---
title: "Phase 7 — Beyond WebP — notes"
summary: "The prose, findings and finished-work write-ups behind this section of the roadmap checklist."
order: 8
group: Roadmap notes
---

# Phase 7 — Beyond WebP — notes

*The checklist for this section is in the [roadmap](https://github.com/basic-automation/Skidbladnir/blob/master/ROADMAP.md). What follows is the writing that used to sit between its items; a ✓ marks an item that was done when it moved here.*

The README has promised JPEG 2000 "coming soon" since 2019. Decide it honestly.

## ✓ Research and decide the next format

**The answer: AVIF. JPEG XL is a watch item, not a decision.** Evidence, gathered 2026-09-24:
- **AVIF is at roughly 90–93% global browser support** as of early 2026, and is the
  recommended default with a JPEG fallback.
  <https://orquitool.com/en/blog/avif-browser-support-2026-compatibility-webp-switch>
- **JPEG XL is still flag-gated almost everywhere.** Chrome 145 (February 2026) and
  Firefox 152 (June 2026) restored JXL decoding, but both ship it **disabled behind a
  flag**; only Safari enables it by default, which is about 16% of users. Chrome is
  expected to enable it by default in H2 2026, which would take support to ~85–90%.
  <https://theimagecdn.com/docs/jpeg-xl-explained>
- JPEG 2000 has no momentum outside medical and archival imaging. The README's
  "coming soon" claim has already been struck.
Revisit JPEG XL once Chrome ships it unflagged — that single event moves it from
16% to usable, and it is the trigger to re-open this item.

## **Chrome turns JPEG XL on by default — update the README when it ships.**

The JPEG XL project's news page (25 September 2026) says JPEG XL is set to be enabled by default in Chrome 155 stable, due early October. When it is out, re-word the README's "JPEG XL files open in Safari, and in Firefox and Chrome as each enables it" gap to what is actually shipped, and re-check Firefox's status the same way. <https://jpegxl.com/news/> Re-checked 2026-10-02: jpegxl.com's newest news is still that 25 September post; Chrome's stable channel is 154, and Chromium's schedule puts 155 stable on 6 October
2026. <https://chromiumdash.appspot.com/fetch_milestone_schedule?mstone=155>
Re-checked 2026-10-03: stable is still 154 (154.0.8037.98), and the schedule still
says 6 October. <https://chromiumdash.appspot.com/fetch_releases?channel=Stable&platform=Windows&num=1>
Re-checked 2026-10-04: still 154.0.8037.98. <https://chromiumdash.appspot.com/fetch_releases?channel=Stable&platform=Windows&num=1>

## ✓ **JPEG XL is close to its trigger — prepare, do not build yet.**

*Superseded:* the owner asked for JPEG XL ahead of Chrome, and it shipped in 0.10.0 on libjxl (see "JPEG XL output and input" below), with `cjxl`'s whole surface since 0.14.0. Mozilla announced (August 2026) that Firefox is shipping JPEG XL, decoded by Google Research's Rust `jxl-rs`, and that "Chrome are also intending to ship", expecting cross-browser support "before the end of the year". Chrome has not unflagged it yet, so the trigger above still stands; but when it fires, the first question is the **encoder** — the Rust side has decoders (`jxl-rs`, `jxl-oxide`), and encoding the full control surface likely means libjxl again. Research the encoder options (control surface, licence, build on all three runners) so the decision is ready. <https://hacks.mozilla.org/2026/08/intent-to-ship-jpeg-xl/>

## ✓ Add AVIF output

**Design decided here so the work can start; no code yet.**

*Which encoder.* ~~`libavif-sys`~~ — **superseded 2026-09-26 by `ravif`; see the
re-check item below.** The original reasoning, kept for the record:
**`libavif-sys`** (BSD-2-Clause, libavif 1.0.4), not `ravif`.
Parity is not the constraint — there is no existing AVIF behaviour to preserve — so
the question is control surface versus build complexity, and Skidbladnir exists to
expose the control surface. `ravif` wraps `rav1e` and offers quality, speed and
alpha-quality; libavif reaches the encoder's tuning, chroma subsampling, bit depth
and range. The C dependency is the same trade already accepted for libwebp, and
`libwebp-sys` has shown it builds green on all three platforms.

*How settings are shaped.* The awkward part, and the reason this is written down
before any code: `EncodeSettings` is WebP-specific — `sns`, `partition_limit`,
`segments` and the filter surface mean nothing to AV1. Three options were weighed:
- An **enum** `EncodeSettings::{Webp(..), Avif(..)}`. Cleanest types, but switching
  format in the UI throws away the other format's tuning, and every call site gains
  a match.
- A **flat struct with unused fields** per format. No, for the obvious reason: a UI
  that shows `sns` for AVIF is lying about what the encoder will do, and this project
  has already fixed that exact class of bug in the mode show/hide logic.
- **A job with shared settings plus one sub-struct per format, all kept live.**
  Chosen:
  ```
  struct EncodeJob { format: OutputFormat, resize: Resize, webp: WebpSettings, avif: AvifSettings }
  ```
  `resize` is genuinely shared. Each format's own settings persist while the user
  tries the other, which matches how the app already keeps every mode's settings live
  rather than resetting them, and it is what presets and the preferences file should
  store.

*Migration path, in landable slices:*
1. **Done.** Rename `EncodeSettings` → `WebpSettings`, lift `resize` out into
   `EncodeJob`, add `OutputFormat` with a single variant. No behaviour change: the 76
   parity settings, the PNG-file and colour-type parity and the CMYK check all stayed
   byte-identical against `cwebp` 1.6.0 through it. `EncodeJob` is the wire and
   on-disk type; it **reads the old flat shape too**, so preset and preferences files
   saved by 0.5.0 load with every value intact — verified in the running window with
   a hand-written 0.5.0-shape preferences file, not only by unit test.
2. **Done (core only).** `AvifSettings` (quality, alpha quality, speed, bit depth,
   colour model, alpha mode, multi-threading — `ravif`'s defaults), `OutputFormat::Avif`,
   and `crates/skidbladnir-encode/src/avif.rs`. The shared resize runs through
   **libwebp's rescaler**, so a resize gives identical dimensions in either format.
   Output is named `.avif`, dimensions are read back from the file's `ispe` box, and
   the preview labels its encoded side `image/avif`.
   **The gate is a reference decoder, not a reference encoder:**
   `tests/avif_reference.rs` has libavif's own `avifdec` decode seven of our files
   and checks size, transparency and PSNR (47.5 dB at the defaults; quality 20 → 40.8
   dB, 95 → 50.6 dB, so quality demonstrably means something). It was
   mutation-tested — swapping R and B in the encode path drops it to 16.0 dB and
   fails it. Enforced in CI's parity step (`libavif-bin` / brew `libavif`).
   WebP parity was unchanged through it (76/76).
   **An AVIF encode cannot be cancelled mid-way:** `ravif` has no progress hook, so
   cancel is honoured before and after the encode only.
3. **Done.** A Format selector (WebP / AVIF) above Mode; WebP's Mode, Quality and
   Advanced panels show only for WebP, and an AVIF panel (quality, alpha quality,
   speed, multi-threading, bit depth, colour model, colour under transparency) only
   for AVIF. Resize moved into its own panel because both formats share it. The file
   extension and the progress note follow the format. Verified in the running window:
   switching shows 3 AVIF sliders and hides Mode; **WebKitGTK displays the AVIF
   preview**; an AVIF conversion writes a file `avifdec` reads as 10-bit 4:4:4 with
   alpha. The axe audit now covers the AVIF panel and an on-screen preview too, and
   caught one contrast failure (a 3.91:1 description on the Format cards), fixed.
4. Output naming and the preview — **done in slices 2 and 3**. What is left:

## ✓ Read AVIF **input** (done 2026-09-27, once `nasm` was installed)

`SourceFormat::Avif` is sniffed from the `ftyp` box — major *or* compatible brand `avif`/`avis`, and a HEIC with the same container is refused. `decode_avif` uses `avif-decode` 3.0 over rav1d; 16-bit output (10/12-bit AVIF) drops its low byte, as 16-bit PNG does. **Gate:** `our_avif_decoder_agrees_with_avifdec` decodes the same 10- and 8-bit files with ours and with libavif's `avifdec` — 49.5 and 50.5 dB agreement, alpha identical. Mutation-tested: a wrong bit-depth reduction drops it to 4.7 dB and fails. **Two findings on the way:**
- `avif-parse` **panics** on a malformed box (a `debug_assert` — found by the
  corrupt-file test). `decode_avif` catches the panic and returns a decode error, so
  a user's damaged file can never take a conversion down.
- rav1d's x86 assembly cannot be linked into a `cdylib` (non-PIC relocation against
  `dav1d_dr_intra_derivative`). The Tauri library's `staticlib`/`cdylib` crate types
  existed only for mobile targets and were dropped; it is `rlib` only now.
Animated AVIF (`avis`) is sniffed but only its first frame would decode — not tested.

## ✓ **Widen the AVIF-input gate**

beyond two files. `tests/avif_input.rs` has `avifenc` write 17 encodings — 8/10/12-bit; 4:4:4, 4:2:2, 4:2:0, monochrome; full and limited range; BT.601/709/2020 and identity; straight and premultiplied alpha; lossless — and `decode_avif` must agree with `avifdec` (mean ≤ 2, worst ≤ 20) **and land no further from the original than libavif does**, within half a level of mean error (macOS CI's Homebrew libavif is 0.27 closer on 8-bit 4:4:4, a rounding difference). All 17 pass on Arch (libavif 1.4.2), Ubuntu (1.0.4) and macOS. Mutation-tested against `decode_avif` itself: an off-by-12 narrowing fails 8 of 17. What it established: avif-decode upsamples chroma nearest-neighbour (bilinear decoders disagree on siting by up to 50 levels at a hard edge); at saturated limited-range pixels libavif is the one further from the original (pure blue: libavif 237, ours 250); and **libavif's and libheif's greyscale output leaves limited-range monochrome unexpanded** (black comes out as 16) while ours expands it, so that case is held to libavif's raw Y plane. Enforced in CI's parity step.

## ✓ AVIF input honours the `clap`/`irot`/`imir` (crop, rotate, mirror) properties

`avif-parse` does not expose them, so `crates/skidbladnir-encode/src/avif_transform.rs` reads `pitm`/`iprp`/`ipco`/`ipma` itself and applies the primary item's properties in association order (MIAF: crop, rotate, mirror). A `clap` that is not whole pixels inside the image is ignored, as libavif does. Never panics on malformed boxes. **Gate:** `honours_crop_rotation_and_mirror` in `tests/avif_input.rs` — lossless `avifenc` fixtures for each `irot`, each `imir` axis, a crop and all three combined, checked **exactly** against the `image` crate's own rotate/flip/crop of the source (an independent implementation) *and* against `avifdec` where it applies them — found by CI: Ubuntu 24.04's libavif 1.0.4 `avifdec` ignores all three and shows the stored image, so there it is reported, not trusted (1.4.2 on Arch applies them and agrees exactly). Mutation-tested: clockwise rotation fails `irot` 1 and 3; swapped mirror axes fail both `imir`.

## ✓ AVIF input decodes grid (tiled) images (done 2026-09-28)

`avif-parse` refuses `grid` items, so `src/avif_grid.rs` reads the container itself, rewraps each tile (and its alpha tile, when the alpha plane is a grid too) as a minimal single-image AVIF for the ordinary decoder, and stitches the tiles, cropped to the grid's output size. The canvas is allocated only once the first tile proves the layout fits (MIAF: covering the output, overhanging by less than a tile), so a hostile descriptor cannot demand a huge buffer. The grid's own crop/rotation/mirror still apply. **Gate:** `decodes_grid_avifs` in `tests/avif_input.rs` — `avifenc --grid` 2x2 and 4x3 (with alpha) lossless files come back exactly as their source, a rotated grid exactly as the rotated source, and a lossy 4:2:0 grid within tolerance of `avifdec`; each fixture is checked to really be a grid. Mutation-tested: swapped row/column order, dropped alpha tiles and a lost edge column each fail it.

## ✓ **Show the AVIF preview on every platform**

(done 2026-09-27). The encoded AVIF is decoded in Rust and sent to the webview as lossless WebP, so no web engine has to decode AVIF; the smoke test's "displays the AVIF preview" is a hard check again. The "cannot display" notice remains in the window as a fallback that should now never show. History: Found by CI, not by reading: Ubuntu 24.04's WebKitGTK cannot decode AVIF (the smoke test's image load fails there), while Arch's can, and the AppImage bundles the Ubuntu build. The window now says so instead of showing a broken image, but the comparison is lost. The fix is the same AV1 decoder the AVIF-input item needs: decode the preview in Rust and send it to the webview as lossless WebP, as the original side already is. The two items should be solved together. **Blocked on `nasm` (owner-gated), found 2026-09-26.** The right decoder exists: `avif-decode` 3.0.0 (20 September 2026, by `ravif`'s author) is pure Rust over `rav1d`, the Rust port of dav1d — no C library. But on x86 it depends on `rav1d` with default features, which include `asm`, and rav1d's build script then panics with "NASM build failed. Make sure you have nasm installed". Cargo feature unification means Skidbladnir cannot switch that off from its side. `sudo pacman -S nasm` on the dev host (and `nasm` on the three CI runners: apt, brew, choco) unblocks this **and** the rav1e `asm` speed-up at once. <https://crates.io/crates/avif-decode> · <https://crates.io/crates/rav1d>

Do **not** start at step 2. Step 1 is the one that can silently change WebP output,
and it is the one the existing parity tests can prove innocent.

## ✓ **Re-check the AVIF encoder choice before slice 2. Decided: `ravif` 0.13**

, with `default-features = false, features = ["threading"]`.
- `libavif-sys` was last published July 2024 as `0.17.0+libavif.1.0.4`; upstream
  libavif is at **1.4.2** (26 May 2026). No maintained binding tracks it.
  <https://crates.io/crates/libavif-sys> · <https://github.com/AOMediaCodec/libavif/releases>
- `ravif` 0.13.0 was published January 2026 and is the AVIF encoder under the
  `image` crate (~15M downloads in 90 days). It is pure Rust over `rav1e`, so
  there is no C toolchain to stand up on the Windows runner.
- What it exposes: quality, alpha quality, speed, bit depth, internal colour model,
  alpha colour mode and thread count. What it does **not**: chroma subsampling
  (always 4:4:4 — its docs call subsampling "a bad idea for AVIF anyway"), AV1 tune,
  or a choice of codec. That is a smaller surface than libavif's, accepted in
  exchange for a maintained, current encoder.
  <https://docs.rs/ravif/latest/ravif/struct.Encoder.html>
- Default features are off because `asm` needs `nasm` at build time, which the dev
  host lacks (owner-gated) and would be one more thing for each CI runner.

## ✓ `rav1e`'s `asm` is back on (`ravif` default features)

now that `nasm` is on the dev host (installed 2026-09-27 at the owner's request) and on every CI runner via `ilammy/setup-nasm` Measured on the dev host: a 1600x1200 AVIF at the defaults went from 818 ms (0.6.0, pure Rust) to 595 ms, **byte-identical output** (180,742 bytes). `nasm` is now a build requirement, stated in the README.

## Watch **Tauri 3**, do not adopt it

`3.0.0-alpha` releases began appearing in September 2026, bringing a CEF runtime option, plugin-API changes (`js_init_script` → `initialization_script`) and removed deprecated APIs. Adopting an alpha mid-migration would be trading a known platform for an unknown one; the app stays on Tauri 2.x until 3 is stable and the migration has shipped. <https://github.com/tauri-apps/tauri/releases> Re-checked 2026-09-27: `3.0.0-alpha.3` shipped beside `2.12.0` (26 September). Its breaking changes that would touch this app: `Plugin` must be `Sync` and its hooks take `&self`; plugin closures must be `Fn + Send + Sync`; `run_on_main_thread` is removed in favour of a trait. Still an alpha — no change to the decision. <https://github.com/tauri-apps/tauri/releases> Re-checked 2026-09-28: `2.12.0` and `3.0.0-alpha.3` are still the newest; no change. Re-checked 2026-10-01: `2.12.1` (30 September; taken this run) and `3.0.0-alpha.4` (1 October). Still an alpha; no change. Re-checked 2026-10-03: still `2.12.1` and `3.0.0-alpha.4`.

## **Drop `macos-private-api`.**

Tauri 2.12.1 no longer needs the `macos-private-api` feature (or `macOSPrivateAPI` in `tauri.conf.json`) for transparency or fullscreen on macOS (tauri-apps/tauri#16166). Skidbladnir enables the feature only for its frameless `transparent` window, and the private API is what keeps an app out of the Mac App Store. Remove the feature from the workspace `tauri` dependency once a macOS build confirms the window still draws transparent — which, since no macOS build has been launched, waits on the macOS first-launch item. Tauri `3.0.0-alpha.4` removes the feature and `macOSPrivateApi` outright, so it has to go before any move to 3. <https://github.com/tauri-apps/tauri/releases> <https://github.com/tauri-apps/tauri/releases/tag/tauri-v2.12.1>

## ✓ Confirm the encoder is current

**No libwebp upgrade is pending:** 1.6.0 (9 July 2025) is still the newest release, and it is exactly what `libwebp-sys` vendors and what the parity test compares against, so the parity claim is against current upstream. Re-check each run. Re-checked 2026-09-25, 2026-09-27, 2026-09-28, 2026-10-01 and 2026-10-03: still 1.6.0. <https://github.com/webmproject/libwebp/tags>

## ✓ Strike the JPEG 2000 claim from the README

done; the Status section now lists WebP as the only output format rather than promising JPEG 2000.

## ✓ Decoding/inspection of existing WebP files

`crates/skidbladnir-encode/src/inspect.rs` reads dimensions, lossy/lossless/mixed, alpha and animation from the bitstream header via libwebp's `WebPGetFeatures`, which does **not** decode the image, so inspecting a large file is cheap. Surfaced through path inspection, so selecting a WebP tells the user what it already is. The window also warns when a selected file is an **animated** WebP, which this still-image encoder cannot re-encode.

## ✓ Handle animated WebP properly

**Correcting an earlier claim in this file:** it was recorded that converting an animation "would keep only the first frame". That was asserted without testing and is **wrong** — libwebp's still decoder refuses an animated WebP outright, so no frames were ever silently dropped. What was wrong was the *message*: the user got "libwebp rejected the file", which explains nothing. An animation is now detected before decoding and refused as `SourceError::Animated`, whose message says what the file is and why it cannot be converted. The UI warning was corrected to match. The test **builds its own two-frame animation** with libwebp's `WebPAnimEncoder` rather than reading one from an environment variable, so it always runs — a test that skips unless someone remembered to set a variable is a test that never runs in CI, and this one guards a refusal users depend on.

## ✓ Re-encode animated WebP rather than refusing it, using libwebp's `WebPAnimEncoder`

This needs a per-frame settings story (do the advanced controls apply to every frame?) and a demuxer for the input, so it is a real piece of work, not a flag. *Slices:*
1. **Done (core only).** `crates/skidbladnir-encode/src/animation.rs`: decode every
   frame with `WebPAnimDecoder` (full-canvas RGBA plus durations, loop count and
   background), re-encode with `WebPAnimEncoder`. **The settings story: every WebP
   control applies to every frame** — the per-frame `WebPConfig` comes from the same
   `build_config` the still path uses; target size and PSNR become per-frame. Resize
   uses the still path's `cwebp`-matching rescale on each frame. **Gate:**
   `tests/animation.rs` is byte-identical to libwebp 1.6.0's `img2webp` in 18 cases
   (lossless, lossy, quality, method, sharp YUV, near-lossless, loop count),
   mutation-tested; CI builds a version-matched `img2webp` beside `cwebp`. Found on the
   way: the app's default `-pass 6` changes lossy output even with no target set.
   Controls `img2webp` has no flag for are only proven to *reach* the frames.
2. **Done.** `encode_file` sends an animated WebP through the animation encoder.
   `load` still refuses one (it returns a single picture, and handing back frame 1 as
   if it were the image is the silent truncation this project refuses), and so does
   **AVIF output — decided: refuse by name, never keep the first frame**, since
   `ravif` writes stills only. The preview shows **both sides as animations**, every
   frame, with a frame count; the size guard counts every decoded frame.
3. **Done.** The window's warning now says what will happen (WebP: every frame kept;
   AVIF: refused, choose WebP) and the target controls say a target is per frame.
   Verified in the running release binary: the smoke test converts an
   `img2webp`-written 3-frame fixture, finds 3 `ANMF` frames on disk, gets the AVIF
   refusal, and the webview displays the animated preview; axe clean.

## Animated **AVIF** output (AVIF image sequences)

`ravif` writes stills only; this needs a different encoder path, and belongs with the AVIF-input decoder work.

## ✓ **HEIC output and input**

(done 2026-09-28; the owner chose Kvazaar + libheif over x265, which would have made the binaries GPL, and over macOS-only ImageIO). libheif 1.23.5 (LGPL-3.0) is built by `scripts/build-libheif.sh` from pinned submodules as one **shared** library with Kvazaar 2.3.2 (BSD-3, the encoder) and libde265 1.1.3 (LGPL-3.0, the decoder) static inside it and **plugin loading off**, so no system x265 can ever be loaded. It ships beside the app (`tauri.<platform> .conf.json`), found through rpaths set in `src-tauri/build.rs`; its C API is bound in `src/heic.rs`. The encoder is requested by name, `kvazaar`. Kvazaar is 4:2:0 only, so quality is the only control and there is no lossless HEIC. **Gate:** `tests/heic_reference.rs` has the runner's own libheif (`heif-dec`, a separate build, with our library path removed) decode our files at the right size and alpha with PSNR rising with quality, and agree with our decode. Licence notices for every shipped native library are generated into `THIRD-PARTY-NOTICES.md` by `scripts/third-party-notices.py`, bundled into every installer, and checked in CI. **Not yet:** HEVC patent-pool licensing is unexamined (the owner accepted the risk, as GIMP, ImageMagick and ffmpeg do); iPhone grid images and HDR gain maps decode as libheif decodes them but are untested with real phone files. *Original plan, kept for the record:* **HEIF/HEIC input.** The common case is iPhone and macOS photos, which are HEIC by default. Converting those to WebP/AVIF is something users do, so this is a real input format, not a curiosity. Added to the queue 2026-09-28.
- *Sniffing already half-exists:* `SourceFormat` reads the `ftyp` box for AVIF and
  explicitly **refuses** a HEIC with the same container. This item turns that refusal
  into a decode for the `heic`/`heix`/`mif1` brands.
- *Decoder choice is the whole decision, and it is a licensing one.* `libheif-rs`
  wraps libheif (LGPL-3.0) and needs libde265 for HEVC. That is a C toolchain on
  three runners, and dynamic-linking obligations that `cargo deny` will have to be
  told about. `heic-rs` claims pure Rust (MIT OR Apache-2.0, no C toolchain) and
  covers iPhone grid images, 8/10-bit and 4:2:0/4:2:2/4:4:4. It is young, so it has
  to earn trust the way `avif-decode` did: an agreement gate against a reference
  decoder (libheif's `heif-dec`) in CI, before it ships.
  <https://github.com/tbraun96/heic-rs> · <https://crates.io/crates/libheif-rs>
- *HEVC is patent-encumbered.* Decoding in a free desktop app is the common practice
  (libheif and GIMP ship it), but check this, and write the answer down, before
  release.
- *Out of scope: HEIC output.* Encoding HEVC means x265 (GPL) and the patent pool.
  AVIF already is "HEIF with a royalty-free codec", and it is the output format to
  offer anyone who wants HEIF.
- *Carry over from HEIC:* EXIF orientation (iPhone photos rely on it) and the
  embedded colour profile. Check whether the AVIF path already honours either.

## ✓ **The GPL edition: HEIC through x265**

(done 2026-09-28; the owner changed their mind about x265 and asked for two builds rather than one). The `gpl` cargo feature (and `full`, every optional feature) builds the app against a libheif that `scripts/build-libheif.sh --edition gpl` builds around **x265 4.2** (GPL-2.0-or-later, a Bitbucket submodule) with its 8- and 10-bit encoders linked together, in place of Kvazaar. That build is distributed under GPL-3.0-or-later as a whole; the source stays ISC, and the standard edition stays ISC and unchanged. **Guard:** each libheif build records its edition in `EDITION` beside it, `build.rs` refuses to link the other edition's, and a test asserts the linked libheif has this edition's encoder and not the other's. **Controls:** lossless (RGB kept as RGB at 4:4:4), 4:2:0/4:2:2/4:4:4, 8- or 10-bit (Main 10, fed 10-bit RGB so the colour conversion runs at 10 bits), x265's ten presets and four tunings, TU intra depth, and through libheif's `x265:` pass-through: adaptive quantisation mode and strength, psy-RD, psy-RDOQ, deblocking on/off with its tC and beta offsets, and SAO. Settings a standard edition cannot write are refused there and reset to Kvazaar's when a preset or preferences file from the GPL edition is read. **Found on the way:** libheif encodes transparency with a *fresh* encoder that gets only its listed parameters, not `x265:` ones, so those shape the colour image only; and x265 refuses placebo's TU inter depth in the 16-px CTUs libheif uses under 32 px, which is refused up front for transparent images. Opaque images now carry no alpha image in either edition. **Gate:** unit tests for every chroma, bit depth, preset, tune and AQ mode at every CTU size; lossless exact; and `heif-dec` reads lossless exactly and 4:4:4, 4:2:2 and 10-bit. **Distribution:** each release builds both editions (`Skidbladnir-GPL_*` for the GPL one), attaches `Skidbladnir-<version>-source.tar.gz` with every submodule, and gives each edition its own updater manifest (`latest.json`, `latest-gpl.json`). Notices are per edition, and the GPL edition bundles the GPL text as `COPYING`. **Not yet:** 12-bit (Main 12), and HEVC's patent pools, exactly as for Kvazaar.

## ✓ **JPEG XL output and input**

(done 2026-09-28, ahead of Chrome at the owner's request, so libraries can be converted in anticipation). libjxl 0.12 is bound directly in `src/jxl.rs` — `jpegxl-rs`/`jpegxl-sys` are GPL-3.0 and cannot be linked into an ISC app — and built statically from `jpegxl-src`'s source via CMake (`SKIDBLADNIR_LIBJXL=vendored` in CI and releases; a CMake-less dev host links the system libjxl through `pkg-config`). Controls: quality (libjxl's own quality→distance map), effort, lossless, **lossless JPEG recompression** (on by default, as in `cjxl`; skipped when a resize takes effect) and multi-threading. `jxl-oxide` decodes for the preview, the reported dimensions and JPEG XL input. **Gate:** `tests/jxl_reference.rs` has `djxl` decode our files (size, alpha, PSNR rising with quality, lossless exact), rebuild a recompressed JPEG byte for byte, and agree with `jxl-oxide` (54 dB lossy, exact lossless). Note: `jpegxl-src`'s crates.io metadata says BSD-3-Clause but its `lib.rs` carries a GPL header; it only runs at build time and nothing of it is linked, but replacing it with our own CMake invocation over a pinned libjxl source would remove the question entirely. *Original plan, kept for the record:* **JPEG XL input, then output.** Supersedes the "watch item" in the format decision above: the trigger it named is close. Firefox 157 enables JXL by default (due the end of September 2026), and Chrome/Edge have formalised their intent to enable it by default after shipping it behind a flag in Chrome 145. <https://mintec.co/blog/jpeg-xl-firefox-pipeline-imagenes/> · <https://www.phoronix.com/news/Chrome-145-Released>
1. **Input first. It is cheap, and useful today** for anyone who already has .jxl
   files. `jxl-oxide` (0.12, pure Rust, MIT/Apache) is a complete decoder with no C
   toolchain. Sniff the bare codestream (`FF 0A`) and the ISOBMFF container
   (`JXL ` box). Gate it the way AVIF input was gated: our decode against libjxl's
   `djxl` on the same files, in CI.
   <https://crates.io/crates/jxl-oxide>
2. **Output once Chrome enables it by default** (re-check before starting). The
   encoder is libjxl, via `jpegxl-rs`/`jpegxl-sys` (BSD-3). That is a C++ build on
   three runners, so price it the way the AVIF encoder choice was priced. Its
   controls map naturally onto the existing panel: distance/quality, effort
   (1–10, the analogue of `method`/`speed`), and lossless. One control is worth
   adding: **lossless JPEG recompression**, which re-packs a JPEG into JXL about 20%
   smaller and can reconstruct the original JPEG bit for bit. No other output format
   here can offer that.
3. The preview already decodes AVIF in Rust and shows lossless WebP, so JXL gets a
   preview on every web engine the same way, whatever the browsers do.

## **Intermittent stack overflow in the animation tests on Windows CI**

(seen once, 2026-09-28, run 36521408006: `a_still_webp_decodes_as_one_frame`, `a_reference_animation_decodes_as_built` and `lossless_round_trip_is_exact` overflowed together; the next run on the same code passed). Each builds its fixture with `WebPAnimEncoder` first, whose candidate encodes are stack-heavy, and in a debug build the `cc`-compiled libwebp is unoptimised. Not reproducible on the Linux host. Next: measure the stack high-water mark of an animation encode on Windows, then either optimise the C dependencies in the dev profile (`[profile.dev.package.libwebp-sys] opt-level`, re-running the parity gates to prove the output is unchanged) or run the app's animation encodes on a thread with a stated stack size — not raise `RUST_MIN_STACK` in CI to hide it. **Measured 2026-10-01, and the stack-depth hypothesis does not hold on Linux:** each of the three test bodies (and a lossy animation encode) runs on a main thread limited by `ulimit -s` to **under 50 KiB**, with libwebp's C at `-O0` (debug) and at `-O3` alike — versus the 1 MiB / 2 MiB Windows gives a main / test thread. Two things the failing run's log does show: the three tests are exactly those that decode *lossless* (VP8L) data through `WebPAnimDecoder` (`a_still_webp_decodes_as_one_frame` never touches `WebPAnimEncoder`), and those test binaries link with `LNK4098: defaultlib 'libcmt.lib' conflicts with use of other libs` — a static and a dynamic C runtime in one process (`native/heic_jpeg.cc` is built `static_crt(true)` to match libjxl's; see the next item). Revised next step: make the CRT consistent, then reproduce on the Windows runner (a dispatch-only job running `tests/animation.rs` in a loop); only if it still overflows, measure there. **The CRT is now consistent** (0.15.0, below); the overflow did not recur in that PR's Windows runs, which proves little for an intermittent failure — keep watching before ticking. **Measured again 2026-10-04, for every encoder:** `scripts/stack-probe.sh` (with `examples/stack-probe.rs`) bisects the smallest stack each encoder's heaviest settings survive with *every* thread limited, the encoders' own worker threads included (glibc takes their default from `ulimit -s`; on Windows a thread started without a size gets the executable's 1 MiB). On the dev host, release build: AVIF at speed 0 needs 124 KiB, everything else (WebP `-m 6` lossy and lossless, animated WebP from GIF, JPEG XL `-e 9` lossy and lossless, HEIC) at most 44 KiB; debug build: at most 92 KiB. This mattered beyond the tests: gpui runs the window's background tasks, conversions and previews included, on the Windows thread pool (`TrySubmitThreadpoolCallback`, `gpui-windows` 1.17.2 `dispatcher.rs`), whose threads have that 1 MiB, so the gpui window on Windows has about 8x headroom (MSVC's frames are not measured, and can be larger). Nothing on Linux comes near the 2 MiB of a test thread, so the overflow is still unexplained there.

## ✓ **Concurrent HEIC encodes tripped libheif's memory limit**

(found and fixed 2026-10-01/02 by CI: two of PR #68's macOS parity runs failed one HEIC case each with "Memory usage of 18446744073709539283 bytes ... exceeds the security limit", while the same commits passed in the other runs). libheif 1.23.5 counts an image's memory against its context's limits, keyed by their address (`security_limits.cc`). The shim's HEIC reader (`load_heif`) freed its context while the decoded image lived on; a context allocated later at the same address (another thread's, in parallel tests; a preview overlapping a conversion, in the app) had its count taken below zero when that image was released. The reader's context now lives until its image is released (`Loaded::context` in `native/heic_shim.c`). Gate: `concurrent_encodes_keep_libheif_memory_accounting_sound` (8 threads x 25 HEIC and PNG sources). It does not reproduce on Linux, where glibc's per-thread arenas rarely reuse an address across threads, so macOS CI is its real test. Worth reporting upstream: the tracker could refuse to re-register a live key.

## ✓ **One C runtime on Windows**

(2026-10-01): everything on the static runtime — `.cargo/config.toml` `+crt-static` for `x86_64-pc-windows-msvc`, and `CMAKE_MSVC_RUNTIME_LIBRARY=MultiThreaded` for libjpeg-turbo, libaom and libavif in `build.rs`; libheif stays a DLL on its own runtime. **Trap found:** CI's workflow-wide `RUSTFLAGS` *replaces* the config's target rustflags, so the first CI run built the dynamic runtime and went green meaninglessly (`LNK4098` still there); CI's Windows jobs now set the flag in `RUSTFLAGS` themselves, while `release.yml` (no `RUSTFLAGS`) takes it from the config. Verified by CI run 36895266768: `LNK4098` 0 times (was 3), both editions' Windows suites green (263 passed on the standard), and the installed NSIS app passes the Windows smoke test. Not run on a Windows machine outside CI. *Original item:* The MSVC test binaries link both `libcmt` (static CRT: libjxl from `jpegxl-src`, and `native/heic_jpeg.cc` to match it) and the dynamic CRT the Rust toolchain and the other `cc`-built C use, which the linker warns about (`LNK4098`, seen in run 36521408006). Two CRTs mean two heaps and two sets of CRT state in one process; nothing is known to cross between them, but it is the kind of thing that produces failures like the intermittent overflow above. Either build every C/C++ dependency against the static CRT (`+crt-static` for the Windows target) or libjxl against the dynamic one, and re-run the Windows parity, smoke and installer jobs.
