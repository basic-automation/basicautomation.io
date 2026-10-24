---
title: "Guiding principles and tracks"
summary: "The six hard constraints every change is held to, and the ten tracks in priority order."
order: 2
group: Strategy
---

# Guiding principles and hard constraints

1. **Benchmark-gated features.** A feature is "done" only when `Weft-Bench` shows a
   measured, reproducible, correctness-validated outcome.
2. **Vendor-neutral connectors (hard constraint).** The WeftDB codebase defines **only**
   a vendor-neutral connector abstraction — ideally a small dedicated crate (e.g.
   `weft-connector`) holding the `Source`/`Connector` trait + runtime registry. Every
   concrete connector (Thorchain, InfluxDB, CSV, …) lives **outside** the core as its
   own crate that depends on the abstraction, never the reverse. No vendor-specific
   code/types/deps in `splimes`/`weftdb`/`weft-orchestration`/`weft-tui`.
   Thorchain is *one of many* sources and must not be coupled to WeftDB.
3. **Storage boundary.** **libSQL/Turso is the control plane** — catalog, metadata,
   config, pipeline state, transactional control. WeftDB's own **typed columnar
   measurement segments** (Storage v2) own the high-volume measurement hot path.
   External databases like InfluxDB are *integration targets* (source and/or sink)
   reached through connectors — **never** replacement backends. Do not reintroduce
   `sled` or `sqlx`.
4. **Precision-aware, not precision-taxed.** Keep `BigDecimal` as the logical/API
   type; execute each series in the fastest *safe* physical encoding declared by
   schema. Downcasting is explicit, benchmarked, and governed by schema-level error
   bounds — never a silent `BigDecimal → f64`.
5. **Port designs, not legacy code.** Legacy crates are edition-2021, `.unwrap()`-heavy,
   often nightly microservices. Reimplement against current async + typed `Error`
   conventions, libSQL, and `splimes`.
6. **Honesty / anti-Goodhart.** Publish negative results and workloads where WeftDB
   loses; methodology before numbers; correctness gates every performance number.

## Top-level tracks

Priority order:

1. **Weft-Bench** — public, reproducible, competitor-facing, customer-runnable.
2. **Benchmark-grade API** — server mode, InfluxDB Line Protocol, REST, Arrow/Parquet, metrics.
3. **Instrumentation** — full timing breakdown ingest → GPU → serialization.
4. **Physical type system** — precision semantics with fast physical encodings.
5. **Storage v2** — libSQL control plane + typed columnar measurement segments.
6. **GPU interpolation** — end-to-end, auto-tuned, portable, economically justified.
7. **Compression v2** — modern codecs, model-based segments, random access, downstream stability.
8. **Operational correctness** — late/out-of-order data, WAL, crash recovery, compaction consistency.
9. **Commercial hardening** — security, compliance readiness, packaging, SDKs, backup/restore.
10. **Analytics premium** — pattern/event/signal pipelines, after the core engine is proven.
