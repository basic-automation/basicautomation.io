---
title: "Immediate next actions — notes"
summary: "The prose, findings and finished-work write-ups that sit behind the roadmap checklist for this section."
order: 27
group: Roadmap notes
---

# Immediate next actions — notes

*The checklist for this section is in the [roadmap](https://github.com/basic-automation/weftdb/blob/main/ROADMAP.md). What follows is the writing that used to sit between its items.*

## **START HERE (filed 2026-10-11 for the next run).**

The 2026-10-11 run (PR `routine/dsp-2026-10-11`)

stacked the open 2026-10-09 routine (#75) on main (one conflict, `weft-reduce/src/lib.rs`), so
merging it lands both. It stayed in the free `weft-reduce` lane: integer-path bookkeeping (hourly
`avg` ~3.1× → ~2.1× f64), the same for `reduce` on points (~−13%), and integer time-weighted
averages identical in representation (`avg,p99,twa` ~2.6–3× on real prices); the dense sketch
store was measured and dropped; the storage generators were shown to flatter reads 1.5–2.7×.
Recommended order:
1. **Owner:** merge this PR (it carries #75); pick up the `POST /api/v1/downsample` token bug for
   FRE-5 (filed below under Phase 5's compute-endpoint items).
2. **Free lane, measurable:** the per-bucket `BucketAcc` build on the points path (five
   `BigDecimal` clones per bucket, ~4 ms of ~11 per 1M points) and exact percentiles over
   integer mantissas in `finish` (compare `(i64, index)` instead of `BigDecimal`) — both must keep
   results identical in representation.
3. **Bench:** a representative storage generator or real-corpus quick-start commands (filed
   under the generator audit); a cross-engine TWA arm (below) once EVI-13's adapter exists.

## **Research (2026-10-11) — the exact TWA is now a measurable differentiator.**

QuestDB 9.3.3

added `twap(price, timestamp)`: step-function (LOCF) integration returning `double`, falling back
to the arithmetic mean when every observation shares one timestamp — the same semantics as
WeftDB's `twa`, in floating point. TimescaleDB's `time_weight(method, ts, value DOUBLE PRECISION)`
offers `LOCF` and `linear`/`trapezoidal` — WeftDB's `twa` and `twa_linear` — also only over
`double`. So a Weft-Bench TWA arm (hourly `twa`/`twa_linear` on the real corpus) compares an exact
decimal result against two engines' `double` results at a now-comparable cost, and should report
the `double` engines' deviation from the exact value beside the timings. Depends on EVI-13's
adapter shape (DuckDB first); QuestDB and TimescaleDB arms come after. `bigdecimal` 0.4.11 is
still the latest release, so the TWA emulation's operator rules (filed under the decimal tax)
stand. *(src: https://questdb.com/docs/query/functions/aggregation/ ·
https://questdb.com/blog/questdb-9-3-3-release/ ·
https://www.tigerdata.com/docs/api/latest/hyperfunctions/time-weighted-calculations/time_weight ·
https://github.com/akubera/bigdecimal-rs/releases)*

## **START HERE (filed 2026-10-09 for the next run).**

The 2026-10-09 run (PR `routine/dsp-2026-10-09`)

worked the lanes no other session owns (weft-reduce, weft-bench, a new `weftdb` child module) and
filed the lane-owned follow-ups instead of landing them. Recommended order:
1. **Lane-owned fixes this run measured and filed (hand to the owners):** the compute endpoints'
   `BigDecimal::from_f64` widening (13.7× reduction tax on JSON input; L-COMPUTE), their
   per-point `BigDecimal` output before narrowing to JSON `f64` (~80% of an interpolation;
   L-COMPUTE), and `?fill=` on the downsample endpoints (L-COMPUTE / L-STORAGE-READ).
2. **EVI-10A review:** `SegmentStore::interpolate_range` / `_f64` already have the form decision 18
   asks for; the evidence track adopts or reshapes them. They now carry an input cap
   (`interpolate_range::MAX_KNOTS`, 4 Mi stored rows per read window), checked on the rows
   `read_time_range` returns. Refusing before the decode needs the index's per-segment row
   counts (a `prune_by_time` sum), which live in `segment_store.rs`: the store lane's follow-up.
3. **Free-lane residue:** ~~the sketch's dense bin store~~ (measured 2026-10-11, no win; see the sketch list) (keeps the sidecar's serde form; the
   sketch is now the costliest per-sample reduction on the integer path), arbitrary bucket
   widths for Q5's `SAMPLE BY 5s` (freeze-track API decision first), a real smooth-signal corpus
   for the spline-fill question.
4. The 2026-10-08 list below still stands for owner decisions and the durability-gated items.

## **(2026-10-08 list.)** The 2026-10-08 run (PR `routine/dsp-2026-10-08`)

rebuilt the codec read path and cut the exact-decimal reduction tax. Recommended order:
(1) owner decisions waiting: `VAL_CODEC_DFOR` (BTC 33.7 → 13.6 bits/value), the timestamp
common-multiple codec, ALP adoption, and retiring `VAL_CODEC_TRANSPOSED`; (2) the remaining ~6×
decimal tax (profile per-bucket materialization); (3) the backup checkpoint-first A/B;
(4) bulk ingest through the `.weftseg` seal, once the durability arc has landed.
Lanes first ([1.0 plan §2](/projects/weftdb/docs/release-plan#2-operating-rules-for-the-whole-release),
single-writer hot-file lanes): `backup.rs` and `segment_store.rs` (L-STORE) belong to the
durability track and the `weft-physical-type` frame/codec files to L-FMT, so work on them is
coordinated with the owning lane, not landed independently.

## **(2026-09-23 list; item 3 shipped 2026-10-08.)** The 2026-09-23 run closed both cheap backup

follow-ons (sidecar sweep shipped; snapshot cost **measured**, and the diagnosis on record was
wrong — it is I/O, not vacuum CPU) and landed the depth item (**transposed layout realized on
disk**, with an honest end-to-end *no-win* result). Recommended order:
1. **Route measurement bulk ingest through the `.weftseg` seal — still the highest-value item, and
   still not started.** On the **real** `btc_1min.csv` the legacy `batch_capture_measurements` path
   runs at **2,978 rows/s at n=20k falling to 1,447 rows/s at n=40k** — 2× rows costing **4.11×**
   the time — while the columnar seal is linear and *speeds up* with amortization (**202k → 288k
   rows/s**), i.e. **67.9× at 20k and 199.3× at 40k**, and seals **1M real rows in 4.57 s (218,963
   rows/s, 4.22 B/point)**. The ratio grows with n because the legacy side is super-linear, so this
   is the write-amplification hard-constraint #3 exists to remove. *(src:
   https://www.slingacademy.com/article/optimizing-inserts-and-updates-with-index-management-in-sqlite/
   · https://medium.com/@JasonWyatt/squeezing-performance-from-sqlite-insertions-971aff98eef2)*
2. **Backup cost residue, now that the cause is known (cheap, and measurable on the shipped
   bench):** run the two A/B experiments — `PRAGMA synchronous=OFF` on the snapshot connection, and
   an explicit `db.checkpoint()` before the four vacuums — on `WEFT_BENCH_BACKUP_DIR` pointed at a
   real volume on a **quiet** box. Both are filed with their citations in the Turso section. Do
   **not** reach for the experimental passive checkpoint: it is an open data-loss path (#8076).
3. **The decode-threshold slice (cheap, and the transposed layout's real lever):** make the reader
   dispatch on values-requested-per-tile (~10 is upstream's crossover) instead of always taking the
   single-value path in `read_value_at`, and fix the **batch** point read, which still re-decodes a
   tile per instant. Filed with its citation beside the transposed item.
4. **The depth item is now the f64/ALP arc**, which the 2026-09-23 research substantially
   retargeted: ALP has a frozen Parquet wire layout whose 1024 vector size matches WeftDB's tile, the
   `alp` crate makes it benchmarkable without hand-rolling, the acceptance bar should come from
   upstream's own +4.36%/−7.28% ablation (declining is a legitimate outcome), and the GPU target
   should be **G-ALP**, not arXiv 2511.04140 — with the exception layout decided *before* the
   on-disk block is frozen.

## **POSITIONING ALERT — WeftDB's precision wedge now has a direct competitor (research 2026-09-23).**

QuestDB shipped a native **`DECIMAL(precision, scale)`** in 9.2 (Nov 2025): up to 76 digits,
auto-sized storage from 1 byte (DECIMAL8) to 32 bytes (DECIMAL256), **no implicit conversion**
(explicit `CAST` or an `m` literal suffix), at a documented cost of only **~2× DOUBLE**. That is
nearly the same shape as WeftDB's "BigDecimal logical type + schema-declared physical encoding, no
silent downcast" pitch, so "precision-aware time-series engine" is no longer a category of one.
Two consequences: Weft-Bench needs an **exact-arithmetic arm** (same precision/scale on both sides,
e.g. DECIMAL(38,9) equivalent) rather than only decimal-vs-f64 internally, and WeftDB must be able to
state **its own decimal-vs-f64 slowdown factor** against QuestDB's published ~2× or the wedge is
asserted rather than measured. *(src: https://questdb.com/docs/query/datatypes/decimal/)*

## **MEASURED (2026-10-08) — WeftDB's own decimal-vs-f64 factor is ~43×, not ~2×.**

`weft-reduce/benches/decimal_tax.rs` takes 1 Mi real BTC closes, hourly `avg`, three paths
cross-checked first (17,477 buckets; the integer sums equal the BigDecimal sums exactly). The
shipped `weft_reduce::reduce` over BigDecimal takes **100.65 ms**, an f64 loop **2.33 ms**, and
an **exact** scale-8 i64-mantissa loop summed in i128 **1.44 ms**. The shipped path also pays
`Point`/`DateTime` bucketing, which the tight loops do not, so 43× is the whole path, not pure
arithmetic. Either way, against QuestDB's documented ~2× the precision wedge currently costs
more than the competitor's, while the exact integer path WeftDB's `ScaledI64` columns already
store is *faster* than f64.

## **DONE (2026-10-08) — `weft_reduce::reduce_scaled`**, the integer-native streaming reduction

(count/sum/avg/min/max/first/last over `(epoch_nanos, mantissa, scale)`, i128/i64 accumulators,
one BigDecimal per output bucket). It is **equal bucket-for-bucket to `reduce`** (tested over
resolutions, filters and out-of-order input; bucket keys property-tested against
`Resolution::to_base`, and since INT-0 against `weft_reduce::bucket_index`, as splimes 1.0
removed `to_base`) and returns `None` for percentiles, TWA and sketches. On the real-BTC
`decimal_tax` bench: **`sum` 58.65 → 8.46 ms (6.9×)**. **`avg` 133–153 → 50–133 ms** across two
loaded runs, because the per-bucket `BigDecimal` division (17,477 of them) now dominates both
paths.

## **DONE (2026-10-08) — the `avg` division floor.**

`avg_like_bigdecimal` transcribes

`bigdecimal` 0.4's `impl_division` (special cases, 100-digit precision, round-half-up on the next
digit) into `u128` long division, building the BigInt once per 38 digits. It is **identical in
representation** (`int_val`, `scale`) to `bigdecimal`'s own `/` over 20,000+ random and edge cases.
Hourly `avg` on real BTC: shipped **122.75 ms → `reduce_scaled` 28.45 ms (4.3×)**, f64 2.77 ms,
so the decimal tax on this path went from ~44× to ~10× (one run, load avg ~50).

## **DONE (2026-10-08) — wired into `SegmentStore::downsample_range`:**

`segment_partial` reads

the window physically (`read_segment_range_physical`) and uses `reduce_partial_scaled` for
one-scale ScaledI64 rows, falling back otherwise. Runtime-verified on the real server: 100k BTC
closes, hourly min/max/avg/sum/first/last, all 1,667 buckets match an independent Python
`Decimal` recomputation.

## **DONE (2026-10-08) — `reduce_partial_scaled` accepts `sketch_p*`**, feeding each bucket's

DdSketch through the same `add_decimal` (so sketches are identical; tested against
`reduce_partial` with the full sidecar set). Stored-range `sketch_p*` downsamples therefore take
the integer path too. Not switched: bigdecimal's `to_f64` is a custom digit-trimming
conversion, not provably correctly rounded, so `m as f64 / 10^s` cannot replace it.

## **MEASURED (2026-10-08) — per-segment end to end** (`decimal_tax` `segment_downsample_*`, one real

1 Mi-row 4.42 MB frame, decode + reduce, both routes asserted equal, load avg ~50): six streaming
reductions **183.6 → 134.0 ms (1.37×)**; avg + sketch_p99 309.6 → 281.5 ms (1.10×). The
reduction itself is no longer the cost (~28 ms in isolation), so the next lever is the
physical window decode. Profile `read_segment_range_physical` on this frame.

## **DONE (2026-10-08) — `BucketAcc::finish` computes `avg` through `avg_of_sum`**, the

proven-identical integer long division, whenever the sum's unscaled integer fits i128. This
speeds up every path, the BigDecimal `reduce` included. Quieter-box numbers (load avg ~11):
hourly avg `reduce` **60.04 ms**, `reduce_scaled` **13.52 ms**, f64 2.14 ms; per-segment
streaming6 **127.6 → 59.7 ms**; avg+sketch_p99 176.5 → 144.0 ms (the sketch's per-value
`to_f64` is now the cost). The decimal tax on the integer path is ~6.3× f64, against QuestDB's
documented ~2×.

## **NEXT — the remaining 6.3×:**

per-bucket BigDecimal materialization (six values + the

`BTreeMap<String, _>` per bucket) and the window decode (~30 ms of the 59.7). Profile before
choosing.

## **DONE (2026-10-09) — no per-sample bucket indexing on time-ordered input.**

`reduce_scaled`'s accumulation and `reduce_partial_scaled`'s sketch pass keep the current
bucket's nanosecond range (`base_range`, proven tight against `base_of` over every
resolution, both signs) and index a sample only when it leaves it; the sketch pass finds a
bucket by binary search instead of a `BTreeMap` lookup per sample. Criterion
`decimal_tax`, pinned to one core, three alternating pairs: hourly `sum` 7.52/8.02/7.83 →
6.85/5.41/6.80 ms, hourly `avg` 16.40/17.36/16.37 → 15.08/15.50/14.99 ms; per segment
`scaled_avg_sketch_p99` 83.8/92.4/85.6 → 60.7/59.2/74.9 ms (unpinned, load ~14);
`scaled_streaming6` unchanged within noise (the decode dominates).

## **DONE (2026-10-09, sub-items below) — the `avg` division was the biggest piece of `reduce_scaled`:**

hourly `avg`

costs ~8 ms over `sum` for 17,477 buckets (~0.5 µs each); BTC averages do not terminate, so
every bucket's quotient carries all 100 digits.

## **TRIED (2026-10-09), NO WIN — 19 digits per `u128` division.**

Base-10¹⁹ long

division gives `bigdecimal`'s digit string exactly (it passed the equality test, widened
this run to 25,000+ cases including full-range `u64` counts and quotients that terminate
mid-chunk), but pinned A/B over three pairs left hourly `avg` at 14.49/15.38/15.77 →
15.61/14.30/13.97 ms, inside the noise. The digit loop is not the cost; not landed (the
widened test is).

## **DONE (2026-10-09) — one `BigUint` multiply + one division per non-terminating

average.** `avg_like_bigdecimal` tests termination first (`count / gcd` has only factors
2 and 5); a non-terminating quotient, which always runs to 100 digits, is
`floor(num · 10^m / count)` rounded on the next digit (`10^m` from a table built once),
bit-identical over the widened equality test; terminating ones keep the digit loop.
Criterion pinned, nine alternating pairs: hourly `avg` `reduce_scaled` median **15.29 →
8.99 ms** (seven pairs 6.74–9.66 ms after; two load-spike outliers at 18.8/20.1), the
BigDecimal `reduce` 63.2/64.4/60.0 → 54.6/53.3/55.0 ms. The exact-integer path is now
**~4.0× f64** (2.27 ms), against QuestDB's documented ~2×.

## **DONE (2026-10-11) — per-bucket bookkeeping off the integer path.**

The accumulator

closes time-ordered buckets into a `Vec` (one map merge only for out-of-order input),
`reduce_scaled` builds `sum`'s decimal only when asked and sizes its output once, and so
does `PartialReduction::finish` (every downsample ends there). Results unchanged (the
`reduce` equality test now runs sorted and shuffled input). Criterion `decimal_tax`, load
average ~200, ratios against the `f64` loop in the same run: hourly `avg` `reduce_scaled`
6.50/7.78 ms (f64 2.08/2.54) → 4.26/4.61 ms (f64 2.06/2.07), i.e. **~3.1× → ~2.1–2.2× f64**;
hourly `sum` 4.42 → 3.05 ms. Per-segment arms moved within the box's noise (the decode
dominates). What is left per bucket is the API's own shape: a `String` key and a
`BTreeMap` node per value, and the `BigDecimal` itself.

## **DONE (2026-10-11) — the same for `reduce` on `BigDecimal` points**

(`reduce_partial_points`): ordered buckets close into a `Vec`, the partial's map is
bulk-built, and the rescaling pass is skipped when every value has the common scale (the
representation test now also runs sorted and single-scale series against the `BigDecimal`
reference). Hourly on 1M real closes, criterion A/B, f64 control flat: `avg` 24.09 → 20.96
ms, `sum` 21.57 → 19.19 ms (~10× f64). Measured split on 1M two-decimal points before it:
lifting values out of `BigDecimal` ~3 ms, accumulation ~3 ms, building the partial's
`BucketAcc`s (five `BigDecimal` clones per bucket) ~4 ms, finishing ~2 ms.

## **DONE (2026-10-11) — time-weighted averages on integers.**

Measured first: on 1M

two-decimal samples hourly, `finish` took 94 ms for `twa` and 180 ms for `twa_linear` against
15 ms to collect the samples. `scaled::twa_scaled` replays the `BigDecimal` loop on
`(i128 digits, scale)` pairs, following `bigdecimal` 0.4's `Mul` (a value of exactly one
returns `dt` at scale 0), `Add` (a zero operand raises the other's scale by up to 15),
`AddAssign` (zero terms skipped, a zero accumulator replaced) and `Div` (through
`avg_like_bigdecimal`), and declines (falls back) on a scale past 17, an overflow or no time
spread. A differential test over 6,000 random buckets (scales 0–19, mixed scales, zeros, ±1,
near-`i64::MAX` mantissas, duplicate and sub-millisecond instants, shuffled order, bucket ends
before and after the last sample) compares `(digits, scale)` against the untouched
`BigDecimal` loop. Criterion per stored segment (decode + reduce, real 1 Mi-row frame):
`scaled_avg_p99_twa` 155.2 → 79.1 ms, `bigdecimal_avg_p99_twa` 197.0 → 119.5 ms. Hourly on
1M real closes (weft-bench, all PASS): `avg,p99,twa` 150 → 55–58 ms (points) and 119 → 38 ms
(`--ds-scaled`); `twa_linear` 223–229 → 71–82 and 160–170 → 42–54 ms. Re-check on a
`bigdecimal` upgrade: the emulation follows 0.4.11's operator code; the weekly
`.github/workflows/bigdecimal-drift.yml` runs these differential tests against the newest 0.4.x.

## **NEXT — the sidecar build.**

The `.weftpart` sidecar build

(`write_partial_sidecar`) receives the seal's BigDecimal values rather than stored mantissas,
so switching it means threading the seal's encoded column through instead. Its callers sit in
the persist paths the durability arc is reworking, so do it after that lands. Then add a
server-level downsample timing (real corpus, many segments) and publish the end-to-end factor
beside QuestDB's ~2×. `decimal_tax` covers the reduction only.

## *(original item)* **a `ScaledI64`-native reduction fast path in `weft-reduce`:**

reduce

`(epoch, mantissa, scale)` columns straight from the segment for count/sum/avg/min/max/first/last
(i128 accumulators), materializing a BigDecimal only per output bucket. It stays exact (the
BigDecimal stays the API type) and the measured ceiling is ~70× over today's path on this
corpus. Wire `SegmentStore::downsample_range` / the `.weftpart` sidecar to it, re-run
`decimal_tax` and `--ds-csv`, and publish the new factor beside QuestDB's.

## **External-engine adapter fairness — three concrete rules from the 2026 landscape.**

(a) **QuestDB egress:** QuestDB 10.0 (2026-08-06) introduced **QWP**, a binary columnar WebSocket
protocol that supersedes both ILP (writes) and PG Wire (reads) and streams **Apache Arrow** record
batches, reporting 220M rows/s egress. An adapter written against PG Wire would be measuring a
deprecated path and is trivially attacked as unfair — use QWP/Arrow and record the protocol in the
run manifest. Corollary for WeftDB itself: if the north star is $/billion interpolated **output**
points, result serialization is on the critical path, so WeftDB needs its own Arrow-batch egress or
the comparison is apples-to-oranges. (b) **ASOF joins:** QuestDB now has four+ selectable ASOF
strategies (Fast, Memoized, Light, and Dense added in 9.2), optimizer-chosen but hint-overridable —
run the arm **twice** (optimizer default and best-hint), publish both, and capture the chosen
strategy; the same discipline applies to ClickHouse's hash vs full-sorting-merge ASOF.
(c) **Publication precedent:** QuestDB's own 10.0 post publishes named head-to-head numbers against
ClickHouse (1.55× native reads, 2.35× Arrow streaming) and its DECIMAL docs claim wins over
ClickHouse and DuckDB — current, dated evidence that named comparative publication is normal
practice here, which de-risks the open legal item below. It also sets the rhetorical bar: vendor
comparisons quote a single headline multiplier, so WeftDB's $/billion-points framing needs one beside
it. *(src: https://questdb.com/blog/questdb-10-release/ · https://questdb.com/blog/questdb-9-2-release/)*

## **Adopt the TSM-Bench QUERY SPEC (not the repo) as Weft-Bench's external comparison workload.**

TSM-Bench (PVLDB 16(11), 2023) already defines interpolation as a first-class benchmark query — Q5
is literally `SELECT time, st_id, <s_list> FROM ts_table WHERE … SAMPLE BY 5s FILL(LINEAR)` — and
records that **Druid and MonetDB do not support it at all**, and that eXtremeDB "does not support
interpolation, instead, it fills the surrogate values with zeros". That is **peer-reviewed,
citable evidence for WeftDB's core commercial claim** that interpolation is under-served, far stronger
than a vendor blog, and Q5/Q4 are ready-made specs rather than workloads WeftDB invents for itself.
Its datasets also give an externally-defined scale bar: **D-LONG 518M** points and **D-MULTI 17.2B**
points — the right order of magnitude for a "$ per billion interpolated points" headline.
**Implement the spec inside WeftDB's own harness; do not depend on the repos** — the academic line is
dormant (TSM-Bench last pushed 2025-12-25, 28 stars; SEER last pushed 2024-08-23, 5 stars). For
TSBS compatibility, target the fork that is actually moving: **questdb/tsbs** (pushed 2026-09-04)
rather than timescale/tsbs (2026-05-27), and note the divergence in the run manifest — neither is
archived, so claiming TSBS is dead would be wrong. *(src:
https://www.vldb.org/pvldb/vol16/p3363-khelifati.pdf · https://api.github.com/repos/questdb/tsbs ·
https://api.github.com/repos/eXascaleInfolab/seer)*

## **BENCHMARK HYGIENE — the synthetic ingest corpus flatters WeftDB, by a lot (measured 2026-07-23).**

Running `ingest_path_profile_legacy_vs_columnar` on the real corpus for the first time contradicted
the synthetic numbers three ways, all now guarded in the harness but worth carrying as a standing
caution for every workload that uses a generator. (The real corpus, `database/datasets/btc_1min.csv`,
is a local file not distributed with the repository, so the real-data figures below cannot be
reproduced from a clone; see the note under [Phase 6](https://github.com/basic-automation/weftdb/blob/main/ROADMAP.md#phase-6--compression-v2--high).)
- **Compression was overstated ~2.5×.** A representative 1M-row real window frames at **4.22
  B/point** against the synthetic corpus's **1.71 B/point**.
- **The head of `btc_1min.csv` is degenerate.** Its first ~20k rows are 2012 ticks holding constant
  (4.58 … 6.30), which the RLE-class value codecs crush to **0.17 B/point** — a ~25× flattering
  figure. Any bytes/point number taken from the first N rows of this corpus is not a result; hence
  the new `INGEST_PROFILE_SKIP_ROWS`. **No README perf claim may cite a head-of-corpus number.**
- **The synthetic schema was unrepresentable on real data.** The hardcoded `ScaledI64 { scale: 2 }`
  fits synthetic two-decimal prices but not real BTC closes: the seal failed with *"declared encoding
  exceeds tolerance: worst error 0.00117537 > bound 0"* — hard-constraint #4 (no silent downcast)
  doing its job. The harness now derives an exact encoding via `recommend_encoding`; the 1M-row
  window needs `ScaledI64 { scale: 8 }` while the 20k/40k windows need only scale 2, so the required
  scale is *window-dependent* — which is exactly why it must be derived, not declared by a benchmark.

## Audit the other `weft-bench` workloads' generators for the same class of flattery (the shape

knobs are seeded and reproducible, but "reproducible" is not "representative").

## **DONE (2026-10-08) — the compression workload runs on a real corpus:**

`--comp-csv <FILE>`

(`--csv-value-col`, `--csv-skip`; exact decimal text; header auto-skipped; rows sorted).
1M real BTC closes (rows 3M..): **4.22 B/point realized** (`scaled_for`), round trip PASS,
20.8M points/s decode, `advisory_dfor_value_bytes` = 1.70 B/point.

## **DONE (2026-10-08) — `point_lookup` on a real corpus:**

`--pl-csv <FILE>`. On 1M real BTC

closes, a 128-instant batch over 50 reps has p50 **2.43 ms** single-block vs **0.90 ms** paged
(8,192 rows/page), both PASS. The single-block frame is 4.2 MB, and every read CRCs all of it.
That is real-data evidence for the per-block checksum item.

## **DONE (2026-10-08) — `range_fetch` on a real corpus:**

`--rf-csv <FILE>`. On 1M real BTC

closes, 32 windows of 100 rows over 30 reps have p50 **60.8 ms** single-block vs **17.8 ms**
paged (8,192 rows/page), both PASS. That is ~1.9 ms per window, dominated by the whole-frame
CRC of the 4.2 MB frame.

## **DONE (2026-10-08) — `downsample` on a real series:**

`--ds-csv <FILE>`. **Finding: the

generator flatters in the OTHER direction here.** On 1M real BTC closes, hourly buckets with
`avg,p99,twa` run at **3.39M points/s** (p50 292 ms, 5 reps, PASS). The same-size generated series
(60 s stride) runs at **0.53M points/s** (p50 1,808 ms), **6.4× slower**, measured back to back at
load avg ~44–62. The generator builds values with `BigDecimal::from_f64(signal)`, whose exact
binary expansions carry ~50 significant digits and make every BigDecimal op expensive. Real
two-decimal prices do not. So the README's reduction table, which is all generator-based,
**understates** WeftDB on real price data.

## **DONE (2026-10-09) — the harness times the integer path too:**

`--ds-scaled` runs

`reduce_partial_scaled` + `finish` over the series as one `ScaledI64` column (rescaled to the
largest scale, as a sealed column is), gated on equalling `reduce` bucket for bucket. Hourly
`avg`: 500k two-decimal points 0.58 vs 14.40 ms; 1M real BTC closes 6.4 vs 52.8 ms.

## **DONE (2026-10-09) — the interpolation generator: pessimistic at scale, now a knob.**

Its samples are exact binary expansions too. On 100k samples the flagship-shaped run
interpolates in 50.4–53.7 ms against 24.6–25.8 ms at two decimals (~2×, three runs each,
accuracy unchanged to 0.2 RMSE); at the 480-sample flagship the gap is ~5%. `--decimals N`
(`SyntheticParams::value_decimals`) rounds the samples; the default stays the exact
expansion, because zero-noise accuracy scoring needs samples exactly on the truth. No
published figure used the generator's speed.

## **DONE (2026-10-11) — the storage generators are NOT representative; they flatter.**

They emit exact two-decimal text (checked 2026-10-09: `point_lookup` and `range_fetch` seal
the sawtooth `10000000.{i % 97:02}`, the `compression` shapes are two-decimal), but the
patterns compress far better than real data, and reads scale with frame bytes. 1M rows each,
generated vs real BTC closes (rows 3M..), back to back at load ~210, all PASS: realized
0.92 B/point (sawtooth, `clustered`, `trending`) and 0.53 (`jitter`) vs **4.22**; point batch
(128 instants) p50 0.66 vs 1.58 ms single-block, 0.51 vs 0.75 ms paged (8,192 rows/page);
range fetch (32 × 100 rows) 17.7 vs 48.1 ms and 9.0 vs 14.8 ms; full decode ~22M points/s
for every shape and the real series alike. README now warns against quoting generated storage
figures. Evidence: `weft-bench --point-lookup|--range-fetch|--compression` with and without
`--pl-csv|--rf-csv|--comp-csv database/datasets/btc_1min.csv --csv-value-col 4 --csv-skip
3000000` at `--*-rows 1000000`.

## **NEXT — a representative storage generator, or real-corpus defaults.**

Either make the

generated storage corpus a seeded random walk with realistic decimal width (BTC-like 4.2
B/point) or make the README's quick-start commands for these workloads take a real CSV. The
sawtooth stays useful as a best-case arm, labelled as one.

## **DONE (2026-10-09) — the downsample generator emits realistic decimals:**

values are

rounded to `--ds-decimals` places (default 2; `full` keeps the pre-2026-10 binary expansion), and
the README reduction table was re-baselined with both generators measured back to back. On 1M
points (hourly `avg,p99,twa`) the two-decimal generator runs at 5.10M points/s against 4.49M for
real BTC closes and 0.61M for the old generator, so it is now within 1.14× of real data rather than
7.3× pessimistic.

## **FOUND (2026-10-09) — `sketch_p99`'s published ~2.6× speed-up over exact `p99` was the

generator's.** On two-decimal values the two run level (74.1 vs 74.9 ms, 500k points hourly,
10 reps); on 1M real BTC closes the sketch is 1.36× faster. The README now says speed is not the
reason to pick the sketch.

## **DONE (2026-10-09) — exact percentiles select instead of clone-and-sort.**

`BucketAcc::finish`

ranks borrowed `(value, arrival index)` pairs, so the result equals the old stable sort
including the scale of tied values (tested); one percentile uses `select_nth_unstable_by`,
several share one sort, and only the selected value is cloned. Single `p99`, hourly, 10 reps,
two runs each, before → after: two-decimal 500k **59.7/59.1 → 32.3/38.7 ms**, real BTC 1M
**203/116 → 77/96 ms**, full-expansion 500k (5 reps) **1,451/1,362 → 387/418 ms**; all four
percentiles together level (real 120/155 → 119/115 ms). Exact `p99` is now ~2× faster than
`sketch_p99`.

## **DONE (2026-10-09) — the sketch's per-sample `BigDecimal → f64`.**

For a value

`m × 10^-s` with `|m| < 2^53` and `0 <= s <= 22`, `m as f64 / 10^s` rounds the exact quotient
once and is bit-identical to `bigdecimal` 0.4.11's `to_f64`, which (below ~44 digits) formats
`<digits>e-<s>` and parses it with std's correctly rounded parser. `DdSketch::add_decimal`
takes that path (borrowing the digits), and `reduce_partial_scaled` feeds mantissas straight
in (`add_scaled`), so sketches are unchanged (tested bit for bit over 23 scales × 4,000+
mantissas). Harness `sketch_p99`, hourly, before → after: two-decimal 500k **63.8/67.0 →
30.3/31.6 ms**, real BTC 1M **148.8/149.0 → 76.2/77.4 ms**; the ~50-digit `full` series
falls back and is ~4% slower (288.6/303.9 → 304.6/314.9 ms, the extra check). Per sealed
1 Mi-row real segment (`decimal_tax` criterion, decode + `avg,sketch_p99`, load avg ~38): the
scaled route **202.2 → 97.0 ms (−54%)**, the BigDecimal route 196.4 → 145.5 ms (−27%).
Re-check if `bigdecimal` is upgraded: the proof leans on its `to_f64` implementation.
*(Checked 2026-10-09: 0.4.11, released 2026-10-03, is the latest on crates.io and the one
locked; its notes touch square root, inverse and exp, not `to_f64` or `/`. src:
https://github.com/akubera/bigdecimal-rs/releases)*

## **DONE (2026-10-09) — the sketch skips `ln` for a value inside the last sample's bucket**

(`BinCache`: the bucket shrunk by a relative 1e-9, far wider than `ln`'s index error, so
the index is exactly the logarithm's; invisible to equality and serde, so sidecars are
unchanged). `sketch_p99`, hourly, 10 reps, three alternating pairs at load ~33: real BTC
closes 48.3/46.2/46.7 → 35.4/36.2/35.8 ms (BigDecimal points) and 27.5/24.7/25.2 →
18.1/18.9/17.9 ms (`--ds-scaled`); the noisier generated series gains ~5%.

## **TRIED (2026-10-11), NO WIN — a dense bin store.**

The sign stores as a ring (and then

a `Vec` with an in-range fast path) of counts from an offset, sparse past 4,096 buckets,
serializing byte-for-byte as the `BTreeMap` (tested against a map model with collapsing).
On real prices a bucket's sketch holds one to three bins, where a B-tree node is already a
short linear scan: 1 Mi samples into hourly sketches took 5.3 ms with the map against 6.4 ms
dense, and `weft-bench --downsample --ds-aggs sketch_p99` on 1M real closes ran 3–10%
slower in three alternating pairs (load ~200). Not landed. The dense form would pay only
for wide-range buckets (latency-like data), which no workload here measures yet.

## **Research (2026-10-09) — a cheaper sketch index, if the sketch format is ever revised.**

`DdSketch::index` computes `v.ln()` per sample. DataDog's reference sketches-java ships
`CubicallyInterpolatedMapping`, which takes `floor(log2 v)` from the float's bits and
interpolates the rest cubically, "much faster than computing the logarithm … by a factor of
6" at **1%** more bins than the logarithmic mapping. Adopting it changes every bin index, so
persisted `.weftpart` sketches would no longer merge with new ones: it needs a sidecar
format/version bump (L-FMT/freeze territory) and a measurement that `index` is a material
share of `sketch_p99` first. *(src:
https://github.com/DataDog/sketches-java/blob/master/src/main/java/com/datadoghq/sketch/ddsketch/mapping/CubicallyInterpolatedMapping.java)*

## **Positioning (2026-10-09) — exact percentiles are a differentiator against QuestDB.**

QuestDB's aggregate docs list only `approx_percentile`/`approx_median` (HdrHistogram, a
precision knob 0–5, and an error on any negative value); no exact percentile is listed.
WeftDB's exact nearest-rank `p*` over exact decimals now runs level with its own sketch, so
Weft-Bench's QuestDB arm should compare `approx_percentile` against both `sketch_p*` and
exact `p*`, and say which is which. *(src: https://questdb.com/docs/query/functions/aggregation/)*

## **DONE (2026-10-09) — the scaled partial serves exact percentiles and TWA.**

`reduce_partial_scaled` now accepts every reduction, collecting each bucket's
`(instant, value)` samples in input order as `reduce_partial` does while sum, min, max,
first and last stay integer (equality-tested alone, filtered, and merged both ways with
BigDecimal partials). Before, a stored-range `p*`/`twa` downsample decoded the window
physically, was declined, and decoded it again. `decimal_tax` per real 1 Mi-row segment,
`avg,p99,twa`, pinned, three pairs: the store's route 210.9/215.6/245.3 → 147.3/167.2/155.1
ms (the plain BigDecimal route is 190–210 ms). Runtime-verified on the live server against
an independent Python nearest-rank and LOCF computation.

## **DONE (2026-10-09) — `reduce`/`reduce_partial` take the integer path themselves**

when every value fits an `i64` mantissa at the series' largest scale (≤ 18 places), mixed
scales included: compare and sum on integers, locate min/max/first/last by position and
return the original values, collect original samples, bring each bucket's sum back to its own
largest scale. Postcard bytes of the partial and every finished value's `(digits, scale)` are
identical to the BigDecimal reference (tested over mixed scales 0..=8 with equal values at
different scales). Pinned criterion on 1 Mi real BTC closes: hourly `avg` 53.0/52.8/52.6 →
23.0/22.9/28.3 ms, `sum` 50.8/50.9/50.6 → 20.8/20.4/21.9 ms. `POST /api/v1/downsample` gains
once its `from_f64` widening (above) is fixed; today its ~50-digit values decline the path.

## **NEXT — select on the mantissas when a partial is not merged.**

A single-segment

downsample could rank `i64` mantissas and build one `BigDecimal` per bucket, but a
`PartialReduction` must carry `BigDecimal` samples to merge; a finish-only fast path
needs `SegmentStore::downsample_range`'s inline single-segment route (L-STORE lane).

## **DONE (2026-07-20) — BUG ROOT-CAUSED + FIXED: the "flaky GPU interpolation tests" were never a

GPU bug.** The roadmap offered two hypotheses — a real GPU race, or an unsound check. **Both the
check and the test fixtures were broken; the GPU path is correct.** Three distinct defects, all in
test code:
1. **The similarity metric was not a cosine similarity.** `linear::tests::pow` computed
   `v^(2^exponent)` — it squared the *accumulator* each pass — so `pow(v, 2)` returned `v⁴` and every
   norm was `sqrt(Σv⁴)`. Two *identical* vectors scored ~1e-4 instead of 1.0.
2. **`COS_THRESHOLD` had been tuned to the broken metric** (`8e-5`), which made the gate **inert**:
   it accepted anything short of a ~10,000× error. Fixing `pow` alone exposed a run where CPU-vs-GPU
   scored **0.377** and the test still reported `ok` — so passing runs had been proving nothing,
   exactly as suspected.
3. **The real source of the flakiness was a degenerate test fixture, not the GPU.** `POINTS` built
   ten points via `Point::random()`, whose timestamp is drawn from just 61 integer-second buckets
   (−30..=30) around a per-call `Utc::now()`. Ten draws collide in the same second ~half the time,
   and because each draw re-reads the clock a collision yields two knots **microseconds apart** — a
   near-degenerate knot pair whose divided differences divide by a ~1e-6 s gap and blow up. Hence
   the "garbage" values, and hence the clustering (one shared static → several tests fail in the same
   process). The **CPU-vs-SIMD** comparison failed on bad draws too (measured 0.337), which is what
   ruled the GPU out. A sibling instance of the same class: `regression::get_deterministic_points`
   re-evaluated `Utc::now()` per point *per call* despite its name, handing each backend a
   differently-drifted grid, so output lengths/timestamps diverged.

**Fixed** by correcting `pow`, anchoring both fixtures to one base time (values stay random; only
the knots are separated), and raising `COS_THRESHOLD` to a **real 0.999**. With the degeneracy gone
all four paths agree to ~13 decimal places (CPU-vs-SIMD, CPU-vs-**GPU** and CPU-vs-auto all measured
in `[0.9999999999999, 1.0000000000001]`), so the GPU quarantine was removed rather than kept.
**Verified: `cargo test -p splimes --lib` run 6× consecutively = 27 passed / 0 failed every time**
(previously ~1 run in 3 failed, and `tests::regression` failed ~2/2). The Phase 5 GPU benchmark
claims now have a correctness gate that means something.

## **DONE (2026-07-20) — BLOCKER CLEARED: the `gpu_integration_tests` rustc ICE was an

attribute-ORDER bug, fixable in WeftDB's own source.** The dump names it exactly: `attribute is missing
tokens` on the compiler-injected `rustc_test_entrypoint_marker` at
`splimes\tests\gpu_integration_tests.rs:6:1: 6:8` — i.e. on `#[test]`. Mechanism: with `#[test]`
**outermost**, rustc's builtin harness injects its entrypoint marker and the `#[serial(gpu_tests)]`
**proc-macro** attribute then re-emits the item without that marker's token information, and the
compiler asserts. The sibling `splimes/src/tests/*.rs` never hit it because they write
`#[tokio::test]` (a proc macro) outermost, so the literal `#[test]` is generated last.
**Fixed by reordering the two attributes** (`#[serial(gpu_tests)]` above `#[test]`) across all eight
tests in the file — no toolchain change, no `allow`, semantics unchanged. Ruled out the parallel
frontend as a cause (the ICE reproduces identically under `-Z threads=1`, so it is not the
workstation's global `-Z threads=15`). **The 8 tests in that target now compile and pass for the
first time (8 passed / 0 failed)**; they had never run.

## **DONE (2026-07-20) — the LNK1102 link OOM is FIXED at the root: `[profile.test] debug = 1`.**

With the ICE cleared, the default-parallelism `cargo test --workspace` died in `link.exe` with
`LINK : fatal error LNK1102: out of memory` while linking several large test executables at once
(`weft-arrow-store`, `weftdb`'s `db_tests`, `weft-tui`, `weft-server`); the cascade of
`can't find crate` / `no resolution for an import` "ICE"s after it was downstream noise from those
failed links, not separate compiler bugs. A resource limit, not a correctness one (~250 rlibs per
test binary). Two fixes were measured, and the better one shipped:
- `-j 2` works (`Finished test profile in 9m 21s`, zero link errors) but throttles the whole build
  to 2 jobs on a box configured for 15 — an expensive workaround.
- **`[profile.test] debug = 1`** (line tables instead of the full `-C debuginfo=2`) cuts the debug
  info `link.exe` must hold and **fixes it at FULL parallelism** — verified end-to-end:
  `SKIP_SLOW_TESTS=1 cargo test --workspace` (no `-j` cap) → EXIT=0, **969 passed / 0 failed / 30
  ignored across 29 targets, 0 link errors** — byte-identical results to the `-j 2` run. Shipped in
  the root `Cargo.toml`; the `dev` and `release` profiles are untouched, so ordinary debugging is
  unaffected and test backtraces keep line numbers. *(src:
  https://learn.microsoft.com/en-us/previous-versions/troubleshoot/visualstudio/language-compilers/linker-fatal-error-out-of-memory
  · https://doc.rust-lang.org/cargo/reference/profiles.html#debug)*

## **DONE (2026-07-20) — `cargo test --workspace` COMPLETES for the first time: 969 passed, 0

failed, 30 ignored across 29 targets.** The last blocker was `weftdb`'s `db_tests`. Isolated it by
running the target serially: 14 of its 15 tests finish in seconds and
**`test_create_btc_1min_database`** was the entire stall — it bulk-loads the real
`datasets/btc_1min.csv` corpus and ran **40+ minutes at ~5 GB RSS** without producing a result
(memory plateaus, so it grinds rather than leaks). **`SKIP_SLOW_TESTS` was already the repo's
convention for exactly this** (`weft-orchestration/src/lib.rs` guards four tests with it) but had
never been wired into this target, so `SKIP_SLOW_TESTS=1` silently did nothing here. Added the same
guard; the target now runs **15 passed in 53 s** instead of never finishing.
**Full verified command: `SKIP_SLOW_TESTS=1 cargo test --workspace` → EXIT=0, 969 passed / 0
failed / 30 ignored, no link errors.** `SKIP_SLOW_TESTS=1` is the one flag still needed (it skips the
BTC bulk load); the link OOM is fixed in-tree by `[profile.test] debug = 1`, so no `-j` cap is
required. A run can now legitimately quote a single whole-workspace number. NB killing a backgrounded `cargo test -p database` orphans
`db_tests-*.exe`, which holds a lock and breaks the next build — kill the exe too.

## **DONE (2026-07-23) — the BTC bulk-load test is RUNNABLE, not merely skippable.**

Both halves of

this item landed: (i) the load was **profiled** and root-caused (the legacy row-store path is
super-linear — see the ingest-profile items above), and (ii) the fixture was **bounded** rather than
promoted: the default run loads a capped prefix (`BTC_TEST_MAX_ROWS`, default 5,000) into a **temp
data dir**, so it is bounded *and* hermetic. The temp dir matters as much as the cap — the test's
pre-existing "database already exists, test passed" early-out meant that simply un-gating it would
have kept handing a no-op pass to anyone with a populated data dir; a fresh root per run means the
ingest path is genuinely exercised every time. `BTC_TEST_FULL=1` restores the historical full load.
Also added the assertion the test never had: that the `close` aspect actually holds measurements
afterwards (previously it could only fail by erroring). **Measured with `SKIP_SLOW_TESTS` unset:
the single test runs in 12.23 s (it previously did not terminate — 40+ min at ~5 GB RSS), and the
whole `db_tests` target runs 16 passed / 0 failed in 47.45 s.**

## **ANSWERED (2026-09-23) — `SKIP_SLOW_TESTS` cannot be dropped workspace-wide yet, and the

guard has been hiding three real failures.** Timed `weft-orchestration` **unguarded**
(`SKIP_SLOW_TESTS` unset): **9 m 58 s wall-clock, 14 passed / 3 FAILED / 17 total**. The seven
guarded tests are the whole cost — `test_api` 596.9 s, `test_batch_processing` 596.9 s,
`test_pipeline_api_precise` 593.2 s, `test_specific_process_batch` 583.4 s,
`test_pipeline_api_with_fake_db` 579.8 s, `test_pipeline_api` 406.6 s, `test_api_precise` 357.2 s
— while every other test in the crate finishes in under 8 s. So the flag is doing real work and
retiring it would add ~10 minutes to every run.

## **The three unguarded `weft-orchestration` failures are latent bugs, not flakes — fix them

before the guard can retire.** With `SKIP_SLOW_TESTS` unset: `test_api_precise` fails with
`Database error: Failed to query patterns: Parse error: no such table: patterns` (preceded by
`Failed to store dictionary metadata: DDL statements require an exclusive transaction (use BEGIN
instead of BEGIN CONCURRENT)` — i.e. the dictionary's table is never created because its DDL is
issued inside a `BEGIN CONCURRENT`, and the failure is then swallowed as a warning);
`test_pipeline_api_with_fake_db` and `test_pipeline_api_precise` both fail with
`Invalid time range: start time must be before end time`. These are **pre-existing** and unrelated
to the 2026-09-23 increments — they have simply never run in CI because the guard hides them. The
DDL-under-`BEGIN CONCURRENT` one looks like a genuine control-plane bug rather than a test bug.

## **Re-checked 2026-10-08:**

`test_api_precise` now **passes**. The DDL-under-`BEGIN CONCURRENT`

defect is fixed on main: `set_dictionary_metadata` creates its tables through
`Aspect::ensure_dictionary_tables` in an exclusive transaction first. `test_pipeline_api_precise`
ran **>29 min without failing**, then hit a 30-min `timeout` (no "Invalid time range" in its
output), and `test_pipeline_api_with_fake_db` was never reached. The time-range failures are
therefore **unconfirmed either way**. These tests need the bounding below before they can give
a verdict.

## **Re-measured 2026-10-09 — still unbounded.**

With test databases now in a per-binary temp dir,

`cargo test -p weft-orchestration` without `SKIP_SLOW_TESTS` passed 12 tests and
`test_api_precise` in **331 s**, then hit a 40-minute `timeout` with eight `#[serial]` tests
unfinished (`test_api`, `test_batch_processing`, `test_load_or_create_pipeline`,
`test_pipeline_api`, `test_pipeline_api_precise`, `test_pipeline_api_with_fake_db`,
`test_run_subject_pipelines`, `test_specific_process_batch`; being serial, most had not
started). No failure was printed, so the time-range failures stay unconfirmed. Another session
was running `weft-orchestration` crash tests on the same box (`legacy_queue_crash`, durability),
so bounding these belongs with whoever owns that crate's lane.

## **Bound the seven slow `weft-orchestration` tests the way `db_tests` was bounded.**

Each

spends ~6–10 minutes; `test_create_btc_1min_database` was made runnable by capping its row count
and using a temp data dir (`BTC_TEST_MAX_ROWS`, default 5,000). The same treatment here would let
the flag retire and give the suite its real coverage back.

## **Historical note — the LNK1102 research that produced the `[profile.test] debug = 1` fix:**

LNK1102

is heap exhaustion in `link.exe`, and the standard mitigations are to cut the debug information the
linker must chew (a `[profile.test] debug = 1` — line tables only — instead of the current full
`-C debuginfo=2`) and to cap parallel link jobs. Try `debug = 1` on the test profile first; it is a
one-line workspace change and does not touch the dev profile the owner debugs with. *(src:
https://learn.microsoft.com/en-us/previous-versions/troubleshoot/visualstudio/language-compilers/linker-fatal-error-out-of-memory
· Cargo debug levels — https://doc.rust-lang.org/cargo/reference/profiles.html#debug)*
NB the earlier ICE dropped `rustc-ice-*.txt` dumps in the repo root — never commit them.

## **Guard the `#[serial]`-above-`#[test]` ordering (research 2026-07-20):**

the ICE cleared above is

**upstream rust-lang/rust#100263, open since Aug 2022** — same panic string (`attribute is missing
tokens`) in the same file (`rustc_ast/src/attr/mod.rs`), same shape (a test-harness attribute plus a
proc-macro attribute on one function). So this is not a transient nightly regression that a toolchain
bump will fix, and writing `#[test]` above a proc-macro attribute anywhere in the workspace will
reintroduce it. Worth (a) a comment at each site — done in `gpu_integration_tests.rs` — and (b)
considering a lint/grep in CI. WeftDB's ordering repro is also a cleaner minimization than the issue's
current one (which involves an unimported `test_case`), so it is worth contributing upstream.
*(src: https://github.com/rust-lang/rust/issues/100263)*

## **DONE (2026-07-14, capstone of the 2026-07-13 read-path arc) — `weft-bench` `point_lookup` workload

+ the full storage/read/aggregation suite:** shipped `run_point_lookup` (parallel runner sealing a
`weft-physical-type` `Segment` and timing `weftseg::read_segment_point`/`read_segment_points`, single &
batch, regular closed-form vs irregular, single-block & paged, present + off-grid queries) with a
correctness gate vs the full-decode `value_at`, p50/p95/p99 + CIs, and a `--point-lookup` CLI mode.
Measured (release, 100k-row FOR segment, 128-instant batch): regular batch p50=749µs / 169k lookups·s⁻¹,
irregular batch p50=2.67ms; batch amortizes ~37× over N single reads; closed-form regular ~3.6× the
irregular decode+search. Landed alongside the sibling `range_fetch`, `compression`, and `downsample`
workloads (see Phase 1 shipped-workloads item) and the shared `weft-reduce` crate.

## **NEW — cross-engine point-lookup comparison** is the residue

WeftDB's own point-lookup is now

benchmarked; wiring ClickHouse ASOF / QuestDB behind the same workload (needs the external adapters
below) is the next step, and the evidence for the *When WeftDB beats general TSDBs* point-lookup page.

## **`weft-reduce` crate + downsample reduction (2026-07-14):**

new vendor-neutral leaf crate

(`Aggregation`/`Bucket`/`reduce`, BigDecimal, epoch-grid buckets) that the HTTP `downsample` endpoint
was **deduplicated onto** (server no longer carries its own copy) and the `weft-bench` `downsample`
workload drives. Full reduction set: min/max/avg/sum/first/last + nearest-rank **p50/p90/p95/p99** +
**TWA** (LOCF dwell-weighting). Runtime-verified against the live `/api/v1/downsample` endpoint.

## **DONE (2026-07-16) — approximate mergeable quantiles (DDSketch):**

shipped as

`weft-reduce::sketch::DdSketch` (canonical logarithmic mapping `γ=(1+α)/(1-α)`, mirrored negative
store, exactly-counted zeros, `merge`) + the four opt-in `sketch_p50`/`p90`/`p95`/`p99` reductions
(`SKETCH_ALPHA` = 1%), reachable on the HTTP downsample endpoint and its ILP siblings. Values
**stream** into the per-bucket sketch (`needs_full_bucket` deliberately excludes them), so a bucket
costs a bounded number of counters however many samples land in it, and `SKETCH_MAX_BINS` (2048,
lowest-bucket collapse) makes that bound *absolute* rather than merely logarithmic in the value
range. Benchmarked on the shipped CLI (500k points, 5 reps, correctness PASS): **`sketch_p99`
p50=468.90 ms / 1,075,976 pts·s⁻¹ vs exact `p99` p50=2018.53 ms / 249,169 pts·s⁻¹ — ~4.3× faster.**
Runtime-verified against the live endpoint: sketch_p50=497.78 vs exact 500.0 (0.44%) and
sketch_p99=982.58 vs exact 990.0 (0.75%), both inside the 1% bound.

## **NEXT — UDDSketch (uniform guarantee under collapse):**

WeftDB's `max_bins` uses the reference

**collapsing-lowest** strategy, which preserves every count/rank but **loses the relative-error
bound for quantiles inside collapsed buckets** (for an all-positive column: the low quantiles;
p95/p99 are unaffected) and costs exact mergeability between two sketches that collapsed
differently. **UDDSketch**'s uniform bucket-collapse keeps accuracy guarantees over the *full*
quantile range under collapse — the principled fix if WeftDB ever needs a tight low-quantile bound on
a pathological range. Low priority: `SKETCH_MAX_BINS` spans a ~10¹⁷ dynamic range, so a realistic
column never collapses. *(src: collapsing loses the guarantee on collapsed quantiles —
https://github.com/DataDog/sketches-java · UDDSketch — https://arxiv.org/abs/2004.08604)*

## **DONE (2026-07-16) — sketch rank-convention divergence REMOVED.**

`DdSketch::quantile` now

ranks by WeftDB's nearest-rank ordinal (`⌈q·n⌉`, 1-based, clamped) rather than DDSketch's reference
`⌊q·(n-1)⌋`, so `sketch_p*` and `p*` name the **same sample at every bucket size** and the sketch
is always within `SKETCH_ALPHA` of the exact answer — substitutable, no small-bucket trap.
WeftDB-internal consistency beat matching Datadog's convention. Guarded by
`sketch_and_exact_percentiles_agree_on_small_buckets` (n=1..=12 × p50/p90/p99). Runtime-verified:
a 3-sample bucket returns `sketch_p99`=49.90 vs exact 50.0 where it previously returned **0.0**.

## **DONE (2026-07-16) — the mergeable-reduction primitive exists.**

`reduce_partial(...)

-> PartialReduction` + `PartialReduction::{merge, finish}`: a reduction can be computed over parts
(a chunk, a segment, a parallel shard) and combined. `reduce` is now `reduce_partial` + `finish`,
so the single-pass path cannot drift from the distributed one. Merging is exact for **every**
reduction (counts/sums add, min/max combine, first/last resolve by timestamp, samples concatenate,
sketches merge) — proven by reducing 600 points in four boundary-straddling chunks, merging in a
scrambled order, and asserting equality with the single pass across all 13 reductions.

## **DONE (2026-07-16) — `PartialReduction` has a consumer + a number.**

`weft-bench --ds-parallel

<N>` reduces in N rayon chunks via `reduce_partial` and merges (identical buckets to serial,
asserted by test across 2/3/8/64 chunks and 9 reductions). Measured (500k points, `sketch_p99`,
5 reps, 16-core, correctness PASS): serial 441.2 ms / 1,134,659 pts·s⁻¹ → **64 chunks 30.1 ms /
16,921,104 pts·s⁻¹ = 14.7×**. So mergeability is throughput, not theory — and `sketch_p99` at 64
chunks is ~68× the serial exact `p99` (30.1 ms vs 2018.5 ms). This is the evidence for the
cross-segment surface below.

## **DONE (2026-07-16) — cross-segment downsample, store layer.**

`SegmentStore::downsample_range`

prunes the index by time, folds **each surviving segment into its own `PartialReduction`**, merges,
and finishes once — so only one segment's rows are ever in memory and a range far larger than RAM
reduces; with a `sketch_p*` the per-bucket state is bounded too. Epochs lift through the catalog's
declared `TimeUnit`. Proven equal to a single pass over the whole series across 8 segments with
boundary-straddling buckets (9 reductions incl. `sketch_p99`), plus windowed/empty/undeclared cases.

## **DONE (2026-07-17) — the cross-segment downsample is exposed at the API.**

`GET|POST /api/v1/storage/{aspect}/downsample?start=&end=&resolution=&agg=` over
`SegmentStore::downsample_range`, with the compute endpoints' full output set
(`downsample`/`.csv`/`.arrow`/`.parquet`) and a `downsample.range` stage span nesting under the
request root span. Registered on **both verbs** — it is a read (hence GET, as every sibling stored
read) that this roadmap named a POST; it takes no body either way and a test asserts the two answer
identically. Omitted bounds span all stored history; inverted window / unknown token / undeclared
aspect / unconfigured store are 400/400/404/503. The compute and stored paths were **deduplicated
onto one envelope** (`buckets_to_response`), so they cannot drift. Runtime-verified against the
live binary over three separately-sealed segments (`segment_count=3`): minute buckets sum
6/36/66, the hour bucket folds all nine (sum=108, first=1, last=23), `sketch_p99`=22.875 vs exact
23.0 (0.54%, inside the 1% bound), and PAR1/Arrow content types confirmed. This is the surface
that finally puts the bounded-memory `sketch_p*` p99 in front of a user on stored data.

## **DONE (2026-07-17) — `downsample_range` reduces its segments concurrently — measured 4.7×.**

Each pruned segment's async read + CPU decode/reduce (`segment_partial`) now runs concurrently
(`try_join_all`, CPU half on the blocking pool, deterministic descriptor-order merge). Measured
(`database/benches/downsample_range.rs`, release, 16-core, 200k rows fixed, serial baseline taken
by stashing the change and re-running the identical bench): **4 segments 31.57→10.60 ms (2.98×) ·
16 segments 39.88→8.50 ms (4.69×) · 64 segments 61.32→20.16 ms (3.04×)**; `sketch_p99` at 16
segments 49.49→9.42 ms (**5.25×**), exact `p99` 49.29→17.51 ms (2.81×). **The roadmap's own caveat
was right**: the win does NOT reach `--ds-parallel`'s 14.7× — the per-segment file read is real, so
stored data carries roughly a third of the in-memory chunked-partial figure.
**A single segment keeps an inline fast path**: the first A/B measured the concurrent version
**1.7× SLOWER** on a one-segment corpus (35.7 vs 21.0 ms) — the `spawn_blocking` hand-off bought
nothing with no second segment to overlap. One segment is a common shape (a young aspect, a tight
window), so it now runs the serial path by construction and cannot regress.
*(Caveat recorded honestly: run-to-run variance on this box is ~30%, so no claim rests on the
single-segment numbers — only the multi-segment speedups, which sit far outside that band.)*

## **DONE (2026-07-18) — materialize per-segment partials at seal time (the highest-value

downsample follow-on): shipped.** WeftDB's `PartialReduction` (mergeable, exact for every reduction) IS
the partial TimescaleDB's continuous aggregates / ClickHouse's `AggregatingMergeTree` store and
finalize at query time — and a sealed segment is immutable, so its partial can never go stale (the
invariant Timescale needs a refresh policy to maintain, WeftDB gets for free). Shipped across the arc:

## **(1) per-segment `.weftpart` sidecar at a declared base resolution**

`weft-reduce`'s

`PartialReduction`/`DdSketch` are serde-serializable; `weftdb`'s `PartialSidecar` frame
(magic-prefixed bincode, staleness stamp = segment `(row_count, byte_len)`), `PartialSidecarPolicy`
(off by default; `WEFT_SEGMENT_PARTIAL_BASE`/`WEFT_SEGMENT_PARTIAL_MIN_ROWS`), written at seal for the
ten bounded reductions (`Aggregation::is_sidecar_materializable`).

## **(2) `downsample_range` merges sidecars in place of a decode** when every requested reduction

is materializable, the window covers the segment, and the base serves the resolution — **measured
3.2× vs decode** (8.39 ms → 2.60 ms, 16 seg / 200k rows, min/max/avg/sum/first/last + sketch_p99;
`database/benches/downsample_range.rs`), proven to skip the value column by deleting every `.weftseg`
and re-running the downsample unchanged.

## **re-bucketing a fine base to a coarser resolution**

`PartialReduction::rebucket` +

`grids_nest` re-key a fine-base partial (e.g. MINUTES) to any coarser nesting resolution
(HOURS/DAYS) with no decode, the in-query form of TimescaleDB's hierarchical continuous aggregates.

## **sidecar consistency across rewrites**

a reconcile/split/squash regenerates or removes the

sidecar so acceleration survives (and no `.weftpart` is orphaned).

## **DONE (2026-07-19) — (3b) hierarchy of materialized tiers.**

The `.weftpart` sidecar carries a

chain of coarser rollup tiers beside its base partial (`PartialSidecar::rollups`, frame version 2),
each re-keyed from the tier below (`build_rollups`, associative + cheaper than from the base), so a
coarse downsample re-keys from the coarsest materialized grid that nests in the requested resolution
(`PartialSidecar::partial_for`, exact tier = zero re-key) instead of folding the whole fine base — the
in-storage analogue of TimescaleDB's continuous-aggregates-on-continuous-aggregates and ClickHouse's
`raw→hourly→daily` `-State`/`-Merge` rollups (whose quantile-digest-as-state validates WeftDB's
`sketch_p*`-in-sidecar). Opt-in via `WEFT_SEGMENT_PARTIAL_TIERS` (comma-separated fine→coarse,
`[Option<Resolution>; MAX_SIDECAR_TIERS=4]`, non-nesting/finer entries skipped); a rewrite
regenerates the tiers. **Measured ~1.16×** on a DAY query over a MINUTES base (16 seg / 200k rows,
7.30 → 6.30 ms, non-overlapping CIs; `database/benches/downsample_range.rs::bench_tiered_vs_single_base`).
Honest: a modest win at this corpus size (~208 minute buckets/segment), growing with the base-bucket
count per segment, and the tiered sidecar is a larger read (base + tiers). *(src: hierarchical
continuous aggregates —
https://docs.tigerdata.com/use-timescale/latest/continuous-aggregates/hierarchical-continuous-aggregates/
· ClickHouse AggregatingMergeTree `-State`/`-Merge` + rollup —
https://clickhouse.com/docs/engines/table-engines/mergetree-family/aggregatingmergetree)*

## **DONE (2026-07-19) — (3a) materialization watermark: satisfied by construction.**

WeftDB has no

"unsealed hot tail" at the store layer — every segment is immutable once sealed — so the watermark
reduces to *which sealed segments carry a sidecar*, which `downsample_range` already handles
transparently: a segment with a matching sidecar merges its stored partial, one without decodes on the
fly, and the two combine in the same pass (the QuestDB/Timescale `materialized_only=false` "combine
materialized history with on-the-fly recent data" pattern). No code was needed beyond the existing
mixed path. *(src: TimescaleDB real-time vs materialized-only continuous aggregates —
https://www.tigerdata.com/learn/continuous-aggregates-timescaledb)*

## **DONE (2026-07-20) — (3c)(ii) the tier win SCALES with base-buckets-per-segment, but sub-linearly.**

`bench_tiered_span` (`database/benches/downsample_range.rs`) holds rows (200k) and segments (16) fixed
and widens the sample **stride**, so every arm reads the same bytes and merges the same 16 partials —
only the base buckets per segment change (~208 → ~3125 → ~12500 at a MINUTES base), isolating the
re-key cost a rollup tier elides from the file read and value decode. Measured (release, criterion,
DAY query over a MINUTES base + `[HOURS, DAYS]` tiers, 7 reductions incl. `sketch_p99`):
**stride 1s → 5.34 vs 4.65 ms (1.15×) · 15s → 40.5 vs 32.0 ms (1.27×) · 60s → 201.3 vs 145.9 ms
(1.38×)**. So the 2026-07-19 ~1.16× replicates exactly at its short span, and the win does climb with
span — but a **~60× increase in base buckets buys only 1.15× → 1.38×**, so the elided re-key is *not*
the dominant cost even at one base bucket per row; the tiered arm's larger sidecar read (base + tiers)
eats much of what the re-key saves. Honest caveat: the `single_base/60` sample is noisy
([175, 238] ms CI) against a tight tiered CI ([142, 149] ms) — the CIs are disjoint so the direction is
real, but that point estimate is soft.

## **NEXT — (3c) materialized tiers, remaining:**

(i) a sensible **default** tier chain derived from

the base — owner-gated, a default-flip like the others. Now better informed: per (3c)(ii) above the
payoff is 1.15–1.38× over the realistic span range, i.e. real but modest, so a default chain should be
justified against its extra `.weftpart` bytes rather than assumed. (ii) The remaining unmeasured axis is
the **sidecar read cost itself** — split the tiered arm's wall-clock into sidecar-read vs re-key to see
whether a *shallower* chain (say `[DAYS]` only, no `HOURS`) beats the full chain at coarse queries.

## **Positioning — WeftDB's `.weftpart` sidecar IS the "incremental materialized view", and mergeable

DDSketch is its edge (this run's research):** ClickHouse frames the choice as **incremental** MVs
(insert-triggered, real-time, `AggregatingMergeTree` storing `-State` partial aggregates merged lazily
at query) vs **refreshable** MVs (scheduled full recompute; the fallback for dimension-heavy joins and
UPDATE/DELETE sources, and — critically — for *percentiles / distinct counts over wide windows, which
incremental MVs handle awkwardly*). WeftDB's sidecar is exactly the incremental/`AggregatingMergeTree`
pattern (immutable-segment partials on disk, merged in `downsample_range`) — and because WeftDB's partial
carries a **mergeable DDSketch**, it serves the wide-window percentile case that ClickHouse names as
incremental's weakness. Fold this into the *When WeftDB beats general TSDBs* honesty page as a concrete
wedge, and note the **refreshable** counterpart (a scheduled full re-reduce) becomes relevant only once
B-tags bring UPDATE/DELETE-style mutations WeftDB's immutable segments don't yet have. *(src: ClickHouse
incremental vs refreshable materialized views —
https://clickhouse.com/docs/materialized-view/refreshable-materialized-view · TimescaleDB real-time vs
materialized-only continuous aggregates —
https://www.tigerdata.com/learn/continuous-aggregates-timescaledb)*

## **NEXT — materialize the sidecar at a coarser DEFAULT + adopt sketches:**

the sidecar is off by

default (opt-in via `WEFT_SEGMENT_PARTIAL_BASE`). Decide a sensible default base per the shape mix (a
finer base serves more resolutions but costs more `.weftpart` bytes and seal CPU for the sketch), and
measure the seal-time cost of building the four `sketch_p*` sketches per segment vs the read win —
the sidecar's size/CPU is the trade to quantify before flipping any default. Owner-gated like the
other default flips.

## **DONE (2026-07-19) — per-segment overhead knee measured + a size-targeted compaction shipped.**

Swept the `downsample_range` segment count at a fixed 200k rows (`bench_segment_count`, now
[1,4,16,64,128,256]): the knee sits at **~16 segments / ~12.5k rows-per-segment** (9.68 ms min);
**below** it the single-segment decode dominates (1 seg = 32.8 ms, no cross-segment parallelism),
**above** it a ~**0.37 ms/segment** fixed cost (file read + index row + partial merge) dominates and
wall-clock grows ~linearly (64=23.8, 128=47.0, 256=94.0 ms). So both extremes are bad and blindly
squashing an over-fragmented aspect to *one* over-corrects. Shipped the fix:
`SegmentStore::squash_aspect_to_target_rows(target_rows)` coalesces consecutive seal-id-ordered
segments toward ~`target_rows`-sized segments (not one), leaving already-large segments untouched,
plus the store-wide `squash_all_to_target_rows` sweep. Reuses the squash machinery (decode +
`merge_newer_wins` last-writer-wins + reseal + sidecar cleanup).

## **DONE (2026-07-19) — size-targeted compaction wired into the reconcile daemon + a manual

endpoint.** `reconcile_tick_compact` + `ReconcileDaemonConfig.compact_target_rows` + the
`WEFT_COMPACT_TARGET_ROWS` env (beside the reconcile/squash daemon knobs) run
`squash_all_to_target_rows` each tick, recording passes in the `weft_reconcile_*` metrics; the manual
`POST /api/v1/storage/{aspect}/compact?target_rows=N` (parallel to `/squash`) runs
`squash_aspect_to_target_rows` on demand. **Both runtime-verified** against the live binary: six
ingested 2-row segments coalesced to two 6-row segments — the daemon path via `/stats` segment_count
6→2 + the `reconcile.tick kind="compact"` span + `weft_reconcile_passes_total`, and the endpoint via
`POST …/compact?target_rows=6` → `{"removed":4,"segment_count":2}` (missing `target_rows` → 400).

## **DONE (2026-07-19) — fragmentation gate for the compaction daemon.**

`SegmentStore::squash_aspect_to_target_rows_if_fragmented` reads the **O(1)** per-aspect rollup and
runs the compaction only when `segment_count > ⌈total_rows / target_rows⌉` (genuinely over-fragmented),
so a converged aspect costs one rollup read per tick, not a full segment-index scan; the daemon tick
(`reconcile_tick_compact`) now calls the gated store-wide sweep
`squash_all_to_target_rows_if_fragmented`. The ungated `squash_*_to_target_rows` stays as the "force"
form the manual `/compact` endpoint uses. (2 new database tests: gate skips a well-sized aspect,
gated sweep touches only the fragmented one.)

## **NEXT — default target for the compaction daemon:**

pick a sensible **default** `WEFT_COMPACT_TARGET_ROWS`

from a real segment-size mix — the 200k-row bench's ~12.5k is corpus- and hardware-specific (the
transferable knob is rows-per-segment, but the optimum shifts with decode cost and core count).
Owner-gated default.

## **DONE (2026-07-16) — linear (trapezoidal) TWA method beside the shipped LOCF weighting:**

`Aggregation::TwaLinear` (token `twa_linear`, alias `time_weighted_avg_linear`) computing
`Σ½(vᵢ+vᵢ₊₁)Δtᵢ / ΣΔtᵢ`; `time_weighted_average` is generalized over a private
`TwaMethod::{Locf,Linear}` so both methods share one duration-weighting core and the same
degenerate-case handling. `Twa` gained the explicit `twa_locf` alias. The ½ stays exact in
`BigDecimal`. Verified against upstream semantics: LOCF weighs `v₁·Δt`, linear `½(v₁+v₂)·Δt`, and
the sensor guidance matches (LOCF for change-only devices, linear for irregularly-sampled
continuous signals). Runtime-verified on the live endpoint: one request returns twa_linear=13.75,
twa=15.0, avg=11.67 on the same series. *(src:
https://deepwiki.com/timescale/timescaledb-toolkit/3.3.1-time-weighted-averages ·
https://github.com/timescale/docs/blob/latest/use-timescale/hyperfunctions/time-weighted-average.md)*

## **DONE (2026-07-16) — TWA residue: the *last-point-to-bucket-end* weighting.**

`Aggregation::TwaBucketEnd` (token `twa_bucket_end`, alias `twa_locf_end`) carries the bucket's
last sample forward to its grid end, fixing a bias that is not subtle: a change-only sensor
reporting 0 at 00:00 and 100 at 00:01 in an hour bucket gets `twa`=0.0 though it held 100 for 59
of 60 minutes; `twa_bucket_end`=98.33. LOCF only (the linear method has no successor value to
interpolate toward). Runtime-verified: one request returns twa=0.0 / twa_bucket_end=98.33 /
twa_linear=50.0 / avg=50.0. *(src:
https://github.com/timescale/timescaledb-toolkit/discussions/697)*

## **DONE (2026-07-16) — server ILP `parse_aggregation_token` adopts

`weft_reduce::Aggregation::from_token`:** the last duplicate of the aggregation vocabulary is gone;
the HTTP surface consequently gained the `median`/`time_weighted_avg` aliases it had been missing
and can no longer drift from the reduction. (The drift was real: `weft-bench`'s `--ds-aggs` error
message had already gone stale, omitting `twa` — fixed in the same pass.)

## Define the first benchmark profile

`interpolation-heavy-irregular`

## Add the **DuckDB** adapter

the first external-engine (real database) baseline *(owned by the evidence track's EVI-13 → 14 → 15 slices: decision 18 specifies WeftDB against DuckDB `DOUBLE` and `DECIMAL` on MCAR, block-missingness and UCI household-power data at three scales. Note for whoever lands it: the `duckdb` crate 1.10506.0 is MIT but pulls `arrow` 58 non-optionally beside the workspace's 60, plus a bundled C++ build, so it belongs behind an off-by-default feature; checked 2026-10-09)*

## **Research (2026-10-09) — DuckDB has a native linear-interpolation arm:**

the `fill(expr ORDER BY x)` window function "replaces `NULL` values of `expr` with a linear interpolation based on the closest non-`NULL` values and the sort values", with one ordering key, and uses **linear extrapolation** for missing values at the ends. So the cross-engine report can run DuckDB as fair-protocol **class A** (a `range()` grid left-joined to the knots, then `fill(value ORDER BY ts)`), not only as a portable-SQL class B baseline. Two fairness notes: its edges extrapolate linearly where splimes' cubic holds the edge value, so score the interior separately or align the edge policy, and it is linear-only, so compare it against WeftDB's linear arm and report the spline arms beside it. *(src: https://duckdb.org/docs/current/sql/functions/window_functions)*

## **Cross-segment out-of-order merge (Phase 4.6):**

shipped — overlap detection

(`SegmentIndex::overlapping_count`, surfaced in per-aspect + store-wide stats),
the `merge_newer_wins` kernel, `SegmentStore::reconcile_overlaps`/`reconcile_all_overlaps`
(+ `SegmentIndexStore::delete`), the `?overlaps=true` reconcile endpoints, and the
`WEFT_RECONCILE_OVERLAPS` background daemon sweep

## **Hot/cold split in the background reconcile (Phase 4.6):**

shipped —

`reconcile_aspect_hot_cold`/`reconcile_all_hot_cold`, `?hot_cold=true` endpoints,
`WEFT_RECONCILE_HOT_COLD` daemon mode

## **Split-not-rewrite optimization (Phase 4.6):**

shipped — `split_segment`

primitive, `reconcile_overlaps_with_policy` (consumes `SplitPolicy::decide`; default
`reconcile_overlaps` keeps the 50 MiB floor), the `?split_min_bytes=` query param on
the per-aspect and store-wide reconcile endpoints, and the `WEFT_RECONCILE_SPLIT_MIN_BYTES`
daemon env; plus the **squash** half — `squash_aspect`/`squash_aspect_if_exceeds`/
`squash_all_over_threshold`, `POST …/{aspect}/squash?max_segments=`, and the
`WEFT_RECONCILE_MAX_SPLITS` daemon env *(src: https://questdb.com/docs/concepts/partitions/)*

## **Per-stage tracing child spans (Phase 3):**

shipped — `interpolate.parse`/

`interpolate.compute`/`interpolate.serialize` under `interpolate.engine`,
`downsample.parse` beside `downsample.reduce`, `storage.ingest.parse`/`storage.ingest.seal`
on the write path, and a per-request root span (`request{method,path,request_id}` +
`x-request-id`) they all nest under

## **OTLP trace export (Phase 3):**

shipped — env-gated OTLP/gRPC `SdkTracerProvider`

(batch exporter + `weft-server` resource) + `tracing_opentelemetry` layer beside the
`fmt` subscriber; deps `opentelemetry`/`opentelemetry_sdk`/`opentelemetry-otlp` 0.32 +
`tracing-opentelemetry` 0.33 (build protoc-free). Runtime-verified boot both with and
without `OTEL_EXPORTER_OTLP_ENDPOINT`.

## **OTLP collector verification: shipped.**

Local Jaeger collector (docker,

auto-restart) + `scripts/verify-otlp.sh` — asserts `request` root spans with nested
storage stage spans land via the Jaeger query API; re-runnable headlessly.

## **Cursor paging (Phase 2 B-rest):**

shipped — opaque `next_cursor`/`?cursor=`

forward-iteration token on `…/points` + `…/value-points`

## **Gorilla-codec adopt-or-drop (Phase 6.1): ADOPTED + realized.**

Benchmarked on a

scattered-single-jitter corpus (~28% below the best shipped codec in its ±2048 regime,
honest loss past it); realized as a lossless codec, wired into the `.weftseg` block +
`best_estimated_bytes`/`best_encoding_name`, and surfaced in weft-bench. RLE realized on
disk in the same arc.

## **Scaled-int value bit-pack codec (Phase 4/6): shipped + realized on disk.**

The

value block carries a `VAL_CODEC_VARINT`/`VAL_CODEC_BITPACK` selector; a `ScaledI64`
column bit-packs when smaller (`best_value_codec`), surfaced via
`StorageEstimate.realized_value_bytes`/`value_codec` (schema v8). Measured 37.4% below
varint on a 480-pt 2-decimal ramp; runtime `bytes_per_point=2.13` via `/…/stats`.

## **Per-block adaptive (dynamic) bit-pack timestamp codec (Phase 6.1): shipped.**

The

fifth `.weftseg` timestamp codec (`TS_CODEC_BLOCKED`), strict winner on mixed-magnitude
streams (184 B vs 384–961 B for the other codecs on the eval corpus).

## **`storage.ingest.parquet` stage span (Phase 3): shipped.**

Closes the

Arrow-decode-on-ingest tracing gap; runtime-verified nesting under the request root span
(`byte_len`, `require_sorted`, `format="parquet"`).

## **FOR (frame-of-reference) before bit-packing (Phase 6.1): prototyped + benchmarked

(advisory).** `for_bitpack_*` beside the blocked codec (per-block reference, unsigned
residual packed to the block *range*): `for_estimated_bytes` (timestamp),
`for_value_bytes` (value), surfaced in the bench as
`StorageEstimate.advisory_for_value_bytes` (schema v9). Measured 82% below per-block
bit-pack on clustered timestamp dods, 88% below on value mantissas clustered near 1e9.

## **Per-block adaptive (blocked) VALUE codec (Phase 6.1): shipped + realized on disk.**

`VAL_CODEC_BLOCKED` selected via `best_value_codec` (`scaled_blocked`), strict winner on
a mixed-magnitude / zero-straddling mantissa column; regular columns byte-for-byte
unchanged. Round-trip- + framed-segment-verified.

## **FOR adopt-or-drop (Phase 6.1): DECIDED — ADOPTED for the value column (owner

sign-off).** `VAL_CODEC_FOR` realized as the fourth `.weftseg` value codec
(`scaled_for`, strict-win selection); timestamps stay advisory (small dods, FOR
rarely wins). Decided together with the headline flip below — one metric break.

## **FastLanes transposed bit-unpack (Phase 6.1, decode-speed): shipped (prototype).**

*(Correction 2026-10-08: a bit-sliced layout, not FastLanes'; now behind `bitsliced-codec`.)*
`TRANSPOSE_TILE`/`transpose_bitpack_bytes`/`_encode`/`_decode` — a per-tile bit-plane-major
layout whose decoder reads `u64` words and walks only the *set* bits (`w &= w-1`), so the empty
high bit-planes of a small-magnitude stream are skipped wholesale. Byte footprint identical to
the linear per-block layout (a bit permutation). Measured (release, criterion `benches/bitunpack.rs`):
transposed **~238 Melem/s (4.40 ms)** vs linear per-block **~41.6 Melem/s (25.2 ms)** at the same
footprint — **~5.7× decode speedup**, bytes/point unchanged. *(src: FastLanes, VLDB'23 —
https://www.vldb.org/pvldb/vol16/p2132-afroozeh.pdf)*

## **Transposed-layout tile-level random access (Phase 6.1, decode-speed residue — first

slice): shipped.** `timestamp::transpose_bitpack_decode_range(bytes, tile, count, start, len)`
decodes only the `len` values at `start`, skipping earlier tiles by their width headers — the
transposed mirror of `blocked_bitpack_decode_range`. This is the prerequisite the on-disk
realization needs: without it, storing the transposed layout as a value codec would regress the
just-shipped streaming point read (which requires a block-random-access value decode). Shared the
per-tile decode with the full `transpose_bitpack_decode` via a `transpose_tile_decode` helper;
the range decode equals the full decode sliced to `[start, start+len)` (round-trip-tested across
tile sizes, single-value/boundary-straddling windows, width-0 tiles, and out-of-range requests).

## **Transposed layout REALIZED on disk (Phase 6.1, decode-speed residue) — shipped 2026-09-23,

and the end-to-end answer is an honest NO.** `VAL_CODEC_TRANSPOSED` (tag 5) is the sixth `.weftseg`
value codec: tile-size uvarint + length-prefixed `transpose_bitpack_encode` stream, with its **own**
size function (`ColumnEncoding::transposed_value_bytes`) and selector entry
(`best_value_codec_transposed(max_overhead)`) rather than reusing the blocked figure, full reader
dispatch (`read_value_column`, `read_value_at` via `transpose_bitpack_decode_range`, and the
random-access whitelist/skip helpers), and `FrameOptions`/`write_segment_with` +
`write_paged_segment_with` as the general frame writers. Reachable from a deployment via
`TransposedPolicy` / `WEFT_SEGMENT_TRANSPOSED_MAX_OVERHEAD`. **Opt-in**, so an unconfigured store
writes byte-for-byte the historical frames.
**Measured end-to-end (release, `weft-physical-type/benches/transposed_read.rs`, 1M-row
zero-straddling ScaledI64 column):** frame bytes 1,251,057 transposed vs 1,250,076 linear
(**+0.08%**); full decode **12.98 ms vs 13.39 ms** (CIs overlap — a tie); windowed 1000-row range
**2.380 ms vs 2.393 ms** (a tie); single point read **2.250 ms vs 2.431 ms** (~1.08×, disjoint CIs).
**So the ~5.7× kernel-level unpack win does NOT survive the whole read path** — the
bandwidth-bound caveat this item carried, confirmed on WeftDB's own path. The layout is byte-neutral
and read-neutral here, which is why it stays opt-in and the default is unchanged.
*(src: https://www.vldb.org/pvldb/vol16/p2132-afroozeh.pdf · https://arxiv.org/pdf/2606.22423)*

## **Windowed value reads no longer re-walk the codec chain per row (found by review of the

above).** `read_range_from_section` resolved a window by calling `read_value_at` once per row, and
every fixed-layout codec locates a value by walking its block/tile headers *from the start of the
stream* — so an `N`-row window cost `N` walks, and on the 1024-value-tile bit-sliced layout it decoded a
whole tile per value (measured ~27× slower than linear, and ~20× slower than the full-decode
fallback it was supposed to beat). Fixed by `weftseg::read_value_range(bytes, start, len)`, which
does the range decode **once** per codec; this also removes the pre-existing per-row walk for the
blocked/FOR codecs. Equal to the full decode sliced to the window, tested across every codec and
window shape.

## **`read_value_range` cannot panic on a malformed block (found by the same review).**

A cascade

block whose RLE inner run-lengths sum short decodes to fewer values than its header's `count`, and
the fallback arm sliced against that count — a panic inside a fallible public parser. Now slices
with `get`, matching `read_value_at`'s existing behaviour; regression-tested with a hand-built
short-decoding block.

## **DONE (2026-10-08) — the transposed layout's real lever is a per-tile decode-count threshold, not the

layout itself (research 2026-09-23).** The `fastlanes` crate's docs state that beyond roughly **10
values** it is typically faster to unpack a whole tile and index than to unpack values
individually. WeftDB's reader currently always takes the single-value path in `read_value_at` and
always takes the whole-range path in `read_value_range`; neither adapts. Make the dispatch count
the requested values falling in a tile and pick accordingly — that is the difference between
tile-level random access being a win and being a pessimization. The same threshold applies to the
**batch point read** (`read_points_from_section`), which still calls `read_value_at` per instant
and so re-decodes one tile per instant when several instants share a tile (measured by review:
500 same-tile instants ≈ 2.33 ms vs 0.52 ms linear). *(src: https://lib.rs/crates/fastlanes)*

## **NEXT — upstream FastLanes does NOT make the transposed layout its default either, and

exposes the permutation instead (research 2026-09-23).**
*(Correction 2026-10-08: WeftDB's codec is bit-sliced, not FastLanes' transposed layout; the
FastLanes findings below are an analogy for it, not a description of it.)* The FastLanes *file
format* paper states they "use the Unified Transposed Layout (UTL) as an option rather than as the
default", because
for Delta schemes it permutes tuple order and restoring that order costs a gather; their escape
hatch is a **shareable 1024-entry selection vector** that a vectorized engine can apply in front of
decoded vectors, with the restore performed only on request. This independently validates WeftDB's
opt-in choice, and names the next slice: expose an **unordered** tile decode beside the ordered one
so WeftDB's order-*insensitive* consumers (Phase 6.3 min/max/count from metadata, predicate eval
before decompression, CPU filter before GPU transfer) pay no gather at all, while only the ordered
interpolation path restores. *(src: FastLanes file format, VLDB'25 —
https://www.vldb.org/pvldb/vol18/p4629-afroozeh.pdf)*

## **DONE (2026-10-08) — Cross-check WeftDB's hand-rolled bit-plane decoder against the `fastlanes` crate (0.7.2,

2026-09-02, Apache-2.0).** *(Correction 2026-10-08: the tile size matches, the bit order does
not; WeftDB's codec is bit-sliced, so compare decode speed at a width, not layouts.)* It provides
a 1024-element layout (BitPacking pack/unpack, single-value unpack, transposed Delta/RLE, linear
FoR) via LLVM auto-vectorization. If WeftDB's
decoder is materially slower at the same bit width, that is a bug rather than a design choice —
a cheap external yardstick for `benches/transposed_read.rs`. *(src: https://lib.rs/crates/fastlanes)*

## Yardstick shipped (`benches/fastlanes_yardstick.rs`, bench-only pinned dev-dep)

It found

the set-bit-walking decoder **3.7–15× slower** than `fastlanes` at widths 3/10/20 — a bug, per
the rule above. Rewritten as a branch-free table spread written straight into the output:
**1.32→0.78 / 5.27→1.50 / 7.60→2.32 ms** per 1 Mi values (1.7× / 3.5× / 3.3×).

## **Residue — still 2.4–7× behind `fastlanes` (0.33 ms flat across widths).**

The remaining

cost scales with width (~0.07 ns/value/bit). Candidates: a 64×64 bit-matrix transpose per
64-lane plane-word column (fixed cost per value regardless of width), or explicit SIMD on the
spread. Re-run the yardstick on a quiet box before and after.

## **Track the FastLanes SPEC, not the CWI reference implementation.**

`cwida/fastlanes` is on a

`dev` branch with no tagged release (the paper's v0.1), its Rust bindings are path-only
(`fls-rs = { path = "./rust" }`, not a published crate), and its CUDA reader is listed under
"Coming Soon". Depend on spiraldb's published crates (`fastlanes`, `alp`) or on nothing; do not
vendor the C++ reference. *(src: https://raw.githubusercontent.com/cwida/fastlanes/dev/README.md)*

## **Next slice — evaluate Vortex as interchange + bench baseline (Phase 1/4):**

Rust,

Arrow-compatible, cascading ALP/FastLanes/FSST codecs, **~100× faster random access + 10–25×
faster decode than Parquet+zstd at ~same ratio (TPC-H SF10, 38% smaller)**, GPU-SIMT decode by
design — directly on WeftDB's random-access + GPU + interpolation wedge, and Vortex now an LF AI &
Data incubation project (stable enough to depend on). Vortex's own guidance — cascading wins on
"auto-incrementing IDs, sensor readings with bounded variation" — independently validates WeftDB's
just-shipped delta-cascade value codec. *(src: https://vortex.dev/ ·
https://spice.ai/learn/vortex · cascading-with-BtrBlocks —
https://spiraldb.com/post/cascading-compression-with-btrblocks)*

## **GO on both counts, and the governance question is settled (research 2026-09-23):**

the

crate is at **0.86.1 (2026-09-11, Apache-2.0)**, the **file format is stable from 0.36.0**
(all later releases read files written by any version ≥ 0.36.0) though the library API is
explicitly not, and the project is now an **Incubation Stage project at LF AI & Data** rather
than a single vendor's — which is what clears hard-constraint #2. Split this item: (a) add
Vortex as a `weft-bench` external-format baseline for the storage + random-access workloads (it
shares WeftDB's cascading/ALP/FastLanes design, so it is the *fair* comparison Parquet is not);
(b) scope a `weft-vortex` interchange crate **outside** the core crates, beside `weft-arrow`. Pin
the version. *(src: https://github.com/vortex-data/vortex)*

## **Do NOT take a build dependency on `vortex-gpu`.**

Its last publish is 0.56.0

(2025-11-17) — about ten months and thirty minor versions behind the main line at 0.86.1 — and
its docs.rs build failed, so there is no published API documentation. Use it **read-only** as a
reference implementation (it is the only open-source *Rust* rendering of ALP + FastLanes GPU
kernels) alongside `cwida/FastLanesGpu-Damon2025`, and keep WeftDB's GPU path its own.
*(src: https://docs.rs/vortex-gpu)*

## **Evaluate the FastLanes *File Format* (not just the layout) as a bench baseline + a

random-access reference (Phase 1/4):** the FastLanes file-format paper (VLDB'25, 18(11):4629)
extends the transposed layout to a full format whose headline API is **"flexible support for
partial decompression… fine-grained access at the level of small batches rather than rowgroups"**
— the closest external analog to WeftDB's just-shipped block-level random access + streaming point
read. Assess it beside Vortex/Parquet as a `weft-bench` external-format baseline for the
storage/compressed-query **and point-lookup** workloads, and as the reference design for the
transposed-on-disk realization. *(src: "The FastLanes File Format", VLDB'25 —
https://www.vldb.org/pvldb/vol18/p4629-afroozeh.pdf · CWI impl — https://github.com/cwida/fastlanes)*

## **It publishes a random-access target WeftDB can mirror exactly (research 2026-09-23):**

retrieving the first value (`LIMIT 1 OFFSET 0`) across PUBLIC_BI takes FastLanes **0.14053 ms**,
vs Parquet+Snappy **315.62×** slower, Parquet+Zstd **413.66×**, BtrBlocks **813.57×**, DuckDB
5.96× — because "block-based compression methods are extremely inefficient for random access, as
they require decompressing the entire block to access a single value". Add a `weft-bench` case
mirroring it (single cold-frame point read, reported in ms *and* as a multiple of Parquet), so
WeftDB's point-read work has an external yardstick rather than only an internal before/after. It is
also the argument for **not** adopting a block-based heavyweight codec (zstd over a rowgroup) on
the measurement hot path even where it would win bytes/point: the north star is a *latency*
target. *(src: https://www.vldb.org/pvldb/vol18/p4629-afroozeh.pdf)*

## **Two honesty corrections from the same paper.**

(i) **Encoding is the weak side**:

FastLanes total encode time on PUBLIC_BI is 81,341 ms vs Parquet+Snappy 5,867 ms (~14× slower),
and the authors concede "no effort whatsoever has been made to make it fast". WeftDB encodes on the
*ingest* path, so an exhaustive per-column codec search would do the same damage — adopt the
paper's own mitigation before growing the candidate set with ALP/cascade: **three-way sampling**
(vectors at positions 0, 32, 64) reaches >99% of the ratio of searching all 64. (ii) **Ratio
alone is not the story**: on PUBLIC_BI Parquet+Zstd is within 2% of FastLanes, and on TPC-H it
is 15.3% *ahead* — FastLanes' win is the 43–44× decode. So WeftDB's compression headline must be
ratio **and** decode throughput jointly, never ratio alone.
*(src: https://www.vldb.org/pvldb/vol18/p4629-afroozeh.pdf)*

## **Point-lookup positioning — WeftDB's block-random-access read is a genuine columnar mitigation

(Phase 0/1):** the 2026 competitive reviews name point lookups as *the* columnar weakness ("a
column store opens ~50 column files to materialise one row; a row store walks one B-tree path" →
"skip a columnar DB when point lookups are the main access pattern"). WeftDB's streaming point read
(never materializes the value column; `O(1)` closed-form row for a regular timestamp column)
mitigates exactly this — add a `weft-bench` **point_lookup** workload and benchmark WeftDB's
`read_point`/`read_points` vs ClickHouse ASOF/point + QuestDB, then fold the result into the
*When WeftDB beats general TSDBs* honesty page. *(src:
https://clickhouse.com/resources/engineering/when-to-use-columnar-database ·
https://questdb.com/blog/clickhouse-vs-questdb-comparison/)*

## **GPU-decode the `.weftseg` transposed layout rather than adopting a new format (Phase 5/6):**

a 2026 study ("Do GPUs Really Need New Tabular File Formats?", arXiv 2602.17335) finds existing
formats (Parquet, **FastLanes**) can be *rewritten/optimized* for competitive GPU performance
rather than needing purpose-built formats — evidence to GPU-decode WeftDB's own transposed `.weftseg`
layout (the `transpose_bitpack_decode_range` prototype) on-device, pairing with the GPU
interpolation flagship, instead of importing a new columnar format. *(src:
https://arxiv.org/pdf/2602.17335)*

## **Correlation-aware column compression as a post-B-tags codec direction (Phase 6):**

Corra

(arXiv 2403.17229) and FastLanes' multi-column compression (MCC) exploit *inter-column*
correlation for extra ratio — only relevant once WeftDB has multiple value columns / per-measurement
tags (B-tags), so park it behind that, but note it as the multi-column codec frontier. *(src:
https://arxiv.org/pdf/2403.17229)*

## **Headline bytes/point FLIPPED to the realized figure (Phase 4/6, owner sign-off,

bench schema v10):** `Segment::value_bytes`/`total_bytes`/`bytes_per_point`,
`Page::total_bytes`, `StorageEstimate.bytes_per_point`/`total_bytes_per_point`, and
the bench HTML `val B/pt` now report the codec actually written; the naive `len*8`
figure is retained as `logical_value_bytes`/`estimated_value_bytes` (the compression
baseline). Pre-v10 bytes/point artifacts are not comparable.

## **weft-bench parallel-test OOM — ROOT-CAUSED + FIXED (it was a logic bug, not

environmental).** A full-backtrace capture pinned the ~28 GB allocation to
`splimes::helpers::generate_target_times::TargetTimesIterator::next_impl` (splimes 0.1; 1.0 has no such iterator), which sized the
per-batch `Vec<DateTime<Utc>>` from *free system memory* (`available_memory / point_size /
2`) instead of from the number of timestamps to produce — a tens-of-GiB speculative
`Vec::with_capacity` per call. Single-threaded one such allocation succeeds when RAM is
idle (only ever filled to the tiny real grid, then dropped), which is why `--test-threads=1`
masked it; under the default parallel harness many interpolation tests call it at once and
the summed over-allocation aborts the process. Fixed by capping the batch by
`remaining_points()` (the timestamps left) and `MAX_BATCH_POINTS` (1 << 20); the previously
reliable crash is gone (`cargo test -p weft-bench --lib` now passes 92/0 on repeated parallel
runs). The sibling sizers in `optimizations/mod.rs` + `gpu/mod.rs` were already bounded by
the real work — no change needed there.

## **f64 value-column codecs (Phase 6.1): Gorilla + Chimp + Chimp128 + Elf-style, best-of

selector (advisory), bench-surfaced (schema v13).** Faithful **Chimp128** (14-bit-trailing-hash
128-value reference window) shipped + folded into `best_f64_codec` (82.8% below Gorilla on a
revisiting signal); **Elf-style** erasing codec shipped as a verified-lossless conservative
advisory (6.7% below Chimp128 on 2-decimal drift; faithful bit-level erase is the residue). See
the Phase 6.1 f64-codec block. **Adopt target is ALP** (replaced Chimp128 in DuckDB, beats both
Chimp128 and Elf on ratio+speed) — the adopt-or-drop + on-disk realization is owner-gated (a
headline change, as FOR was).

## **Sprintz FIRE forecaster + zero-RLE (Phase 6.1): shipped advisory + bench-surfaced (schema

v14).** `fire_residuals`/`fire_reconstruct`/`fire_estimated_bytes` (learned-coefficient
delta-of-delta generalization, verified-lossless) with the RLE zero-run half; surfaced as
`StorageEstimate.advisory_fire_timestamp_bytes`. 54.8% below dod on a constructed
geometric-velocity stream — but FIRE is *marginal on real data* (upstream + the 2025 comparative
study), so adoption is gated on the bench advisory showing a real win.

## **Cascading codec composition (Phase 6.1): advisory + on-disk descriptor shipped.**

`ColumnEncoding::delta_cascade_bytes`/`delta_cascade_plan` (delta→best inner packer over
{varint,bit-pack,blocked,FOR,RLE}; 97.4% below the best single-level codec on a monotone-trend
column) **and** the on-disk `.weftseg` codec-chain descriptor `VAL_CODEC_DELTA_CASCADE` (anchor +
inner-codec descriptor + inner-coded deltas; `write_value_column_cascading` /
`best_value_codec_cascading`, decoded by the ordinary `read_value_column`). Surfaced as
`StorageEstimate.advisory_delta_cascade_value_bytes` (bench schema v15). Kept **opt-in** — the
cascade beats FOR on FOR's own clustered fixtures, i.e. a broad realized-bytes change of the FOR
class, so the default selector is unchanged. *(Vortex's own guidance independently confirms the
regime — cascading wins on auto-incrementing IDs + bounded-variation sensors:
https://spiraldb.com/post/cascading-compression-with-btrblocks)*

## **Cascade adopt-or-drop into the DEFAULT selector — owner-gated (headline change, as FOR/ALP):**

fold the delta cascade into `best_value_codec`/`best_serialized_bytes` so trending value columns
realize it by default (bench schema bump; pre-adoption bytes/point not comparable on trending
columns). Broad win — needs owner sign-off, then flip and re-baseline the headline once.

## **Block-level random access (Phase 6.1): shipped.**

`blocked_bitpack_decode_range` /

`for_bitpack_decode_range` decode only the blocks overlapping a `[start, len)` window (skipping
earlier blocks by their headers), and `weftseg::read_value_at(bytes, index)` reads one value
straight from a `.weftseg` value block — **all three fixed-layout `ScaledI64` value codecs take a
random-access fast path**: the two per-block codecs (`VAL_CODEC_BLOCKED`/`VAL_CODEC_FOR`) via the
block-skip range decoders, and the fixed-width `VAL_CODEC_BITPACK` via `bitpack_decode_at` (the
value at `index` lives at bit `index * width`, an `O(width)` read); the per-value/cascade payloads
fall back to a full decode + index. The streaming point read (`read_point_from_section`, single &
paged) skips the value block for any of the three. The point-lookup / late-materialization lever,
matching Vortex's finer-grained in-segment access. *(src: https://spice.ai/learn/vortex)*

## **Streaming single-value point read wired into the segment/API point-read path (Phase 4/6):

shipped.** `weftseg::read_segment_point(bytes, t)` reads the first present value at `t` from a
single-block `.weftseg` frame **without materializing the value column**: on a per-block value
codec (`VAL_CODEC_FOR` / `VAL_CODEC_BLOCKED`) it skips the value block by its self-describing
framing, decodes only the timestamp block to locate the row (binary-search sorted, linear-scan
out-of-order), maps the logical row to its dense present-rank, and unpacks the *one* covering
value block via `read_value_at`; every other codec falls back to `read_segment` + `value_at`
(equal for every frame). `SegmentStore::read_point` (which powers `GET …/storage/{aspect}/at`)
now takes this path for single-block segments. Benchmarked (`benches/pointread.rs`, criterion,
100k-row sorted FOR segment): **222.65 µs vs 13.196 ms full-decode — ~59× faster point lookup,
identical bytes on disk.**

## **Streaming point read extended to paged segments (Phase 4/6): shipped.**

`weftseg::read_paged_segment_point(bytes, t)` parses the per-page index (stats + block length)
and **prunes pages on their indexed min/max ts without decoding a column byte** (on-disk
intra-segment page skipping), then resolves the surviving page through the shared
`read_point_from_section` (the block-skip value read applies within the page too), matching
`PagedSegment::value_at`'s first-present-page semantics. The paged branch of
`SegmentStore::read_point` (which powers `GET …/storage/{aspect}/at` for paged frames) now takes
it. Refactored the single-block reader onto the same section helper so both share one code path.
Benchmarked (`benches/pointread.rs`, 100k-row FOR frame, 4096 rows/page ≈ 25 pages): **168.99 µs
vs 1.2471 ms full paged decode — ~7.4× faster** (a smaller multiple than the single-block ~53×
because `PagedSegment::value_at` already prunes pages before materializing values; the streaming
read additionally skips the surviving page's value-column decode). Runtime-verified against the
live endpoint on a 5-page FOR frame (format_version 6).

## **Batch point lookup — amortize the timestamp decode across many instants (Phase 4/6):

shipped.** `weftseg::read_segment_points`/`read_paged_segment_points(bytes, &[t])` and
`SegmentStore::read_points(aspect, &[t])` resolve many instants in one pass: the index is pruned
once by the batch's whole span, each surviving segment/page is opened + its timestamp column
decoded **once** for the whole batch (paged pages still skip when no unresolved instant falls in
their span), and results are returned aligned to the query slice with per-instant last-writer-wins
across segments. So `N` instants sharing a segment pay one file read + one timestamp decode, not
`N`. Equal to the per-instant `read_point` for every slot (unit-tested single-block + paged +
cross-segment). Refactored `read_point_from_section` into a batch `read_points_from_section` the
single-instant path delegates to. Benchmarked (`benches/pointread.rs`, 64 instants on a 100k-row
FOR frame): **520.65 µs for one batch read vs 13.902 ms for 64 single reads — ~27× faster.**

## **Batch point lookup exposed at the API (Phase 2/4): shipped.**

`GET /api/v1/storage/{aspect}/at-multi?t=<epoch>,<epoch>,…` resolves a comma-separated list of
instants through `SegmentStore::read_points`, returning `{aspect, time_unit, points:[{timestamp,
value, found}]}` in query order (a non-integer entry → `400`). Runtime-verified against the live
binary: a scrambled batch (repeat + off-grid miss + out-of-range) returns the correct per-instant
values in order and matches the single `/at`. Amortization benchmarked at the codec layer (~27×
for 64 instants, see the batch-read item above).

## **Closed-form timestamp lookup for regular (constant-stride) columns (Phase 4/6): shipped.**

The remaining `O(n)` cost of the streaming point read was the whole-timestamp decode + binary
search. For a **regular series** (the common IoT/finance case) that is now `O(1)`:
`DeltaOfDeltaColumn::arithmetic_stride()` detects a constant stride (first difference defined, all
second differences zero → `ts[i] = first + i*step`), and `read_points_from_section` resolves each
instant's row in closed form (`(t - first) / step`, gated on `time_sorted` so `step > 0` and no
wrap-around) — **no timestamp materialization at all**. An irregular or out-of-order column decodes
+ binary/linear-searches as before. Benchmarked (`benches/pointread.rs`, 100k-row point lookup):
**regular closed-form 191.53 µs vs irregular decode+search 1.3353 ms — ~7× faster** (and the
single-block streaming point lookup dropped to 192 µs / ~62× vs the 11.9 ms full decode). Validated
for equality against `value_at` by the existing point-read tests (whose regular fixtures now take
the closed-form path, the duplicate/irregular ones the fallback) + a dedicated `arithmetic_stride`
test.

## **DONE (2026-07-16) — block-random-access timestamp search for *irregular* sorted columns

(Phase 4/6):** shipped as an **opt-in** on-disk checkpoint index. `DodCheckpoints` /
`DeltaOfDeltaColumn::checkpoints(stride)` record `(row, timestamp, delta)` every `stride` rows;
`TS_CODEC_CHECKPOINTED` (tag 5) persists that index followed by the inner codec stream —
**additive, so no format-version bump and every existing frame still reads**;
`write_segment_checkpointed` / `write_paged_segment_checkpointed` write it, and the streaming point
read resumes from the nearest checkpoint. Equal to the plain frame for every probe/batch/null-run
(tested across strides on single-block + paged frames).
**The measured story, in order, because the first answer was wrong:**
1. The index *alone* delivered **nothing** end-to-end (355.11 ms plain vs 350–360 ms checkpointed —
   noise). Skipping the cumulative-sum reconstruction is only ~1% of a real point read.
2. Diagnosis: the **dod codec decode** dominates, not the reconstruction. Forcing the inner stream
   to the range-decodable `TS_CODEC_BLOCKED` and range-decoding only the blocks a probe walks
   (`blocked_bitpack_decode_range`) fixed the step that actually costs: **352.94 ms → 102.42 ms,
   ~3.45× faster irregular point read for +0.41% frame bytes** (stride=1024, 100k-row frame).
3. Paged frames gain only **1.14×** (68.70 → 60.41 ms): page pruning already bounds the decode to
   `rows_per_page`, so there is little left to save. The index is mostly a *single-block* lever.
This is the "decode-throughput is often bandwidth-bound — measure, don't assume" caveat confirmed
on WeftDB's own path. *(src: https://arxiv.org/pdf/2606.22423)*

## **DONE (2026-07-16) — the checkpointed seal is REACHABLE (opt-in).**

`CheckpointPolicy`

(`weftdb`) reads `WEFT_SEGMENT_CHECKPOINT_STRIDE` + `WEFT_SEGMENT_CHECKPOINT_MIN_ROWS` (default
8192 rows) and applies at `persist`/`persist_paged`, so all six seal entry points inherit it;
`SegmentStore::with_checkpoint_policy` overrides it programmatically. It fires only where it pays
— `Segment::benefits_from_checkpoints()` (sorted **and** irregular). **Off by default**: an
unconfigured store writes byte-for-byte the historical frames. Runtime-verified on the live binary
over identical 12k-row sorted-irregular ingests: unset → `total_bytes=19159`
(`bytes_per_point=1.5966`), `WEFT_SEGMENT_CHECKPOINT_STRIDE=1024` → `19422` (`1.6185`, **+1.37%**),
with `…/at` and `…/at-multi` returning byte-identical JSON from both stores.

## **NEXT — checkpoint index adopt-or-drop into the DEFAULT policy — owner-gated (bytes/point

change, as FOR/cascade/ALP):** the trade is measured end-to-end and merely needs a decision:
**~3.45× faster irregular single-block point reads for ~+0.4–1.4% bytes** on the shapes that now
pass the gate (+1.37% on the 12k-row runtime corpus; +0.41% on the 100k-row bench — the index's
share shrinks as the segment grows, being `rows/stride` entries against a growing column). Flip
`CheckpointPolicy::from_env`'s default to `stride: Some(1024)` if adopted, then re-baseline the
headline once. The predicate is already shipped and now correct on all three axes:
`time_sorted && !regular && rows >= 8192 && codec_overhead <= 1.25`. Two things to weigh:
**paged frames gain only 1.14×** (page pruning already bounds their decode), and the codec gate
means **Gorilla/RLE-shaped irregular columns get no win at all** — so the benefit is narrower than
"all irregular columns" and depends on a deployment's shape mix.

## **DONE (2026-07-16) — the `TS_CODEC_BLOCKED` override is QUANTIFIED, and it is NOT small.**

Measured per shape on the timestamp block (10k rows,
`weft-physical-type/benches/dodsearch.rs::report_codec_override_cost`): bounded jitter **+1.04%**
(blocked already wins) · scattered single jitter **+251%** (gorilla wins) · long constant runs
**+1301%** (RLE wins) · regular +1418% (moot — never checkpointed). **The earlier +0.41% frame
figure was corpus-specific luck**: the bounded-jitter corpus is the one shape where blocked is
already best. The scattered-jitter and constant-run shapes are *irregular*, so the shape-only
predicate would have checkpointed them and silently bloated their timestamp block 3.5×/14×.
**Fixed**: `Segment::checkpoint_codec_overhead()` (`blocked/best`) + `CheckpointPolicy`'s
`max_codec_overhead` ceiling (default 1.25, `WEFT_SEGMENT_CHECKPOINT_MAX_CODEC_OVERHEAD`) refuse
those seals; proven end-to-end by a test where an RLE-shaped column seals byte-identical to plain
and only checkpoints when the ceiling is lifted.

## **NEXT — a random-access-capable Gorilla/RLE would widen the checkpoint index's reach:**

the

codec gate now *refuses* Gorilla/RLE-shaped irregular columns rather than bloating them, so those
columns keep the `O(n)` timestamp decode on a point lookup — correct, but they get no win. A
block-framed Gorilla (or an RLE with per-run offsets) would let the checkpoint index apply there
too, at a fraction of the current override. Only worth it if such corpora prove common — measure
the shape mix of a real customer corpus first.

## **Windowed range read — decode only the row window for a regular block-coded segment (Phase

4/6): shipped.** `weftseg::read_segment_range(bytes, start, end)` returns the `[start, end]` rows;
for a **regular (constant-stride) sorted column with a random-access value codec** it computes the
row window `[lo, hi]` in closed form (no timestamp materialization), generates the window
timestamps directly, and unpacks **only the present values inside the window** via `read_value_at`
(one block per present row) — so a selective range over a large regular block-coded segment decodes
~`window` values, not all of them; the sparse case walks the dense-rank window. Any other shape
(irregular, per-value/cascade value codec, out-of-order) falls back to a full decode + filter.
`SegmentStore::read_time_range`'s single-block branch now takes it (paged already page-prunes).
Equal to `decode_nullable()` filtered to the window for every frame (unit-tested regular/sparse/
irregular/f64/out-of-order across full-span, interior on/off-grid, single-point, empty, and
out-of-range windows). Runtime-verified against the live `GET …/points?start=&end=` endpoint.
Benchmarked (`benches/pointread.rs`, a 100-row window over a 100k-row FOR frame): **629.40 µs
windowed vs 12.651 ms full decode + filter — ~20× faster.** Extended to **paged** frames too:
`read_paged_segment_range` skips whole pages disjoint from the window (on-disk page skipping) and
windows each surviving page through the shared `read_range_from_section` (single-block + paged now
share one range-read core, mirroring the point-read arc); wired into `SegmentStore::read_time_range`'s
paged branch, equal to `PagedSegment::read_time_range`, runtime-verified against the live endpoint on
a 5-page frame.

> The key commercial move is not adding features — it is making WeftDB's performance
> claims measurable, reproducible, and valuable to a specific buyer. If WeftDB can
> credibly show it is faster, cheaper, or more accurate for large-scale interpolation
> and compression-aware irregular time-series analysis than general-purpose TSDBs, it
> has a clear path to a commercial product.
