---
title: "Phase 8 — Reference-CLI parity — notes"
summary: "The prose, findings and finished-work write-ups behind this section of the roadmap checklist."
order: 9
group: Roadmap notes
---

# Phase 8 — Reference-CLI parity — notes

*The checklist for this section is in the [roadmap](https://github.com/basic-automation/Skidbladnir/blob/master/ROADMAP.md). What follows is the writing that used to sit between its items; a ✓ marks an item that was done when it moved here.*

**The claim this phase makes true:** for a still image, every result the reference
command-line encoder can produce, Skidbladnir can produce — `cwebp` for WebP, `avifenc`
for AVIF, `cjxl` for JPEG XL, `heif-enc -e kvazaar` for HEIC — proven by parity tests that
run the real tool and compare bytes. The owner's scoping (2026-09-28): AVIF moves to
libavif + libaom so `avifenc`'s surface is reachable; HEIC stays on Kvazaar (x265 is GPL)
and its claim says "with Kvazaar"; multi-image features are queued below, not built now.

## ✓ WebP: every `cwebp` option, one field per flag

`-preset` and `-z` are buttons the Rust core applies, as they are shorthands on the command line too. 246 parity cases, including `cwebp`'s libpng gamma correction (`png_gamma.rs`, libpng 1.6.58's tables).

## ✓ JPEG XL: every `cjxl` option for a still image

202 parity cases.

## ✓ AVIF: libavif + libaom replace `ravif`

every `avifenc` option for a still image, its still path ported as `native/avif_shim.c`. 191 parity cases.

## ✓ HEIC

every `heif-enc` option Kvazaar can honour, its still path ported as `native/heic_shim.c`. 147 parity cases. `-L` cannot work with Kvazaar (it asks for a `chroma` parameter Kvazaar lacks), so lossless is `-p lossless=true`; `-b` only affects 16-bit input, which Kvazaar refuses; `--enable-metadata-compression` needs a libheif built with zlib, which the default build is not.

## ✓ Each format's window exposes its whole surface (a panel per format, the flag in every control's help), and presets round-trip it

presets store the `EncodeJob` itself. The accessibility audit covers every control with every section open.

## ✓ Decode JPEG input the way each reference tool does

libjpeg-turbo 3.2.0 (a pinned submodule, linked statically) with libjpeg's defaults for `cwebp` and `cjxl`, and `avifenc`'s and `heif-enc`'s own JPEG readers compiled into their shims, reading from memory, so their direct YCbCr copies happen exactly when theirs do. zune-jpeg had differed by up to 3 levels on a quarter of the samples.

## ✓ CI builds every reference from the sources the app links

reading JPEG through the same libjpeg-turbo (`scripts/build-reference-tools.sh`: `cwebp`, `img2webp`, `gif2webp`, `avifenc`, `cjxl`, `heif-enc`), and the `parity` job requires all 2,861 cases

## ✓ Merged with 0.12 and 0.13 (2026-09-29), shipped as 0.14.0

The GPL edition's x265 controls are `heif-enc`'s `-L` and `-p` parameters in the per-format HEIC settings; 0.12's job-level metadata toggles load into each format's own options (`cwebp -metadata`, `avifenc --ignore-*`, `cjxl -x strip=`, and which kinds `heif-enc` keeps); the animation and GIF gates (`img2webp`, `gif2webp`) and 0.13's whole-surface WebP-, JPEG- and TIFF-file gates run against the per-CLI encoder and pass, 2,254 WebP cases in all. Malformed metadata that `cwebp -metadata` refuses is still refused. The one result not reproduced is 0.13's deliberate divergence: `cwebp` premultiplies a straight-alpha TIFF through libtiff, and Skidbladnir keeps its colours.

## ✓ **PNM/PAM input**

(2026-10-01): binary `P5`, `P6` and `P7`, read by `src/pnm.rs` as libwebp 1.6.0's `imageio/pnmdec.c` reads them (line-at-a-time header, `(v * 255 + maxval / 2) / maxval`) and handed to libjxl as `cjxl`'s `lib/extras/dec/pnm.cc` hands them over (`log2(maxval + 1)` bits, `JXL_BIT_DEPTH_FROM_CODESTREAM`, perceptual sRGB). **Gate:** `tests/pnm.rs` — 143 of 143 byte-identical to `cwebp`, 20 of 20 to `cjxl`; `cwebp`'s refusals (`P1`-`P4`, a one-line header, truncation) checked against `cwebp`. `cwebp` reads no `P1`-`P4`, and neither does `cjxl`, so no reference exists for them.

## ✓ **PFM input**

(2026-10-01), as `cjxl` reads it: 32-bit floats handed to libjxl as they are (bottom-up rows, the scale's sign as byte order). **Gate:** `matches_cjxl_reading_pfm` — 12 of 12 byte-identical. Other formats get it clamped to 0..1 at 8/16 bits, with no reference to match (only `cjxl` reads PFM).

## **libjxl 0.12.0 fails a lossless float encode at effort 3**

("Residual overflow", `enc_encoding.cc:314`) — `cjxl` itself fails the same PFM, so the PFM gate pins that both refuse it. It matches libjxl's open issue #4902, "Lossless fp32 encoding fails when the image mixes negative and positive values" (a suspected 0.12.0 regression; the fixture's samples run from -0.05 to 1.06), and #4905 reports the same error with patches. Check whether a libjxl release fixes it before the next libjxl bump, and turn the pin into a parity case then. <https://github.com/libjxl/libjxl/issues/4902> · <https://github.com/libjxl/libjxl/issues/4905> Checked 2026-10-01: #4902 is still open, and PR #4948 ("modular: wrap residual subtraction for lossless fp32 predictors", open since 20 August 2026) says it fixes it, with a regression test. libjxl 0.12.0 is still the newest tag; watch for a release carrying #4948. <https://github.com/libjxl/libjxl/pull/4948> Re-checked 2026-10-03: #4902 and #4948 still open, 0.12.0 still the newest tag.

## ✓ **A still GIF into JPEG XL, as `cjxl` reads it**

(2026-10-01). `cjxl` reads GIF with its own reader (`lib/extras/dec/gif.cc`): three colour channels, alpha only when a pixel is transparent, perceptual sRGB — and it counts GIF a lossy input, so with no `-d`/`-q` it encodes losslessly. Skidbladnir took the generic path (relative intent, distance 1). **Gate:** `matches_cjxl_reading_a_still_gif` in `tests/gif.rs` — four still GIFs (opaque, transparent index, local palette + interlaced, a loop extension) x five settings including no target: 20 of 20 byte-identical to `cjxl`. Mutation: the generic path fails 16, the distance-1 default fails 8.

## ✓ **TIFF into HEIC, held to `heif-enc`**

(2026-10-01; test only, nothing needed changing): `heif-enc` reads TIFF with libtiff (`heifio/decoder_tiff.cc`). `matches_heif_enc_across_tiff_inputs` — 8-bit RGB (plain and LZW) and straight-alpha RGBA x two settings: 6 of 6 byte-identical. A 16-bit TIFF is refused by Kvazaar in `heif-enc` too.

## ✓ **WebP into HEIC, held to `heif-enc`**

(fixed 2026-10-01). `heif-enc` reads a *lossy* WebP straight into YCbCr 4:2:0 planes (`heifio/decoder_webp.cc`: `WebPDecode` into `MODE_YUV(A)`, never RGB), where Skidbladnir went through RGB — 4 of 8 conversions differed (every lossy one). A lossy WebP now reaches the shim as its own 4:2:0 planes (`encoder::webp_yuv420_planes`, the same decode the `cwebp` route uses, and a third input layout in `native/heic_shim.c`). **Gate:** `matches_heif_enc_across_webp_inputs` — lossless and lossy, with and without alpha, and an odd-sized lossy one: 9 of 9 byte-identical. GPL edition: the same input path, built and checked by CI only.

## ✓ **HEIC into HEIC, held to `heif-enc`**

(fixed 2026-10-01). `heif-enc` decodes a HEIF input with libheif in the file's own colourspace and chroma, NCLX passed through and transformations applied, and keeps its first Exif and XMP blocks (`heifio/decoder_heif.cc`). Skidbladnir decoded to RGB and **dropped the source's Exif and XMP**. The shim now loads an untouched HEIC itself, as that reader does (`load_heif` in `native/heic_shim.c`); the window's Exif/XMP toggles still leave them out. With the ICC toggle off, the pixels go through RGB (the reader cannot drop a profile). **Gate:** `matches_heif_enc_across_heic_inputs` — sources written by `heif-enc` (RGB, RGBA, gray, odd size, every kind of metadata) x two settings: 10 of 10 byte-identical, plus a direct check that Exif/XMP are kept and left out as asked. Mutation: the old route fails it (on the dropped metadata first). AVIF-in-HEIF input is not covered: neither our libheif nor the reference `heif-enc` decodes AV1.

## ✓ **Decided (owner, 2026-10-01): correct TIFF colours by default, with an opt-in to reproduce the tools.**

`EncodeJob::tiff_alpha_like_reference` ("TIFF input → Read transparency as the official tool does", off by default): WebP from a straight-alpha TIFF is premultiplied as `cwebp`/libtiff do, and HEIC from a premultiplied TIFF takes the stored samples as `heif-enc` does. **Gates:** `matches_reference_cwebp_through_a_straight_alpha_tiff_when_asked` (8- and 16-bit x 138 settings: 276 of 276 byte-identical to `cwebp`) and `matches_heif_enc_through_a_premultiplied_tiff_when_asked` (2 of 2 to `heif-enc`, and the default checked to differ). Mutation: either branch removed fails 275 of 276 and 2 of 2. This also settles the straight-alpha exception below.

## ✓ (owner decision) **Premultiplied-alpha TIFF into HEIC.** Decided above

Since 2026-10-01 an associated-alpha TIFF is un-multiplied as `cwebp` does, for every format. Reading `heifio/decoder_tiff.cc`, `heif-enc` instead takes associated alpha as plain alpha (it un-multiplies nothing unless `--premultiplied-alpha` marks the image), so its HEIC of such a TIFF is darker where semi-transparent — the mirror image of the straight-alpha exception kept for `cwebp`. **Run 2026-10-01:** a 16x16 TIFF stored as premultiplied (100, 50, 25) at alpha 128 — straight colour (200, 100, 50), which is how ImageMagick reads it — comes out of `heif-enc -e kvazaar -q 100` and `heif-dec` as (100, 50, 25) at alpha 128. Decide whether HEIC keeps true colours (as now) or follows `heif-enc`, then pin it with a test either way.

## ✓ **Y4M input into AVIF, held to `avifenc`**

(2026-10-01): `avifenc`'s own reader (`apps/shared/y4m.c`) is compiled into the shim, reading from memory through a `tmpfile`, so a Y4M's planes are encoded as they are, with `avifenc`'s Y4M rules (`-y` and `-r` ignored, `-d` must match, no `-d D,E`). The first frame only. For every other output, and for the preview, it is converted to RGB with libavif's defaults for an unsignalled image (BT.601, the file's range); no reference tool makes that conversion for WebP or JPEG XL. **Gate:** `matches_avifenc_across_y4m_inputs` — 4:2:0, 4:2:2, 4:4:4, 4:4:4 with alpha, mono, 10- and 12-bit, full range, odd size x four settings, plus lossless and `-d 10`, and both refusals: 40 of 40. Mutation: the RGB route fails 40 of 40.

## ✓ **Y4M into HEIC, held to `heif-enc`**

(2026-10-01). `heif-enc`'s reader (`heifio/decoder_y4m.cc`) takes every Y4M as 8-bit 4:2:0 planes whatever its `C` tag, and refuses a frame line with parameters. Where that reading is the file's (8-bit 4:2:0, or no tag) the planes go to the shim as they are, through the lossy-WebP planes layout; any other Y4M, which `heif-enc` misreads or refuses, takes the RGB conversion instead — correct colours, as with the TIFF cases, and no reference. **Gate:** `matches_heif_enc_across_y4m_inputs` 8 of 8 (no tag, `C420jpeg`, `C420mpeg2`, 61x45 `C420` x two qualities); the RGB route fails 8 of 8.

## ✓ **PGX input, held to `cjxl`**

(2026-10-01): `src/pnm.rs` reads it as `lib/extras/dec/pgx.cc` does, refusals included (signed, over 16 bits). `cjxl` hands libjxl the samples at their container's full range, which is right only at 8 and 16 bits — run here, a 12-bit 4095 decodes as 256 of 4095 — so those two depths are matched and every other depth is read as meant (rescaled), with no reference. **Gate:** `matches_cjxl_reading_pgx` 16 of 16 (8- and 16-bit, both byte orders, CRLF, the optional space; four settings), the 12-bit file checked to be read right and to differ from `cjxl`, and both refusals. Mutation: the generic route fails 16 of 16.

## ✓ Raw YUV input, as `cwebp -s` reads it (2026-10-02)

a `.yuv` file (known by its extension; raw planes have no signature) is 8-bit I420 at `EncodeJob::yuv_size`, set under "Raw YUV input" in both windows. Into WebP the planes go straight into a YUV picture, as `ReadYUV` puts them, and through libwebp's own YUV-to-ARGB on the paths that need it; the other formats get that RGB. Parity gate `matches_reference_cwebp_through_raw_yuv`: 138 of 138 settings byte for byte on a 67x49 fixture (odd, so the chroma planes round up); with the planes sent through RGB instead, 77 diverge. A wrong length and a missing size are refused, as `cwebp` refuses them.

## ✓ `heif-enc --raw` has no result to reproduce in this build (checked 2026-10-02)

its reader (`heifio/decoder_raw.cc`) makes one typed component in a custom colour space, which only libheif's uncompressed codec can write, and the libheif Skidbladnir ships and the reference `heif-enc` are built with HEVC encoders only. Run here: `heif-enc --raw-width 8 --raw-height 8 --raw-type uint8 m.raw -o m.heic` fails with "Unsupported feature: Unsupported color conversion", and this `heif-enc` has no `-U`. Revisit only if uncompressed HEIF output is ever added.

## ✓ EXR input, as `cjxl` reads it (2026-10-02)

`src/exr_input.rs` reads with the `exr` crate (BSD-3-Clause, pure Rust, already in the tree through `image`) and picks what libjxl's `exr.cc` picks — R/G/B or the first layer's triple, else the first channel as gray, that prefix's alpha (premultiplied), the display window with the data window placed in it, linear light with sRGB primaries or the file's chromaticities, white luminance as the intensity target, and its refusals (`UINT`, subsampled, mixed types). JPEG XL gets the samples as stored (half or float), alpha flagged premultiplied unless `--premultiply` says otherwise; the other formats get the sRGB curve, clipped at white. The reference `cjxl` is now built with OpenEXR (`build-reference-tools.sh` fails if it is missing; CI installs `libopenexr-dev` and Homebrew's `openexr`). Gate `matches_cjxl_through_exr`: 134 cases over 10 files (half and float, RGB/RGBA/gray, a named layer, data windows inside and past the display window, P3 chromaticities with 203 nits, uncompressed, RLE, ZIP, PIZ, PXR24, B44, DWAA and DWAB), 126 byte for byte and 8 that `cjxl` and Skidbladnir both refuse (libjxl 0.12.0 fails `JxlEncoderProcessOutput` on half-float alpha at `-d 25`, `-q 0` and resampling 2-8). Dropping the premultiplied flag fails 84, and declaring halves as floats 114, of the first 124 (before the DWA files were added).

## ✓ EXR channels beyond colour and alpha (2026-10-02)

written as `cjxl` writes them, each a named optional extra channel after the alpha, with a value-initialised info (not `JxlEncoderInitExtraChannelInfo`'s) at its own half/float depth, and its buffer after the frame. 15 more cases in `matches_cjxl_through_exr` (RGBA with a float depth and a half mask, gray with a depth, two layers with the second as extras), 149 in all; leaving out the names, or the channels, fails all 15.

## ✓ JPEG XL to JPEG XL, as `cjxl` converts it (2026-10-02)

`cjxl` decodes a `.jxl` input with libjxl (`DecodeImageJXL`, `coalescing=false`), and so does Skidbladnir now (`jxl::decode_like_cjxl`, the decoder already linked): float samples at the codestream's depth through an image callback (as `use_image_callback` has it), alpha kept premultiplied or not as coded, orientation undone and the Exif box's offset stripped and orientation reset (`ResetExifOrientation`), XMP and JUMBF, the data's colour as an encoding or else ICC, every extra channel past the first alpha with its own description and name, and the decoder's basic info and frame header (with its name) handed to the encoder as `cjxl` hands `ppf.info` over. Gate `matches_cjxl_from_jpeg_xl`: 126 cases over six sources `cjxl` wrote (lossless and lossy RGBA, 16-bit gray, Exif orientation 6 with XMP, float from PFM, EXR with extra channels; the option surface and every hint on the first), 124 byte for byte and 2 that both refuse (124 in a debug build; see below). Mutations: no orientation reset fails 6; ICC for every colour, 20.

## ✓ A lossy JPEG XL made lossless matches too, in an optimised build (2026-10-02)

In a debug build it differed in 2 of 9,216 samples by one level: the `cmake` crate builds libjxl at the Cargo profile's optimisation, so a debug test links an unoptimised decoder whose float maths round differently from the reference's Release build. Not a SIMD target: both builds carry AVX2, SSE4 and SSE2 only (`nm`). `cargo test --release` (CI's parity job, and what ships) matches all 126; the gate leaves the two out only under `debug_assertions`.

## ✓ A JPEG XL's IPTC and `jhgm` boxes (2026-10-02)

read as `cjxl` reads them and written back as it writes them (IPTC as an `xml ` box after the XMP and JUMBF, then `jhgm`; `--container=0` strips them with the rest). 6 more cases, from `cjxl`'s own container with the two boxes appended: 132 in all, release build; dropping the boxes fails 5 (the sixth is `--container=0`).

## JPEG XL to JPEG XL, not matched yet

several frames or layers (animation, deferred with the multi-image work) and a cropped layer — each converted from its pixels instead.

## HTJ2K-compressed EXR

the `exr` crate cannot decompress it (`compression/mod.rs` returns "yet unimplemented compression method").

## Animated GIF and APNG into `cjxl` (with the multi-image work below)

## ✓ Animated WebP's own options as controls (2026-10-01)

`-mixed`, `-min_size`, `-kmin`/`-kmax`, `img2webp -loop` and `gif2webp -loop_compatibility` (`WebpAnimation`). Found on the way: under `-mixed` the encoder still reads the config's own `lossless`, which `gif2webp` sets lossy and `img2webp` leaves lossless. **Gates:** `matches_reference_img2webp` 42 cases (was 18), `matches_reference_gif2webp_with_animation_options` 70 of 70; every option mutation-tested.

## ✓ `img2webp -d` given once for every frame (2026-10-01)

`WebpAnimation::frame_duration`, "Set every frame's duration". **Gate:** two cases in `matches_reference_img2webp` (46 of 46 now); ignoring it fails 4.

## ✓ `img2webp`'s frame options (2026-10-02)

`WebpAnimation::frame_changes`, each "from frame N on: lossy or lossless, quality, method, exact, duration", applied per frame in frame order as `img2webp` carries an option from the frame it precedes to every later one (`animation::for_frame`; `-lossy`/`-lossless` ignored under `-mixed`, as there). In both windows' Animation section as a list of changes (the gpui window gained `SKID_EXPAND` to open a disclosure for a check). Gate: 10 cases at two loop counts in `matches_reference_img2webp` (66 in all), the harness putting each change's flags before its frame; ignoring the changes fails 18, applying them out of order 4. GIF input has no such options in `gif2webp`, so there they apply on top, with no reference. Smoke test 43/43; axe clean with a change added in every "every control showing" state.

## ✓ GPL edition

`heif-enc`'s `-p x265:<param>` beyond the fixed set of x265 controls (2026-10-01): `HeicSettings::x265_parameters`, a list of `KEY=VALUE` passed after the controls (so one overrides them), refused in the standard edition and dropped when a GPL settings file loads there. **Gate** (GPL build): `free_form_x265_parameters_reach_x265` — the controls' own value given again changes nothing, another value does, a parameter with no control does, the result decodes, and an unknown parameter is an error. Checked by decoding, like all x265 output.

## ✓ Parity on macOS again (2026-10-01)

the `parity` job is a matrix over `ubuntu-latest` and `macos-latest` (Apple silicon), with `--no-fail-fast`. Its first macOS run found a test bug, not an encoder one: the AVIF, HEIC and JPEG XL gates named scratch directories after the clock, which ticks in microseconds on macOS, so parallel tests shared and deleted one directory; a counter replaced it. Every gate then passed on macOS in CI run 36956355147.

## ✓ Parity on Windows

the reference tools would have to build there (`makefile.unix` does not; CMake might). A first slice, sized 2026-10-02 from libwebp's sources: libwebp's CMake builds `cwebp` with MSVC, but on Windows it reads PNG, JPEG and TIFF through WIC whenever `wincodec.h` is found (`cmake/deps.cmake`, `HAVE_WINCODEC_H`), a different decoder from the libpng/libjpeg-turbo/libtiff the gates match. So: configure with `-DHAVE_WINCODEC_H=0` (the check is skipped when the variable is set) and run only the gates that never hand cwebp a PNG, JPEG or TIFF — the PAM control surface, the cwebp-defaults reset, WebP and PNM sources, raw YUV — as a Windows parity leg. **First slice done (2026-10-02):** CI's `parity-windows` job runs the four `tests/parity.rs` gates of that kind, and on its first run every case matched with MSVC builds of both sides — 138 control-surface settings, 552 WebP-to-WebP conversions, 138 raw YUV conversions and the defaults reset (run 37092442114). Then, all passing on their first runs (37094421926) and now gates: `img2webp`, `gif2webp` and `webpmux` too, and the image readers the Linux references use (libjpeg-turbo from our submodule; libpng, libtiff and giflib from vcpkg; static runtime, no WIC) — every `tests/parity.rs`, `tests/animation.rs` and `tests/gif.rs` gate and `tests/pnm.rs`'s cwebp ones on Windows; and `cjxl` from libjxl's CMake with MSVC — every JPEG XL gate but EXR's and the JPEG XL-source one (libjxl finds OpenEXR only through pkg-config), and `tests/pnm.rs`'s PNM, PFM and PGX ones. **Done (2026-10-03):** OpenEXR for that `cjxl` (vcpkg's `openexr`, found through vcpkg's `pkgconf`; `/Zc:lambda`, since MSVC's legacy lambda parser refuses libjxl 0.12.0's `exr.cc`), so the JPEG XL-source gate runs there (132 of 132); `avifenc` built by `scripts/build-reference-avifenc.sh`, which now runs under Git Bash with MSVC (every `tests/avif_parity.rs` gate); and `heif-enc` from a second libheif built by `scripts/build-libheif.sh` with vcpkg's readers on the dynamic runtime (every `tests/heic_parity.rs` gate). All gates in CI run 37171820482. Two real bugs came out of it, below. The EXR gate itself stays out on Windows (next item).

## ✓ **EXR on Windows: `cjxl` writes other bytes for 10 of 149**

(found 2026-10-03, CI run 37171820482; diagnosed and settled 2026-10-04): every case of the two fixtures whose data window leaves part of the display window uncovered. Not Skidbladnir and not OpenEXR: libjxl 0.12.0's `lib/extras/dec/exr.cc` `malloc`s the display-window image (`PackedImage`, `packed_image.cc`) and copies only the data window in ("TODO(eustas): should we deal with unpopulated pixels?"), so `cjxl` encodes whatever the allocator returned there: zero on a fresh glibc or macOS heap, other bytes on Windows. Shown on the dev host: with `MALLOC_PERTURB_=165` Linux's `cjxl` diverges on exactly the same 10 of 149. Skidbladnir makes those pixels zero, so `matches_cjxl_through_exr` now holds those two fixtures to `cjxl` reading the same image with the zeros written out (the data window widened to the display window), every `cjxl` run in `tests/jxl_parity.rs` is under `MALLOC_PERTURB_` (a case that matches only by luck fails on Linux too), and the EXR gate runs on Windows. 149 of 149 on the dev host and on Windows (CI run 37253214479, `parity with cjxl / windows`); moving the placement one pixel fails the 10. Still unfixed on libjxl's main branch (<https://github.com/libjxl/libjxl/blob/main/lib/extras/dec/exr.cc>, the TODO at line 464; <https://github.com/libjxl/libjxl/blob/main/lib/extras/packed_image.cc>, line 110).

## Report libjxl's uninitialised EXR border upstream (an issue on libjxl/libjxl; none found by searching its tracker on 2026-10-04)

`cjxl` encodes undefined pixels for any EXR whose data window does not cover its display window. The routine does not file issues on its own; the reproduction is the `MALLOC_PERTURB_` run above.

## ✓ **Every Windows libheif lacked sharp YUV**

(found and fixed 2026-10-03 by the Windows `heif-enc` parity job): `scripts/build-libheif.sh` looked for `sharpyuv.lib`, MSVC builds `libsharpyuv.lib`, and libheif's configure quietly built without it. `heif-enc` then refuses `-C sharp-yuv`; the app only prefers it, so a Windows HEIC made with Sharp YUV used the default downsampler. The script now finds it and fails without it. Gate: the Windows `heic_parity` run, 8 of 8 tests, sharp YUV cases included.

## ✓ **libaom, libavif and libjpeg-turbo were debug-quality builds on Windows**

(found and fixed 2026-10-03 by the Windows `avifenc` parity job): with Visual Studio's generator `cmake-rs` 0.1.58 replaces `CMAKE_<LANG>_FLAGS_RELEASE` with the compiler's base flags minus `/O`, so CMake's `/O2 /Ob2 /DNDEBUG` never reached them: unoptimised, assertions on. A libaom assertion (`av1/encoder/bitstream.c:2982`) ended the test process on a superres setting. `build.rs`'s `msvc_release_build` now sets the Release flags itself. Gate: the Windows `avif_parity` run, 4 of 4 tests, byte for byte.

## ✓ **libjxl on Windows has the same unoptimised build**

(fixed 2026-10-04, though not the way first suggested): `cmake-rs` replaces the Release flags only when no generator is named, and reads `CMAKE_GENERATOR` from the environment, so `build.rs` (`libjxl_msvc_generator`) names the Visual Studio generator for `jpegxl-src`'s build in release builds, and fails the build if libjxl's `CMakeCache.txt` then lacks `/O2` and `/DNDEBUG` (a cache configured before is removed first). Every Windows parity job passed with it, the build-time check included (CI run 37253214479: `cjxl` 7 of 7 tests, `avifenc`, `heif-enc`, libwebp's tools). *Original item:* `jpegxl-src` builds it with `cmake-rs` and ClangCL, so the flag replacement above applies, and `build.rs` cannot reach that configure. The JPEG XL gates pass there all the same (byte parity held with an unoptimised libjxl), so this is speed, and assertion code shipped, not output. The fix is the one already suggested for `jpegxl-src`'s licence header: our own CMake invocation over the pinned libjxl source, through `msvc_release_build`; the Windows JPEG XL gates must stay green through it (Linux showed an unoptimised libjxl rounding differently on decode).

## Build libjxl from a pinned source with our own CMake call instead of `jpegxl-src`'s

its crates.io metadata says BSD-3-Clause but its `lib.rs` carries a GPL header (it only runs at build time and nothing of it is linked; Phase 7's JPEG XL item). Not a submodule alone: libjxl's own dependencies (highway, brotli, skcms) are nested submodules, and every CI job checks out `submodules: true` without recursion, so the source tarball and all 12 checkouts would change with it. Pins at libjxl v0.12.0 (`git ls-tree v0.12.0 third_party/`, 2026-10-04): highway `457c8917`, brotli `028fb5a2`, skcms `96d9171c`; the library build needs only those three (sjpeg, lcms, libpng, zlib, googletest, libjpeg-turbo and testdata are for tools, tests or alternatives). The reference `cjxl` builds (`scripts/build-reference-tools.sh`, the Windows `cjxl` job) take their source from `jpegxl-src` too and move with it. Top-level submodules for the three would need no change to the checkouts, but libjxl cannot simply be pointed at them: `third_party/skcms.cmake` hard-codes `${PROJECT_SOURCE_DIR}/third_party/skcms`, so `build.rs` would assemble a source overlay (libjxl with the three in its `third_party/`) in `OUT_DIR` and configure that.

## Multi-image features the tools have, deferred by the owner (2026-09-28)

### Animation and image sequences

`avifenc` from Y4M or several inputs (timescale, keyframe interval, repetition count), `cjxl` from GIF/APNG, and `heif-enc -S`/`-V`. (Animated WebP and GIF to animated WebP shipped in 0.12, Phase 7, held to `img2webp` and `gif2webp`.)

### Several inputs into one file

`avifenc --grid` from separate cells, `avifenc --layered`, `heif-enc` with several images and `-T` tiled input.

### `heif-enc` metadata tracks, MIME items, and the other experimental item types

## Formats

### ✓ **SVG input**

(2026-10-01): `src/svg.rs` rasterises with `resvg` 0.48 (Apache-2.0 OR MIT) at the file's own size, transparency kept, straight colour, text in the system's fonts. Only `data:` images embedded in the file are drawn: no path or URL an SVG names is opened (`never_reads_another_file`, which fails with `resvg`'s default resolver). Capped at 100 megapixels. Sniffed by content (the sniff window grew from 64 bytes to 1 KiB for SVG's XML declaration and comments). Tested to every format; no reference tool reads SVG.

### ✓ SVG drawn at the resize's size (2026-10-01)

an uncropped SVG with a resize is redrawn at the target size before any format's encoder sees it (`encoder::svg_at_resize`), the missing dimension derived as libwebp's rescaler derives it, so sizes match every other source's. Tested: a hard edge survives a 2x enlargement to lossless WebP (fails without it).

### ✓ `.svgz` input (2026-10-01)

`resvg`'s `svgz` feature, and the sniff looks inside the gzip stream, from the start of the file alone.

### ✓ SVG drawn at the crop's size (2026-10-02)

with a crop and a resize both set, only the crop's rectangle (in the drawing's own pixels) is drawn, straight at the resized size (`svg::rasterise_region`), the missing dimension derived from the crop as libwebp's rescaler derives it. A crop alone still keeps the raster's own pixels. Tested: sizes match libwebp's crop-then-rescale for four crops, a crop outside the drawing is refused, and a hard edge survives an 8x enlargement of a crop to lossless WebP (fails with the old raster route).

### **SVG output**

(owner request, 2026-09-28) — needs the owner's answer to the question below first. The original notes, input included: *Input* means rasterising: `resvg` is the obvious renderer (pure Rust, no C toolchain); it needs a size — the SVG's own, or the resize — and a background for the areas SVG leaves transparent. *Output* is the open design question, because a raster has no vectors to write: either trace it (`vtracer`, which suits logos and flat art and mangles photographs) or wrap the encoded raster in an SVG `<image>` (lossless in content, and pointless unless something requires an `.svg`). Decide which one users mean before building either; they may want both. Check each crate's licence against ISC first.
