---
title: "Research and business notes"
summary: "The benchmarking, competitor, compression and GPU research behind the plan, the target personas and the pricing hypotheses."
order: 4
group: Strategy
---

# Research and business notes

**Benchmarking research:** *TSM-Bench* (PVLDB'23) and *SEER* (PVLDB'24) →
macrobenchmarks with realistic data, concurrency, dashboards, reproducibility;
Weft-Bench should resemble SEER. *SciTS* → growth curves (10M→100M→1B). *TSBS* →
implement for compatibility (via ILP), not as the primary proof.

**Competitor architecture (don't benchmark stale mental models):** *InfluxDB 3*
(FDAP stack) — compete where it's less specialized (interpolation-heavy irregular,
precision, GPU resampling, model compression), not on broad scans. *TimescaleDB
Hypercore* (hybrid row/columnar) → WeftDB needs its own hot/cold story. *ClickHouse*
(vectorized OLAP) → don't fight on generic OLAP first. *QuestDB* (ILP, `SAMPLE BY`,
ASOF) → strong finance/high-ingest comparison. *Apache IoTDB/TsFile* → validates a
time-series-native columnar file layout. *DuckDB* → excellent CPU-only baseline.
*kdb+* → optional; **legal review before publishing comparisons.**

**Compression research:** *Chimp* (PVLDB'22), *Elf* (PVLDB'23), *ALP* (SIGMOD'24,
vectorized), *NeaTS* (ICDE'25, nonlinear + random access — aligns with WeftDB's spline
DNA). Judge compression by *downstream task impact*, not only bytes.

**GPU databases:** the bottleneck is end-to-end data movement (PCIe, capacity,
orchestration), not kernel speed — *Vortex* (PVLDB'24/25), *Scaling GPU DBs Beyond
GPU Memory* (PVLDB'25). *GPUDirect/BaM* = CUDA-centric long-term research, not
`wgpu`-portable → defer.

**Irregular/missing data:** *TSI-Bench* etc. → missingness pattern matters; MCAR can
mislead; block/subsequence missingness is harder; linear interpolation is a strong
baseline → benchmark interpolation **quality** (extrema preservation,
event-detection stability) as well as speed.

**Target personas (feel interpolation/resampling pain):** quant finance / market
data; industrial IoT / SCADA; energy / grid monitoring; scientific instrumentation;
robotics / autonomous telemetry; healthcare / wearables (if compliance scope is
manageable). **Design-partner criteria:** irregular data; large historical ranges;
production interpolation/gap filling; pain with current TSDB/app-layer workflow;
measurable latency/cost targets; willing to run Weft-Bench and share anonymized
results. *Avoid partners who only need generic dashboards.*

**Pricing hypotheses:** open-source core; paid enterprise server; paid GPU
acceleration; paid advanced compression; paid security/compliance; paid benchmark
consulting; managed Weft-Bench reports; support subscription. **Validate willingness
to pay before building expensive distributed features.** Key question: *is
interpolation performance a budget-owning pain, or merely an engineering annoyance?*
