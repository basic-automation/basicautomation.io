---
title: "Control-plane engine: Turso/libSQL 0.6 adoption — notes"
summary: "The prose, findings and finished-work write-ups that sit behind the roadmap checklist for this section."
order: 24
group: Roadmap notes
---

# Control-plane engine: Turso/libSQL 0.6 adoption — notes

*The checklist for this section is in the [roadmap](https://github.com/basic-automation/weftdb/blob/main/ROADMAP.md). What follows is the writing that used to sit between its items.*

WeftDB pins `turso = "0.6"`. Per hard-constraint #3, Turso/libSQL is the **control
plane** only — the features below are evaluated **only** for control-plane use; none
of them turn Turso into the measurement backend.

#### Migration 0.4 → 0.6

Turso 0.6 rejects `AUTOINCREMENT` under

`PRAGMA journal_mode=experimental_mvcc` at parse time; all control-plane schemas
migrated to plain `INTEGER PRIMARY KEY` (still a rowid alias). MVCC concurrent
writes (`BEGIN CONCURRENT`) remain the basis of the write path.

#### Encryption at rest (AEAD pager) for catalog/metadata/pipeline-state DBs *(Phase 8)* —

**UNGATED (research 2026-07-20): available on the pinned 0.6.** Turso 0.6.0's notes state
encryption for MVCC databases is *fully* supported, with the logical log (`.db-log`) encrypted
at rest using the same cipher infrastructure as the pager (per-transaction-frame payload
encrypted on write, decrypted on read). No version bump needed to start.
*(src: https://turso.tech/blog/turso-0.6.0)*

#### `VACUUM INTO 'file'` for online, consistent control-plane backup/snapshot *(Phase 7.4)* —

**MVP shipped (2026-07-21).** `weftdb::backup` (`vacuum_into` + `snapshot_and_verify`) snapshots a
control-plane DB to a fresh file and reopens the copy to verify its user-table set + per-table row
counts match the source; each of the four control-plane stores gained a `backup_to`, and
`SegmentStore::backup_control_plane(dir)` snapshots all four (segment_index/metadata/aspect_catalog/
catalog) into one dir returning a `ControlPlaneBackup` (per-DB reports + `total_rows`/`total_bytes`).
Exposed at the API as `POST /api/v1/storage/backup?label=` (label-guarded against traversal;
`WEFT_BACKUP_DIR`-or-`<root>/backups` base) and observable via `weft_backup_snapshots_total`/
`weft_backup_bytes_written_total`. Runtime-verified against the live binary. Finding: Turso's MVCC
mode adds an internal `__turso_internal_mvcc_meta` table to `sqlite_master`, filtered out of the
verified user-table set. *(src: https://turso.tech/blog/turso-0.6.0)*

#### **Backup 7.4 residue (a) — concurrent-write-safe verify: shipped (2026-07-23).**

`VerifyMode::{SourceMatch, SnapshotOnly}`: `SourceMatch` keeps the quiescent-source row-count
cross-check (unchanged default); `SnapshotOnly` never re-reads the source and instead validates the
copy's own committed frame — it reopens the snapshot and **fully scans every row of every user
table** (`scan_rows`, not `COUNT(*)`, so a truncated copy fails rather than reporting a plausible
count). Threaded through all four control-plane stores (`backup_to_with`),
`SegmentStore::backup_control_plane_with_verify`, and the endpoint's `?verify=source|snapshot`
(unknown token → 400; the response echoes which check ran). **The background daemon uses
`SnapshotOnly`**, which is the correctness point: it backs up a live, ingesting control plane, so a
seal committing between a vacuum and its verification would otherwise be a spurious mismatch.
Runtime-verified with six concurrent ingests in flight during a `verify=snapshot` backup.

#### **Backup 7.4 residue (c) — background backup daemon: shipped (2026-07-23).**

`WEFT_BACKUP_INTERVAL_SECS` + `WEFT_BACKUP_KEEP` beside the reconcile/compact daemons, writing a
fresh `backup-<unix_millis>` dir per tick into `WEFT_BACKUP_DIR`-or-`<root>/backups` and pruning the
oldest **generated** snapshots past the retention bound. Pruning only ever considers
`backup-<digits>`, so an operator's `?label=nightly` snapshot is structurally never a candidate,
and retention runs only after a *successful* snapshot so a run of failures cannot prune the last
good backup away. Runtime-verified: 7 snapshots / 5 prunes with the hand-taken backup surviving all
of them.

#### **Backup 7.4 residue (b) — incremental / WAL-streaming backup** beyond the full `VACUUM INTO`

snapshot: Turso streams WAL changes to replicas, so a change-since-last-snapshot backup is the
natural next tier, and 0.7 adds explicit **MVCC database syncing** (#7500) worth assessing as the
mechanism. Also worth noting from upstream SQLite guidance: `VACUUM INTO` **cannot run inside a
transaction** and is not the tool for a hot backup that must not block writers for its whole
duration — the **online backup API** (copy pages, re-read any page a writer dirties) is the
designed-for-hot-backup alternative if snapshot latency ever becomes the constraint.
*(src: https://turso.tech/blog/turso-0.7.0 · https://www.sqlite.org/c3ref/backup_finish.html ·
https://dev.to/dataformathub/distributed-sqlite-why-libsql-and-turso-are-the-new-standard-in-2026-58fk)*

#### **Backup 7.4 residue (d) — whole-store backup manifest**

fold the `.weftseg` segment frames in

beside the control plane (today it is control-plane only, per hard-constraint #3), so a restore
into an empty root is a complete store rather than a frame-less one.

#### **Backup cost: MEASURED (2026-09-23), and the diagnosis on record was wrong.**

The symptom is

confirmed — the interval is a floor, not a cadence — but the cause is **not** the vacuum's work.
`database/benches/backup_cost.rs` times one whole `backup_control_plane_with_verify` (four
`VACUUM INTO`s + verification) and sweeps the aspect count, with `WEFT_BENCH_BACKUP_DIR` choosing
the volume. On **tmpfs**: `snapshot_only` 8.62 ms @1 aspect / 6.18 ms @16 / 16.79 ms @128;
`source_match` 5.36 / 6.68 / 16.31 ms — single-digit milliseconds, growing with control-plane rows
(~2.7× from 16→128 aspects), not a fixed per-database floor. On the **btrfs** store volume under
heavy load (load avg 84–98) the same call took 39.96 s @1 / 50.05 s @16 — contaminated, not a
publishable number, but decisive on direction. Runtime on btrfs at load ~12: daemon ticks landed
2987/3493/3531/4100/4498/3140 ms apart at a 2 s interval, i.e. ~1.0–2.5 s per tick (not 7–22 s).
**So the cost is filesystem durability + I/O contention, and a fix must aim there.** The residue
items below name the specific levers.

#### **Snapshot dirs no longer accumulate empty `.db-log`/`.db-wal` sidecars** —

`backup::remove_empty_sidecars` sweeps them after each verification, in both `VerifyMode`s, and
removes a sidecar **only** when it is exactly zero bytes (a non-empty `-wal` holds
un-checkpointed frames = data, and is never touched). Runtime-verified: a control-plane backup
directory now holds exactly its four `.db` files. Finding while pinning the premise: `VACUUM INTO`
itself creates the empty `-wal`; the verifying reopen adds the `-log`.

#### **Backup cost residue (a) — the root cause is documented upstream, and it is per-call

fsync + TRUNCATE checkpoint (research 2026-09-23).** Turso's `VACUUM INTO` reference states the
destination "is fully synced and a TRUNCATE checkpoint is performed before the statement returns,
so the destination is durable without further action" — so a tick pays 4× (full-file write + fsync
+ WAL truncate-checkpoint). Record this as the attribution rather than re-litigating it, and stop
reading the ~1–2.5 s tick drift as daemon scheduling jitter. *(src:
https://docs.turso.tech/sql-reference/statements/vacuum)*

#### **Backup cost residue (b) — (i) MEASURED 2026-10-08: `synchronous=OFF` is NOT a material win.**

`backup_cost` on the HDD volume (`WEFT_BENCH_BACKUP_DIR` under /mnt/deepmem, load average ~12–21):
snapshot_only/1 4.77 → 4.25 s, /16 4.88 → 4.61 s, with overlapping confidence intervals. The
pragma was set on the store connection in a throwaway patch, never committed. (ii) checkpoint-first
is still untried. Original item:
(i) Upstream SQLite makes the output fsync **conditional** on the *source* database's
`PRAGMA synchronous` being NORMAL or FULL, and Turso implements that pragma partially (OFF and FULL
only) — so `synchronous=OFF` on the snapshot connection may collapse the seconds-scale cost. Note
Turso's own docs describe the sync as unconditional, so the two disagree and only a measurement
settles it; a non-crash-safe snapshot may be acceptable since WeftDB verifies every snapshot and can
re-take it. (ii) Call the SDK's explicit `db.checkpoint()` once at the top of the tick, then take
the four snapshots, and see whether the per-snapshot TRUNCATE checkpoint gets cheaper for having a
short WAL — a one-line reordering in the backup daemon if it works. *(src:
https://sqlite.org/lang_vacuum.html · https://docs.turso.tech/sdk/rust/reference)*

#### **Backup cost residue (c) — DO NOT reach for Turso's experimental passive checkpoint.**

It is

a documented data-loss path in exactly WeftDB's configuration: issue #8076 (filed 2026-07-28, still
open at 2026-09-23) reports a TRUNCATE checkpoint discarding acknowledged concurrent commits when
`experimental_mvcc_passive_checkpoint` is enabled under `journal_mode=experimental_mvcc` — and
`VACUUM INTO` performs exactly that TRUNCATE checkpoint on every call. A sibling (#8068) panics
("MVCC vacuum gate acquired while transactions are still active") instead of returning busy, which
would abort `weft-server` mid-backup. This **supersedes** the passive-checkpoint suggestion in the
0.7-upgrade item below. Re-evaluate when #8076 closes. *(src:
https://github.com/tursodatabase/turso/issues/8076 · https://github.com/tursodatabase/turso/issues/8068)*

#### **Backup 7.4 residue (b) is UPSTREAM-GATED, not an open design question (research 2026-09-23):**

Turso lists `sqlite3_backup_init`/`_step`/`_finish` as **stubs** in COMPAT.md, so the SQLite online
backup API (copy pages, re-read pages a writer dirties) does not exist there; and there is no
vendor-neutral incremental/WAL-streaming path either — the only incremental mechanisms are the
Turso sync engine (a push/pull protocol against a remote) and libSQL's `bottomless` virtual WAL,
which requires S3-compatible object storage. So incremental control-plane backup is unavailable
without a cloud/object-store dependency, which hard-constraint #2 keeps out of core. Keep
`VACUUM INTO` as the only snapshot mechanism and re-check COMPAT.md at each `turso` bump. *(src:
https://raw.githubusercontent.com/tursodatabase/turso/main/COMPAT.md ·
https://raw.githubusercontent.com/tursodatabase/libsql/main/bottomless/README.md)*

#### **Backup cost residue (d) — evaluate an `sqlite3_rsync`-style page-delta replica.**

It is a

documented page-level delta copy for SQLite-format databases: the replica sends per-page hashes and
the origin returns only differing pages (a 500 MB database syncs in ~20 KB), against a live
database, and its WAL-mode/page-size restrictions were lifted in SQLite 3.50.0 (2025-05-29). Write
cost then scales with *changed* pages, not database size, which is precisely the btrfs fsync bill
WeftDB measured. Validate two things first: that a Turso-written file is byte-compatible enough for the
protocol, and that "replica is read-only during sync" fits the restore-drill flow. *(src:
https://sqlite.org/rsync.html)*

#### **Confirm the snapshot verifier does not depend on MVCC-broken pragmas.**

Turso issue #4929

(filed 2026-01-29, still open) reports `PRAGMA page_count` returning 0 and `user_version` /
`application_id` returning 0 under MVCC — discovered while running the `VACUUM INTO` integration
tests. WeftDB's verifier compares user-table sets and *scans every row*, so it should be unaffected,
but that is worth asserting explicitly rather than assuming, since a pragma-based check would be
vacuously passing. *(src: https://github.com/tursodatabase/turso/issues/4929)*

#### **Upgraded to `turso` 0.8.1 (2026-10-05).**

No API breaks. Behaviour changes handled: (1) **139

`let _ = commit_*` call sites silently dropped `COMMIT` errors**, so a write lost to an MVCC
conflict was reported as success. They now propagate, and `commit_concurrent`/`commit_immediate`
`ROLLBACK` on failure. (2) The lock probes in `database/mod.rs` match `Error::Busy | Error::BusySnapshot`
instead of the message text, because 0.8 reports aborted commit dependencies as `BusySnapshot`.
(3) Open read cursors are dropped before `COMMIT`. **One-way:** once 0.8 writes, the MVCC log is
v3 and 0.6 can no longer open the store. Still open: a retry policy for `BusySnapshot` on the
hot write paths (today it surfaces to the caller), and adopting `TransactionBehavior::Concurrent`
in place of the raw `BEGIN CONCURRENT` strings. The original evaluation notes follow.

#### ~~**Evaluate the `turso` 0.7 upgrade**~~

the release notes are now read (research 2026-07-23),

and two of the three open questions have answers.** WeftDB pins `turso = "0.6"` and locks 0.6.1.
**Version check (research 2026-09-23): stable is now `0.7.2` (2026-07-30), with `0.8.0-pre.12`
out on 2026-09-22 — WeftDB is two minor versions behind, and 0.8-pre is moving weekly, so part of
this decision is whether to wait for 0.8 stable.** Before bumping, audit the `weftdb` crate for
(a) any place two write statements can be in flight on one connection (now returns busy) and (b)
any interactive transaction where a statement can be abandoned mid-way (now poisons it) — **the
backup tick running beside a concurrent catalog writer is exactly the shape that trips (a)**.
NB the passive-checkpoint win listed below is **superseded** by the data-loss gate filed above
(#8076): do not adopt it as part of this bump. *(src: https://crates.io/crates/turso)*
From the 0.7.0 notes:
- **The `AUTOINCREMENT`-under-MVCC constraint is LIFTED upstream.** 0.7 makes `AUTOINCREMENT`
  behave correctly under concurrent transactions via PostgreSQL-style sequences (#7137), plus a
  `sequence_watermark()` so CDC consumers cannot skip rows. Hard-constraint #3's "use plain
  `INTEGER PRIMARY KEY`" note is a **0.6** constraint, not a permanent one. (No action needed —
  the plain-rowid schemas are fine — but the constraint should not be cited as timeless.)
- **A behavioural change to check before bumping: one write statement at a time.** Starting a
  second write while another is mid-flight now returns busy, and abandoning a half-done write
  inside an interactive transaction **poisons the transaction** so it refuses to commit a partial
  statement (#7420). WeftDB's seal path issues several control-plane writes per ingest — this is the
  migration risk to test, not `n_change`.
- **Wins that matter to the control plane:** MVCC reads under concurrent writes went from
  `N·log(N)` to a linear merge (#7501); GC of obsolete row versions is decoupled from
  checkpointing and watermark-driven (#7493); **experimental passive checkpoints** run the
  write-out without the global lock so `BEGIN CONCURRENT` transactions keep committing (#7583) —
  directly relevant to the backup-tick cost item above; encrypted MVCC on pluggable storage
  (#7353); MVCC database syncing (#7500) for the incremental-backup tier.
*(src: https://turso.tech/blog/turso-0.7.0 · https://crates.io/crates/turso)*

#### Triggers (`BEFORE/AFTER/INSTEAD OF` + `WHEN`)

enforce catalog invariants, emit audit-log rows on metadata mutations *(Phase 7/8)*

#### `Statement::n_change()` affected-row accounting

shipped on the seal path's two

control-plane writes (`SegmentIndexStore::insert`, `AspectMetadataStore::put` return the count;
`control_plane.*` spans carry `rows_changed`); consuming it for an idempotency *ledger* is the
Phase 7.1 residue *(Phase 3/7)*

#### Dynamic auth tokens as closures

hosted/remote control-plane credential rotation *(Phase 8)*

#### `UPDATE … FROM`, aggregate `FILTER`, `INDEXED BY`, `NULLS FIRST/LAST`

simplify catalog/metadata queries *(Phase 2/4)*

#### Evaluate (don't rush)

native vector search over pattern/shape **summaries** only *(Phase 9 — never over raw measurements)*; CDC/sync engine for online ingest/replication *(assess once 7.2 is solid)*; custom I/O (`with_io_impl`) / generated columns *(only on concrete need)*

**Explicitly defer / avoid:** multi-process WAL access (`?experimental=
multiprocess_wal`) — **incompatible with `BEGIN CONCURRENT`**, which the write path
depends on; treating any Turso table as the measurement store (violates
hard-constraint #3).
