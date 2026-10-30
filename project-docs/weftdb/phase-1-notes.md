---
title: "Phase 1 — Build Weft-Bench — notes"
summary: "The prose, findings and finished-work write-ups that sit behind the roadmap checklist for this section."
order: 12
group: Roadmap notes
---

# Phase 1 — Build Weft-Bench — notes

*The checklist for this section is in the [roadmap](https://github.com/basic-automation/weftdb/blob/main/ROADMAP.md). What follows is the writing that used to sit between its items.*

A `weft-bench` workspace that is both an internal engineering suite and a
public/customer-runnable diagnostic. Model it on SEER/TSM-Bench (result storage,
dashboards, repeatable config, system adapters, workload profiles) — not ad-hoc
scripts. Implement **TSBS compatibility** (via InfluxDB Line Protocol) for baseline
comparisons, but make Weft-Bench the primary suite. Target layout: `adapters/`
(weft, clickhouse, influxdb3, questdb, timescaledb, iotdb, duckdb, kdb_optional),
`workloads/` (ingest, online_ingest_query, range_fetch, point_lookup, downsample,
upsample_interpolate *(flagship)*, gap_fill, compression, compressed_query,
pattern_pipeline), `datasets/`, `runners/` (local, docker_compose, cloud),
`reports/` (json, parquet, html, grafana), `dashboards/`, `docs/`.

## First workload profile

`interpolation-heavy-irregular` (seeded, reproducible generator)

## Portable baselines

linear (fair-protocol class C) + forward-fill (class B)

## Latency stats

p50/p95/p99 + min/max/mean/stddev + bootstrap CIs

## CLI runner

`.lp`/TSBS input or `--synthetic` (seed/points/missingness/jitter/noise/shape knobs); non-zero exit on correctness failure

## External-engine adapters

DuckDB first, then ClickHouse, InfluxDB 3, QuestDB, TimescaleDB (+ IoTDB)

## **DONE (2026-10-29) — DuckDB, the first external engine** (`weft-xbench`)

A separate workspace, so DuckDB's C++ build stays out of the main one, with its lock seeded from the workspace's and checked in CI. It runs six arms: WeftDB in memory, stored (exact-decimal and `f64`, in 1,024-row segments and in one bulk segment), and DuckDB `DOUBLE` and `DECIMAL`. The phases are load with on-disk bytes, linear interpolation, and bucketed downsampling, each gated against the in-memory reference. Every run renders Markdown and HTML with a generated honesty section, where a win or loss counts only when the p50 bootstrap intervals are disjoint. It also runs nightly at `tiny` scale on CI. The stored WeftDB arm (`weftdb-stored`, `--stored` in `weft-bench`) shipped first.

## **DONE (2026-10-30) — first cross-engine report**

WeftDB against DuckDB on the reference SSD, over MCAR, block missingness and the UCI series at three scales; all 99 gates passed. DuckDB wins every load and the stored downsamples, and is 3–4× faster on exact-decimal grids at `medium`. WeftDB wins interpolation at `tiny` and `small` scale, and its store is smaller (about half of DuckDB's on the UCI series). A second full run showed that single-run intervals understate run-to-run variation. See the [cross-engine report](/projects/weftdb/docs/cross-engine-report).

## **Storage/read/aggregation workloads shipped (2026-07-14)**

`point_lookup` (streaming point read, single/paged/batch, regular closed-form vs irregular), `range_fetch` (windowed range read), `compression` (realized bytes/point + value-column compression ratio + decode throughput), and `downsample` (the full reduction set: min/max/avg/sum/first/last + **p50/p90/p95/p99 percentiles** + **TWA**). Each is a parallel `run_*` runner over the `.weftseg`/`weft-reduce` hot path with a correctness gate, p50/p95/p99 latency, and a `--point-lookup`/`--range-fetch`/`--compression`/`--downsample` CLI mode; storage workloads take a `rows_per_page` paged-segment path. OHLC is open/high/low/close = first/max/min/last (already covered by the shipped reductions).

## **DONE (2026-10-09) — `gap_fill` workload** (`--gap-fill`)

TSM-Bench Q5's shape (`SAMPLE BY … FILL(LINEAR)`) over a seeded series with outages, timing reduce + `weft_reduce::fill` (new: `Fill::{Null, Previous, Linear, Value}`, dense grid, `count == 0` marks a synthesized bucket) and scoring the filled buckets against the clean signal. One day at 1 s → minutes: linear 4.70 ms, RMSE 0.87; prev RMSE 6.36.

## **DONE (2026-10-29) — the nightly benchmark gate runs**

A typo in `bench-regression.yml` (`$WORKLOAD_NAME__weftdb`, read by the shell as one undefined variable) meant the gate had never succeeded. Once it was fixed, the first green run uploaded the baseline it compares against.

## **NEXT — `?fill=` on the downsample endpoints** (`POST /api/v1/downsample`, `GET …/storage/{aspect}/downsample` and their columnar siblings), with a …

bounded grid (`FillError::TooManyBuckets` → 400) and the `count == 0` provenance carried to JSON/CSV/Arrow/Parquet — Lanes: the compute handlers are L-COMPUTE and the stored-range handler L-STORAGE-READ ([1.0 plan §2](/projects/weftdb/docs/release-plan#2-operating-rules-for-the-whole-release)), so coordinate before landing.

## **NEXT — arbitrary bucket widths** (`5s`, `15m`)

`Resolution` only has unit steps, so Q5's literal `SAMPLE BY 5s` cannot be expressed. A width multiplier over `bucket_index` is the smallest change; it touches every reducing surface and the `.weftpart` re-bucket rules (`grids_nest`).

## **DONE (2026-10-09) — gap fill on a real corpus** (`--gf-csv`)

the same seeded outages cut from a real series, scored against the real values removed (the series' own gaps are filled, not scored). 1M real BTC closes, hourly, 3,168 hours cut: linear MAE $49.27 (0.67% of the $7,336 mean), prev $76.45.

## **MEASURED (2026-10-09) — a spline fill (`Fill::Spline`, `--gf-fill cubic|quadratic`) does NOT beat linear on real prices.**

Same outages: generated smooth signal, cubic RMSE 0.115 vs linear 0.865 (7.5× better); real BTC hourly MAE $55.34 cubic / $61.32 quadratic vs $49.27 linear, minute buckets $8.37 vs $6.79, at ~14% more time. Shipped as an opt-in fill, default stays linear; README states where it loses.

## **NEXT — a real smooth-signal corpus for the spline-fill claim.**

The only real corpus is a price series, where linear wins; the generated sinusoid is where the spline wins. A real physical-sensor series (temperature, power, vibration) is needed before any "spline fill is more accurate" claim — the honest test of the interpolation wedge on gap fill.

## Remaining workloads

bulk-ingest growth curves (1M→10M→100M→1B), online ingest+query, compressed query, analytics pipeline

## **DONE (2026-10-09) — first-rep/warm separation** (`BenchResult.cold_warm`, schema v21, every workload; console + Parquet)

First-in-process, not OS-cold. Finding: the compression workload's first decode is 4.93× its warm p50, so its p95 at 10 reps is one cold rep; the others are 0.99–1.30×.

## **EXPLAINED (2026-10-09) — the compression first rep is first-touch memory, not lazy init.**

First rep minus warm p50 grows with the decode's size: 0.08–0.09 ms at 2k rows, 0.93–0.98 ms at 20k, 3.3–3.6 ms at 200k, then 2.0–2.6 ms at 1M where the warm reps pay it too (19.0–19.3 ms warm vs 21.0–21.9 first; glibc hands large blocks back to the OS, so a big decode faults every time). Nothing to fix in the codec; it is what a server's first query of a given size pays.

## **NEXT — OS-cold and post-restart runs:**

drop the page cache (`/proc/sys/vm/drop_caches`, needs root — owner-gated) or re-exec per rep for the storage workloads that read files, so "cold" means a cold disk, not a cold process.

## Fair-protocol depth (Phase 1.1)

≥10 reps for short tests, hot/post-compaction/post-restart separation, saturation curves (batch size, clients, writers, query concurrency, cardinality, dataset size, GPU output size), seeded randomized query mixes (published seeds), failure tests (restart during ingest, crash during compaction, network retry, partial/corrupt segment), independent-reproducibility packaging (versions, SHAs, images, configs, hardware, drivers, command lines, raw artifacts)

## Fair interpolation comparisons (Phase 1.2)

report three classes where possible: (A) native in-DB (Timescale gapfill, QuestDB `SAMPLE BY … FILL`, InfluxQL/SQL fill, ClickHouse ASOF/window, DuckDB window fns, IoTDB fns); (B) portable SQL baseline; (C) client-side end-to-end. Don't hide unfavorable results.

## **DONE (2026-10-08) — disk capture:**

`RunMetadata.work_disk_{kind,file_system,mount_point}` (schema v19). The disk

under the working directory, found by longest mount-point prefix through `sysinfo::Disks`.
Verified live: a run from `/mnt/deepmem` reports `hdd btrfs`, one from `/` reports `ssd btrfs`.

## **DONE (2026-10-09) — GPU and driver versions in run metadata:**

an interpolation run's

`metadata.engine` names the adapter (`gpu`, schema v16) and now its driver (`gpu_driver`, schema
v20, from splimes' `GpuInfo::driver`). Verified live: `NVIDIA GeForce RTX 4070 Ti SUPER (vulkan,
discrete; f64 shaders: yes)`, driver `NVIDIA 610.57.04`.

## **DONE (2026-10-09) — Parquet report surface:**

`--parquet` writes a flat results table (one row per result, run metadata repeated, nullable accuracy/storage) beside the JSON, through `weft-arrow`'s writer.

## Report surfaces beyond JSON/HTML/Parquet

Grafana dashboards (the Parquet table is their natural source)

## Anti-Goodhart (Phase 1.3)

publish negative results + WeftDB-losing workloads; benchmark code separate from engine code; run customer-supplied workloads; README policy line *("WeftDB benchmarks guide real engineering decisions, not synthetic wins")* — policy line + the sawtooth negative finding shipped; the publication pipeline is open
