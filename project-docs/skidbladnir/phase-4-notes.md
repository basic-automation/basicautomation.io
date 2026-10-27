---
title: "Phase 4 — Beyond parity — notes"
summary: "The prose, findings and finished-work write-ups behind this section of the roadmap checklist."
order: 6
group: Roadmap notes
---

# Phase 4 — Beyond parity — notes

*The checklist for this section is in the [roadmap](https://github.com/basic-automation/Skidbladnir/blob/master/ROADMAP.md). What follows is the writing that used to sit between its items; a ✓ marks an item that was done when it moved here.*

## ✓ Batch conversion with a real queue, per-file status, and cancel

Multi-select, sequential conversion with per-file success/failure rows, live progress, and a Cancel button. Cancellation works by the encode's own progress callback refusing to continue — there is no way to interrupt `WebPEncode` from outside — and a cancelled conversion writes nothing at all, so stopping a batch cannot leave a half-converted image. **This is why `convert_image` is `async` with the encode on a blocking thread:** as a synchronous command it held the event loop, and a cancel issued from the frontend could never be delivered. Measured, not assumed — a 1800x1400 encode ran to completion every time before the change, and cancels after 3 progress events with an empty output directory after it.

## ✓ Preview

original vs encoded, side by side, before committing the write. Encodes into memory and writes nothing. Both sides come back as `data:` URLs rather than file paths, which means the preview needs **no filesystem permission in the webview at all** and cannot show a stale file from an earlier run. The left-hand side is the source pixels encoded *losslessly* rather than the source file re-served, so both sides are WebP the webview can display while the reference image stays pixel-exact — and any resize is applied to both, so the comparison is like for like instead of a big image beside a small one. Refused above 24 megapixels: two base64 copies in the webview is real memory. **Correction (2026-09-26): this was ticked when only the backend existed.** The `preview_encode` command and its tests landed in 343f7c0, but nothing in the window ever called it, so the README's "preview the result" was untrue until the Preview panel was built. It now exists: pick one of the selected files, see both sides with the size, dimensions and the core's saving figure, and a notice when the settings have changed since. `preview_encode` is now `async` too — as a synchronous command an AVIF preview froze the window while it encoded. Verified in the running window, for both formats, by dropping a file through Tauri's own drop event.

## ✓ Persist settings between launches

`src-tauri/src/preferences.rs` stores the last used settings and destination as JSON in the OS's per-app config directory, saved after a conversion run rather than on every slider drag. The loader **never fails** — a preferences file is read at startup and is the one file a user can hand-edit or a crash can half-write, so anything unreadable, unparseable or *invalid for the encoder* falls back to the defaults and reports which, letting the UI say the saved settings were discarded instead of silently losing them. A destination that has since been deleted or unmounted is dropped. Writes are staged and renamed, as the image writer is.

## ✓ Named user presets (save/load an `EncodeSettings`), distinct from libwebp's own `-preset` values

Stored in **one** JSON file keyed by name rather than a file per preset, deliberately: a name typed by the user must never become a path component. There is a test that saves a preset called `../../escaped` and asserts the config directory still contains exactly one file and nothing was written outside it. Names are trimmed, must be non-empty and at most 80 characters; settings the encoder would reject are refused on save and hidden on load; a damaged file reads as empty and is left on disk rather than destroyed.

## ✓ Recursive directory input with an output-structure mirror

"…or a whole folder" scans a directory for images **by content**, and conversions reproduce the source tree in the destination (toggleable — off writes everything side by side). Three bounds, because a folder picker is an invitation to point at a home directory: **symlinks are not followed** (a symlinked directory can point at its own ancestor, which turns a scan into an endless walk, and a symlinked file can point outside the tree the user thought they chose), the walk is depth-bounded at 32, and it stops at 10,000 files. `mirrored_output_path` refuses any relative path containing `..`, an absolute path or a path prefix, so a mirrored write cannot land outside the chosen folder.

## ✓ Keyboard-navigable and screen-reader-labelled controls

Audited in the running window rather than assumed: **all 32 focusable controls now have an accessible name** (3 did not — the preset-name and resize/target number fields, whose labels were sibling spans rather than associated labels). Sliders carry an explicit `aria-label` instead of relying on proximity; the mode, filter and target groups are real `radiogroup`s with `aria-checked`; conversion status and results are `aria-live` regions so progress is announced rather than only drawn; validation failures are `role="alert"`. A `:focus-visible` ring was added because a keyboard-navigable app whose focused control is invisible against a dark palette is not usable.

## ✓ Run a real accessibility audit

`scripts/a11y-audit.sh` injects **axe-core** into the live window and reports violations; the window is now **clean at the `minor` threshold**. It found two things the hand-written name check could not:
- **Colour contrast on 25 nodes.** Palenight's own comment colour `#676e95` is
  2.76:1 against the background, far under WCAG AA's 4.5:1. It is kept for borders
  and the dot texture, and a new `--color-palenight-muted` (`#9099bd`, 4.86:1) now
  carries the same muted role for anything a person reads. The error red was
  4.37:1 — just under — and was lightened to `#ff6b85` (5.00:1).
- **A missing `lang` attribute** on `<html>`.
Six failures survived the first fix and were worth understanding rather than
suppressing: five were the *disabled* filter sliders, where `opacity-40` on the whole
block took their labels to 2.6:1 and their help text to 2.0:1. Dimming now applies to
the slider track alone and the label reads "· not in use", which is both accessible
and clearer. The sixth was the selected mode card, whose tinted background lifts to
`#373d42` where the muted token is 3.92:1; its description uses the brighter token.

## ✓ Speed up the `window` CI job

It now uses the **prebuilt** `@tauri-apps/cli` from the frontend's lockfile instead of `cargo install tauri-cli`: **10m42s → 1m41s** for the whole job on its first run with the change.

## ✓ Use the prebuilt CLI in `release.yml` as well

done, and **tested before a tag**: the workflow gained a `dry_run` dispatch input that builds the dispatching branch and attaches nothing. The dry run built all four installers in 7m44s (the 0.5.0 release took 13m36s).

## ✓ Run `scripts/a11y-audit.sh` in CI alongside the smoke test

same job.

## ✓ **GIF input**

, still and animated — GIF to animated WebP is WebP's classic job, and libwebp ships the reference converter, `gif2webp`. `crates/skidbladnir-encode/src/gif_input.rs` reads a GIF the way `gif2webp` does, rule for rule (transparent canvas, blending, the three disposals, the 10 ms → 100 ms floor, GIF repeats → WebP plays, the background hint), from the `gif` crate's raw indexed frames; the animation encoder takes `gif2webp`'s keyframe spacing (9/17 lossless, 3/5 lossy). Any GIF converts through the animation encoder, as in `gif2webp`; a still GIF bound for AVIF is a still, an animated one is refused by name. **Gate:** `tests/gif.rs` — **49 conversions byte-identical to libwebp 1.6.0's `gif2webp`**: seven fixtures (sub-rectangles, transparency, every disposal, local palettes, interlacing, short delays, each loop form, a still, a 24-frame clip, and a GIF written by ImageMagick) × seven settings. Mutation-tested: skipping dispose-to-previous fails 7, dropping either keyframe spacing fails 3 and 8 — the last needed the 24-frame fixture, since no shorter clip exercised it. Found on the way: the app's default alpha filtering ("best") moved mostly-transparent lossy frames 2 bytes from libwebp's default ("fast"). CI builds `gif2webp` (giflib). Verified in the running window by the smoke test.

## ✓ **Keep metadata**

— ICC profile, EXIF and XMP — in WebP output: `cwebp -metadata`, which the Electron app never exposed, so every conversion silently dropped a photo's colour profile (a Display P3 or Adobe RGB image then shows as sRGB). A job-level `metadata` choice, all off by default so a default job still matches `cwebp` exactly; a "Metadata" panel in the WebP settings. `crates/skidbladnir-encode/src/metadata.rs` reads the metadata the way libwebp 1.6.0's `imageio` does (JPEG `APP1`/`APP2`, the ICC profile reassembled by segment number and refused when inconsistent, as `cwebp` refuses it; PNG `iCCP`, `eXIf`, XMP and `ImageMagick` raw-profile text; TIFF ICC and XMP; WebP `ICCP`/`EXIF`/`XMP `) and writes the container the way `WriteWebPWithMetadata` does. The preview keeps it too, so its size is the size written. **Gate:** `tests/metadata.rs` — 84 conversions (7 fixtures with hand-built metadata, incl. a 140 KB ICC profile in three out-of-order JPEG segments, × lossy/lossless × six `-metadata` choices) against `cwebp -metadata`: all 84 byte-identical whole files (once JPEG and WebP sources decoded as `cwebp` decodes them; below). A JPEG with a missing ICC segment is refused as `cwebp` refuses it. Mutation-tested: unsorted ICC segments, a missing `VP8X` alpha flag, no RIFF padding, `ICCP` after the image and last-EXIF-wins each fail it.

## **The comparison view — the best image comparison there is**

(owner request, 2026-09-28; the model is Upscayl's before/after slider with zoom, taken further). *Waits on its design (slice 13: designed in Figma before it is built); the Figma connector needed re-authorising on 2026-10-01, so no slice was started.* The preview today is two static images side by side at fit-to-width, which cannot show the artefacts the advanced controls exist to trade off. Slices, each landable alone:
1. **A real viewer.** One full-size viewport instead of two thumbnails; 100% means
   one image pixel per *device* pixel (`devicePixelRatio`-aware), and above 100% pixels
   are drawn nearest-neighbour (`image-rendering: pixelated`), never smoothed — a
   smoothed zoom hides exactly the ringing and blocking being judged.
2. **Wipe slider**, Upscayl-style: both images registered pixel for pixel in one
   viewport, a draggable divider between them, horizontal or vertical, keyboard-
   operable (arrow keys step, Shift steps further) and labelled for screen readers.
3. **Synchronised zoom and pan** in every mode: wheel/pinch zooms about the cursor,
   drag pans, presets for Fit, 1:1, 2x, 4x, 8x, 16x, 32x, and the two sides can never
   drift apart. Side by side stays as a mode, with its viewports locked together.
4. **Loupe magnifier**: a lens that follows the cursor at its own magnification
   (independent of the page zoom), split down the middle or showing A and B as twin
   lenses, with an optional pixel grid from 8x and a readout of both pixels' RGBA and
   their difference under the cursor.
5. **Flicker (A/B blink)**: hold a key to show the original, release for the encode,
   or blink on a timer — the fastest way to see a subtle shift in colour or detail.
6. **Difference view**: an amplified absolute-difference heatmap (x1 to x32), with the
   error computed in the Rust core from the decoded pixels, not by the webview.
7. **Numbers beside the pictures**: PSNR, SSIM and a perceptual metric (SSIMULACRA2 or
   butteraugli; choose on licence and on agreement with the reference tools), computed
   in Rust. PSNR is checkable against `cwebp -print_psnr`, so it gets a parity test;
   the others against their reference implementations.
8. **What you see is what the format decodes to.** AVIF and JPEG XL already decode in
   Rust and reach the webview as lossless WebP; do the same for every format so no
   side depends on the web engine's decoder or colour management, and state how a
   kept ICC profile is shown.
9. **Compare settings within a format — variants.** Snapshot the current settings as a
   named variant; keep a tray of them for the same source; pick any two (or the
   original) as A and B; a table of size, saving, metrics and encode time for all of
   them; one click applies a variant's settings to the panel or saves it as a preset.
10. **Compare across formats.** The same source through WebP, AVIF, JPEG XL and HEIC
   with each format's current settings, any two in the viewer and all four in the
   table. Two fair-fight helpers: **match size** (search each format's quality for the
   same byte size, then compare the pictures) and **match quality** (search for the
   same perceptual score, then compare the sizes).
11. **Rate–distortion curve**: sweep quality for one or more formats and plot size
   against the metric; clicking a point loads that encode as a variant.
12. **Scale.** Base64 `data:` URLs and the 24-megapixel refusal do not fit a viewer
   meant for zooming into large photos: serve the decoded images through a Tauri
   custom protocol, render tiles, and encode previews off the UI thread with
   cancellation when settings change mid-encode. A "preview a region" option can make
   huge images fast, but it changes the encoder's decisions near the region's edges,
   so it must say so and never be the default.
13. **Verified like everything else**: the zoom/pan/registration maths unit-tested,
   the modes driven over WebDriver (including that A and B stay registered at 32x),
   axe-clean, and screenshots re-captured. Designed in the Nanna design (Figma and
   Nuxt UI components) before it is built.

## ✓ **Keep metadata in JPEG XL output**

(2026-09-28). The same `metadata` choice: an ICC profile *labels* the pixels (`JxlEncoderSetICCProfile` in place of the sRGB colour encoding — the decoded pixels are in the source's space, so tagging them sRGB was wrong whenever a profile existed), EXIF becomes an `Exif` box (after its 4-byte TIFF-header offset) and XMP an `xml ` box, as `cjxl` writes them (`JxlEncoderSetICCProfile`, `JxlEncoderUseBoxes`, `JxlEncoderAddBox` in libjxl's `encode.h`: <https://raw.githubusercontent.com/libjxl/libjxl/main/lib/include/jxl/encode.h>). A JPEG recompressed losslessly already keeps its own metadata (libjxl stores it for the bit-exact rebuild), whatever the setting. **Gate:** `keeps_metadata_in_jpeg_xl` in `tests/metadata.rs`, run by libjxl's `djxl`: lossless keeps a Display P3 profile verbatim and decodes to the source's pixels in it; lossy (XYB) keeps its primaries (libjxl regenerates the profile from its compact colour encoding, as `cjxl` output does); both boxes byte for byte; nothing when nothing is kept. Mutation-tested: ignoring the profile, dropping the boxes and omitting the `Exif` offset each fail it. Found on the way: the WebP gate's `-metadata all` cases had kept nothing on our side *or* `cwebp`'s (a test helper misread "all"); fixed, and all 84 still match.

## ✓ **Keep metadata in HEIC output**

(2026-09-28): the ICC profile as the primary image's `colr` box of type `prof` (`heif_image_set_raw_color_profile`), EXIF and XMP as its metadata items (`heif_context_add_exif_metadata` / `_XMP_metadata`). **Gate:** `keeps_metadata_in_heic` — the `colr prof` box is the source's profile byte for byte, and libheif's own `heif-info` (the runner's separate build in CI) lists the profile, `Exif` and `XMP`; nothing when nothing is kept. Mutation-tested: an unset profile and a missing EXIF item each fail it.

## ✓ **An opaque image was written to HEIC with an alpha channel**

(found and fixed 2026-09-28: `heif-info` reported "alpha channel: yes" for a JPEG). `heic.rs` handed libheif interleaved RGBA for everything; an opaque image now goes as RGB, as `jxl.rs` already did, so no alpha plane is stored or advertised. **Gate:** `only_transparent_images_carry_alpha` (libheif's `has_alpha_channel` on our output, for an opaque and a transparent fixture); `heif-info` confirms "alpha channel: no". Mutation-tested: always writing RGBA fails it.

## ✓ **Keep EXIF in AVIF output**

(2026-09-28), through `ravif`'s `with_exif`. **Gate:** `keeps_exif_in_avif` — libavif's `avifdec --info` reports the source's EXIF at its exact size, and no ICC or XMP; none with nothing kept. Mutation-tested: dropping `with_exif` fails it. The window offers only the EXIF toggle for AVIF.

## ✓ **ICC profile and XMP in AVIF output**

— closed by Phase 8's move from `ravif` to libavif + libaom (0.14.0): the ICC profile, Exif and XMP go in as `avifenc` puts them, held to `avifenc` by `tests/avif_parity.rs` and checked by `keeps_metadata_in_avif`. (Left unticked when 0.14.0 shipped; ticked 2026-10-01.)

## ✓ **Keep a GIF's ICC profile and XMP in animated WebP output**

, as `gif2webp -metadata` (2026-10-01). `gif_input::metadata` reads the first `ICCRGBG1012` and `XMP DataXMP` application extensions as `gifdec.c`'s `GIFReadMetadata` does (an XMP packet keeps its sub-blocks' length bytes and loses the 257-byte magic trailer), and `animation::with_metadata` re-muxes ICCP then XMP with libwebp's mux. The WebP panel's ICC and XMP toggles are `gif2webp`'s `-metadata icc,xmp` for a GIF. **Gate:** `matches_reference_gif2webp_keeping_metadata` in `tests/gif.rs` — 20 of 20 whole conversions byte-identical to `gif2webp -metadata`; mutation: keeping the trailer fails 6, last-wins fails 2.

## ✓ Metadata from an **animated WebP** source into animated WebP output (2026-10-01)

`img2webp` has no `-metadata`, so the reference is the command-line route: re-encode, then `webpmux -set icc|exif|xmp`. The source's `ICCP`, `EXIF` and `XMP ` chunks are read as `cwebp` reads a still WebP's (`metadata::webp_chunks`) and set back with libwebp's mux under the WebP panel's three toggles. **Gate:** `keeps_an_animations_metadata_as_webpmux_sets_it` in `tests/animation.rs` — a source made with `webpmux -set`, five choices x lossless/lossy: 10 of 10 byte-identical. Mutation: dropping Exif fails 4. `webpmux` joins the reference tools (`scripts/build-reference-tools.sh`, CI's parity job).

## ✓ Warn before two inputs in one run would write the same output (`photo.png` and `photo.jpg` both become `photo.webp`)

and offer a "Replace existing files" toggle, on by default (2026-10-01) `plan_outputs` names each queued input's output with the conversion commands' own naming (flat or mirrored; case-insensitive on Windows and macOS) and the window lists shared names and files already in the destination. Off, `encode_file_with_options` refuses an existing output before encoding and claims the name with a `create_new` placeholder before the atomic rename, so nothing appearing meanwhile is replaced either. Remembered in the preferences (absent = on).

## ✓ A "Start from `cwebp`'s defaults" button in the WebP panel (2026-10-01)

**Gate:** `cwebps_defaults_are_a_bare_cwebp` runs `cwebp` with no flag at all and requires the reset to match it from four starting settings; mutation (resetting to the app's defaults) fails it.

## ✓ An About and licence view in the window (2026-10-01)

version, edition, licence, and the bundled `LICENSE`, notices and (GPL edition) `COPYING`, read by an enum, never a path (`src-tauri/src/legal.rs`, whose test holds the names to both editions' `bundle.resources`). Smoke-tested and axe-audited in the running window.

## ✓ `cargo tauri build` green on **Linux** for `.deb`

**this was not actually blocked on `patchelf`.** Only the AppImage target needs it; `cargo tauri build --bundles deb` produces a valid 3.8 MB `Skidbladnir_<version>_amd64.deb` on the dev host today, containing `usr/bin/skidbladnir` and the hicolor icon set.

## ✓ AppImage on Linux

produced by `release.yml` in CI (80 MB for 0.5.0). It is not *built* on the dev host, which has no `patchelf` (Phase 1), but it can be *checked*: the published `Skidbladnir_0.5.0_amd64.AppImage` was downloaded, unpacked with `--appimage-extract`, and passes the 9-check smoke test launched through its own `AppRun`.

## ✓ The published 0.5.0 `.deb` passes the same smoke test

This closes the gap the 0.5.0 run left: CI's upload replaced the locally-tested `.deb`, so the file users download had never been run. It now has.

## ✓ `cargo tauri build` green on **Windows** (NSIS `x64-setup.exe`)

built by `release.yml` for 0.5.0. **Compiled and bundled, never launched** — see below.

## ✓ `cargo tauri build` green on **macOS** (`.dmg`)

built by `release.yml` for 0.5.0, **Apple Silicon only** and never launched.

## ✓ First launch of the **Windows** build

and of the *installed* app, not just the bare executable. CI builds the NSIS installer, installs it silently to `%LOCALAPPDATA%\Skidbladnir`, and runs the full smoke test (13 checks) against the installed `skidbladnir.exe`. WebView2 displays AVIF there.

## "Basic Automation", not "basicautomation", as the Windows publisher

Not a label only: Tauri's NSIS installer keeps the install folder under `HKCU\Software\<publisher>\Skidbladnir`, and with no `bundle.publisher` the publisher is `basicautomation`, from the identifier. Renamed, an in-app update of a copy in a custom folder installs to `%LOCALAPPDATA%\Skidbladnir` instead, its shortcuts keep opening the old copy, and that copy offers the update again on every start. Running the new setup.exe by hand, its "uninstall first" reads the same key before any installer hook can run. Needs a migration, tested on Windows over a custom-folder install, before the key is set.

## First launch of the **macOS** build

`tauri-driver` does not support macOS, so the `.dmg` still needs a human to open it once.

## ✓ An Intel macOS build

`release.yml` cross-builds `x86_64-apple-darwin` on the Apple Silicon runner as a fourth matrix entry; the dry run produced `Skidbladnir_<version>_x64.dmg` beside the `aarch64` one. Never launched, like the Apple Silicon build.

## ✓ Stop attaching a locally-built `.deb` to a release that CI then overwrites with `--clobber`

Since 1.0.0 releases carry CI's artifacts only. For 1.2.0 the CI-built AppImages of both editions (release dry run 36960672813) passed the smoke test on the dev host before the tag (42 and 43 checks), and the GPL `.deb` was checked to carry the GPL metainfo, `COPYING` and its libheif.

## ✓ A `release.yml` workflow that builds all three targets and attaches them to the GitHub release for a tag

Triggers on `v*` tags, or manually with a tag input so a release whose build failed can be retried without moving the tag. `fail-fast: false`, so one platform failing does not deny the release the artifacts the others produced, and the collect step **fails loudly** if a platform produced no installer rather than uploading nothing. **Unverified until a tag exists** — a tag-triggered workflow cannot be exercised before the tag it reacts to.

## ✓ Decide whether the Tauri updater is in scope

First decided **not for the 0.x line** (key custody; an auto-update channel for a pre-parity app; no telemetry to see a bad update), to be revisited once the Tauri app was the shipping app and a tri-platform release had gone out. Both held by 0.7.0, and the owner asked for it (2026-09-28), so it is in — shaped by those three objections:
1. **Key custody.** The minisign keypair was generated in an interactive session
 with the owner, not by the routine. The private key and its password live with the
 owner and in the repository's Actions secrets
 `TAURI_SIGNING_PRIVATE_KEY` / `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`, nowhere else;
 the public half is in `tauri.conf.json`. The routine never touches either.
2. **Nothing is silent.** The app checks once per launch (release builds only) and
 shows a banner; nothing is downloaded or installed until the user clicks. Every
 download is verified against the public key before it is installed.
3. **Each install updates in its own format**: the manifest is keyed per bundle
 (`linux-x86_64-appimage`, `linux-x86_64-deb`, `windows-x86_64-nsis`,
 `darwin-{aarch64,x86_64}-app`), so a `.deb` install is never replaced by an
 AppImage. A `.deb` update asks for the admin password through polkit.

## ✓ Updater plumbing

`release.yml` builds with `createUpdaterArtifacts` only when the signing secret is present (so local and CI builds need no key), and a final `manifest` job writes `latest.json` from the signed installers (`scripts/updater-manifest.py`) and commits it to the orphan **`updater` branch**, which is what installed copies read. Since 1.0.0 neither the manifests nor the `.sig` files are attached to the release; they were clutter there. Not `releases/latest`: that skips prereleases, and every release before 1.0.0 was one. From 1.0.0 `release.yml` holds a tag's artifacts in a draft full release, not a draft prerelease. The manifest job never offers a draft, whose files are not public and would fail to download: publish the release, then re-run that one job, which reuses the run's signed installers. A re-run of an older tag never rolls the branch back. Dry runs sign with a throwaway key so the whole path is exercised without publishing. Verified locally: a signed `.deb` built with a throwaway key, served with a generated manifest, raised the banner in the real window; a tampered download was refused with "signature verification failed". A `release.yml` dry run signed all five updatable installers and wrote a manifest listing every target; its first run found that a `dmg`-only target list yields no `.app.tar.gz`, so `app` is now a bundle target too. **The first release that can be offered as an update is the first one built with the secret set** — 0.7.0 and earlier have no updater and must be updated by hand once.

## ✓ First tri-platform release of the Tauri app

**v0.5.0**, a prerelease carrying a Windows installer, a macOS `.dmg`, a `.deb` and an AppImage.

## Distribution, deferred past the 1.0.0 launch (2026-10-01)

### (owner-gated) Code signing

an Apple Developer ID with notarization, and Windows Authenticode (Azure Artifact Signing or SignPath Foundation) run through `bundle.windows.signCommand` inside the bundle step, so the updater's signatures cover the signed files.

### winget (the standard edition only, or give the GPL edition its own identifier first) and Scoop (a bucket of our own now; Extras wants 100+ stars)

### AUR `skidbladnir-bin` and AppImageHub (the AppStream metainfo is now in place)

*AUR waits on the update-check switch below:* a `-bin` package repackaging the `.deb` carries a binary that identifies itself as a `.deb` install, so its updater would try to install `.deb` updates on Arch (found 2026-10-01).

### Flathub

metainfo, an app ID under `io.basicautomation.*` or `io.github.basic_automation.*`, an offline from-source build of every crate, npm package and submodule, and an owner-written manifest under Flathub's AI policy.

### A Homebrew cask (after notarization; the official tap also wants 225 stars), Snap (the owner registers the name), and the Microsoft Store (a signed, offline installer)

### ✓ AppStream metainfo with PNG screenshots, shipped in the `.deb`, the `.rpm` and the AppImage (2026-10-01)

`resources/linux/*.metainfo.xml`, one per edition (their licences differ), `appstreamcli validate --pedantic` clean, matched to the desktop entry and icon by `appstreamcli compose` over the built `.deb`. `src-tauri/tests/metainfo.rs` fails a build whose newest `<release>` is not its version, so **every version bump adds a `<release>` to both files**. The AppImage's copy is built only in CI.

### (owner decision) A supported way for packagers to turn the update check off

an `updater` cargo feature that keeps the two commands registered, and `FLATPAK_ID` detection. The smoke tests' environment switch is a test hook, not a documented one.

### ✓ An `.rpm` per edition (2026-10-01)

bundled libheif and metainfo, renamed to `Skidbladnir_<v>_x86_64.rpm` so the editions do not collide, glibc-floor checked (`glibc-floor.py` reads rpm payloads itself), offered by the updater (`linux-x86_64-rpm`), and installed with dnf on `fedora:latest` by `release.yml`'s `rpm-install` job.

### More platforms: a universal `.dmg`

(The Linux ARM64 leg, `ubuntu-22.04-arm`, shipped in 1.2.0: `.deb`, `.rpm` and AppImage for both editions.)
