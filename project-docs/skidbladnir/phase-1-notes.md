---
title: "Phase 1 — Tauri 2 + Nuxt + Tailwind scaffold — notes"
summary: "The prose, findings and finished-work write-ups behind this section of the roadmap checklist."
order: 3
group: Roadmap notes
---

# Phase 1 — Tauri 2 + Nuxt + Tailwind scaffold — notes

*The checklist for this section is in the [roadmap](https://github.com/basic-automation/Skidbladnir/blob/master/ROADMAP.md). What follows is the writing that used to sit between its items; a ✓ marks an item that was done when it moved here.*

The new app lands **alongside** the Electron app, not on top of it. `master` keeps
building and running the Electron app until Phase 6 retires it.

## ✓ Choose the layout

**The answer: exactly that.** A Cargo workspace at the repo root, with:
- `crates/*` — pure-Rust logic with **no Tauri dependency**, so the encode core is
  testable from plain `cargo test` with no window, no IPC and no frontend. First
  member: `crates/skidbladnir-encode`.
- `src-tauri/` — the Tauri 2 application shell, a thin IPC layer over `crates/*`.
- `frontend/` — the Nuxt + Tailwind frontend.
The Electron files stay at the repo root until Phase 6. Nothing in the workspace
may reference them, so deleting them cannot break `cargo build`.

## ✓ `cargo install tauri-cli` on the dev host

**installed, version 2.11.5**. It does **not** build on the dev host's default nightly: every tauri-cli 2.x dependency tree resolves a `rustix` below 1.0 (`0.37.28` under `--locked`, `0.38.43` unlocked), and those use `rustc_attrs`, which rustc 1.100.0-nightly rejects with "attributes starting with `rustc` are reserved". Install it on **stable** with the global nightly-only rustflags cleared: `RUSTFLAGS= cargo +stable install tauri-cli --locked --version '^2'`. This is a host/toolchain quirk, not an in-tree nightly dependency — the workspace itself must keep building on stable.

## ✓ Scaffold the Tauri 2 app

`src-tauri/` with `tauri.conf.json`, the appId `com.basicautomation.skidbladnir`, a 1000x780 window, a minimal capability set, and a generated icon set. The shipped `build/icon.png` is 2363x2364, one pixel off square, which `cargo tauri icon` rejects; it was cropped to 2363x2363 with `cwebp -crop` + `dwebp` in the run's scratch dir. The mobile (android/ios) icon sets `cargo tauri icon` also emits were deleted — this is a desktop-only product. `tauri.conf.json` deliberately omits `version` so it inherits from `src-tauri/Cargo.toml` and there is no third copy of the version to drift.

## ✓ Scaffold the Nuxt frontend in `frontend/`

Nuxt 4 + Tailwind 4 via `@tailwindcss/vite`, `ssr: false`, the static Nitro preset, output in `.output/public`. `package-lock.json` is committed.

## ✓ Wire `beforeDevCommand` / `beforeBuildCommand` / `frontendDist`

Two traps worth recording, both found by running the app rather than reading the config:
- The before-commands run from the **repo root**, not from `src-tauri/`, so they are
  `npm --prefix frontend run ...`. With `../frontend` they resolve outside the repo.
- The `custom-protocol` Cargo feature is what makes a binary serve the embedded
  frontend. Without it — and a bare `cargo build --release` does not set it — the
  release binary still points at `devUrl` and opens showing
  "Could not connect to 127.0.0.1: Connection refused". **Release builds must go
  through `cargo tauri build`**, which enables the feature.

## ✓ First green `cargo tauri build` on Linux producing a runnable binary

`cargo tauri build --no-bundle` produces a 12 MB `skidbladnir`. Driven over WebDriver with no dev server running, it loads `tauri://localhost/`, renders the Nuxt shell, and its IPC commands return live data from the Rust core. `--no-bundle` because the AppImage target needs `patchelf`, which the dev host lacked. Installers and the AppImage have since been built by `release.yml` in CI, where `patchelf` is an apt package (Phase 4).

## ✓ First green dev window that renders the Nuxt shell

verified over WebDriver against the Nuxt dev server on 127.0.0.1:1420: `document.title` is "Skidbladnir", the shell renders, and `encoder_version` / `default_settings` return real values. The dev host's shared WebDriver harness drives this app correctly; its first green run against Skidbladnir is this one.

## ✓ (owner-gated) `patchelf` on the dev host for AppImage bundling

*Superseded:* CI builds the AppImage (`release.yml` installs `patchelf` from apt), and the published AppImage is what gets checked, so the dev host does not need it.

## ✓ Tighten the CSP

Everything except inline script is now locked down: `default-src 'self'`, `img-src 'self' data:` (the preview's two images and nothing else), `font-src 'self'` (the Inter webfont is bundled, not fetched), `connect-src 'self' ipc: http://ipc.localhost` — the app talks to Rust over the IPC bridge and should never open a socket — plus `object-src`, `frame-src`, `frame-ancestors` and `form-action` all `'none'`, and `base-uri 'self'`.

## ✓ Remove `script-src 'unsafe-inline'`

**It turned out not to need the build-time hashing this item described.** Tauri rewrites the CSP it delivers to cover the inline scripts it serves from the bundle, so `script-src 'self'` is enough on its own and naming Nuxt's three inline scripts by hash is unnecessary machinery. A hash-injecting build script was written, and then deleted once measurement showed it was redundant. **Enforcement was verified, not assumed** — in the running window an injected inline `<script>` does not execute and `fetch("https://example.com/")` is blocked.

## ✓ Run `scripts/smoke-test.sh` in CI

the `window smoke + accessibility` job, under `xvfb-run` with the `webkit2gtk-driver` package and `tauri-driver`. Note `execute/sync`, not `execute/async`: the async endpoint waits for a completion callback, so a script that simply returns hangs until the driver times out (this cost a debugging round already).

## ✓ Run the smoke test on the **Windows** runner too

the `window smoke (windows)` job. `tauri-driver` drives Windows through Microsoft's `msedgedriver`, fetched by the pinned `msedgedriver-tool` to match the installed WebView2. Four traps, each found by a failing run rather than by reading:
- Git Bash paths (`/d/a/...`) reach native Windows programs unreadable; the harness
  converts with `cygpath`.
- On the `windows-2025` image WebView2 never opens its DevTools port ("DevToolsActivePort
  file doesn't exist"); the job is pinned to `windows-2022`, per
  <https://github.com/actions/runner-images/issues/14738>.
- Git Bash rewrites the installer's `/S` into a drive path, turning a silent install
  into one waiting for a click; `MSYS_NO_PATHCONV=1`, plus a 45-minute job ceiling.
- Windows serves the bundled frontend from `http://tauri.localhost`, not
  `tauri://localhost`.
tauri-driver has no macOS support, so the macOS build still cannot be launched this way.
