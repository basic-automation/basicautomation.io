---
title: "Phase 0 — Foundations (make the repo routine-ready) — notes"
summary: "The prose, findings and finished-work write-ups behind this section of the roadmap checklist."
order: 2
group: Roadmap notes
---

# Phase 0 — Foundations (make the repo routine-ready) — notes

*The checklist for this section is in the [roadmap](https://github.com/basic-automation/Skidbladnir/blob/master/ROADMAP.md). What follows is the writing that used to sit between its items; a ✓ marks an item that was done when it moved here.*

## ✓ Add `ROADMAP.md` as the phase-ordered checkbox work queue (this file)

## ✓ Rewrite `README.md` as the consumer-facing home (about + shipped features only)

## ✓ Add `/scratch` to `.gitignore` for routine transient output

## ✓ Remove `yarn.lock` / `package-lock.json` from `.gitignore`

a lockfile-less JS project cannot have reproducible builds, and the Tauri frontend will need one committed.

## ✓ Add a CI workflow (`.github/workflows/ci.yml`)

fmt, clippy `-D warnings`, build and test the Rust workspace on `ubuntu-latest`, `windows-latest`, `macos-latest`, on stable Rust, with `fail-fast: false` so a Windows- or macOS-only break is not hidden. It installs the Linux Tauri system dependencies and a reference `cwebp` (apt on Linux, brew on macOS) ahead of the phases that need them.

## ✓ Build the frontend in `ci.yml`

It turned out not to be an optional extra job: `tauri::generate_context!` embeds `frontendDist` at **compile** time, so without `npm ci && npm run generate` ahead of it the Rust build fails outright with "the `frontendDist` configuration is set to ... but this path doesn't exist".

## ✓ Cache the Nuxt build in CI as well as npm's download cache

`node_modules/.cache` (where Nuxt 4 keeps its build cache) is keyed on the lockfile plus the frontend sources, so an unchanged frontend is not regenerated on all three runners.

## ✓ Add `rustfmt.toml` and a clippy configuration matching the owner's other Rust repos (hard tabs, `-D warnings` in CI)

`rustfmt.toml` copies `DSP/rustfmt.toml` verbatim (hard tabs, `tab_spaces = 8`, `max_width = 10000`, horizontal imports, `StdExternalCrate` grouping). Clippy is configured as `[workspace.lints.clippy]` with `all` and `pedantic` at warn, consumed by members via `lints.workspace = true`. `clippy::nursery` is deliberately excluded — its lints move between toolchains and the dev host (nightly) and CI (stable) would disagree. **Formatting is checked by a separate CI job on nightly rustfmt.** `imports_layout`, `imports_granularity` and `group_imports` are still nightly-gated; stable rustfmt does not reject them, it silently ignores them and formats differently, so a stable `cargo fmt --check` fails against a nightly-formatted tree. Do not "fix" that by deleting the options — everything that *compiles* stays on stable, and only rustfmt runs on nightly.

## ✓ Decide and record the app's product identity

**The answer:** the product is **Skidbladnir** — the repo name, the name every released tag carries, and the only one of the four candidates a user has ever seen. Concretely:
- Product / window title / release name: **Skidbladnir**
- `appId` (Tauri + electron-builder): **`com.basicautomation.skidbladnir`**
- Binary, crate and Nuxt package name: **`skidbladnir`**
- Rejected: `ba-nextgenimg` (an internal slug), `skidblad` (a truncation from the
  dead 2021 branch), `ba | Next Generation Image` (a description, not a name).
The Electron `package.json` keeps `name: ba-nextgenimg` and `appId: ba.nextgenimg`
until Phase 6 retires it — renaming it now would change the electron-builder output
path that the shipped v0.4.3 artifact uses, for an app that is being deleted anyway.

## ✓ Triage `origin/copilot/add-resize-control-option`

**The answer: there was nothing to land.** PR #31 merged it on 2026-06-04 and `git merge-base --is-ancestor origin/copilot/add-resize-control-option master` confirms the tip is an ancestor of `master` with an empty diff — it is a stale post-merge branch, not unmerged work. Deleted from the remote.

## ✓ Declare `origin/Skidbladnir` (the cold 2021 Vue 3 POC) dead

**It is dead.** `master` is the only codeline. Do not revive that branch, do not port from it, and do not mistake it for the migration target: it is a Vue 3 + Vite proof of concept abandoned in 2021, predating this Tauri 2 + Nuxt decision entirely. It is kept on the remote for archaeology only — the one thing it is good for is prior art on the settings-store shape, and even that must be re-derived against the Electron app's real control surface rather than trusted.
