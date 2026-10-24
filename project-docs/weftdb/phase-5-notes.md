---
title: "Phase 5 — GPU interpolation flagship — notes"
summary: "The prose, findings and finished-work write-ups that sit behind the roadmap checklist for this section."
order: 16
group: Roadmap notes
---

# Phase 5 — GPU interpolation flagship — notes

*The checklist for this section is in the [roadmap](https://github.com/basic-automation/weftdb/blob/main/ROADMAP.md). What follows is the writing that used to sit between its items.*

> **Moved (2026-10-05):** the interpolation engine is now its own crate and repository,
> [basic-automation/splimes](https://github.com/basic-automation/splimes), with its own
> [roadmap](https://github.com/basic-automation/splimes/blob/main/ROADMAP.md). Engine items
> below (5.1–5.6, GPU memory stability) are tracked there; WeftDB keeps only the
> **end-to-end** benchmark (storage read → … → API serialization), which needs the database.

Interpolation/extrapolation already works end to end (CPU/SIMD/GPU); this phase makes
the GPU path *fast end-to-end and economically justified*. GPU benchmarks must be
**end-to-end** (storage read → decode → filter → Decimal convert → transfer → queue
wait → kernel → readback → serialize); a kernel-only speedup is not commercially
credible.

**Acceptance:** publishable claim like *"on hardware X, WeftDB produces Y M interpolated
points/sec for irregular cubic interpolation including storage read, decode, GPU
transfer, kernel, readback, and API serialization, p95 = Z."*

#### Interpolation/extrapolation capability

linear/quadratic/cubic/polynomial on CPU, SIMD, and GPU (`Outputs::analyze_range`/`analyze_point`)

#### GPU infra

size-tiered LRU buffer pool (wired through the static f64/f32 paths), persistent staging buffers, async-handle scaffold (`GpuInterpolationResult<T>` + `IntoFuture`; computes synchronously today), `GpuConfig` presets + `prewarm_gpu_with_config()`/`gpu_buffer_pool_stats()` *(splimes 0.1; 1.0 replaced them with `configure_gpu(GpuConfig)`, `prewarm_gpu() -> GpuInfo`, `gpu_pool_stats()` and `calibrate()`, which `weft-server` runs at startup)*

#### **DONE (2026-10-09) — the storage half:**

`SegmentStore::interpolate_range` (new `weftdb::types::interpolate_range` module, a `mod` hook only, no `segment_store.rs` edit) and `weftdb/benches/interpolate_range.rs`. **Finding: the GPU loses end to end.** 1 Mi stored samples / 16 segments, cubic to one-second points: ~1M points from 100k knots take 45.3 ms on rayon, 67.9 ms on the GPU, 137.3 ms on one thread (~100k points: 7.7 / 10.9 / 15.5 ms), while `--gpu-memory` measured the GPU at ~152M points/s in isolation.

#### **MEASURED + DONE (2026-10-09) — where the end-to-end time goes, and the `f64` egress.**

On the 100k-knot / ~1M-point window: read+decode 4.1 ms; rayon cubic 7.7 ms with an `f64` result vs 38.0 ms with the `BigDecimal` result; GPU 17.6 vs 59.4 ms. The per-point `BigDecimal` output is ~80% of the call. `SegmentStore::interpolate_range_f64` (knots via the new `weft_reduce::decimal_to_f64`, bit-identical to `to_f64`) takes ~1M points end to end in 14.1–16.3 ms on rayon against 43.3–51.5 ms (two runs).

#### **FOUND (2026-10-11, runtime) — `POST /api/v1/downsample` rejects the documented multi-word

tokens.** The JSON body deserializes `Aggregation` through `#[serde(rename_all = "lowercase")]`
(`weft-reduce/src/lib.rs:45`), so it accepts `twalinear`, `twabucketend`, `sketchp99` and
answers `422` to the README's `twa_linear`, `twa_bucket_end` and `sketch_p99` (and, by the same
rule, presumably to the aliases `median`, `time_weighted_avg`, …, which only `from_token`
knows). The query-string surfaces (`?agg=` on the storage downsample) parse with `from_token`
and accept them. Seen on the real server: `aggregations[3]: unknown variant 'twa_linear',
expected one of … 'twalinear' …`. The fix is a deserializer that goes through `from_token`
(keeping the lowercase forms as accepted aliases so no client breaks); it belongs to
**FRE-5** (compute vocabulary, L-COMPUTE), which should pin both spellings in a contract test.

#### **FOUND (2026-10-09) — the compute endpoints widen JSON `f64` values with `BigDecimal::from_f64`** (`weft-server/src/downsample.rs:138` …

`interpolate.rs:347` and `:591`), i.e. to each float's exact binary expansion — a client's `99.92` is reduced as `99.9200000000000017053025658242404460906982421875`. That is exactly the downsample generator's old `--ds-decimals full` case, measured at **13.7×** slower hourly `avg` (197.8 vs 14.4 ms at 500k points) and **13.1×** for exact `p99` (414.2 vs 31.5 ms) against two-decimal values. Widening through the shortest round-trip decimal (`f.to_string().parse::<BigDecimal>()`, or a `serde_json` arbitrary-precision number so the client's decimal text arrives intact) would make the reductions cost what they do on real decimals and compute on the value the client wrote. L-COMPUTE lane; it changes result digits only below `f64` resolution, which the JSON response narrows away.

#### **NEXT — the compute endpoints pay the same tax:**

`POST /api/v1/interpolate` builds a `BigDecimal` per output point and then narrows it to JSON `f64` ("only the final wire value is narrowed"), so its JSON/CSV/Arrow outputs could take `run_f64` and skip ~80% of the work (raw points would then be `f64`-rounded; they already are on the JSON wire). L-COMPUTE lane.

#### **Reconcile with EVI-10A** (2026-10-19: the API now has an input cap, `interpolate_range::MAX_KNOTS`, a `pub` const the review may keep, turn into an option or drop)

the 1.0 plan's decision 18 ships stored interpolation as a library API in slice EVI-10A (W3, a new child module with a one-line `mod` hook between D-S10 and D-S11), with the HTTP route deferred past 1.0. `SegmentStore::interpolate_range` / `interpolate_range_f64` (2026-10-09) take exactly that form; the evidence track should review the API (the `margin` knob, the `f64` variant, the error vocabulary) and adopt or reshape it rather than land a second one.

#### **NEXT (post-1.0 per decision 18) — the HTTP endpoint:**

`GET …/storage/{aspect}/interpolate?start=&end=&resolution=&spline=&margin=` with JSON/CSV/Arrow/Parquet like the other storage reads and a bounded grid. **Missing today and not tracked before:** the HTTP API can interpolate only a request-supplied series, so commercial claim #1 (interpolation-on-read for large stored ranges) has no API surface. The router (L-ROUTER) and storage read handlers (L-STORAGE-READ) are lanes, so it lands through their owners.

#### **DONE (2026-10-09) — GPU memory-stability + pool-eviction benchmark** (`weft-bench --gpu-memory`, `gpu_pool` in schema v22)

on the RTX 4070 Ti SUPER the default 512 MiB pool created 2 buffer sets over 60 mixed-size calls (none after round 1, 0 evictions, idle steady at 112 MiB); a 32 MiB cap evicted 20 and re-created 19 at an unchanged per-call p50.

#### **NEXT — device memory, not just pool bytes:**

`gpu_pool_stats` counts splimes' idle buffers; a leak outside the pool (wgpu staging, driver) would not show. Sample the adapter's allocated bytes over a long soak. **Checked 2026-10-09: `nvidia-smi` cannot do it here** — a wgpu (Vulkan) process does not appear in `--query-compute-apps`, and the device total is shared with every other workload on the GPU, so it cannot attribute a leak. The route is wgpu's own allocator report (`Device::generate_allocator_report`), which splimes would have to expose (a splimes-repo ask).
