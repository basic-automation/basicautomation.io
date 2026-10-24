---
title: "Commercial thesis and positioning"
summary: "The wedge WeftDB takes, where it wins, and the claims it will and will not make."
order: 1
group: Strategy
---

# Commercial thesis and positioning

**The wrong wedge:** "WeftDB is a faster general-purpose time-series database." Too hard
to prove early against ClickHouse, InfluxDB 3, QuestDB, TimescaleDB, IoTDB, DuckDB,
and kdb+.

**The wedge to take:**

> **WeftDB is an interpolation-native, precision-aware, GPU-accelerated time-series
> engine for irregular high-value data, with public benchmarks proving superior
> performance on resampling, gap filling, compression-aware historical analysis, and
> analytical pipelines.**

**Where WeftDB wins (focus here):** irregular time-series; interpolation-on-read;
upsampling/gap filling; high-precision values; GPU spline execution;
compression-aware historical analysis; event/pattern pipelines that depend on
reconstructed signal shape.

**First commercial claims (each benchmark-backed):**
1. Fastest interpolation-on-read for large irregular ranges.
2. Best cost/performance for gap filling and upsampling.
3. Compression that preserves downstream analytical behavior.
4. Predictable p95/p99 latency under concurrent ingest + query.
5. Transparent benchmarks vs ClickHouse, InfluxDB, QuestDB, TimescaleDB, DuckDB, IoTDB.

**Do NOT claim initially:** "faster than ClickHouse for all analytics"; "better than
InfluxDB for all TSDB workloads"; "GPU makes every query faster"; "arbitrary
precision with no performance cost"; "commercially ready because the TUI works";
"AI-native vector TSDB" before real vector/embedding functionality exists.
