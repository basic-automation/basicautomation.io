---
title: "Cross-cutting — notes"
summary: "The prose, findings and finished-work write-ups behind this section of the roadmap checklist."
order: 10
group: Roadmap notes
---

# Cross-cutting — notes

*The checklist for this section is in the [roadmap](https://github.com/basic-automation/Skidbladnir/blob/master/ROADMAP.md). What follows is the writing that used to sit between its items; a ✓ marks an item that was done when it moved here.*

## ✓ **The gpui window is the default**

(1.3.0, PR #67, an owner-requested session rather than a routine run): `crates/skidbladnir-gpui`, opened by `src-tauri` through the default `gpui` feature, with the Nuxt webview kept as a fallback (`SKIDBLADNIR_UI=webview`, or automatically when gpui cannot open a window). Every UI change goes into both. <https://github.com/basic-automation/Skidbladnir/pull/67>

## ✓ Something automated opens the gpui window (2026-10-02)

`scripts/gpui-smoke.sh` launches it with its debug variables (`SKID_FORMAT`, `SKID_INPUTS`, `SKID_CONVERT`) and a scratch configuration, has it convert a PNG to WebP, AVIF, JPEG XL and HEIC and a raw `.yuv` at the size its settings give, and checks each file's header on disk and that the process it started is still the one running (the webview fallback relaunches and exits). 5 of 5 on the dev host (Hyprland); forced onto the webview window, every one fails.

## ✓ `scripts/gpui-smoke.sh` is a CI gate (2026-10-02)

on Linux in the window job, both editions, with Mesa's lavapipe on Xvfb, and on Windows against the installed app (Direct3D, WARP on the GPU-less runner; the script writes the real `%APPDATA%` configuration there, which it allows only under `CI=true`). Both passed 5 of 5 on their first run (37092442114), the first time anything automated opened the gpui window on Windows. macOS is covered by the release workflow, which launches the app and screenshots its window.

## ✓ An accessibility audit of the gpui window (2026-10-03)

`scripts/gpui-a11y-audit.py` reads the window as a screen reader does, AT-SPI on Linux (in a private D-Bus session per state, with its own accessibility bus) and UI Automation on Windows (pywinauto), in ten states: each format with every disclosure open, the preset form, the settings, an open select, a queued file's menu, the preview and About. It fails on nameless controls and images, buttons sharing a name, sliders out of range, required text fields missing or unreadable, and a field that will not take the focus. CI steps in both Linux window legs and the Windows window job. **It found that no text or number field reached a screen reader at all**: gpuikit's input implements none of gpui's accessibility methods, so the role and name set on it were dropped. `Announced` (`controls.rs`) now reports them, with the value as a text run; 15 problems in the 5 first states with the old code. Also two buttons named only "Apply" and a bare "Collapse"/"Expand", renamed in both windows; and Convert, announced as "Convert" whatever was queued and as available when dimmed, is now named as drawn ("Convert 2 files") and marked disabled when it does nothing. A field focused over AT-SPI and typed into with `wtype` reads back what was typed (dev host, Hyprland).

## A person using the gpui window with a screen reader

Orca, Narrator or NVDA, and VoiceOver. The audit above checks what they are given, not how it sounds or flows. macOS is not audited at all (AccessKit's NSAccessibility tree; reading it from a CI runner needs an accessibility permission granted to the reader).

## ✓ Dragging files onto the gpui window, on X11 (2026-10-03)

`scripts/gpui-drop-test.py` plays a file manager's side of XDND with python-xlib (offers a PNG as `text/uri-list`, answers the window's selection request, drops), then presses Convert through AT-SPI and checks the WebP on disk. CI steps in both Linux window legs (Xvfb); passes here through XWayland, and fails with the drop left out.

## ✓ Keyboard reach of the gpui window (2026-10-03)

`scripts/gpui-keyboard-test.py` tabs through each format's panel (every disclosure open), reading the focus from AT-SPI, and fails on a control or radio group Tab never reaches, a trap, a nameless focus, or a Shift+Tab cycle that is not Tab's reversed. Clean in all four panels here; taking Lossless out of the tab order fails it. CI steps in both Linux window legs. In the WebP panel it also presses the keys inside controls (the arrows, Page Up, Home and End on a slider; the arrows in a radio group; Space on a check box); reversing the slider's arrows fails it; and a select (Down opens it on the current choice, Down and Enter choose, Escape closes). And the queue's menu (2026-10-04): Enter on Queue opens it on its first item, Down/Up/Home/End move the highlight, Space ticks "Include subfolders" and leaves it open, Escape closes it with the focus on Queue. Space is pressed only once the check item is highlighted, since the other two open file dialogs. Swapping Up and Down in the app fails 6 of those checks; the menu is highlight-only, so the focus never leaves Queue and the Escape check guards only against losing it. Since 2026-10-04 the test reads the focus once it has moved and held still, not at a fixed pause after the key: master's run 37180306916 lost a Tab stop ("Tab never reaches 'App settings'"), which a read before the focus moved would explain (not reproduced, so not proven).

## ✓ **A select's value did not reach AT-SPI**

(found and fixed 2026-10-03 by the keyboard test): the trigger is a `ComboBox` with `aria_value`, but AccessKit 0.18.1 gives a combo box no Text interface (`supports_text_ranges` covers text inputs, labels and documents only), and the open list is a pop-up elsewhere in the tree, so a screen reader could say "libwebp preset, combo box" but not "photo". Each select now carries its choice as a selected option of its own (`chosen_option` in `controls.rs`), as a browser exposes a `<select>`; AT-SPI's Selection reports it. The audit checks every select says what it holds; without the option, 9 of its 10 states fail. On Windows the audit reads UI Automation's Value (or selected item) for the same check (since 2026-10-04; passes in CI run 37253214479).

## ✓ A real drop onto the gpui window on Windows (2026-10-04)

`scripts/gpui-drop-test.py` opens Explorer on a folder holding a PNG, presses the mouse on the file, moves onto the window and lets go (OLE drag and drop from the real file manager), then invokes "Convert 1 file" through UI Automation and checks the WebP on disk. A step in the Windows window job; passed on its first run (CI run 37255781900) and since.

## A drop onto the gpui window on Wayland (a native Wayland drag source) is still untested

a Wayland drag needs a real pointer press's serial, which a script cannot fake the way it plays XDND on X11.

## AccessKit's AT-SPI mapping reports every button enabled

accesskit_atspi_common 0.18.1 (`node.rs`) adds `Enabled | Sensitive` unless the role is one of those `is_read_only_supported` lists (text inputs, check boxes, sliders and the like), so a disabled Convert is announced as available on Linux. The window marks it disabled (UI Automation passes that on); report upstream, and take the fix when AccessKit has one.

## The gpui window on macOS and Windows has not been opened by a person (CI builds and tests it; the Windows installer smoke runs the webview window)

## ✓ CI opens the gpui window on macOS (2026-10-04)

the macOS rust job runs `scripts/gpui-smoke.sh` against its debug build, converting a PNG to every format and a raw YUV file (5 of 5 in CI run 37258119163). Before, only `release.yml`'s launch screenshot had shown it there.

## The gpui window's macOS accessibility tree, read by the audit (`AxReader`, 2026-10-04; a reported-only CI step)

The hosted runner's reader is trusted for accessibility. CI run 37258119163 read all 10 states: every control named, every select's value and slider range given, Convert disabled with nothing queued. The one problem in each was a text field that, asked to take the focus (`AXFocused`), did not report it. Bringing the app to the front first (`AXFrontmost`, `AXMain`) did not change that (run 37259957909). AccessKit's adapter does pass the request on (`accesskit_macos` 0.26.3 `setAccessibilityFocused:` → `Action::Focus`), but reports a node focused only while the host view has focus, which gpui gives it only while the window is key (`gpui-macos` 1.17.2 `window.rs`, `update_view_focus_state(is_active)`); a bare binary started from CI is not the active app. But activating it (`NSRunningApplication.activateWithOptions_`) worked (run 37261752235: active, `AXFrontmost` and `AXMain` true) and still no field reported the focus, so that is not it either. The reader now prints the AXError the request returns and whether `AXFocused` is settable, to tell a refused request from one taken and never reported. Make the step required once it is clean.

## **On CI's Xvfb, some private AT-SPI sessions never get the window's controls**

: the audit's and keyboard test's single retry absorbs it (every run of 2026-10-04, mostly the GPL leg; once on master, run 37180306916). The diagnosis printed since then (CI run 37258119163) shows the app registered on the AT-SPI desktop with its window as its one child, but nothing inside the window for 90 seconds, so it is AccessKit's tree for the window that does not arrive, not the app's connection. A registry started 3 seconds late does not reproduce it on the dev host. The likely mechanism, read from `gpui-unofficial` 1.17.2 `window.rs` (not proven): on activation gpui hands AccessKit a tree of the window alone and asks for a frame to send the real one, but a frame sends the tree only if accessibility was active from its start, so an activation that lands mid-frame leaves the window empty until something draws again, which in a window nobody touches is never. Since 2026-10-04 the audit (and the keyboard test, through it) resizes the window by a pixel and back when it is listed but empty for 5 seconds, and says so in the log. Its first occurrence in CI (run 37261752235, GPL leg) was recovered by it at once, the state passing with no retry: one case, in keeping with the mechanism, not proof of it. A person's first key or pointer move would draw the frame, so it matters little outside tests, but it is gpui's to fix: report it upstream once confirmed.

## ✓ The saving percentage is computed **once**, in Rust

`savingOf()` is gone from `pages/index.vue`; the conversion report and the preview both carry the core's `saving_percent`, and the window only formats it (commit 235dbc0 — this box was left unticked when it landed).

## ✓ Every new Rust dependency goes in `[workspace.dependencies]`, consumed with `{ workspace = true }`

Holds for all of them: `base64`, `image`, `libwebp-sys`, `serde`, `serde_json`, `skidbladnir-encode`, `tauri`, `tauri-build`, `tauri-plugin-dialog`, `thiserror`. A standing rule, not a one-off task — re-check it whenever a dependency is added.

## ✓ Keep dependencies current every run

both `cargo update` and the frontend's lockfile. Done this run: `cargo update` found nothing to move (already at the highest compatible versions) and `npm update` refreshed the frontend lockfile. `vue-router` 5.x is available and deliberately **not** taken: Nuxt 4 is on vue-router 4, so forcing the major would break the framework, not modernise it.

## ✓ `cargo deny` (advisories + licences + bans + sources), as `deny.toml` and its own CI job

All four checks pass. Two things it found on its first run:
- **A wildcard dependency of our own making.** `skidbladnir-encode` was declared as a
  bare `{ path = ... }`, which resolves as `*`. Now carries `version = "0.1"`.
- Six **unmaintained** advisories reaching the tree transitively through Tauri —
  `proc-macro-error` (RUSTSEC-2024-0370) and five `unic-*` crates
  (RUSTSEC-2025-0075/0080/0081/0098/0100), each reporting "No safe upgrade is
  available". These are unmaintained notices, not vulnerabilities. `unmaintained` is
  therefore scoped to `workspace`, so an unmaintained crate *we* chose still fails
  while Tauri's transitive tree does not produce an ignore-list that never shrinks.
  Vulnerabilities and yanked crates still fail unconditionally.
The graph is checked against the Windows and macOS target triples as well as Linux,
so a Windows-only crate's licence or advisory is not invisible from this host.

## ✓ The README screenshot is the Tauri app

committed in-tree at `resources/images/screenshot.webp` rather than hot-linked from `basicautomation.io`, so it cannot rot independently of the code Captured from the running release binary over the WebDriver harness and encoded by `cwebp` at the app's own default settings — 91 KB for 1892x1720.

## ✓ Re-captured for 0.6.0 (Format selector, AVIF panel, Preview panel), and the capture is now **genuinely scripted**

`scripts/screenshot.sh` runs in CI's window job and uploads the PNGs as the `screenshots` artifact. It has to be CI — on the dev host WebKitWebDriver's screenshot endpoint hangs under XWayland. The README images are those PNGs cropped to their content and encoded by the reference `cwebp` at the app's defaults. The preview is shot in WebP because CI's WebKitGTK cannot show AVIF.

## Re-capture whenever the UI changes materially

download the `screenshots` artifact from the change's CI run, crop, encode. Cheap; the risk is forgetting.

## ✓ Dependabot now has an in-tree config (`.github/dependabot.yml`) covering cargo

the Nuxt frontend's npm tree, the Electron app's npm tree and github-actions, with the Tauri and Nuxt crates/packages grouped so they update together instead of opening mutually-conflicting PRs Its PRs are gated by CI, which now exists.

## ✓ Notices for the window's font (Fira Code

OFL-1.1) and its eleven Iconify icon collections (CC BY 4.0 attribution for Codicons, IconaMoon and Subway; the MIT, ISC, Apache-2.0 and OFL texts for the rest), and libpng's licence (`png_gamma.rs`), in both editions' notices (2026-10-01) Texts the packages lack are in `LICENSES/third-party/` with their sources; the generator refuses to run if `frontend/package.json`'s icon collections differ from the ones it describes.

## ✓ Notices for the Rust crates (2026-10-02)

`cargo-about` 0.9.2 (`about.toml`, `about.hbs`) lists the 700-odd crates compiled into the app on any of the five platforms it is built for (no build or dev dependencies, not Skidbladnir's own), grouped by licence text, into `LICENSES/third-party/rust-crates.md`, which `third-party-notices.py` appends to both editions' notices. CI's `deny` job installs the same cargo-about and fails if the listing is stale. MIT is preferred where a crate offers a choice: Apache-2.0 first came out larger (918 KB against 550 KB), because crates' copies of the Apache text differ in their whitespace.

## ✓ Notices for the JavaScript packages in the webview window's bundle (2026-10-02)

a Vite plugin (`frontend/tools/javascript-notices.ts`, active only when `SKIDBLADNIR_JS_NOTICES` names a file) lists every npm package with a module that kept code in the client bundle after tree-shaking — 35 packages (Vue, Nuxt, Nuxt UI, Reka UI, Floating UI, VueUse, the Tauri API…), every one with a licence file — grouped by licence text into `LICENSES/third-party/javascript.md`, appended to both editions' notices. CI's Linux rust leg rebuilds it and fails if it is stale. A clean rebuild is byte-identical.

## ✓ Notices for the Ubuntu libraries inside the AppImage (2026-10-02)

linuxdeploy copies most bundled packages' Debian copyright files into the image (`usr/share/doc/<package>/copyright`), **but not all**: the new check found 10 of the 110 packages behind its 172 libraries without theirs, on every Linux leg and edition — dconf-gsettings-backend, glib-networking, libbz2-1.0, libcap2, libdbus-1-3 and others the GTK plugin pulls in — so every AppImage to date shipped those libraries without their licences. `scripts/appimage-notices.py` maps each bundled library to its runtime package (`dpkg -S`, through symlinks), release.yml bundles the AppImage again with the missing files (`tauri bundle --bundles appimage --config <fragment>`, re-signed), and the check fails the release if any are still missing. Both editions' notices say where the files are and that the sources are Ubuntu 22.04's (jammy). Release dry run 37092442062: 110 of 110 on all four Linux legs, installs and updater manifests green.

## Dependabot's cargo and npm PRs now fail CI's notices checks until someone regenerates `LICENSES/third-party/rust-crates.md` or `javascript.md`

and the notices, on the PR branch (that check is the point: a new package's licence must reach the notices) A workflow that regenerates and pushes them for Dependabot's branches would save the manual step; it needs a token that can push to them, so it is a security decision.

## Two Dependabot alerts with no clean fix (2026-10-01)

`glib` 0.18 (unsound `VariantStrIter`, fixed in 0.20) comes with Tauri 2's GTK 3 bindings, and `esbuild` 0.27 (a Windows dev-server file read, fixed in 0.28.1) is pinned `^0.27` by `fontless` under `@nuxt/fonts`. Neither is in what ships; take each fix when its parent allows it. Re-checked 2026-10-02: both still open (`glib` 0.18.5 in `Cargo.lock`; `fontless` 1.2.1 is the newest). A third, alert #45, high: `node-forge` 1.4.0 (RSA PKCS#1 v1.5 signatures accepting extra nested `DigestAlgorithm` elements, CVE-2026-85393, no fixed release) comes through `nuxt` → `@nuxt/cli` → `listhen`, the dev server's certificate helper, in development scope only; the bundle listing (`LICENSES/third-party/javascript.md`) confirms it is not in what ships. Take a fix when `listhen` or `node-forge` has one. <https://github.com/advisories/GHSA-86w9-cpqp-85rv> Re-checked 2026-10-04: the same three open (#43 `glib`, #44 `esbuild`, #45 `node-forge`, no patched version); `glib` 0.18.5, `fontless` 1.2.1, `listhen` 1.10.1, `node-forge` 1.4.0 are still what resolves.

## ✓ README

an acknowledgements and non-affiliation section (2026-10-01).

## ✓ README: a dated "How it compares" table (2026-10-01)

Squoosh, XnConvert, Converseen and the raw CLIs, each from its own page (<https://github.com/GoogleChromeLabs/squoosh>, its `codecs/` directory, <https://www.xnview.com/en/xnconvert/>, <https://converseen.fasterland.net/>), "not stated" wherever a page does not say. Re-check it when it is more than a few months old.

## README: a short demo clip
