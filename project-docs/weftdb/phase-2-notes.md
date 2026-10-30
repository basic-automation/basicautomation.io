---
title: "Phase 2 — Benchmark-grade server/API — notes"
summary: "The prose, findings and finished-work write-ups that sit behind the roadmap checklist for this section."
order: 13
group: Roadmap notes
---

# Phase 2 — Benchmark-grade server/API — notes

*The checklist for this section is in the [roadmap](https://github.com/basic-automation/weftdb/blob/main/ROADMAP.md). What follows is the writing that used to sit between its items.*

A commercial DB can't lead with an embedded Rust API + TUI. `weft-server` (axum) is
that surface — see README ["HTTP Server"](https://github.com/basic-automation/weftdb/blob/main/README.md#http-server)) for what ships.
Interop priority: REST/JSON → ILP → Arrow/Parquet import-export → Prometheus
metrics → OpenTelemetry → Python SDK → Rust SDK → Arrow Flight/Flight SQL → SQL
surface / DataFusion (later) → Grafana → Prometheus remote write/read (if
monitoring) → R/Arrow workflows.

**Acceptance:** Weft-Bench drives WeftDB entirely through public APIs; the TUI becomes
secondary (demos/debugging); API responses distinguish raw / interpolated /
extrapolated / compressed / reconstructed values *(delivers the synthetic-point
marking nuance — backlog item B-tags)*.

## `axum` server skeleton

`/health`, `/ready`, Prometheus `/metrics`

## InfluxDB-Line-Protocol ingest

`POST /api/v1/interpolate/ilp` (+ downsample sibling)

## Downsample/aggregation query

`POST /api/v1/downsample` (+ `…/ilp`; `BigDecimal` reductions, epoch-grid-aligned buckets)

## Single-instant point query

`POST /api/v1/interpolate/point` (raw/interpolated/extrapolated labelling)

## Stored-range read surface

Arrow IPC `…/storage/{aspect}/range` + `…/value-range`, JSON `…/points` + `…/value-points`, `…/storage/aspects` / `…/{aspect}/schema` / `…/stats` (bytes/point)

## Single-instant read surface

`GET …/storage/{aspect}/at?t=` point lookup (order-signal-driven read planner: binary search on a sorted segment, linear scan on an out-of-order one)

## Storage maintenance

`POST …/storage/{aspect}/reconcile` (in-place out-of-order reconciliation pass; Phase 4.6)

## HTTP catalog management + ingest

declare aspect schema; JSON/ILP/Parquet/CSV batch ingest; `…/storage/catalog`; no-silent-downcast enforced (`400` on unrepresentable); `weft_ingest_*` counters

## B-rest pagination

`offset`/`limit`/`take`/`page` + `total`/`count` on `…/points` and `…/value-points`

## Parquet interchange

`…/range.parquet` / `…/value-range.parquet` export + `POST …/parquet` ingest

## CSV interchange

stored-range export/ingest + compute-endpoint CSV output

## Columnar output for compute endpoints

Arrow IPC + Parquet for `interpolate`/`downsample` (+ every ILP sibling); `weft-arrow` reconstructed-series + reduction-table interchange

## Prometheus latency histograms

compute endpoints, ILP compute path, and the storage-ingest seal path

## OpenTelemetry trace export (paired with Prometheus `/metrics`)

env-gated OTLP/gRPC exporter beside the `fmt` subscriber (delivery to a live collector = a runtime follow-up)

## B-rest residue

`interpolation` query-param alias for `spline` on the ILP compute endpoints (`spline` wins when both given)

## B-rest residue

cursor paging (stable forward-iteration token) on `…/points` / `…/value-points`: an opaque `next_cursor` (hex position token over the deterministic read order) + `?cursor=` (supersedes `offset`/`page`, malformed → 400); a client follows `next_cursor` until absent
