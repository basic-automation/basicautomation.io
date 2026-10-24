---
title: "Benchmark report requirements"
summary: "What every public WeftDB benchmark report must contain, including the honesty section."
order: 3
group: Benchmarks
---

# Benchmark report requirements

Every public report must include: **hardware** (CPU model/cores/threads, RAM, disk +
filesystem, GPU + memory, PCIe gen, OS/kernel, drivers, cloud instance + hourly
cost); **systems** (every system's version/git SHA/config); **datasets** (regular +
irregular IoT, high-frequency finance, scientific sensor, long single series, many
short series, sparse/missing, block missingness, compression corpus, anonymized
customer data where allowed); **workloads** (ingest, online ingest/query, raw range
fetch, point lookup, aggregation, downsampling, interpolation, gap filling,
compression, compressed query, analytics pipeline); **metrics** (points/sec,
bytes/sec, p50/p95/p99/max latency, storage bytes/point, compression ratio + speed,
random-access latency, GPU upload/kernel/readback, memory, CPU + GPU utilization,
freshness lag, cost estimate, correctness/error metrics); and a **required honesty
section** (where WeftDB wins, where it loses, workloads not tested, known limitations,
config caveats, reproduction instructions).
