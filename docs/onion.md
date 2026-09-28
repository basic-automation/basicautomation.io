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
  ships in the site's own image and runs beside the site. (Originally
  `docker-entrypoint.sh` ran the two processes side by side; since 2026-09-27
  the site starts the gateway itself, from `server/plugins/onion-gateway.ts`,
  so the image needs no shell.) Two containers would have made a loopback proxy hop
  into a network hop and the address file into a shared volume, for nothing:
  the gateway is a front for this exact site and has no life without it.

- **Slice 4 — show it working.** The page now carries a browser frame with the
  site in it, fetched by this server through a real rendezvous circuit to its own
  `.onion` address every ten minutes, with the measurement underneath — status,
  bytes, seconds, and when it last succeeded. A claim on a page about an onion
  service is worth less than the thing running.

  Three decisions in it are worth keeping:

  **It is not `artiqwest`, and it should have been.** artiqwest is this org's own
  "HTTP over Tor" crate and this is precisely its job. It cannot be used here:
  artiqwest 0.4.1 pins `arti-client 0.43` and `tokio-native-tls`, while onyums 0.5
  is on `arti-client 0.46` and went deliberately C-free with rustls. Taking both
  means two complete, semver-incompatible copies of arti in one binary — two
  bootstraps, two consensus downloads, two sets of circuits — plus OpenSSL back in
  a static musl build that does not currently need it. `artiqwest::get` also wants
  an `Arc<TorClient<PreferredRuntime>>` from *its* arti, so the bootstrapped client
  we already hold could not be passed to it regardless.

  So `snapshot.rs` does what artiqwest does, over the same arti onyums already
  links. The Tor-specific part is confined to `fetch_once` so that bumping
  artiqwest onto a shared arti makes swapping it in a one-function change.
  **That bump is the real fix** and it is an artiqwest issue, not a site one.

  **It needs a second Tor client, and the first version was wrong about that.**
  The obvious implementation reuses `OnionServiceHandle::tor_client()` — already
  bootstrapped, already hosting the service — and it does not work: a client
  cannot reliably rendezvous with a service it is itself hosting. It appeared to
  work twice, which is the worst way for something to be broken. Measured on the
  deployed container: an external probe got 200 in 4.8s while the container's own
  attempts failed with `Failed to obtain hidden service circuit`, twice, ten
  minutes apart. onyums' own live test bootstraps a second client for exactly this
  reason, and its comment is the only place that says so.

  Two details of that second client are not guessable. It needs its own state
  directory, and it needs `allow_onion_addrs(true)` — arti's address filter
  refuses `.onion` by default, and a client built without it fails on the connect
  with an error that never mentions the filter.

  This does weaken the count in the artiqwest argument above: two bootstraps
  happen either way. What taking artiqwest would have added is a second *copy of
  arti* and OpenSSL with it, which is a different thing from a second instance of
  the one already linked.

  **It lets itself through its own gate.** The service is behind Skin, so fetching
  it returns the proof-of-work challenge, not the site. The gateway mints itself a
  clearance from the gate's own store rather than solving the puzzle. Solving your
  own front door is theatre — the gate is not what the frame demonstrates, the
  circuit is — and a binary carrying a solver for its own challenge is a strange
  thing to own.

  **The frame is inert.** Scripts stripped, `pointer-events: none`, `inert`, and a
  CSP with `script-src 'none'`. Without that it boots a second copy of the whole
  application inside the first, with a second set of backdrop and SVG filters
  compositing every frame. And its links are relative, so following one would
  quietly leave the snapshot and load this origin instead — a lie told by
  accident. `style-src` does allow inline, because the page carries a
  `<style id="nuxt-ui-colors">` block and sets the hero through a `style=`
  attribute; with scripts at `'none'` and everything else `'self'`, inline CSS can
  neither execute nor reach off-origin.

  `/onion-frame` is `Disallow`ed in robots.txt: it is a byte-for-byte copy of the
  home page under a second URL.

  The frame also appears on the **artiqwest** page, with a Tor Browser
  walkthrough beside it on both. artiqwest is the client half of the same story —
  onyums publishes a service on the Tor network, artiqwest is how your own code
  reaches one — so a page fetched over Tor belongs on both. The copy there says
  the fetch was done "using arti, the Tor client artiqwest wraps", because that
  is what happened and the ambiguous version ("reached that way") would have read
  as a claim that artiqwest performed it. When the version pin above is resolved,
  that sentence gets simpler and truer at the same time.

  The walkthrough (`TorBrowserSteps.vue`) is the reader doing it themselves,
  which is the only version that actually settles the question. It includes the
  certificate warning and the proof-of-work interstitial, because those are the
  two steps people stop at when nobody told them they were coming.

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
