---
title: "Predecessor-derived backlog — notes"
summary: "The prose, findings and finished-work write-ups that sit behind the roadmap checklist for this section."
order: 23
group: Roadmap notes
---

# Predecessor-derived backlog — notes

*The checklist for this section is in the [roadmap](https://github.com/basic-automation/weftdb/blob/main/ROADMAP.md). What follows is the writing that used to sit between its items.*

Concrete items mined from the 15 archived repos, re-mapped to the phases above.
A checked box = shipped; an unchecked box carries its residual status inline
(`partial`/`absent`/`verify`).

#### **B-tags** *(Phase 2/4 · absent)*

Per-measurement tags/labels (incl. `interpolated=true`/provenance); `measurement.rs` has none. *(src: `DSM-Database`, `DSM-Measurement`)*

#### **B-conn** *(Phase 2/7 · absent)*

Vendor-neutral connector trait + registry (core). *(src: `dsm-source`, `dsm-asset`)*

#### **B-ilp** *(Phase 2 · partial)*

ILP ingest shipped (parser + endpoints); the ILP/Influx **interop** connector crate (not a storage swap) is still to do. *(src: `dsm-influxdb`, `dsm-batch`)*

#### **B-rest** *(Phase 2 · partial)*

REST facade + declarative query-params + pagination shipped (`offset`/`limit`/`take`/`page` + `total`/`count` **and now an opaque `next_cursor`/`?cursor=` forward-iteration token** on `…/points` and `…/value-points`); the `interpolation` query-param alias shipped. Residue: cursor tokens are position-over-read-order (stable while the window is unchanged), not a row-identity keyset — a keyset cursor resilient to concurrent inserts is the next refinement. *(src: `DSM-Database`)*

#### **B-poll / B-retry / B-register** *(Phase 7 · absent)*

Scheduled polling daemon (per-source interval) + at-least-once retry buffer + runtime source registration. *(src: `DSM-Input-Module`)*

#### **B-interp** *(Phase 5)*

Interpolate-on-read, single-instant lookup, out-of-range extrapolation. *(src: `splimes`/`weftdb`)*

#### **B-analysis** *(Phase 4/9 · verify)*

Per-point analysis model (signed neighbor distance, slope-segmented trends, max-normalized relative vectors); verify `Trend`/`Relative`/`MeasurementVector`/`Analysis` wired end-to-end. *(src: `dataset_management`, `DSM-Measurement`)*

#### **B-object** *(Phase 4 · absent)*

Schemaless object/annotation store beside numeric aspects. *(src: `DSM-Database`)*

#### **B-windows** *(Phase 9 · absent/partial)*

Sliding/overlapping + event-centered windows; multi-resolution horizon fan-out; min-density validation; config-driven batching policy. *(src: `dsm-batch`, `DSM-Batcher`)*

#### **B-dedup** *(Phase 7 · partial)*

Event-UUID idempotency ledger + delete-after-success queue. *(src: `dsm-batch`, `DSM-Batcher`)*

#### **B-sim** *(Phase 9 · partial)*

Full variability-metric matrix (`static`/`absolute_static`/`percentage`/`absolute_percentage` × `Max`/`Avg`/`Sum`); fixed-point dictionary dedup; occurrence-distance constraint; resample-before-compare (wire to `splimes`). *(src: `DSM-Pattern`)*

#### **B-precision** *(Phase 4/6 · partial)*

`BigDecimal` math audit (no float drift in pattern coords); improved `simplify` (local-extrema). *(src: `DSM-Batch-v2`)*

#### **B-resilience** *(Phase 4/7 · partial)*

Write retry (backoff+jitter) + size-tiered write selector; interpolation window extension (±N steps). *(src: `legacy/database`)*

#### **B-conncache** *(Phase 4/7 · partial)*

Complete the cached-connection migration (TTL/LRU connection cache + `begin_concurrent` shipped for core input/query ops; batch/pattern/correlation ops still on `begin_concurrent_direct`); add pool metrics/health checks; benchmark before/after; tune cache size + TTL. *(src: the retired `database/CACHED_CONNECTIONS.md` note — verify current state in `database/src/types/cache.rs`)*

#### **B-msgpack** *(Phase 6 · absent)*

MessagePack for queued artifacts (vs JSON). *(src: `dsm-batch`)*

#### **B-snapshot** *(Phase 3/9 · absent)*

Pipeline state-snapshot audit trail (before/after JSON per stage). *(src: `DSM-Log`, `DSM-Batch-v2`)*

### Archived source map

The 15 predecessor repositories are **not part of this repository**. They were removed
along with their history, so the backlog items above reference them by name only:
`dsm-source`, `dsm-asset`, `dsm-influxdb`, `DSM-Thorchain`, `DSM-Input-Module`,
`DSM-Database`, `DSM-Measurement`, `weftdb`, `dsm-batch`, `DSM-Batch-v2`, `DSM-Batcher`,
`DSM-Pattern`, `DSM-Patterner`, `dataset_management`, `DSM-Log`.
