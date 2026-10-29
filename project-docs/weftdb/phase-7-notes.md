---
title: "Phase 7 — Online perf, durability, correctness — notes"
summary: "The prose, findings and finished-work write-ups that sit behind the roadmap checklist for this section."
order: 18
group: Roadmap notes
---

# Phase 7 — Online perf, durability, correctness — notes

*The checklist for this section is in the [roadmap](https://github.com/basic-automation/weftdb/blob/main/ROADMAP.md). What follows is the writing that used to sit between its items.*

**Acceptance:** a 24-hour run sustains continuous ingest + concurrent interpolation +
range scans + compression + compaction + late arrivals + simulated failures + restart/
recovery, with bounded p99 and no loss beyond the declared durability mode.

## **7.1 Online ingest**

scheduled polling daemon, runtime source registration, retry

buffer, backpressure, idempotency ledger, at-least-once, dedup/upsert, late-arrival
policy *(maps backlog B-poll, B-retry, B-register, B-dedup)*

## **7.2 WAL & crash consistency.**

The design is in [`basicautomation.io/projects/weftdb/docs/crash-consistency`](/projects/weftdb/docs/crash-consistency) (2026-10-05).

A code audit verified **43 crash/consistency windows**: 7 lose data that was already acknowledged, and 6 corrupt data that was already committed.
The worst: segment frames are never fsynced while the index commit is; maintenance rewrites committed frames in place;
concurrent seals can share an id; and a cold open deletes the legacy `metadata.db-log`, dropping committed rows.
The design is "Atomic Publish": write-once fsynced frames, one control-plane transaction per state change, and startup recovery. There is no separate WAL in 1.0.
Milestones: **M1** (S1–S12 + S15) makes the strict promise true; **M2** (S13–S14) adds idempotent HTTP ingest; **M3** (S16) adds whole-store backup;
**M4** (S18–S20) moves legacy ingest onto the seal (Immediate #1). Slices:

## **S3** Storage-v2 open hardening

MVCC/FULL probes, root LOCK, register_scope, directory durability *(~4 h; after S2)*

## **S8** Write-once maintenance I

generational outputs, frame journal, single-transaction swap, reaper and reader pins (reconcile_segment, split_segment) *(~8 h; after S7)*

## **S9** Write-once maintenance II

overlap merge (both branches), squash, size-targeted compaction *(~8 h; after S8)*

## **S14** HTTP ingest wiring

Idempotency-Key, detached tasks, body limit, backpressure, status classes, graceful shutdown *(~7 h; after S13)*

## **S15** Partial sidecar v4

CRC trailer, frame-stem naming, frame_crc stamp, tmp+rename, backfill *(~5 h; after S10)*

## **S16** Whole-store backup with hard-linked frames

restore_store and in-place restore mode with adoption *(~8 h; after S5, S12)*

## **S18** Legacy rows-mode hygiene

atomic Database::new, write-ahead enqueue, batch dedupe *(~5 h; after S1)*

## **S19** Seal-backed legacy aspects

storage_mode, legacy ingest and reads through SegmentStore *(~8 h; after S13, S18)*

## **7.3 Corruption detection**

segment/page checksums *(CRC-32 shipped in the

`.weftseg` frame)*, catalog checks, startup verification, repair tooling

- **7.4 Backup/restore** — online backup, PITR if feasible, verification, drills, documented RPO/RTO

## Concurrent-write-safe verification (`VerifyMode::SnapshotOnly`)

the mode an online backup must use

## **Restore + a backup/restore drill**

`restore_control_plane` puts a snapshot back into a fresh store root, verifying each file at its destination, and refusing both an incomplete backup dir and an existing control plane; a round-trip test reopens the restored store and reads its measurements back

## **Restore drill at the API**

`POST /api/v1/storage/restore/drill?label=` rehearses a restore into a throwaway dir, verifies it, reports `restorable`, and cleans up; non-destructive by construction (it cannot touch the live store), runtime-verified against the live binary

## Restoring *into a chosen new root* over HTTP

deliberately not shipped (a deployment decision, not an HTTP call); revisit only if an operator flow actually needs it

## Whole-store backup manifest (fold the `.weftseg` frames in beside the control plane)

today a restore into an empty root yields a valid but frame-less store

## **7.5 Compaction**

scheduling, query consistency during compaction, resource

limits, metrics, cancellation, priority

## **7.6 Quotas/limits**

tenant/disk/memory/request-size/query-timeout/GPU-memory
