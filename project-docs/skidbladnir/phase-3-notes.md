---
title: "Phase 3 — Frontend parity (Nuxt + Tailwind) — notes"
summary: "The prose, findings and finished-work write-ups behind this section of the roadmap checklist."
order: 5
group: Roadmap notes
---

# Phase 3 — Frontend parity (Nuxt + Tailwind) — notes

*The checklist for this section is in the [roadmap](https://github.com/basic-automation/Skidbladnir/blob/master/ROADMAP.md). What follows is the writing that used to sit between its items; a ✓ marks an item that was done when it moved here.*

Parity means a user of the Electron app finds every control they had, not a
prettier subset.

## ✓ File selection

input paths and output path, via `tauri-plugin-dialog`. The window holds only `dialog:allow-open` and no filesystem permission at all — every read and write happens in Rust against a path the user picked.

## ✓ Drag-and-drop of input files onto the window, using Tauri's **native** drag-drop event rather than HTML5 dragover/drop

with the native handler enabled the webview's own events never fire, so the HTML5 approach looks right and silently does nothing. Which dropped files are usable is decided by the Rust core reading each file's leading bytes, so the UI cannot accept something the loader then refuses. **Caveat: the drop gesture itself is unverified.** A native drag cannot be synthesised over WebDriver; what was verified in the running app is that the listener registers without error and that `inspect_dropped_paths` correctly sorts a real PNG, a text file and a missing path.

## ✓ The mode selector and its conditional control groups

Verified in the running window over WebDriver: lossy shows 9 sliders plus the advanced disclosure, and switching to lossless collapses to 3 sliders with no advanced group.

## ✓ Every Phase 2 control bound to the UI, with the same ranges and defaults

The defaults are **fetched from the Rust core** on mount rather than written again in TypeScript, which is how the two would otherwise drift.

## ✓ The advanced-options disclosure

It is present for lossy mode, where the expert controls actually reach the encoder.

## ✓ Per-control help text

**The premise of this item was wrong and is corrected here:** the Electron UI's `-info` elements are live numeric value readouts, not help text, and the whole app contains exactly one tooltip (on the file picker). There was no copy to carry over, so the help text is taken from `cwebp -longhelp` — libwebp's own wording, which is the authoritative description of what each flag does.

## ✓ Input/output validation and error states

Convert is disabled until inputs, a destination and (in preset mode) a preset are chosen, and settings are validated by the **Rust** `validate_settings` command rather than a second copy of the rules in TypeScript. Per-file failures are listed without stopping the run.

## ✓ Conversion progress and the completed state

Real per-file progress via libwebp's `WebPPicture::progress_hook`, emitted as a `conversion-progress` event and shown as a bar with a file counter. **libwebp does not guarantee a final call at 100** — a default-quality encode of a 96x64 fixture stops reporting at 68 — so completion is signalled by the command returning, not by the bar filling. The UI says so rather than appearing stuck.

## ✓ Original vs converted size readout

a results table with before, after, the percentage change and the encoded dimensions, per file.

## ✓ Theming

**Owner directive 2026-09-24: keep the Electron app's design, restyled in the Tailwind Palenight palette, using a skinned component library.** Delivered as:
- **Nuxt UI 4** for the components (chosen over shadcn-vue: it is a Nuxt module, so
  it owns the Tailwind 4 integration and needs no per-component vendoring).
- The **Material Theme Palenight** palette written out as Tailwind `@theme` colours
  in `frontend/assets/css/main.css`, with Nuxt UI's semantic tokens (`--ui-bg`,
  `--ui-primary`, …) re-pointed at it, so every component it renders is skinned by
  default rather than restyled one at a time.
- The Electron app's **layout kept**: the full-width dot-textured header band with a
  large centred title, the 2px **dotted** borders around option groups, the
  two-column control rows, the fixed dot-textured footer, and the circular accent
  FAB bottom-right. Only the palette moved.
The app is dark-only, which is what the Palenight theme is; there is no light variant
to follow the system preference into.

## ✓ Bundle the icon set (`@iconify-json/lucide`) rather than letting Nuxt UI fetch icons from the Iconify API at runtime

a desktop app cannot assume network access, and an icon that silently fails to load offline is a broken window. 43 icons, 10.4 KB.
