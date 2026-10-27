---
title: "Phase 2 — Encode core in Rust (the real work) — notes"
summary: "The prose, findings and finished-work write-ups behind this section of the roadmap checklist."
order: 4
group: Roadmap notes
---

# Phase 2 — Encode core in Rust (the real work) — notes

*The checklist for this section is in the [roadmap](https://github.com/basic-automation/Skidbladnir/blob/master/ROADMAP.md). What follows is the writing that used to sit between its items; a ✓ marks an item that was done when it moved here.*

The Electron app shells out to `cwebp.exe`. The Rust port should not.

## ✓ **Decide the encode backend. The answer: `libwebp-sys`, binding libwebp's `WebPConfig`.**

It carries a 1:1 field for every control the Electron UI exposes, and byte-for-byte parity with `cwebp` is now demonstrated rather than assumed (see the parity item below). It vendors and statically links libwebp, so there is no system library to locate on Windows or macOS — CI builds it green on all three platforms. The `image` crate was rejected: it reaches none of the advanced knobs, so it cannot reach parity. The **Tauri sidecar remains the documented fallback**, and `cwebp_args()` keeps it a working one rather than a paper plan. **No binary is vendored into this repository, and none will be without writing its provenance and update path down first.** libwebp-sys compiles libwebp *from source* as part of the build, so what ships is built here from a pinned crate version, not a downloaded executable of unknown origin. If the sidecar fallback is ever taken, the three `cwebp` binaries, where each came from, how their integrity is checked and who updates them go into this file and the README **before** they are committed.

## ✓ Define the `EncodeSettings` type

`crates/skidbladnir-encode/src/settings.rs`. (Since split into `EncodeJob` + `WebpSettings` for Phase 7; see the AVIF item.) Serializable, camelCase over the wire, `#[serde(default)]` so a partial payload from the frontend fills in rather than failing, with every range and default taken from the Electron UI's own `<input>` attributes and pinned by test.

## ✓ Implement the encoder and prove **parity against `cwebp` itself**

`crates/skidbladnir-encode/tests/parity.rs` encodes the same pixels through `encode_rgba` and through a real `cwebp` and compares the output byte for byte. **76 settings covering the whole control surface match `cwebp` 1.6.0 exactly.** The fixture is a PAM (`P7`, `RGB_ALPHA`) file, which `cwebp` reads with its own built-in PNM reader, so no image decoder sits between the two encoders and a mismatch can only be the encoder configuration. The gate was itself mutation-tested: deleting the `near_lossless => lossless = 1` line makes 5 cases diverge, and forcing `use_argb = 0` aborts the run, so it genuinely catches regressions rather than passing vacuously.

## ✓ Build a **version-matched** reference `cwebp` in CI, so parity is **enforced** there rather than reported

CI asks the linked library its own version (`cargo run --example libwebp-version`), clones libwebp at that exact tag, builds `cwebp` from `makefile.unix` and runs the parity test with `SKIDBLADNIR_REQUIRE_PARITY=1` — so a missing or mismatched reference now fails the build. A `libwebp-sys` bump is followed automatically instead of silently degrading the gate to a skip. Unix only: `makefile.unix` does not build on the Windows runner, so parity is enforced on Linux and macOS and reported on Windows.

## ✓ Port the **mode** surface

lossy · lossless · near-lossless · JPEG-like · preset — all five, parity-tested.

## ✓ Port the **preset** surface

`default`, `photo`, `picture`, `drawing`, `icon`, `text` — all six, and libwebp's own preset table is pinned by test.

## ✓ Port **quality** and **alpha quality**

parity-tested at quality 0/1/50/99/100 and alpha quality 0/50/100.

## ✓ Port **compression method** (`-m`) and **segments** (`-segments`)

parity-tested across every value, 0..=6 and 1..=4.

## ✓ Port **spatial noise shaping** (`-sns`)

parity-tested at 0/25/50/100.

## ✓ Port the **filter** surface

strength, sharpness, strong/simple, auto-filter — parity-tested: auto, plus strong and simple at 0/0, 20/3 and 100/7.

## ✓ Port **target size** and **target PSNR** (mutually exclusive with quality)

parity-tested; `-print_psnr` sets `show_compressed`, as cwebp does.

## ✓ Port **multi-pass** (`-pass`)

parity-tested at 1/6/10.

## ✓ Port **partition limit** (`-partition_limit`)

parity-tested at 0/50/100.

## ✓ Port **sharp YUV** (`-sharp_yuv`)

parity-tested, including its effect on the ARGB colour path.

## ✓ Port **low memory** (`-low_memory`)

parity-tested.

## ✓ Port **resize** (width/height)

parity-tested at four sizes including width-only and height-only, and the `-exact` path lossless takes.

## ✓ Port **multi-threading** (`-mt`)

parity-tested on and off.

## ✓ Report real before/after file sizes and the original size back to the UI

`Conversion { source_bytes, output_bytes, width, height }` plus `saving_percent()`. The dimensions are read back out of the encoded file rather than echoed from the request, because a resize with one dimension given as `0` is only resolved by the encoder.

## ✓ Read the user's input files

`crates/skidbladnir-encode/src/source.rs` decodes PNG, JPEG and TIFF with the `image` crate and WebP with libwebp itself, identifying the format by **content sniffing** rather than by extension as the Electron app does. The full file pipeline is parity-tested too: our PNG decode plus libwebp encode matches `cwebp`'s libpng decode plus libwebp encode byte for byte.

## ✓ Write output files safely

`encode_file` refuses to overwrite the source image and stages the write through a temporary file in the destination directory, renamed into place only on success, so a failed encode cannot truncate an existing file. It also refuses to create an output directory the user did not choose. **This closes a real data-loss bug in the Electron app**: it accepts WebP input and derives the output name as `<stem>.webp` in the chosen directory, so converting a WebP into its own folder silently overwrites the original.

## ✓ A `convert_image` IPC command over the above, returning the input path, the output path and the sizes

enough for a batch UI to attach each result to its row.

## ✓ The Electron file filter's JPEG aliases (`.jpe`, `.jif`, `.jfif`, `.jfi`) need no special handling

input is identified by **content**, not extension, so they are all simply JPEG. The picker still lists them so the dialog does not hide the user's files.

## ✓ 16-bit PNG input

**This was a real divergence, found by testing it.** `cwebp` reads PNGs through libpng with `png_set_strip_16`, which **discards the low byte** of a 16-bit sample, while the `image` crate *scales* the value — so 16-bit input encoded differently on the two paths (216 bytes vs `cwebp`'s 212 for RGBA, 168 vs 166 for RGB) while every 8-bit colour type already matched exactly. The reduction now truncates to match, and `matches_reference_cwebp_across_png_colour_types` pins 16-bit RGBA, 16-bit RGB, 8-bit grayscale and 8-bit grayscale+alpha so it cannot drift back. 8-bit palette was verified identical by hand (the `image` crate cannot write one, so it is not in the test).

## ✓ CMYK JPEG input

**Tested, and it is not a parity question after all: `cwebp` refuses CMYK JPEG outright.** It asks libjpeg for `JCS_RGB`, which libjpeg cannot produce from four channels, so `cwebp` 1.6.0 exits with "libjpeg error: Unsupported color conversion request". There is no reference output to match. What `tests/cmyk_jpeg.rs` pins instead, against a 439-byte Adobe/YCCK fixture made with `magick` (provenance and SHA-256 in the test):
- our decoder produces the **right colours**, not their inverse — within 3 levels of
  ImageMagick's own CMYK→sRGB conversion at both ends and the middle of a ramp;
- the file converts end to end;
- the reference `cwebp` **still refuses** it — after first proving that `cwebp` reads
  RGB JPEG at all, so a build without libjpeg cannot pass it vacuously. If a future
  libwebp starts converting CMYK, this fails, and agreement becomes a parity test.
Runs in CI's enforced parity step alongside `parity.rs`.

## ✓ CMYK JPEG **without** an Adobe marker

Tested with a hand-made fixture (`tests/fixtures/cmyk-plain.jpg`: written by the `jpeg-encoder` crate, APP14 cut out). **Finding:** strictly by libjpeg's convention such a file is not inverted, but our decoder reads it as Photoshop-inverted — and so do `magick` 7.1.2 and Chrome's Skia, which inverts CMYK with no marker check (<https://github.com/google/skia/blob/main/src/codec/SkSwizzler.cpp>). Matching what the user's browser shows is the right call, so the test pins our decode to `magick`'s reading of the file, and fails if the decoder ever starts honouring the missing marker. The reference `cwebp` refuses this file too, now checked alongside the Adobe one.

## ✓ **A WebP source converted to lossy WebP matched `cwebp` in only 84 of 304 cases**

(found 2026-09-28 by the metadata gate as a 4-byte difference, fixed the same day). For a lossy encode with no resize and no sharp YUV, `cwebp` decodes a WebP input straight into a YUV 4:2:0 picture with libwebp's decoder (`imageio/webpdec.c`, `use_argb` off); Skidbladnir decoded to RGBA and let the encoder convert back. `encoder::encode_webp_source_with_progress` now takes `cwebp`'s route, for conversion and preview alike (`source::encode_decoded`). PAM, PNG, JPEG and TIFF sources were never affected: `cwebp` imports their RGB the way we do. **Gate:** `matches_reference_cwebp_through_a_webp_file` in `tests/parity.rs` — the whole 76-setting surface from four `cwebp`-written sources (lossless/lossy × alpha/ opaque): 304 of 304 byte-identical; with the old route, 220 diverge. The metadata gate now compares WebP sources whole in both modes.

## ✓ **JPEG to WebP matched `cwebp` in 17 of 456 cases**

(found and fixed 2026-09-28) — the most common conversion. The encoder was never the problem: `cwebp` reads JPEGs with libjpeg(-turbo) as `JCS_RGB` with fancy upsampling (`imageio/jpegdec.c`), and the `image` crate's decoder (zune-jpeg) rounds its IDCT and chroma upsampling differently, so the pixels handed to the encoder differed (2114 vs 2130 bytes at the defaults). JPEG input now decodes through libjpeg-turbo's decoder, as MozJPEG carries it (`mozjpeg` crate, built from source with `cc` and `nasm`, no CMake), configured as `cwebp` configures libjpeg; CMYK/YCCK JPEGs, which `cwebp` refuses, keep the `image` decoder and its Photoshop-inversion handling. Licence: IJG AND BSD-3-Clause AND Zlib — `IJG` added to `deny.toml`, its notice (with the credit the IJG licence asks for) in `THIRD-PARTY-NOTICES.md`. **Gate:** `matches_reference_cwebp_through_a_jpeg_file` in `tests/parity.rs` — six committed `magick`-written JPEGs (4:4:4, 4:2:2, 4:2:0, progressive, restart markers, greyscale; 97x63 so the upsampler's edges count) × the 76-setting surface: 456 of 456 byte-identical; with the old decoder, 439 diverge. The metadata gate's JPEG sources are now compared whole too (84 of 84). **CI's cwebp links the runner's libjpeg-turbo**, so the gate also checks that libjpeg-turbo versions agree: it passed on the Arch host and in CI on `ubuntu-latest` and `macos-latest` (Homebrew) — run 36518337021.

## ✓ **TIFF to WebP, across the whole surface**

(2026-09-28). 8-bit RGB TIFFs (plain and LZW) already matched `cwebp`; **16-bit TIFFs matched in 0 of 76 settings**, because libtiff's `TIFFReadRGBAImage` reduces 16-bit samples with rounding, `(v * 255 + 32767) / 65535` (its `Bitdepth16To8`), where we truncated as libpng does for PNG. The reduction is now per format. **Gate:** `matches_reference_cwebp_through_a_tiff_file` — four committed `magick`-written TIFFs minus the one below × 76 settings: 228 of 228 byte-identical; truncating again fails 76.

## ✓ **Decided: an unassociated-alpha TIFF keeps its colours, unlike `cwebp`.**

libtiff returns such a file premultiplied, and `cwebp` un-multiplies only *associated* alpha, so it encodes premultiplied colour as straight and darkens every semi-transparent pixel — measured exactly, `(c * a + 127) / 255` on all 24,444 samples. A reading bug, not a setting, so not copied (as the Electron app's `-size 1` default was not). Pinned both ways by `unassociated_alpha_tiff_keeps_its_colours`: ours lossless equals the source; `cwebp`'s equals it premultiplied, and the test says what to do if a libtiff or libwebp release changes that.

## ✓ **Associated-alpha (premultiplied) TIFF input**

(fixed 2026-10-01). **It diverged:** the `image` crate hands the stored, premultiplied samples back, and Skidbladnir encoded them as straight colour, darkening every semi-transparent pixel — 272 of 276 conversions differed from `cwebp`. `cwebp` gets them from libtiff as stored and un-multiplies them itself (`imageio/tiffdec.c`, `MultARGBRow`: 24-bit fixed point, black under alpha 0) when `ExtraSamples` is exactly `[1]`; `source.rs` now does the same, and un-multiplies the 16-bit samples exactly for the other formats. The fixture problem was solved by writing the TIFFs byte by byte in the test rather than with `magick`. **Gate:** `matches_reference_cwebp_through_an_associated_alpha_tiff` — 8- and 16-bit, every alpha value 0-255 present, x the 138-setting surface: 276 of 276 byte-identical. Mutation: plain rounded division instead of the fixed-point form fails 79; no un-multiply fails 272.
