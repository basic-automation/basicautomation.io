---
title: "Phase 3 — Instrument everything — notes"
summary: "The prose, findings and finished-work write-ups that sit behind the roadmap checklist for this section."
order: 14
group: Roadmap notes
---

# Phase 3 — Instrument everything — notes

*The checklist for this section is in the [roadmap](https://github.com/basic-automation/weftdb/blob/main/ROADMAP.md). What follows is the writing that used to sit between its items.*

Before optimizing, make bottlenecks visible. **Acceptance:** for any slow benchmark
you can say where the time went (e.g. "52% value parsing, 18% segment read, 15% GPU
transfer, 8% kernel, 7% JSON").

#### `/debug/profile/current`

live p50/p95/p99 latency snapshot

#### Tracing foundation

a `RUST_LOG`-driven `fmt` subscriber (span-CLOSE events, busy/idle timing) with per-request engine spans on the flagship compute path: `interpolate.engine` (input/output points, spline, resolution) and `downsample.reduce` (candidate/in-window points, buckets, resolution)

#### Per-request **root span** + per-stage child spans (partial coverage of ingest → serialization)

a `request{method,path,request_id}` span (via `axum::middleware::from_fn`, `x-request-id` in/out) that every stage span nests under — `interpolate.parse`/`interpolate.compute`/`interpolate.serialize` under `interpolate.engine`, `downsample.parse` beside `downsample.reduce`, and `storage.ingest.parse`/`storage.ingest.seal` on the write path (the seal span surfaces the nested Turso `connect_with_encryption` control-plane spans)

#### Per-stage spans on the **storage read path** (`storage.{range,value_range,point}.read`

+ `.serialize`, uniform `format` dimension over JSON/CSV/Arrow/Parquet), the **ingest
decode paths** (`storage.ingest.parse`/`normalize`/`seal` for ILP + CSV + JSON), and
the **reconcile daemon** (`reconcile.tick{kind,...,aspects,segments}` on all five tick
kinds) — all runtime-verified against the running binary

#### Arrow/Parquet decode on ingest

`storage.ingest.parquet` stage span (byte length + sort guard + `format="parquet"`), nesting under the request root span; runtime-verified against the running binary

#### Remaining per-stage spans

auth · WAL append · commit · page skip · cache hit/miss ·

decompression · CPU interp · GPU upload/queue/kernel/readback. *(The **explicit libSQL write** +
**index update** stages shipped with the `n_change` accounting above:
`control_plane.index.insert`/`.delete`/`control_plane.metadata.put`, each carrying
`rows_changed`.)*

#### **OTLP trace export** (pairs with `/metrics`)

shipped — env-gated on

`OTEL_EXPORTER_OTLP_ENDPOINT`, an OTLP/gRPC `SdkTracerProvider` (batch exporter +
`weft-server` service resource) with a `tracing_opentelemetry` layer beside the `fmt`
subscriber; the shipped request/stage spans export to a collector. Dep constellation
confirmed current on crates.io (May 2026): `opentelemetry` 0.32 + `opentelemetry_sdk`
0.32 (`rt-tokio`) + `opentelemetry-otlp` 0.32 (`grpc-tonic`, builds protoc-free) +
`tracing-opentelemetry` 0.33. A misconfigured/absent collector does not block startup.

#### **OTLP collector verification: delivery verified.**

A Jaeger all-in-one collector

(docker `jaeger`, OTLP/gRPC :4317, query API/UI :16686, `--restart unless-stopped`)
now runs on the dev box; `scripts/verify-otlp.sh` boots `weft-server` against it,
drives a declare/ingest/read cycle, and asserts via the Jaeger query API that
`request` root spans land with their nested stage spans
(`storage.ingest.parse`/`seal`, `storage.range.read`/`serialize` observed nesting
correctly). Re-runnable headlessly; the script (re)starts the container if absent.

#### **`Statement::n_change()` write accounting (Turso 0.6) in ingest/instrumentation spans** —

the two control-plane writes on the seal path now *report* what they changed instead of
discarding it: `SegmentIndexStore::insert` and `AspectMetadataStore::put` return libSQL's
affected-row count (`Result<u64>`, was `Result<()>`), and each emits a `rows_changed` field on
a `control_plane.index.insert{aspect,id}` / `control_plane.metadata.put{aspect}` debug span
(`SegmentIndexStore::delete` already consumed the count for its hit/miss bool and now traces it
too). Runtime-verified against the live binary: two JSON ingests produced
`request{POST …/points,request_id} → storage.ingest.seal{point_count,format} →
control_plane.index.insert{id=0,rows_changed=1}` and the sibling `control_plane.metadata.put
{rows_changed=1}`, correctly nested. This is the accounting an idempotency ledger needs (7.1)
and the "explicit libSQL write" stage span the item below asks for.
