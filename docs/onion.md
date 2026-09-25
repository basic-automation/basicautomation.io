# Serving the site as an onion service

Roadmap Phase 4: *"Serve the site as a Tor onion service too, via `onyums` —
the org's own crate, on the org's own site."*

This is the working note for that item. It is here rather than in the roadmap
because the roadmap is a task list and this is the reason the tasks are shaped
the way they are.

## The problem the item runs into

`onyums` serves an axum `Router`. Its own README is explicit about what it is
not:

> **What this is not:** a host provisioning / configuration-management tool, a
> reverse proxy for existing servers, or a SOCKS client. If you want to front an
> already-running service, that is a planned CLI, not the library.

and its comparison table says to reach for `tor-hsrproxy` "to front an existing
local service with no app code".

This site is an already-running Nitro server. Taken literally, the roadmap item
asks `onyums` to do the one thing it says it does not do.

## Three ways round it, and the one chosen

**1. `route_port` raw TCP.** `onyums` can tunnel raw TCP to a local backend with
`.route_port(port, RawTcpHandler::new("basicautomation-site:3000"))`. This
works, and it is a supported path — but raw ports are by construction *not* 80
or 443 (those go to the TLS HTTP handler), so the address would be
`http://<addr>.onion:9000/`, which nobody types. Raw ports also get neither TLS
nor the Skin abuse gate, both of which are the reason to use `onyums` at all.

**2. An axum `Router` that forwards.** Hand `onyums` a `Router` whose fallback
proxies to `http://basicautomation-site:3000`. The onion service gets 443 and
80, `onyums`' TLS inside the circuit, and Skin in front. The "not a reverse
proxy" caveat is about what the crate ships, not about what your own `Router`
may do — `onyums` serves a `Router`, and what that `Router` does is the
application's business.

**3. Port the site to Rust.** No.

**Chosen: 2.** It is the only one that puts the site on the address a visitor
would actually be given, with the crate's own defences in front of it.

## Slices

- **Slice 1 — the proxy. Landed.** `onion/` is a small Rust crate whose
  `proxy::router()` forwards every request to the running site: hop-by-hop
  headers stripped, bodies streamed rather than buffered, status and end-to-end
  headers passed through, `502` rather than `500` when the site is not
  answering, and `x-forwarded-for` deliberately *removed* — a visitor over an
  onion service has no address, and inventing one would put a meaningless value
  in the site's request log.

  `main.rs` binds it to a plain TCP port for now, which is how it is tested
  without a Tor circuit in the way. Verified against the real built server:
  `npm run check` green through the proxy across all 8 pages and 43 urls, every
  response header identical (case-insensitively — the proxy emits HTTP/2-style
  lowercase names, which RFC 9110 makes equivalent), and bodies byte-identical
  by SHA-256 including the PNG cards and the woff2.

- **Slice 2 — the onion binding. Landed.** The `TcpListener` block in `main.rs`
  is now `OnionService::builder().router(app).nickname(...).serve()`. The three
  questions it raised, answered:

  - **Does Tor bootstrap from the DeepStack network at all?** Yes, and it was
    never a network question. Tested from the host and from inside a container
    on `caddy-shared-network`: identical egress, and `arti` fetched a consensus,
    fetched microdescriptors, built circuits, launched a service and published a
    descriptor in about six seconds cold. No `tor` daemon, no ports to open —
    `arti` dials out, so there is nothing inbound to map.

    The one thing that *did* fail was `fs-mistrust`, which walks the whole
    ancestor chain of the state directory and refused because `/mnt/deepmem` is
    `0777` on this workstation. That is a host-layout problem, not a Tor one,
    and it does not exist in the container, where the chain is `/` → `/app` →
    `/app/tor`. **Do not "fix" a future instance of this with
    `ARTI_FS_DISABLE_PERMISSION_CHECKS=1`** — it was used once, locally, to get
    past the bootstrap test, and it turns off a real check on the directory
    holding the identity key. Fix the directory.

  - **Keystore persistence.** A named volume, `basicautomation-onion`, mounted
    at `/app/tor`. Named rather than bound into `${DOCKER_ROOT}` for a
    permissions reason as much as a lifecycle one: the image creates `/app/tor`
    at `0700` owned by the container's unprivileged user and Docker seeds the
    volume from that, whereas a bind mount arrives root-owned `0755` and fails
    the check above. The volume *is* the address — the `.onion` name is derived
    from the key inside it, so losing it does not restart the site, it replaces
    it with a different one that nothing links to. Worth saying plainly in the
    backup story.

  - **Absolute URLs.** Resolved in favour of answering in whatever name the
    request arrived under. `server/middleware/site-origin.ts` makes that call
    once per request; `siteOrigin(event)` and its client twin `useSiteOrigin()`
    are the accessors. `og:url`, the `SoftwareSourceCode` JSON-LD,
    `sitemap.xml`, `robots.txt` and the releases feed all go through them.

    Two things about it are less obvious than they look, and both were caught by
    fetching the onion service over Tor rather than by reading the code:

    **The proxy has to put the name back.** `Host` is hop-by-hop and the proxy
    drops it — correctly, it describes the connection being made, which is to
    loopback. But dropping it leaves the site seeing `127.0.0.1:3000` and no
    trace of the onion name, so the first version of this change did nothing at
    all: the page still said `basicautomation.io` everywhere. The proxy now sets
    `x-forwarded-host`, from the HTTP/1.1 `Host` header or the HTTP/2
    `:authority`, whichever the visitor's client used.

    **A forwarded header is not evidence.** Anyone can send `X-Forwarded-Host:
    whatever.onion` to the clearnet site. The middleware therefore does not
    parse the header as a name — it compares it against the address the gateway
    actually published, read from `/run/onion/address`, which no visitor can
    influence. Shape-checking it (`looks like a v3 onion`) would have stopped it
    being a redirect but would still have let a visitor choose the address this
    site prints as its own. Everything that is not our own address falls back to
    the configured domain, including the reverse proxy and the loopback
    healthcheck, neither of which is a name the public site has.

- **Slice 3 — deploy. Landed, in one container rather than two.** The gateway
  ships in the site's own image and `docker-entrypoint.sh` runs the two
  processes side by side. Two containers would have made a loopback proxy hop
  into a network hop and the address file into a shared volume, for nothing:
  the gateway is a front for this exact site and has no life without it.

  `Onion-Location` on the clearnet site is **not** done. It is the standard way
  Tor Browser offers an onion address, but it changes what every clearnet
  visitor using Tor Browser is shown, which is a bigger decision than the page
  copy that advertises the address today.

## Building it

```sh
cd onion
cargo test
ONION_UPSTREAM=http://127.0.0.1:3000 cargo run
```

`cargo run` now launches a real onion service against a real keystore under
`./tor/onyums`, so it takes an identity and a few seconds to bootstrap. Use a
throwaway `ONION_NICKNAME` when testing; the nickname names the key, so reusing
`basicautomation` locally means signing the production address from a laptop.

The proxy half is still testable with no Tor in the way — `cargo test` covers
it directly, which is why it lives in its own module.

On the DeepThought workstation a global `~/.cargo/config.toml` sets
`build.rustflags = ["-Z", "threads=8"]`, which is nightly-only. The crate pins
stable, cargo merges `rustflags` across config files rather than overriding
them, and the two cannot coexist — every command fails with E0554 until the
environment clears it:

```sh
RUSTFLAGS="" cargo test
```
