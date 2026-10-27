---
title: "Roadmap overview"
summary: "How the roadmap is kept, and the migration it tracks."
order: 1
group: Roadmap notes
---

# Roadmap overview

*The checklist itself is the [roadmap](https://github.com/basic-automation/Skidbladnir/blob/master/ROADMAP.md). This is the text that used to introduce it.*

Single source of truth for the work queue. Every item is a `[ ]`/`[x]` checkbox in
phase order. Tick `[x]` only when the item genuinely shipped and was verified.
Discovered work becomes a new `[ ]` in the right phase. No status tables, no run
logs, no prose essays — git history and the PRs are the record.

**The migration in one line:** Skidbladnir was an Electron 9 GUI wrapping `cwebp`.
It moved to **Rust + Tauri 2** with a **Nuxt + Tailwind** frontend, shipping on
**Windows, Linux and macOS**, without losing a single one of the encoder controls
the Electron app exposed; the Electron app was retired in 0.7.0 (Phase 6).
