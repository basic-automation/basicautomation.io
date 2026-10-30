---
title: "Phase 6 — Compression v2 — notes"
summary: "The prose, findings and finished-work write-ups that sit behind the roadmap checklist for this section."
order: 17
group: Roadmap notes
---

# Phase 6 — Compression v2 — notes

*The checklist for this section is in the [roadmap](https://github.com/basic-automation/weftdb/blob/main/ROADMAP.md). What follows is the writing that used to sit between its items.*

**Acceptance:** honest claim like *"this mode cuts storage by X while preserving event
detection within Y% and improving historical query latency by Z."*

**Real-corpus figures.** Every "real BTC" number in this phase and below (`btc_close`,
`btc_minutes`, 4.22 B/point, the `--*-csv` workloads) comes from `database/datasets/btc_1min.csv`,
a local, gitignored file that is **not distributed with the repository**, so a clone cannot
reproduce them (the benches that load it by default skip it when the file is absent). Whether the datasets
may be redistributed, and clearing or retiring the BTC-corpus numbers before 1.0, are open with
counsel ([Phase 8](https://github.com/basic-automation/weftdb/blob/main/ROADMAP.md#phase-8--commercial-hardening--required-for-paid-beta);
[1.0 plan, Appendix B](/projects/weftdb/docs/release-plan#appendix-b-human-only-tasks)).

## **6.1 Lossless typed codecs**

timestamp delta/delta-of-delta + **fixed-width

bit-packing** + **RLE** + **Gorilla variable-length** + **per-block adaptive
bit-packing** *(all five realized on disk in the `.weftseg` timestamp block, chosen
per-stream by `best_encoding_name`)*; **scaled-int value bit-packing** *(realized on
disk in the value block)*; Chimp-style f64; ALP-inspired vectorized f64;
Decimal128/scaled-int codecs; **block-level random access** *(shipped —
`blocked`/`for_bitpack_decode_range` + `weftseg::read_value_at`)*. *(Check codec
patents/licenses before embedding — and before shipping; see the gate below.)*

## **Codec patent/licence gate (owner decisions 2026-10-08).**

The check covers **every

codec the crates ship**, not only what the `.weftseg` writer embeds: a codec in a published
crate's public API, or one that only a bench reaches, is still distributed code. Status:

## **Elf, FIRE and the advisory f64 codecs: gated.**

Gorilla-XOR, Chimp, Chimp128, Elf,

the `best_f64_*` selector and the Sprintz FIRE forecaster sit behind
`weft-physical-type`'s non-default `experimental-codecs` feature, outside the 1.0 semver
promise. None is written to disk and no default read or write path calls one; only the
unpublished `weft-bench` enables the feature. A flagged Chongqing patent names Elf
explicitly, so Elf stays gated (or is removed) unless counsel clears it.

## **Bit-sliced value codec: gated pending counsel.**

The opt-in `VAL_CODEC_TRANSPOSED`

codec is behind the non-default `bitsliced-codec` feature (forwarded by `weftdb` and
`weft-server`) because a WARF patent is flagged against it. Without the feature the writer
never selects it, `WEFT_SEGMENT_TRANSPOSED_MAX_OVERHEAD` is ignored with a warning, and
readers return `WeftSegError::CodecNotEnabled`. Its docs now call it bit-sliced; it was
never the FastLanes layout.

## **Default FOR codec and the Tiger Data family: with counsel.**

Amazon US 11,308,093 is

flagged against the frame-of-reference value codec WeftDB writes **by default**
(`VAL_CODEC_FOR`), and Tiger Data patents against both ingest paths. Technical claim charts
are prepared. These stay ungated because default stores depend on them; the decision is
counsel's.

## **The 2026-10-08 routine's advisory codecs: not yet reviewed, and ungated.**

INT-0

merged them after this gate was set: the decimal-exponent FOR (`timestamp::dfor_bitpack_*`,
`ColumnEncoding::dfor_value_bytes`) and the timestamp common-multiple and delta-FOR estimates
(`DeltaOfDeltaColumn::common_multiple`, `common_multiple_estimated_bytes`,
`delta_for_estimated_bytes`). None is written to disk, but all are in `weft-physical-type`'s
public API, so the check above covers them, and the decimal-exponent FOR is a
frame-of-reference variant, so the FOR item's counsel question reaches it too. They fit
`experimental-codecs`' description (advisory codecs the writer never emits) without being
behind it; whether to move them there before the next release is the owner's call. The
bench-only ALP arm (`benches/alp_vs_f64_codecs.rs`, over the `alp` crate) already requires
`experimental-codecs`.

## **SAP family: review before the Phase 6.2 design.**

Read the flagged SAP patents before

designing model-based compression (6.2), so the design starts clear of them rather than
being reworked afterwards.

## **Possible future: a patent-clear codec in a new crate.**

If counsel advises against a

shipped codec, implement a replacement that avoids the claims in its own crate, and keep
the gated original only so existing stores stay readable.

## **Attribution for adapted code.**

Chimp/Chimp128 (`weft-physical-type`) and DDSketch

(`weft-reduce`) are treated as adapted from their Apache-2.0 reference implementations: a
root `NOTICE` and per-crate `THIRD-PARTY-NOTICES` (shipped in each package) meet
Apache-2.0 section 4. *(INT-0, 2026-10-08: the routine's integer `avg` division in
`weft-reduce` transcribes bigdecimal-rs's `impl_division`; it is attributed the same way,
taken under the Apache-2.0 option of bigdecimal-rs's MIT OR Apache-2.0.)*

## **Package licence metadata: mitigated by the relicense; the expression is with

counsel.** Every crate now declares `license = "MIT OR Apache-2.0"`, so Apache-2.0 is one
of the two options scanners see, and the two crates' `THIRD-PARTY-NOTICES` and READMEs say
that the Chimp, DDSketch and bigdecimal-rs portions stay under Apache-2.0 whichever option a
user picks.
The field itself still offers MIT for the whole of `weft-physical-type` and `weft-reduce`.
The candidate expression for those two crates is `(MIT OR Apache-2.0) AND Apache-2.0`;
it is on the [Phase 8](https://github.com/basic-automation/weftdb/blob/main/ROADMAP.md#phase-8--commercial-hardening--required-for-paid-beta) counsel
list.

## **Gorilla + RLE realized on disk**

the timestamp block now carries four

codecs (varint/bit-pack/RLE/Gorilla) chosen by the single-source-of-truth
`best_encoding_name`, so the reported codec always matches the bytes written; the
Gorilla win shows in the weft-bench bytes/point.

## **Evaluated** a Gorilla-style variable-length second-difference estimate

(`gorilla_dod_bits`/`gorilla_bytes`/`DeltaOfDeltaColumn::gorilla_estimated_bytes` —
advisory only, NOT wired into the realized varint-vs-bit-pack selector). Measured
finding: on a 64-point mostly-regular stream with two isolated 50k-gap spikes,
gorilla=52 B beats fixed-width bit-pack=143 B (the roadmap hypothesis holds vs
bit-pack), but the **already-shipped RLE codec (32 B here) wins on isolated
spikes**. Gorilla's unique advantage is therefore *scattered single* jitter (RLE
can't form runs, bit-pack pays max width for the many near-zero values). *(src:
Gorilla, VLDB'15)*

## **Adopt-or-drop decision for the Gorilla codec: ADOPTED.**

Benchmarked gorilla

vs varint/RLE/bit-pack on a scattered-single-jitter corpus: gorilla is the strict
winner in its regime (e.g. 368 B vs the best shipped codec's 508 B, ~28% smaller,
on a 1000-pt base with an isolated jitter every 16th interval within its ±2048
bucket), with an honest loss boundary past ±2048 (falls to the 68-bit bucket).
Realized as a full lossless codec (`encode_gorilla_dods`/`decode_gorilla_dods`),
wired into the `.weftseg` block (`TS_CODEC_GORILLA`) + folded into
`best_estimated_bytes`/`best_encoding_name`, and surfaced in the weft-bench
StorageEstimate. RLE was also realized on disk (`TS_CODEC_RLE`) in the same arc,
closing its estimate/disk divergence. *(src: Gorilla, VLDB'15)*

## **Evaluated + ADOPTED dynamic (per-block adaptive) bit packing.**

Measured on a

256-value mixed-magnitude second-difference stream (one contiguous 32-wide window of
~30-bit values among ±1 narrow jitter, block=64): blocked=184 B is the strict winner —
global bit-pack 961 B, varint 384 B, Gorilla 450 B, RLE 640 B (81% below global, 52%
below the next-best shipped codec). Realized as the fifth timestamp codec
(`blocked_bitpack_encode`/`decode`, `TS_CODEC_BLOCKED`, `BLOCKED_BITPACK_BLOCK=64`),
folded into `best_estimated_bytes`/`best_encoding_name` (`delta_of_delta_blocked`),
and round-trip- + runtime-verified. A single-block stream ties global bit-pack, so the
selector keeps the simpler label there. *(src: "Dynamic Bit Packing", Sensors 2023 —
https://www.mdpi.com/1424-8220/23/20/8575 · Sprintz per-block bit-packing, Proc. ACM
IMWUT 2(3), 2018 — https://doi.org/10.1145/3264903 · https://arxiv.org/abs/1808.02515)*

## **Frame-of-Reference (FOR) per-block codec — prototyped + benchmarked (advisory).**

`for_bitpack_bytes`/`encode`/`decode` beside the blocked codec: each block emits a
zig-zag-varint reference (the block minimum) then the *unsigned* residuals (`v - min`)
bit-packed at the block's *range* width, not its magnitude. Exposed as
`DeltaOfDeltaColumn::for_estimated_bytes` (timestamp) and `ColumnEncoding::for_value_bytes`
(value), and surfaced in the bench as `StorageEstimate.advisory_for_value_bytes` (schema
v9). Benchmarked: timestamp dods on a clustered-offset corpus FOR=135 B vs per-block
bit-pack 748 B (82% smaller); value mantissas clustered near 1e9 FOR=90 B vs blocked
747 B / bit-pack 745 B / varint 960 B (88% smaller). *(src: Lemire, FOR+delta —
https://lemire.me/blog/2012/02/08/effective-compression-using-frame-of-reference-and-delta-coding/
· ALP FastLanes FOR, SIGMOD'24 — https://dl.acm.org/doi/10.1145/3626717)*

## **FOR adopt-or-drop — DECIDED (owner sign-off): ADOPTED for the value column,

timestamps stay advisory.** `VAL_CODEC_FOR` is the fourth realized `.weftseg` value
codec, folded into `best_serialized_bytes`/`best_value_codec` (`scaled_for`, chosen
only when strictly smallest; ties keep the simpler codec); a non-`ScaledI64` payload
is rejected (`value_codec_for_type`). Because FOR packs the residual *unsigned* it
beats zig-zag bit-packing on *any* all-non-negative column — an accepted, genuine
win, decided together with the headline bytes/point flip below so the metric broke
once, not twice. The bitpack/blocked-regime tests moved to zero-straddling fixtures
(their genuine regime). Timestamp FOR stays advisory-only (`for_estimated_bytes`):
dods are small/near-zero so FOR rarely wins there; the advisory number remains as
the tripwire if a real corpus ever contradicts that. Round-trip- +
framed-segment-verified.

## **Sprintz-style FIRE predictor + zero-RLE (advisory):**

shipped as advisory

estimates. `timestamp::fire_residuals`/`fire_reconstruct`/`fire_estimated_bytes` — FIRE
(Fast Integer REgression) generalizes delta-of-delta with a learned fixed-point
coefficient (sign-sign LMS, `FIRE_SHIFT`=8) adapted online, verified-lossless by the
deterministic wrapping-i64 encoder/decoder mirror; the estimate takes the best of
{varint, bit-pack, blocked bit-pack, **RLE**} over the residual tail (the zero/run-length
half). Surfaced in the bench as `StorageEstimate.advisory_fire_timestamp_bytes` (schema
v14) so the FIRE-vs-dod question is answered on the *real* timestamp corpus. Measured
54.8% below dod on a constructed geometric-velocity stream. *(src: Sprintz, Proc. ACM IMWUT
2(3), 2018 — https://doi.org/10.1145/3264903 · https://arxiv.org/abs/1808.02515)*

## **FIRE adopt-or-drop — DECIDED (2026-07-16): DROPPED.**

Measured on the *real* bench

corpora exactly as this item demanded, via the shipped `advisory_fire_timestamp_bytes` (8
distinct timestamp corpora — jitter 0.0/0.02/0.05/0.15/0.35/0.5/0.8/0.9 × missingness
0.1–0.9 × 5 seeds, 50k points each). **FIRE's best real-corpus result is −0.1% (a
rounding-level tie) and it LOSES by +24.3% on a regular column** (95,749 B vs the realized
77,037 B `delta_of_delta`). The constructed 54.8% win does **not** generalize — precisely
what the upstream authors and the 2025 comparative study predicted. Not wired into any
on-disk selector. The advisory estimate stays as the tripwire: if a real customer corpus
ever contradicts this, the number will say so. (Note: the bench's *shape* knob does not
vary timestamps — shape drives values — so shape is not an independent axis here; jitter,
missingness and seed are.) *(src: "Lossless Compression of Time Series Data: A Comparative
Study", 2025 — https://arxiv.org/html/2510.07015v1 · Sprintz §FIRE —
https://arxiv.org/abs/1808.02515)*

## **Evaluate Pcodec as an integer/f64 codec + bench baseline — now with the upstream numbers

(research 2026-07-23):** the 2025 comparative study finds **Sprintz and Pcodec** give the best
ratio/throughput trade-off for integer time-series (Sprintz at Snappy/LZ4 speeds). Pcodec's own
paper reports **29–94% higher compression ratio than other numerical codecs on six real-world
columnar datasets, at less compression time, with decompression consistently above 1 GiB/s per
thread** — and it is Rust (the `pco` crate, actively maintained), columnar, and aimed squarely at
WeftDB's scaled-int + f64 hot path. That profile makes it a *stronger* first candidate than the
Chimp/Elf line for the value column, and a natural `weft-bench` external-format baseline beside
Vortex. Judge it on bytes/point AND decode throughput, and note the corpus caution above — measure
it on the real corpus, not the synthetic generator. *(src: Pcodec, arXiv 2502.06112 —
https://arxiv.org/abs/2502.06112 · comparative study — https://arxiv.org/html/2510.07015v1 ·
https://lib.rs/crates/pco)*

## **SCOPE CORRECTION (research 2026-09-23): evaluate pco for the COLD TIER and as a

bytes/point ceiling — not as the hot-path value codec.** Its format gives **page**-granular
random access with **serial** batch decode inside a page ("Batches within a page must be
decompressed serially"), which is architecturally incompatible with WeftDB's tile-level random
access; and its decode throughput is ratio-first — 1.4–5.5 GiB/s per thread across its own six
datasets, one to two orders below FastLanes-class unpacking, with Vortex beating it on 4 of 6.
Rewrite the item's goal accordingly. *(src: https://arxiv.org/pdf/2502.06112)*

## **The real prize in pco may be its MODE DETECTION, not its format.**

Its automatic modes

map almost exactly onto WeftDB's regime: `IntMult` ("ms-precise timestamps stored as us") is
literally WeftDB's timestamp column, and `FloatMult` ("prices that are multiples of 0.01") is
literally WeftDB's schema-declared scaled-int value column; with them pco beats the next best
alternative by +29% to +94% across its datasets. So run the bench **head to head per column** —
pco `FloatMult` vs the shipped `scaled_for`/`scaled_blocked`, pco `IntMult` vs the shipped
delta/blocked/Gorilla timestamp codecs — not whole-file sizes. If pco's detection beats
`best_value_codec` on the real corpus, the actionable outcome is to steal the **heuristic**,
which stays inside hard-constraint #4 because WeftDB's scale is already schema-declared.
*(src: https://arxiv.org/pdf/2502.06112)*

## **DONE (2026-10-08) — `pco` reached 1.0 (1.0.3, 2026-08-01); `pco =1.0.4` is pinned as a

bench-only dev-dependency of `weft-physical-type`, not a runtime dependency of any core
crate.** The library links none of it, so the out-of-core boundary holds until an adopt
decision (the plan was to pin it in `weft-bench`; the arm went beside the other codec arms
instead, see below). The crate's docs call for the `bmi1`/`bmi2`/`avx2` target features
("improves ... decompression speed substantially"); the measurement below was built without
them, so its pco decode times are a floor and must not decide adopt-or-drop on speed.
*(src: https://lib.rs/crates/pco)*

## **Measured (2026-10-08), value column, per column as asked.**

`pco =1.0.4` is pinned as

a bench-only dev-dependency of `weft-physical-type`, beside `alp`/`fastlanes` in
`benches/alp_vs_f64_codecs.rs`. The library links none of them; the arm sits with the other
codec arms rather than in `weft-bench`. Bits/value at default level 8: **btc_close: pco on exact
mantissas 11.09**, pco on floats 11.64, vs dfor 13.58, ALP 15.35, realized `scaled_for` 33.74,
opt-in delta cascade 32.55. **sensor_2dp: pco 2.81** (= log₂7, the entropy of its ±3-cent
steps), pco floats 3.43, vs delta cascade **3.000**, realized 5.51. **real_doubles: pco 45.90**
vs Chimp 49.50, ALP-RD 56.16. Decode times were taken at load avg 48–63 and are indicative
only (pco 4.6–10 ms per 1 Mi values vs realized FOR ~1.9 ms). Built without BMI/AVX2, so pco's
times are a floor. Reading: pco is the **ratio ceiling** on every corpus. On a random walk the
shipped opt-in cascade is already within 0.19 bits of it. On BTC, dfor plus in-block deltas
reaches only 13.06 bits (Python estimate over the same window). The remaining ~2 bits are
pco's entropy coding of heavy-tailed deltas, which bit-packing at the block's max width cannot
reach. That is a cold-tier argument (pco's page-serial decode), not a hot-path one, matching
the scope correction above.

## **DONE (2026-10-08) — timestamp half measured** (`benches/timestamp_vs_pco.rs`, 1 Mi each,

bits/value, shipped DoD selector vs pco level 8): real **btc_minutes** (rows 3M..) 0.000 vs
0.001 (the window is perfectly regular, so both are free); **ms_as_micros** (ms-precise instants
stored in µs) **20.000 vs 9.001**; **jittered_micros** 20.000 vs 19.001. pco decode 0.88 /
1.63 / 1.28 ms.

## **DONE (2026-10-08, advisory) — factor a timestamp column's common multiple (pco's `IntMult`) before DoD

packing.** Shipped as `DeltaOfDeltaColumn::common_multiple()` (the GCD of the first delta and
every second difference) and `common_multiple_estimated_bytes()` (the shipped selector's best
over the reduced column, plus a varint for g). Measured on ms_as_micros at **20.000 → 10.000
bits/value** (g = 1000; pco 9.001). On real btc_minutes it finds g = 60 at no gain (already
0 bits); on jittered µs it finds none. Surfaced as `storage.advisory_common_multiple_timestamp_bytes`
(and the delta-FOR one as `advisory_delta_for_timestamp_bytes`, schema v18). On a real
`weft-bench --input` run over 20k ms-precise instants: 50,007 → 25,011 timestamp bytes.

## **NEXT — realize the common-multiple factor as a timestamp codec flag (owner sign-off:

  headline bytes/point change).** Original rationale: A µs column holding ms-precise instants costs WeftDB **20 bits/value against pco's
9**, because every second difference carries three wasted decimal digits. This is the
timestamp twin of the decimal-exponent FOR. Per block (or column), compute the GCD of the
deltas, store it once, and pack `dod / gcd`. Expect ~10 bits on that corpus. It stays exact,
and the declared `TimeUnit` is unchanged.

## **DONE (2026-10-08, advisory) — first-order delta + FOR as a timestamp candidate beside DoD.**

`DeltaOfDeltaColumn::delta_for_estimated_bytes()`, measured at jittered_micros **20.000 →
19.424** bits/value (pco 19.001), ms_as_micros 19.420 (the common-multiple factor's 10.000 is
far better there), and btc_minutes 0.250 (it loses on a constant stride, as expected). A
modest ~3% on random-interval streams only. Original rationale: On fully jittered
intervals the second difference doubles the variance, costing ~1 bit/value (20 vs pco's 19).
Add a "delta-FOR" arm to `best_estimated_bytes`'s race; it wins only on random-interval
streams, and that is also exactly where DoD's premise (a near-constant stride) fails.

## **Scaled-int value bit-pack codec — realized on disk.**

The `.weftseg` value block

now carries a self-describing codec selector (`VAL_CODEC_VARINT`/`VAL_CODEC_BITPACK`);
a `ScaledI64` column whose mantissas fixed-width bit-pack below the per-value varint
stores bit-packed (chosen via `ColumnEncoding::best_value_codec`), and the realized
figure flows through `Segment::serialized_value_bytes()` +
`StorageEstimate.realized_value_bytes`/`value_codec` (schema v8). Measured on a 480-pt
exact 2-decimal ramp: bit-pack 901 B vs the prior varint 1440 B (37.4% smaller, 76.5%
below the naive `len*8` estimate). Runtime-verified: a sealed `scaled_i64` aspect reads
`bytes_per_point=2.13` through `/storage/{aspect}/stats`. *(validated by ALP's
decimal→integer PseudoDecimal path, SIGMOD'24 — https://dl.acm.org/doi/10.1145/3626717)*

## **Value-column realized-bytes accuracy — headline FLIPPED (owner sign-off,

bench schema v10).** `Segment::value_bytes()`/`total_bytes()`/`bytes_per_point()`,
`Page::total_bytes()`, and `StorageEstimate.bytes_per_point`/`total_bytes_per_point`
(and the bench HTML `val B/pt`) now report the **realized** figure — the codec each
column actually writes. The naive fixed-width figure is retained as the comparison
baseline (`Segment::logical_value_bytes()` / `StorageEstimate.estimated_value_bytes`),
so `realized / logical` reads as the value column's compression ratio. Pre-v10
bytes/point artifacts are NOT comparable (the old headline reported the uncompressed
size and oversold storage cost); the now-redundant `advisory_for_value_bytes` field
was dropped in the same bump.

## **Per-block adaptive bit-pack for the VALUE column — realized on disk.**

The

`.weftseg` value block carries `VAL_CODEC_BLOCKED` (block-size uvarint + length-prefixed
`blocked_bitpack_encode` stream), reusing the generic blocked primitives over the
mantissa stream. `ColumnEncoding::blocked_value_bytes` folds into
`best_serialized_bytes`/`best_value_codec` (`scaled_blocked`), chosen only when strictly
smallest so regular/uniform columns are byte-for-byte unchanged; a non-`ScaledI64`
payload is rejected (`value_codec_blocked_type`). Wins the mixed-magnitude regime (a
quiet region + a wide burst straddling zero, where a global width over-pays and a FOR
reference is wasted). Round-trip- + framed-segment-verified. *(src: "Dynamic Bit Packing",
Sensors 2023 — https://www.mdpi.com/1424-8220/23/20/8575)*

## **f64 value-column codec — Gorilla + Chimp XOR codecs + best-of selector (advisory).**

The `F64` value column had no compression (raw 8 B/value IEEE pattern). Shipped in
`weft-physical-type::floatcodec`: `xor_f64_*` (Gorilla — XOR vs the immediate predecessor,
store only the meaningful bits between the leading/trailing zeros) and `chimp_f64_*`
(single-predecessor Chimp — 2-bit flags, a 3-bit leading-zero class, trailing-zero trim),
both bit-exact for every f64 (NaN/±inf/subnormal/signed-zero, XORs `to_bits`); a
`best_f64_codec` selector over {raw, gorilla, chimp} (never worse than raw); the
`ColumnEncoding` advisory methods (`gorilla_f64_bytes`/`best_f64_bytes`/`best_f64_codec`);
and the `weft-bench` `StorageEstimate.advisory_best_f64_bytes`/`advisory_best_f64_codec`
(schema v12) surfacing the best f64 saving on a lossy-tolerance run (measured Gorilla
~45% below raw on a stable-exponent column near 1000). **Advisory only** — no f64 codec is
on disk yet. Honest finding: single-predecessor Chimp is *not* a universal win over
Gorilla (Gorilla's reuse-window path re-uses a repeated long-trailing window that Chimp's
trim path must re-header, and Chimp's leading-class rounding writes extra bits) — the
decisive win needs the 128-value window below. *(src: Gorilla, VLDB'15
https://www.vldb.org/pvldb/vol8/p1816-teller.pdf · Chimp, VLDB'22
https://www.vldb.org/pvldb/vol15/p3058-liakos.pdf)*

## **Faithful Chimp128 (128-value reference window) — shipped.**

`floatcodec::chimp128_f64_encode`/`decode`/`bytes`: a 128-value ring + a lookup table keyed
on the low 14 bits → the most-recent ring index with that pattern (reference found in O(1),
the trailing-zero threshold guaranteed by the hash), with the 2-bit-flag/4-way serialization
faithful (flag packed into the payload's high bits). Bit-exact for every f64; folded into
`best_f64_codec` (chosen when strictly smallest) so it flows to the bench
`advisory_best_f64_codec`. Measured 82.8% below Gorilla on a period-4 revisiting signal (the
regime the single-predecessor codecs cannot reach). *(src: Chimp128 —
https://www.vldb.org/pvldb/vol15/p3058-liakos.pdf · duckdb notes —
https://github.com/duckdb/duckdb/pull/4878)*

## **Elf (erasing-based) f64 codec — shipped (conservative advisory variant).**

`floatcodec::elf_f64_encode`/`decode`/`bytes`: a column-shared decimal grid (`alpha` = max
fractional digits, one header byte) + a greedy erase that keeps the most-erased low-bit
pattern whose `round(·,alpha)` restore reproduces the exact value — verified-lossless by
construction — then the Chimp128 backend. Measured 6.7% below Chimp128 on distinct 2-decimal
drift. Residue: the **faithful bit-level closed-form erase**, which upstream reports at **12%
below Chimp128 / 47% below Chimp** on time-series (my column-grid variant leaves bits on the
table). *(src: Elf, VLDB'23 — https://www.vldb.org/pvldb/vol16/p1763-li.pdf · adaptive Elf,
arXiv'23 — https://arxiv.org/pdf/2308.11915)*

## **f64-codec adopt: target ALP, not Chimp128/Elf — the state of the art.**

Upstream

evidence (this run's research): **ALP replaced Chimp128 + Patas in DuckDB**, decodes ~2.6
doubles/CPU-cycle, and beats *both* Chimp128 and Elf on compression ratio **and** speed on
almost every dataset (Elf/Chimp128 only win where repeated values dominate and precision is
highly variable — ALP's `ALPrd` sub-scheme is the fallback there). So the f64 adopt-or-drop
should benchmark **ALP** (with the `ALPrd` outlier path) against the shipped
Gorilla/Chimp/Chimp128 and the advisory Elf, pick ALP unless a repeated-heavy corpus says
otherwise, then realize it as a `VAL_CODEC_*` and flip `best_f64_codec`/the bench headline —
**owner sign-off, as with FOR** (it is a headline change). Judge by bytes/point AND decode
throughput (FCBench / VLDB'25 methodology). *(src: ALP, SIGMOD'24 —
https://dl.acm.org/doi/10.1145/3626717 · DuckDB ALP — https://duckdb.org/library/alp/ ·
comprehensive eval, VLDB'25 — https://www.vldb.org/pvldb/vol18/p4396-hishida.pdf · FCBench —
https://arxiv.org/pdf/2312.10301)*

## **ALP now has a FROZEN wire layout to mirror — do not invent a container (research

2026-09-23).** ALP is a standardized Apache Parquet encoding (`ALP = 10`) in parquet-format
2.14.0: a 7-byte header (compression mode, integer encoding, log vector size, total element
count), an offset array of `num_vectors` uint32 byte positions, then vectors of up to
`vector_size` elements (**default 1024**). Exceptions are `uint16` positions + exact IEEE-754
bit patterns, and each exception slot is replaced by a placeholder *before* FOR encoding so the
integer stream stays branch-free and FOR/bit-packable. Three consequences for `VAL_CODEC_ALP`:
(i) the 1024 default vector size is **identical to WeftDB's `TRANSPOSE_TILE`**, so one tile = one
ALP vector and tile-level random access survives ALP adoption unchanged; (ii) adopt the
placeholder-before-FOR trick rather than a bespoke exception scheme; (iii) **`ALP-RD` is NOT in
the Parquet spec** (mode 0 = ALP, other modes reserved), so if WeftDB uses ALPrd for the
high-precision fallback, declare it a WeftDB-private mode id and keep mode 0 byte-compatible.
*(src: https://parquet.apache.org/docs/file-format/data-pages/alpencoding/)*

## **DONE (2026-10-08) — Use the `alp` crate to get the ALP adopt benchmarked, rather than hand-rolling it first.**

spiraldb's `alp` 0.0.4 (2026-09-08, Apache-2.0) implements both classic ALP and ALP-RD with
`ENCODE_CHUNK_SIZE = 1024` — matching WeftDB's tile granularity — and an encode/decode API whose
`decode_single`/`decode_slice_inplace` map onto `read_value_at`/`read_value_range`. It is a pure
codec crate, so it does not cross the control-plane/hot-path boundary. Two cautions to carry:
`0.0.x` means no semver promise (pin exactly or vendor), and `alp` pins `fastlanes ^0.6` while
that crate is at 0.7.2, so a combined dependency pulls two versions unless pinned.
*(src: https://docs.rs/alp/latest/alp/)*

## Shipped `weft-physical-type/benches/alp_vs_f64_codecs.rs` (`alp =0.0.4` + `fastlanes =0.7.2`,

bench-only). The ALP arm uses a Parquet-style container: per-1024 vector exponents, FOR, a
`fastlanes` pack, and `u16` + f64 exceptions. Every arm is asserted bit-exact before timing.
Bits/value and 1 Mi decode (loaded box, load avg ~27):
**real BTC closes** (rows 3M..+1Mi): ALP **15.35 b, 0.57 ms** · Chimp128 23.34 b, 17.4 ms ·
Elf 38.84 b, 28.1 ms · Chimp 42.09 b · Gorilla 51.74 b · **realized `scaled_for` (scale 8)
33.74 b, 70.8 ms**. **sensor_2dp**: ALP 7.22 b, 0.73 ms · realized `scaled_for` **5.51 b**,
11.3 ms · Chimp128 11.58 b, 7.85 ms. **real_doubles**: ALP 82.2 b (33.8% exceptions) ·
ALP-RD 56.2 b · Chimp **49.5 b**. Against the shipped f64 codecs, ALP clears the acceptance bar
below by a wide margin on both decimal-shaped corpora (−34% / −38% bytes vs Chimp128, 10–30×
decode). It loses badly on full-mantissa doubles, where ALP-RD or Chimp must be the fallback.

## **ALP adopt as `VAL_CODEC_ALP` — owner sign-off (headline change).**

The benchmark says

adopt for decimal-shaped f64 columns, with a per-column fallback to Chimp/ALP-RD when the
exception rate is high (ALP's own sampling picks this). Mirror the Parquet layout per the
frozen-wire-layout item above.

## **DONE (2026-10-08, advisory) — per-vector scale is the lever the realized exact path is missing.**

On the BTC

window, `recommend_encoding` must declare **scale 8 for the whole column** because a few
closes carry 8 decimals, which inflates every FOR residual to ~33 bits. ALP picks an exponent
**per 1024 vector** and pushes the 0.01% odd values to exceptions, reaching 15.35 bits. A
`ScaledI64` codec with a per-tile scale and an exception list would keep the `BigDecimal`
logical type exact, with no float on the path, and should approach ALP's figure. Measure it on
the same bench before deciding between that and ALP.
Shipped as the **decimal-exponent FOR** (`timestamp::dfor_bitpack_{bytes,encode,decode,decode_range}`
+ `ColumnEncoding::dfor_value_bytes`). Each 64-value block factors out its common power of ten
(the fewest trailing decimal zeros of any mantissa in it, stored in one header byte), then
FOR-packs. It is exact integer arithmetic, so no float and no exception list are needed. Only 1
of 16,384 BTC blocks had to keep scale 8. Measured (`alp_vs_f64_codecs`): **btc_close 13.58 b**
vs realized `scaled_for` 33.74 b (**2.48× smaller**) vs ALP 15.35 b; decode 2.10 ms vs
1.78 ms (FOR) / 0.67 ms (ALP). **sensor_2dp 5.64 b vs 5.51 b**: it loses by the header byte
when nothing factors out, so a selector must pick it only when strictly smallest.

## **DECIDED (2026-10-08) — per-block wins on BTC.**

A Python sizing over the same 1 Mi window

gives a per-value minimal exponent (Pseudodecimal-style) **25.20 bits/value**: digits FOR-packed
at 20.28, plus an RLE'd exponent column at 4.92 across 322,504 runs. That is against **13.58**
for the per-block exponent. A value's *minimal* exponent depends on its trailing digits
(3558.90 → k=7, 3559.00 → k=8; the k histogram is 6:832k, 7:102k, 8:71k, 9:35k), so per-value
exponents scatter and jumble the digit magnitudes FOR then pays for. Keep per-block for
`VAL_CODEC_DFOR`. The original item:

## **Prior art for the decimal-exponent FOR: BtrBlocks' Pseudodecimal Encoding (SIGMOD'23)

chooses the exponent PER VALUE, not per block (research 2026-10-08).** It splits a double into
two integer columns (signed significant digits and an exponent) plus an exception column,
then cascades each into integer schemes such as RLE/FOR/bit-packing. Its selection rule:
disable when >50% of values are exceptions, and skip columns with <10% unique values. Before
freezing `VAL_CODEC_DFOR`, size a per-value exponent column (RLE'd) against the per-block
header byte on `alp_vs_f64_codecs`. On BTC only 1 of 16,384 blocks needed k=0, so per-block
should win there, but a column mixing precisions value by value is where per-value would.
*(src: https://www.cs.cit.tum.de/fileadmin/w00cfj/dis/papers/btrblocks.pdf)*

## **NEXT — realize the decimal-exponent FOR as `VAL_CODEC_DFOR` (owner sign-off: headline

bytes/point change).** Add it to `best_value_codec`'s strict-smallest race and wire a
writer/reader selector byte plus the range and gather paths, mirroring `VAL_CODEC_FOR`. Then re-run
`ingest_path_profile_legacy_vs_columnar` on the real corpus: the 4.22 B/point realized headline
should fall, since the value column is most of it. Expected value column: ~13.6 b vs ~33.7 b.

## **DONE (2026-10-08)** surfaced as `storage.advisory_dfor_value_bytes` in the `weft-bench`

`StorageEstimate` (schema v17; `Some` only when it strictly beats the realized codec).

## **DONE (2026-10-08) — the scalar FOR/blocked decode is the read-path bottleneck at wide widths.**

`for_bitpack_decode` takes **70.8 ms per 1 Mi values at ~33 bits** (11.3 ms at ~5.5 bits). It
loops per bit per value, so cost scales with width. The `fastlanes` unpack inside the ALP arm
does the same FOR + unpack work in under 1 ms. Port the FOR/blocked unpack to a word-wise
(or `fastlanes`-style) kernel and re-run `alp_vs_f64_codecs` + `bitunpack`.
Fixed with a shared word-wise `read_bits`/`write_bits` (one unaligned LE load + shift/mask)
behind every LSB-first codec (global/blocked/FOR bit-pack, the FOR range + gather, Gorilla).
A/B: `bitunpack` scalar_global **16.53→1.09 ms**, scalar_blocked **17.19→1.83 ms**;
realized `scaled_for` on BTC **78.1→1.66 ms** (47×), sensor_2dp 11.9→2.55 ms;
`transposed_read` linear full decode **15.5→6.87 ms**. ALP's 0.57 ms on BTC is now a 2.9×
decode gap rather than a 124× one; its byte win (15.35 vs 33.74 b) is unchanged.

## **Re-decide the transposed layout now that the linear baseline is honest — RECOMMEND

RETIRING `VAL_CODEC_TRANSPOSED` to read-only (owner decision).** Tried 2026-10-08: replacing
the table spread with a branch-free 8×8 bit-matrix transpose (Hacker's Delight `transpose8`) made
the tile decode **11–25% slower** (w3/w10/w20: 0.895/1.78/2.87 ms vs 0.78/1.50/2.32 ms on the
`fastlanes` yardstick), so it was reverted. The bit-plane layout needs a transpose that
FastLanes' own layout avoids by design. No remaining kernel idea is credible for the ≥3× it
would need to beat the linear unpack (1.09 ms), and end to end it is byte-neutral and
slightly slower. Keep the reader so existing frames still decode; stop offering
`WEFT_SEGMENT_TRANSPOSED_MAX_OVERHEAD` for new seals. Original item: After the
word-wise read the linear unpack beats the transposed one (1.09 vs 1.95 ms per 1 Mi values), and
end-to-end full decode is 6.87 (linear) vs 7.81 ms (transposed). The old "~5.7× kernel win"
was measured against a per-bit decoder. Either close the yardstick residue
above (≥3× faster tile decode) or retire `VAL_CODEC_TRANSPOSED` to read-only.

## **DONE (2026-10-08) — The f64 codecs (Gorilla/Chimp/Chimp128/Elf) still read with their own per-bit loops**

in `floatcodec.rs` (17–55 ms per 1 Mi values in `alp_vs_f64_codecs`). Port them to the same
word-wise read before any adopt decision compares them with ALP on decode speed.
`BitReader::get_bits` is now one big-endian load + shift per field, and `BitWriter::put_bits`
writes byte-sized chunks. A/B on BTC: Gorilla **36.4→3.41 ms**, Chimp 35.7→6.77,
Chimp128 **19.8→4.45**, Elf 29.4→5.58 ms. Range across all three corpora: 2.7–10.9×. ALP
(0.57 ms, 15.35 b) is still the fastest and smallest on BTC, but the decode gap to Chimp128
is now 7.8×, not 30×.

## **DONE (2026-10-08) — the ~2.4 ms "frame parse" floor under every read was the CRC.**

`weftseg::crc32` was a byte-at-a-time table CRC over the whole frame body, run by every read
(~0.5 GB/s). Now slicing-by-16 (same IEEE polynomial, identical checksums, no dependency).
A/B: 1M-row point read **2.50→0.81 ms**, 1000-row range 2.32→0.63 ms; `pointread` streaming point
185→56 µs, paged 175→33 µs, 64-instant batch 189→67 µs. README read table re-measured.

## **Next read-path floor: every point read still CRCs the whole frame** (real-data evidence

2026-10-08: 1M BTC closes, 128-instant batch p50 2.43 ms single-block vs 0.90 ms paged). Now ~0.8 ms on a
1M-row frame, against the ~10 GB/s a CLMUL CRC reaches. Two options. Add a per-block
(or per-page) checksum so a point read verifies only the bytes it decodes; this is a format
bump, but the paged frame already has the page structure. Or adopt a hardware CRC (`crc32fast`,
a pure codec crate). The per-block checksum is the one that changes the asymptotics.
*(research 2026-10-08)* crc32fast's own benchmark puts its 16-bytes-per-iteration baseline,
the same shape as WeftDB's new slicing-by-16, at **1,499 MB/s**, against **7,314 MB/s** for the
PCLMULQDQ path (~4.9×). The hardware CRC therefore caps the remaining whole-frame cost at about
5× less, while a per-block checksum removes it from point reads altogether. Dual MIT/Apache-2.0,
so it is admissible if chosen. *(src: https://github.com/srijs/rust-crc32fast)*

## **Set the ALP acceptance bar from upstream's own ablation, and be willing to DECLINE.**

FastLanes' per-encoding ablation (VLDB'25, Table 7, PUBLIC_BI) reports ALP at **+4.36%
compression ratio for −7.28% decompression speed**, with ALP_RD +0.57%/−2.30% and Patch
+2.51%/−7.11% — i.e. on a mixed corpus ALP is a modest ratio win bought with decode speed, and
the exception machinery is what costs. So (i) the adopt-or-drop benchmark must report decode
throughput beside bytes/point and reject ALP if it regresses the tile decode rate by more than
the ratio gain (the same gating FOR and Gorilla got); and (ii) WeftDB's corpus is a pure f64
measurement column, not 2,289 mixed columns, so the expected win should be *far* above 4.36% —
if it is not, that is evidence the shipped scaled-int/FOR/blocked path already serves the value
column and **declining ALP is a legitimate, publishable outcome**.
*(src: https://www.vldb.org/pvldb/vol18/p4629-afroozeh.pdf)*

## **GPU-decode ALP — retarget to G-ALP (DaMoN'25), and decide the exception layout BEFORE the

CPU ALP block is frozen on disk.** G-ALP (CWI, open source at `cwida/FastLanesGpu-Damon2025`)
reports **324.7 GB/s** decompress-into-RAM for doubles on a V100 (and 463.5 GB/s for floats on
an RTX 4070), against the previously-cited arXiv 2511.04140 framework's 12.32 GB/s — over an
order of magnitude apart, so the port target should change (caveat, recorded honestly: the two
are not strictly like-for-like, since G-ALP measures decode into device memory on resident data).
Its two design rules bear directly on WeftDB's frame layout: exception patching must be **fully
data-parallel** (a branchy per-thread exception scan "will take longer than the actual decoding
of the value"), which needs a **lane-partitioned** exception section costing a fixed 0.5 bits per
value — and that is *not* bolt-on-able to a Parquet-style flat position array without a
re-encode. So store the exception section in the G-ALP lane-partitioned form behind a descriptor
bit, and expose unpack at **one value per thread** (the paper reports dropping from 32 to 1
value/thread "was crucial for achieving high occupancy"). *(src:
https://azimafroozeh.org/assets/papers/g-alp.pdf · https://arxiv.org/abs/2511.04140)*

## **Fuse decompression INTO the GPU interpolation kernel — with a number behind the wedge.**

G-ALP measures GPU *filter* throughput **above 100% of device RAM bandwidth** (~215% float /
~100% double on an RTX 4070; ~120%/~172% on a V100), because loading data in compressed form
costs less than the bandwidth it saves, and because a fused kernel avoids "a round-trip of
non-compressed data to and from RAM". This turns WeftDB's "decompress-on-device, no host
round-trip" assertion into a concrete architectural rule: do **not** add a separate
decompress-then-interpolate kernel pair. Add a `weft-bench` metric reporting GPU interpolation
throughput as a **percentage of device RAM bandwidth** — the figure that makes the fused design's
win visible and maps onto the $/billion-interpolated-points north star.
*(src: https://azimafroozeh.org/assets/papers/g-alp.pdf)*

## **FastLanes "Unified Transposed Layout" for the bit-pack codecs (decode-speed

slice): shipped (prototype).** *(Correction 2026-10-08: what shipped is a bit-sliced,
bit-plane-major layout, not the FastLanes layout; it is now behind the `bitsliced-codec`
feature — see the codec patent/licence gate above.)* `TRANSPOSE_TILE`/`transpose_bitpack_bytes`/`_encode`/`_decode`
— a per-tile bit-plane-major layout. A plane byte holds the same bit of eight lanes, so the
shipped decoder rebuilds eight lanes per byte read with a fixed, branch-free table spread
(`SPREAD`) written straight into the output, and each tile's one-byte width header drops a
small-magnitude stream's empty high bit-planes. It replaced the first decoder, which read `u64`
words and walked only the *set* bits (`w &= w-1`), after the `fastlanes` yardstick found that
one 3.7–15× slower than the crate at widths 3/10/20; the rewrite took it from 1.32→0.78 /
5.27→1.50 / 7.60→2.32 ms per 1 Mi values (1.7× / 3.5× / 3.3×)
([`benches/fastlanes_yardstick.rs`](https://github.com/basic-automation/weftdb/blob/main/weft-physical-type/benches/fastlanes_yardstick.rs))). Byte
footprint is a permutation of the linear per-block layout (identical on aligned tiles). The
**~5.7× decode speedup** once quoted here (~238 vs ~41.6 Melem/s, 1 Mi small-magnitude stream)
belongs to that old set-bit decoder, measured against a linear decoder that read one bit at a
time, and it did not survive. Once the linear unpack moved to word-wise reads it unpacks faster
than the table spread (1.09 vs 1.95 ms per 1 Mi values,
[`benches/bitunpack.rs`](https://github.com/basic-automation/weftdb/blob/main/weft-physical-type/benches/bitunpack.rs))), and realized on disk as the
opt-in `VAL_CODEC_TRANSPOSED` the layout is byte-neutral (+0.08%) and reads no faster end to end
([`benches/transposed_read.rs`](https://github.com/basic-automation/weftdb/blob/main/weft-physical-type/benches/transposed_read.rs))), as the
caveat that decode is often bandwidth-bound predicted (https://arxiv.org/pdf/2606.22423). See
the retire-to-read-only item above. *(src: FastLanes Compression Layout, VLDB'23 —
https://www.vldb.org/pvldb/vol16/p2132-afroozeh.pdf)*

## **Cascading (recursive) codec composition — delta→best-packer chain: advisory + on disk.**

WeftDB's other value codecs are single-level (one of varint/bit-pack/blocked/FOR); this is the
first *recursive* codec. Shipped as the advisory `ColumnEncoding::delta_cascade_bytes`/
`delta_cascade_plan` (delta-transform the mantissas, then best-of {varint, bit-pack, blocked,
FOR, RLE} over the differences — a monotone-trend column that defeats every single-level codec
drops 97.4%, the trend collapsing to a constant RLE run) **and** the on-disk codec-chain
descriptor `VAL_CODEC_DELTA_CASCADE` in the `.weftseg` value block (anchor + inner-codec
descriptor + inner-coded deltas), written by `write_value_column_cascading` and read by the
ordinary `read_value_column`. **Opt-in** (the cascade beats FOR on FOR's own fixtures → a broad
realized-bytes change; default-adoption is owner-gated). *(src: Vortex cascading compression —
https://vortex.dev/ · cascading-with-BtrBlocks —
https://spiraldb.com/post/cascading-compression-with-btrblocks · FastLanes codec chains,
VLDB'23 — https://www.vldb.org/pvldb/vol16/p2132-afroozeh.pdf)*

## **Evaluate Vortex as a columnar interchange + benchmark reference (Phase 1/4):**

Vortex

(Rust, Arrow-compatible, BtrBlocks-based cascading compression, ALP/FastLanes/FSST
encodings) reports ~100–200× faster random access and 2–10× faster scans than Parquet+zstd
at similar ratio, with a GPU-decompression roadmap — directly on WeftDB's random-access +
GPU-decode + interpolation-native wedge. Assess (a) `vortex-*` crates as an *interchange*
target beside `weft-arrow`/Parquet (out-of-core, per the vendor-neutral boundary), and (b)
Vortex as a `weft-bench` external-format baseline for the storage/compressed-query workloads.
*(src: Vortex at Spice.ai, 2025 —
https://spice.ai/blog/vortex-at-spice-ai-the-columnar-format-for-data-intensive-workloads
· https://vortex.dev/)*

## **6.2 Model-based compression** (leverages WeftDB's spline DNA, NeaTS-like)

piecewise

linear / spline / polynomial / nonlinear approximation with bounded residuals;
lossless-residual option; lossy with max-error guarantee; extrema-preserving mode

## **6.3 Late/compressed-domain execution**

min/max/count from metadata; predicate

eval before decompression; interpolate directly from model segments; event
detection over compressed summaries; CPU filter before GPU transfer

## **6.4 Quality benchmarks**

bytes/point, compress/decompress throughput, random-

access + range latency, interpolation-after-compression, RMSE/MAE/max-error/bias,
extrema preservation, event-detection stability, forecasting impact
