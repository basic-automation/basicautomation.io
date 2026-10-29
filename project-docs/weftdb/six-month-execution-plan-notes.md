---
title: "Six-month execution plan — notes"
summary: "The prose, findings and finished-work write-ups that sit behind the roadmap checklist for this section."
order: 25
group: Roadmap notes
---

# Six-month execution plan — notes

*The checklist for this section is in the [roadmap](https://github.com/basic-automation/weftdb/blob/main/ROADMAP.md). What follows is the writing that used to sit between its items.*

## **Month 1 — Benchmark truth:**

external-engine adapters (WeftDB + DuckDB minimum, then ClickHouse/InfluxDB 3/QuestDB/TimescaleDB); first cross-engine report (no aggressive claims); methodology + anti-Goodhart policy + hardware-reporting template + correctness rules published

## **Month 2 — Public API & observability:**

OTel; Parquet bench output; cold/warm separation; GPU timing breakdown *(server, REST, ILP, Prometheus, p50/p95/p99 shipped)*

## **Months 3–4 — Hot-path optimization:**

batch-ingest rewrite; minimized `BigDecimal` hot-loop use; typed-array interpolation streaming; nightly benchmark-regression CI. *Goal: establish whether storage or conversion is the dominant bottleneck.*

## **Months 4–5 — GPU flagship:**

command batching; true async handles; CPU/GPU overlap; hardware auto-tuning; end-to-end interpolation benchmarks; CPU-only vs GPU cost/performance report; portability/determinism matrix. *Publish only if strong and reproducible.*

## **Month 5 — Compression v2 prototype:**

scaled-int compression; f64 codec prototype; random-access blocks; model-based prototype; accuracy benchmarks

## **Month 6 — Commercial beta:**

Docker image; API keys/TLS; backup/restore MVP; Python SDK; Grafana dashboard; benchmark report; customer-runnable Weft-Bench; design-partner onboarding docs. *Goal: a "WeftDB Performance Preview" for 3–5 partners.*
