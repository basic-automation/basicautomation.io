---
title: "Phase 4 — Hot path: physical types & Storage v2 — notes"
summary: "The prose, findings and finished-work write-ups that sit behind the roadmap checklist for this section."
order: 15
group: Roadmap notes
---

# Phase 4 — Hot path: physical types & Storage v2 — notes

*The checklist for this section is in the [roadmap](https://github.com/basic-automation/weftdb/blob/main/ROADMAP.md). What follows is the writing that used to sit between its items.*

**Acceptance:** range scans avoid materializing `BigDecimal` unless requested;
interpolation streams from typed arrays; page/segment pruning visible in debug output;
Weft-Bench shows ingest/scan/compression gains; correctness tests cover late + OOO data.

## **4.1 Physical numeric encodings**

`weft-physical-type`: all six `PhysicalType`s

(`F32`/`F64`/`ScaledI64`/`ScaledI128`/`Decimal128`/`BigDecimalText`) with explicit
`Exactness`, `PhysicalProfile`, columnar `encode_column`, advisory
`recommend_encoding`, and schema-level declaration + enforced seal
(`AspectSchema::seal`, `SealError::{Encode,ToleranceExceeded}`)

- **4.2 Timestamp semantics**

## Fixed-width bit-packing codec

**realized on disk**: the `.weftseg` timestamp block writes a self-describing codec selector (bit-pack vs varint second differences), so the bytes/point saving is stored, not just estimated (segment format v3, paged v4)

## Monotonic-order enforcement

`first_order_violation` primitive; opt-in `Segment::build_sorted`/`build_nullable_sorted`, `AspectSchema::seal_sorted`/`seal_paged_sorted` (`SegmentError`/`SealError::OutOfOrder`); exposed at the API as `require_sorted` on **all four** ingest formats (JSON/CSV/ILP/Parquet); observability via `SegmentStats::time_sorted` → per-segment index → `unsorted_segments` in aspect/store stats + `time_sorted` on every ingest response

## Out-of-order **reconciliation** (Phase 4.6)

enforcement/detection, in-place per-segment reconciliation, threshold + hot/cold background sweeps, and the **cross-segment overlap merge** (newer-wins dedup) all shipped; the split-not-rewrite optimization + composite upsert keys are the residue (see 4.6)

## **4.3 Columnar segment store**

in-memory `Segment`/`PagedSegment`; versioned

CRC-checksummed `.weftseg` frames (v1 single-block, v2 null/quality column, v3 paged
with per-page index); `AspectSchema::seal_paged[_nullable]` (per-page tolerance
enforcement, global-row error remap); `SegmentIndex`/`SegmentIndexStore` (libSQL
control plane); `SegmentStore` (seal + prune-then-open reads + `aspect_stats`);
`CatalogStore`/`AspectCatalog` hierarchy + schema-aware declare-once/seal-by-lookup;
per-aspect `metadata.db` rollups (`AspectMetadataStore`, O(1) stats, rebuildable
from the index)

- **4.4 Data skipping**

## **4.5 Arrow-compatible arrays**

`weft-arrow` + `weft-arrow-store`: lossless +

typed-fast-path `RecordBatch` interchange (exact `Decimal128` for scaled ints),
paged-batch streams, logical-column builders, Arrow IPC stream bytes, Parquet
import/export; `arrow-*` tree confined to the leaf crates

## **4.6 Correctness semantics**

out-of-order/late data, dedup, upsert, idempotent

batch ingest, clock skew, precision, tz parsing, leap seconds, query consistency
during compaction, read-your-writes, snapshot isolation

## Out-of-order **detection + enforcement** (shipped in 4.2)

`require_sorted`

rejects OOO batches; `unsorted_segments` counts segments needing reconciliation

## Out-of-order **reconciliation — in-place per-segment sort** (first slice):

`SegmentStore::reconcile_segment`/`reconcile_aspect` stable-sort an out-of-order
segment's rows by timestamp and re-seal them sorted at the same id/file (frame
kind preserved), dropping it out of `unsorted_segments` so a point lookup over it
binary-searches; exposed at the API as `POST /storage/{aspect}/reconcile`

## Out-of-order **reconciliation — cross-segment merge** (baseline)

detect

time-overlapping segments (`SegmentIndex::overlapping_count`/`overlapping_segments`)
and collapse each connected overlap component into one time-sorted segment with
**newer-wins** (last-writer-wins / upsert) dedup on shared timestamps
(`merge_newer_wins` + `SegmentStore::reconcile_overlaps`/`reconcile_all_overlaps`,
`SegmentIndexStore::delete`); exposed at the API as `?overlaps=true` on the
per-aspect and store-wide reconcile endpoints and as a background daemon sweep
(`WEFT_RECONCILE_OVERLAPS`). This matches QuestDB's DEDUP UPSERT "last write wins on
the designated timestamp" semantics. *(src: last-write-wins dedup on designated
timestamp + upsert keys — https://questdb.com/docs/concepts/deduplication/)*

## Out-of-order **reconciliation — split-not-rewrite optimization**

shipped.

`SegmentStore::split_segment` carves a sorted segment into a cold prefix (kept id) +
hot suffix (new id) via `split_index`; `reconcile_overlaps_with_policy` consumes
`SplitPolicy::decide` so an overlap component whose cold prefix clears the floor and
outweighs its hot suffix is split rather than fully rewritten (default
`reconcile_overlaps` keeps the QuestDB 50 MiB floor, so production behaviour is
unchanged); exposed as `?split_min_bytes=` on the per-aspect + store-wide reconcile
endpoints and the `WEFT_RECONCILE_SPLIT_MIN_BYTES` daemon env. The **squash** half is
shipped too — `squash_aspect`/`squash_aspect_if_exceeds` (QuestDB-`max.splits`-style
trigger) + `squash_all_over_threshold`, `POST …/{aspect}/squash?max_segments=`, and
the `WEFT_RECONCILE_MAX_SPLITS` daemon env fold over-fragmented aspects back to one
segment. *(src: https://questdb.com/docs/concepts/partitions/)*

## Out-of-order **reconciliation — configurable upsert keys + skip-identical**:

the merge dedups on the timestamp alone (newer wins); add optional composite
dedup/upsert keys (timestamp + declared columns) and a skip-write when the newer
row is byte-identical to the older, matching QuestDB's `DEDUP UPSERT KEYS`. Blocked
on B-tags (per-measurement columns/tags don't exist yet). *(src: composite
UPSERT KEYS, identical-row skip — https://questdb.com/docs/concepts/deduplication/)*

## **Threshold-triggered background reconciliation**

the `unsorted_segments`

count drives a QuestDB-`max.splits`-style trigger for an automatic background
reconcile pass (single-aspect `reconcile_aspect_if_unsorted_exceeds` + store-wide
`reconcile_all_over_threshold` sweep), exposed as the `?threshold=N` gate on
`POST …/{aspect}/reconcile`, a manual store-wide `POST …/storage/reconcile`, and
a timer daemon (`WEFT_RECONCILE_INTERVAL_SECS`/`WEFT_RECONCILE_THRESHOLD`) with the
`weft_reconcile_passes_total`/`weft_reconcile_segments_reconciled_total` metrics

## **Hot/cold split in the background reconcile**

cold (non-hot-tail) segments

are reconciled every pass and only the hot tail (most-recently-sealed) is deferred
until the backlog reaches the threshold — `SegmentStore::reconcile_aspect_hot_cold`/
`reconcile_all_hot_cold`, wired through the reconcile daemon (`WEFT_RECONCILE_HOT_COLD`)
and the `?hot_cold=true` reconcile endpoints; matches QuestDB's "squash non-active
partitions each commit, defer the active partition until the split threshold".
*(src: non-active squashed each commit, active squashed past the split threshold —
https://questdb.com/docs/concepts/partitions/)*

## Read-planner

use the persisted per-segment `time_sorted` to binary-search a

point lookup on a sorted segment and linear-scan only an out-of-order one
(`Segment::value_at`/`PagedSegment::value_at`/`SegmentStore::read_point`; exposed
as `GET /storage/{aspect}/at`)
