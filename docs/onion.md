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

- **Slice 2 — the onion binding.** Replace the `TcpListener` block in `main.rs`
  with `OnionService::builder().router(app).nickname("basicautomation").serve()`.
  One block, but it brings its own questions:
  - **Does Tor bootstrap from the DeepStack network at all?** Unknown, and it
    is the real risk. `arti` is embedded, so there is no `tor` daemon to
    configure, but the container needs outbound access that nothing else in the
    stack currently needs. This has to be answered before anything is deployed.
  - **Keystore persistence.** The onion address is stable only if the keystore
    is; that means a named volume, and the address is then a secret-ish thing
    that leaks by being in a backup.
  - **Absolute URLs.** The site renders canonical links, `og:url` and JSON-LD
    from `runtimeConfig.public.siteUrl`, so an onion visitor is served HTML
    pointing at `https://basicautomation.io/`. Decide whether that is right —
    it is the same site, and cross-linking the clearnet name from an onion page
    is a real privacy question, not a formatting one — before slice 3.

- **Slice 3 — deploy.** A compose service on the DeepStack network, the
  keystore volume, and an `Onion-Location` header on the clearnet site so Tor
  Browser offers the onion address. Not before slice 2 answers the bootstrap
  question.

## Building it

```sh
cd onion
cargo test
cargo run          # proxies http://basicautomation-site:3000 on 127.0.0.1:3080
ONION_UPSTREAM=http://127.0.0.1:3000 cargo run
```

On the DeepThought workstation a global `~/.cargo/config.toml` sets
`build.rustflags = ["-Z", "threads=8"]`, which is nightly-only. The crate pins
stable, cargo merges `rustflags` across config files rather than overriding
them, and the two cannot coexist — every command fails with E0554 until the
environment clears it:

```sh
RUSTFLAGS="" cargo test
```
