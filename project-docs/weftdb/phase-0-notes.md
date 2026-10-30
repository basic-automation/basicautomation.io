---
title: "Phase 0 — Benchmark thesis & buyer wedge — notes"
summary: "The prose, findings and finished-work write-ups that sit behind the roadmap checklist for this section."
order: 11
group: Roadmap notes
---

# Phase 0 — Benchmark thesis & buyer wedge — notes

*The checklist for this section is in the [roadmap](https://github.com/basic-automation/weftdb/blob/main/ROADMAP.md). What follows is the writing that used to sit between its items.*

**Acceptance:** you can answer "why choose WeftDB over InfluxDB/QuestDB/ClickHouse/
TimescaleDB/IoTDB/DuckDB/kdb+?"; 3–5 design partners with interpolation-heavy
workloads identified; willingness-to-pay hypotheses documented.

## **DONE (2026-10-29) — willingness-to-pay hypotheses**

[`WILLINGNESS-TO-PAY.md`](https://github.com/basic-automation/weftdb/blob/main/WILLINGNESS-TO-PAY.md) records six untested hypotheses and the script for testing them, and the decided free/paid line. Free (MIT/Apache) is the single-node engine, including TLS and basic auth. Paid is HA and replication, SSO/RBAC/audit, historian connectors and SLA support. The opening prices are $3k support, $12k per node, $30k per site per year, and a $7.5k benchmark report; pilots are free, with 50% off for two years. Hosting is a viable option, priced on use once its cost is known. The same document sets the benchmark-publication policy: kdb+, AVEVA PI and the enterprise editions of QuestDB and InfluxDB 3 are excluded on licence grounds.

## **DONE (2026-10-29) — design partners, reframed as open datasets**

Rather than named companies, [`DESIGN-PARTNERS.md`](https://github.com/basic-automation/weftdb/blob/main/DESIGN-PARTNERS.md) selects five open, interpolation-heavy datasets that stand in for the target workloads: UCI Beijing air quality, NOAA NDBC buoys, PhysioNet 2012, Petrobras 3W and the Building Data Genome 2. Each is listed with its licence.
