---
title: "Phase 6 — Retire Electron — notes"
summary: "The prose, findings and finished-work write-ups behind this section of the roadmap checklist."
order: 7
group: Roadmap notes
---

# Phase 6 — Retire Electron — notes

*The checklist for this section is in the [roadmap](https://github.com/basic-automation/Skidbladnir/blob/master/ROADMAP.md). What follows is the writing that used to sit between its items; a ✓ marks an item that was done when it moved here.*

Only once Phase 3 parity is `[x]` and a Tauri release has shipped.

**The Electron app still resolves its dependencies** on Node 26 / npm 11: a dry-run install
adds 267 packages including electron 9.4.4 and electron-builder 20.44.4, with no resolution
failure. Its sources parse (`node --check main.js`, and the single inline `<script>` block
in `index.html`). That is as far as this host can verify it — actually *running* it needs
Windows and a downloaded `cwebp.exe`. So "master still has a working app" holds to the level
that can be checked here, and no further claim is made.

## ✓ **Gate added: do not retire Electron until the Windows build has been launched.**

**Cleared 2026-09-26** — the installed Windows app passes the smoke test in CI. Retiring Electron is now unblocked. **The owner gave the go-ahead on 2026-09-27.** Both stated preconditions now hold (Phase 3 parity is ticked and a Tauri release has shipped), but the Electron app is **Windows-only**, and the Tauri Windows build has been compiled and never opened. Retiring the one Windows app that is known to have run, in favour of one that never has, would risk leaving Windows users with nothing. Clears when the Windows first-launch item in Phase 4 is ticked.

## ✓ Remove `main.js`

`index.html`, `index.css` and the Electron `package.json` (its dependencies went with it — there was no committed lockfile), the three SVGs only `index.html` used, and Dependabot's root npm entry `build/icon.png`, the 2363 px master the Tauri icon set was generated from, moved to `resources/icons/icon.png` rather than being deleted. Nothing in the Cargo workspace referenced any of it, as Phase 1 required, so `cargo build` was unaffected. The product version now lives in `src-tauri/Cargo.toml` alone (`tauri.conf.json` inherits it); the root `package.json` was the second copy.

## ✓ Remove the `resources/win/bin` cwebp-download step from the README

the whole Electron build section went, and the README now describes one app.

## ✓ Pin the Electron line for anyone still on it

**The last Electron *binary* stays v0.4.3 (2019)**; no new Electron build was made, because it could not be verified — running it needs Windows plus a hand-downloaded `cwebp.exe`, and nothing in CI exercises it. Its **last source** is the `electron-final` tag, on the final commit before removal (477dade), which carries the years of unreleased Electron work.
