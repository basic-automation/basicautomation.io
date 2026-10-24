---
title: "1.0 release criteria — notes"
summary: "The prose, findings and finished-work write-ups that sit behind the roadmap checklist for this section."
order: 21
group: Roadmap notes
---

# 1.0 release criteria — notes

*The checklist for this section is in the [roadmap](https://github.com/basic-automation/weftdb/blob/main/ROADMAP.md). What follows is the writing that used to sit between its items.*

The phases above define **beta** (Phase 7) and **paid beta** (Phase 8); this section
defines **1.0 / stable**: the point at which WeftDB makes a semver promise about its
API, its on-disk format, and its durability. Today WeftDB is **pre-beta**: every crate
is `0.1.0`, and v0.1.0 is the pre-beta baseline release (GitHub release binaries only, no
crates.io), the previous release the upgrade, rollback and compatibility gates below test
against. 1.0 ships when every box below is ticked.

**Execution plan:** [`basicautomation.io/projects/weftdb/docs/release-plan`](/projects/weftdb/docs/release-plan) orders every
remaining box into waves W0–W15. Its preface records the owner's decisions of 2026-10-08:
everything ships as 1.0, the library crates included, with a frozen Rust API; B-tags stay a
gate; a v0.1.0 baseline GitHub release (no crates.io) is tagged before durability slice S6
reaches main; the soak and report runs use a dedicated SSD volume at `/mnt/weftbench`; every
other open question takes the plan's recommendation. Every wave, its slices and their status
are listed under [Execution waves (W0–W15)](#execution-waves-w0w15) below.

Gates that point at an item elsewhere in this file are ticked **only** when that item
is ticked there — the referenced item stays the source of truth for its detail.

**Recommended order:** CI → WAL & crash consistency → bulk ingest on the seal → tags →
whole-store backup → 24 h soak (**beta**) → TLS/auth + Docker → first cross-engine
report → API/format freeze → **1.0**.

### Durability & correctness *(the beta bar — Phase 7)*

#### **7.2 WAL & crash consistency**

the largest blocker; no durability promise is possible without it

#### **7.3 Corruption detection**

startup verification, catalog checks, repair tooling (beyond the shipped `.weftseg` CRC-32)

#### **7.4 Whole-store backup manifest**

fold the `.weftseg` frames in beside the control plane; a restore must not yield a frame-less store

#### **7.6 Quotas/limits**

request size, query timeout, memory, GPU memory

#### **Phase 7 acceptance run**

the 24-hour soak (ingest + interpolation + range scans + compaction + late arrivals + simulated failures + restart) with bounded p99 and no loss beyond the declared durability mode, published as a benchmark artifact

### Hot path & data model *(must land before the freeze)*

#### **splimes 1.0 is released**, and WeftDB depends on it

The interpolation engine is

its own crate ([basic-automation/splimes](https://github.com/basic-automation/splimes))
with its own 1.0 criteria; a stable WeftDB can't promise a stable API on top of an
unstable engine. *splimes 1.0.0 was published to crates.io on 2026-10-05, and WeftDB
depends on it from the registry (`splimes = "1"`, no patch or git source). The migration
merged to main as PR #62 on 2026-10-08.*

#### **Measurement bulk ingest routed through the `.weftseg` seal**

the legacy `batch_capture_measurements` path is super-linear (see [Immediate next actions](https://github.com/basic-automation/weftdb/blob/main/ROADMAP.md#immediate-next-actions))

#### **B-tags**

per-measurement tags/labels; a data-model change that must precede the API/format freeze

#### **Control-plane engine decision**

moved to stable `turso` 0.8 (2026-10-05). `experimental_mvcc` stays on and is the documented known risk. The bump also fixed 139 call sites that silently discarded `COMMIT` errors; see the `turso` item in the [Turso section](https://github.com/basic-automation/weftdb/blob/main/ROADMAP.md#control-plane-engine-tursolibsql-06-adoption)

### Security & packaging *(Phase 8 minimum)*

#### Packaging

static binaries, Docker image, systemd unit, documented config schema

### Release engineering

#### **Dependencies current and audited (2026-10-05)**

every dependency on its latest major (turso 0.8, wgpu 30, arrow/parquet 60, OpenTelemetry 0.33, rand 0.10, thiserror 2, …). The unmaintained `bincode` (RUSTSEC-2025-0141; its 3.0.0 release is a `compile_error!` tombstone) was replaced by `postcard` 1.x for the `.weftpart` sidecar (frame v3, magic `\x02`; older sidecars are ignored and the segment is decoded instead). The `crossbeam-epoch` and `h2` advisories were cleared, and wildcard `"0"` requirements were pinned to their minor versions

#### **CI**

build, test, `clippy`, `fmt` on every PR (the repository has no workflows today); a nightly benchmark-regression job

#### **Public surface declared and frozen**

`/api/v1` HTTP contract, `.weftseg` `format_version`, control-plane schema, and the published library crates' Rust API (owner decision 2026-10-08: every crate ships as 1.0); anything not listed is explicitly unstable

#### **Compatibility tests**

a fixture store written by the previous release is read by the current one; a format change requires a version bump and a migration

#### **Crate publishing split**

`publish = false` on internal crates (`weft-bench`, `weft-tui`, likely `database_orchestration`); published crates carry versioned path dependencies, docs, and a single edition

#### **Panic audit on server paths**

no `.unwrap()`/`.expect()` reachable from a request or ingest path; failures surface as typed errors / HTTP status codes

#### **Security process**

`SECURITY.md` with a disclosure contact, `cargo audit`/`cargo deny` (advisories + licenses) in CI. *Checked on main 2026-10-08:*

#### `SECURITY.md` is on main

it routes reports to GitHub private vulnerability reporting

#### **Private vulnerability reporting is off**

the repository API reports `enabled: false`, so the channel `SECURITY.md` names does not work yet. The owner turns it on (Settings → Security), then this box is ticked

### Claims & documentation

#### First cross-engine report

WeftDB vs DuckDB at minimum, meeting the [Benchmark report requirements](/projects/weftdb/docs/benchmark-report-requirements)

#### Legal review of competitor benchmark-publication terms + codec licenses (see [Legal review](https://github.com/basic-automation/weftdb/blob/main/ROADMAP.md#legal-review))

*2026-10-08: licence and contribution terms decided, kdb+/KDB-X excluded unless KX consents, flagged opt-in codecs gated; the counsel items are listed under Phase 8.*

### Execution waves (W0–W15)

This list is the execution plan; the gates above remain the release criteria. A wave is one
phase of the [1.0 plan](/projects/weftdb/docs/release-plan#6-waves) (lanes, dependencies, estimates).
`→` is merge order after the previous slice, *(owner)* marks a step only the owner can take,
and a box is ticked only when its slice is on main.

*Status 2026-10-22:* The W2 stack is on main. #91 (X-NAME → main) was closed after its head branch
had become the merge target for #92–#96, so X-NAME, ROB-2, PAC-3, X-FRAME and FRE-14's two
first slices — the 0.1.x data-directory refusal and the rows-mode import — sat on
`xname/declare-validation` with their boxes ticked and their code off main. This wave lands them:
the stack, main's two roadmap edits, the `#[cfg(unix)]` that keeps the symlink probe honest on a
Windows runner, and PAC-5a's roadmap tick (`b5d0667`), whose registry merged in #88 without its
line being checked. The owner's W0 items are done — private vulnerability reporting is on, and the
stale `v0.1.0-preview.1` draft prerelease is gone.

*Status 2026-10-20:* W1 is running. The v0.1.0 baseline is cut and pinned (`compat/releases.toml`,
re-checked by CI's `release pins` job, #83), and X-FX's fixture set is on main (#84): three
trees written by binaries compiled from the tag, the reads that release recorded for them, and
`weftdb/tests/compat_v010.rs` opening them with the build under test. Still open from W0/W1:
the owner's private-vulnerability-reporting switch, deleting the stale `v0.1.0-preview.1`
draft prerelease, and the rest of W1 below X-FX.

*Status 2026-10-09:* W0's code is all on main; only the owner's private-reporting switch is
left. The durability store lane runs ahead: S8/S9 (W2) are on main; S10 and S11 are reviewed
and merged on `durability/base`, not yet on main; S12 is in review round 7 (identity before
any write, never purge an unproven frame), with its unfinished work on `durability/s12-r7-wip`.

#### **W0 · Land in-flight work and lock the shapes S6/S7 depend on**

ticks **splimes 1.0 is released** (ticked, #62) and **Security process** (once private vulnerability reporting is on)

#### **INT-0** Merge deps/splimes-1 → routine/dsp-2026-10-08 → legal → durability/base into main

#61/#62, #67, #63, and the routine (#68) through #73

#### **D-S3** Storage-v2 open hardening

MVCC/FULL probes, root LOCK, register_scope, directory durability — #72

#### **D-S5** Backup directory atomic publish, manifest, retention and drill hygiene, + **SEC-1** backup-label grammar

#72

#### **D-S18** Legacy rows-mode hygiene

atomic Database::new, write-ahead enqueue, batch dedupe — #72

#### **D-S6** Schema v2, IndexTxn, write poison, root-relative frame paths

**FRE-12a** (STORE_FORMAT gate, migrations) first — #72

#### **D-S7** Persistent per-aspect id allocator, commit/maint locks, plain INSERT for seals (+ `next_series_id`)

#72

#### **PAC-1a** Release pipeline

a safe first run — #64

#### **TAG-1** TagSet, SeriesKey and SeriesSelector with canonical form and frozen caps

#74

#### **Decision 1** Store shapes for S6/S7

STORE_FORMAT + migration registry, `series_id`, P1/P2 with no key change, `SegmentStoreOptions`, `store_uuid`/`OpenReport` — adopted, #72

#### **W1 · Baseline release, server split, goldens**

starts **Semver policy + `CHANGELOG.md`** (from the first tagged pre-release)

#### **PAC-4** Cut the v0.1.0 baseline release (GitHub release only)

*released 2026-10-08: tag `v0.1.0` → b9a8ee4 (the #71 merge), five targets + SHA256SUMS, no crates.io. The pin is `compat/releases.toml`, read by every compatibility/upgrade/rollback gate and re-checked in CI (the `compat` job): tag → commit, the fixture set it names, and the sha256 of each archive against the release's own `SHA256SUMS` (`scripts/compat/releases.py`)*

#### → **X-FX** One fixture set under `compat/fixtures/v0.1.0/`, written by the v0.1.0 binary (absorbs PAC-FX, FRE-2)

*#84: three trees written by binaries compiled from the `v0.1.0` tag — a Storage-v2 root (no `store.json`, no segment manifest: descriptors in `segment_index.db`), the backup that same server took, and a rows-mode database — with every read that server recorded while it owned them. 740 KB, 109 files, each re-hashed by the `release pins` job through the pin's `fixtures` entry; regenerated by `scripts/compat/make-v010-fixtures.sh`. `weftdb/tests/compat_v010.rs` opens them with the build under test: the root classifies as layout 1, migrates forward, answers the recorded windows with the same timestamps, values and nulls (a null in the scaled aspect too), and reopens without migrating again. Two findings it settled, both recorded rather than wished away: a v0.1.0 backup copies the four control-plane databases and **none** of `segments/`, so it cannot restore an ingested store; and a rows-mode tree has no reader in this build at all (Turso, and the engine never opens Turso — D-S4), which is exactly the input FRE-14 has to take over.*

#### Store lane

**D-S6** merges only after the v0.1.0 tag (see W0) — #72

#### → **D-S7** (see W0)

#72

#### **X-SPLIT-SRV** Split manage.rs into declare/ingest/maintain/backup_routes, and main.rs into startup phases

*#86: `weft-server/src/manage.rs` (2,696 lines) became `declare.rs` (schema tokens + declare), `ingest.rs` (JSON/CSV/ILP, and the Parquet ingest that `storage.rs` handed over as `ingest_parquet`, so all four formats share one ordering gate and one seal), `maintain.rs` (reconcile/squash/compact + the sweep) and `backup_routes.rs` (backup + restore drill), with the endpoint tests' routers and request helpers in one shared `test_support.rs`; `main.rs` is now the runtime plus one call into `startup/{hooks,config,state,daemons,serve}.rs`. Behaviour and route table unchanged (256 weft-server tests, same count). Design-doc line citations that name `manage.rs`/`storage.rs:351-382` predate the move — the code they describe is in `ingest.rs`/`maintain.rs`/`backup_routes.rs` now.*

#### **PAC-1b** Stripped dist profile and a third-party license bundle (absorbs EVI-20)

*the dist profile shipped in #71; the bundle in #87: `THIRD-PARTY-LICENSES.md`, generated from `Cargo.lock` alone by `cargo-about` over the union of the five release targets' graphs (397 crates, 220 license texts, 432 crate entries), build-dependencies in because a `-sys` build script links foreign code into the archive, dev-dependencies out because no archive carries tests, `stage.sh` packing it next to the two crates' own notices, and a `third-party licenses` CI job that regenerates it and fails on drift. `deny.toml`'s allow-list is `about.toml`'s, in both files' comments, because a dependency one accepts and the other does not is a crate that ships unlabelled. `cfg_block` (through `turso_core`) publishes the Apache-2.0 **notice** rather than the text, so it is only in the bundle at all through a `clarify` entry checksummed against the published file*

#### **PAC-5a** Configuration registry skeleton

one `VarSpec` registry (absorbs FRE-11, ROB-10's knobs) — *#88: `weft-server/src/settings.rs` holds one `VarSpec` per environment name the workspace reads — 51 entries, each with a tier (`Stable` 7 / `Tuning` 17 / `Experimental` 2 / `Test` 25), a one-line summary, what it accepts, its default, and the file that reads it — sorted by name, so `spec()` is a binary search and `suggest()` is a two-edit Levenshtein over the same table. Three rules keep it from rotting: a test that walks every `.rs` in the five shipped crates (`weftdb`, `weft-server`, `weft-tui`, `weft-bench`, `weft-orchestration`) and fails on any `WEFT_`/`TEST_`/`SKIP_`/`OTEL_` literal that is not registered; a test that asserts the walk sees every crate it claims, so the net cannot quietly narrow; and a tier partition that names the Stable, Experimental and Test-tier variables explicitly. Fixture files (`settings.rs` itself, `tests/config_warnings.rs`) sit outside the net because their literals are the disease, not the symptom. `report()` runs as the first startup phase and prints, for a name WeftDB does not read, the closest registered one or the honest "there is nothing close to mistype"; for a test-harness channel set on a real server, the file that reads it. Values are still read where they were read: this is the registry, not the read path. PAC-5b's strict parsing, PAC-5c's single read path and PAC-5d's generated documentation build on it.*

#### **TAG-3** Open `ValueKind` in weftdb, provenance scope

rewords the **B-tags** gate and backlog item

#### **EVI-1** Claims hygiene

links, contradicted wording, precision, memory, cadence, corpus protection

#### **EVI-3** Run manifest (schema v23: the 2026-10-09 routine took v20–v22, so EVI-3 takes the next free number per the plan's rule)

runtime provenance, secret-safe capture, reference_grade verdict

#### **SOA-1** Soak harness skeleton

profile, `weft-bench soak` CLI, cross-platform supervisor, capability probe

#### **W2 · Error contract, frame format, portable builds**

ticks **CI** (EVI-5's nightly benchmark-regression job) and **Crate publishing split** (FRE-1 + PAC-3)

#### Store lane

**D-S8** Write-once maintenance I: generational outputs, frame journal, swap, reaper, reader pins — #72

#### → **D-S9** Write-once maintenance II

overlap merge, squash, compaction (+ P1/P2 output ids) — #72

#### **X-ERR** One error envelope and code table in `error.rs` (absorbs SEC-2, FRE-6a, ROB-1, TAG-0's envelope)

*#90: `weft-server/src/error.rs` (685 lines) is the one module that names a refusal. `Code`'s 42 variants are asserted by name **and** status against the plan's §4 table, and the nine synonyms that table drops (`invalid_request`, `unauthorized`, `store_unconfigured`, `maintenance_busy`, `limit_exceeded`, `panic`, `segment_invalid`, `not_found`, `too_large`) are asserted absent, so a later lane cannot quietly reintroduce one. The envelope is `{"error","code","request_id"}` plus optional `details`/`limit`/`committed` on **every** path: `StrictJson`/`StrictQuery` replace axum's extractors, so a wrong `Content-Type` is `unsupported_media_type` and a malformed body or query is `invalid_json`/`bad_request` instead of axum's empty 400, and `Router::fallback` answers `route_not_found` naming the method, the path, where the aspect list is and where `docs/INTEGRATION.md` is. Classification is by **type**: `classify_read`, `classify_ingest` and `classify_typed` downcast `weftdb::InvalidAspectName`, `weftdb::StoreError`, `SealError`, `ReduceError` and `SketchError`, and the four `SegmentStore` seal wrappers (`weftdb/src/types/segment_store.rs:2782/2798/2814/2826`) now wrap with `anyhow::Error::from(error).context(format!("seal failed: {shown}"))` — `anyhow`'s `Display` prints only the outermost context, so the sentence stays byte-identical while `downcast_ref::<SealError>()` starts working; a reworded wrapper can no longer move a status. Two message rules survive, each commented with the slice that retires it: `no declared schema` (D-S13 types it as `UnknownAspect`, a store-lane edit) and `out-of-order timestamp` (`weft-arrow-store/src/lib.rs:233`'s untyped `bail!`, D-S10/D-S14). `ConvertError` is direction-dependent, so there are two classifiers and `weft-server/tests/error_contract.rs` asserts both halves of the same `Parquet(…)` — a client `400` ingesting, a server `500` reading. Statuses split where §4 names a different condition: `ToleranceExceeded` is `422 value_not_representable` with `details.max_abs_error`/`details.tolerance` (was a `400` carrying a `seal failed` sentence), `Encode(EncodeError::NotFinite)` is `400 not_finite` with `details.row`, a name the store cannot address is `400 invalid_aspect_name` with `details.aspect`/`details.reason`, a store this binary will not open is `503 incompatible_store` (exit 65 in the §4 C7 table), and a downsample `ReduceError` is 422/400 instead of 500. Two findings worth keeping: `weft_physical_type::EncodeError` names only `Overflow` and `NotFinite`, so a wildcard arm beside them was dead code and is gone — a new arm is meant to stop the build where someone picks the §4 code; and `ApiError::message()` returns the cause **by design** (it is the sentence for the log), so the sanitisation tests assert `wire_message()` is the code's fixed text — `internal` "the server could not complete the request", `incompatible_store` "the store on disk uses a format this server cannot open". `axum`'s `CatchPanicLayer` is dropped (FRE-6a: a panic is a process death with the exit code a supervisor sees, not a body), and `ConvertError`/`ReduceError`/`SketchError` gained `#[non_exhaustive]`.*

#### → **X-NAME** `aspect_name::encode` and `validate_new` at HTTP declare (absorbs FRE-7a, SEC-0)

*partly on main: `validate` and the declare check (#66), `encode` (#72). #91 is the rest: `weftdb::aspect_name::validate_new` (`weftdb/src/types/aspect_name.rs`) runs `validate`'s chain and then refuses an ASCII uppercase letter with a new `AspectNameReason::UppercaseAsciiLetter` (the enum is `#[non_exhaustive]`, so the variant is not a breaking change). Order is asserted: the capital rule runs **after** `reason()`, so `../Price` is refused for escaping the directory, not for its capital — the more dangerous reason is never hidden. The hole is real because the legacy frame file is `<aspect>-<id>.weftseg`, which writes the name literally, and NTFS, APFS (by default) and ext4 with `casefold` fold ASCII case: two aspects differing only in case share a file, whichever seal lands second overwrites the other's bytes, and reads serve one series' values for the other's name. `encode` (#72) removes that collision for the frames D-S10 will write; this closes the declaration of a new collision. Applied at **creation only** — `POST /api/v1/storage/aspects` — so `SegmentStore::declare`, every read, seal, maintenance and store-wide sweep keep plain `validate` and a store that already holds `Price` stays readable, writable and compactable (the test asserts both halves: the refusal, then a raw catalog declare of `Price` followed by a 201 write). Two things are deliberately **not** refused: the characters only Windows forbids (`< > : " | ? *`), because `job:rate5m` is blessed on Unix by this module's own docs and is a shape in use, and the cross-platform hazard belongs one layer down where `encode` escapes `:` for write-once frame names (D-S10, the slice the plan names for it); and Unicode NFC/NFD aliases, which need `unicode-normalization` this crate does not carry, while `encode` escapes every non-ASCII byte anyway. A refusal keeps the #90 shape: `400 invalid_aspect_name` with `details.aspect` and `details.reason`.*

#### → **ROB-2** Storage-engine panic fail-stop

a turso-origin panic aborts — *#92: the write scope was already here — `weftdb::exec::control_plane_write`, and every `IndexTxn` operation runs inside it, which weftdb's own `every_op_runs_inside_the_control_plane_write_scope` asserts — so C12's "hook and knob" was the half that was missing, and it lives in the binary: `weft_server::panic_hook::install()` chains the hook it replaces, and when `in_control_plane_write()` says the panicking task held the scope it names the panic and calls `std::process::abort()`: SIGABRT for a supervisor, not the poison path's exit 70, and never an HTTP response (FRE-6a). Startup calls it immediately after `init_tracing`, because `set_hook` hands back the hook it replaced. It deliberately does not write the poison marker: that region reads before it writes (`txn.plans()`, `SegmentIndex::open`), and the marker survives the panic until an operator deletes a file. Nothing is caught, so ROB-3 stays the only catch layer and read-path panics still answer 500; the legacy `weftdb/src/types/aspect.rs` lane is ROB-5's. Proved by `weft-server/tests/control_plane_panic.rs`, which re-executes the test binary the way `poison_exit.rs` does.*

#### **PAC-3** Library crate hygiene

no global allocator or wgpu features imposed on library users — *#93: two decisions were being made for every program that links these crates. `turso` 0.8.1 puts a `#[global_allocator]` in its own crate root behind its `mimalloc` feature, so the workspace's `features = ["mimalloc"]` on a **published library** (`weftdb/Cargo.toml`) chose the allocator of every embedder's process; and `splimes`' default features pull `wgpu`, so `wgpu` sat in the normal graph of `weftdb`, `weft-line-protocol`, `weft-reduce` and `weft-orchestration` — 52 packages of Vulkan, Metal and DX12 code for two crates that never call a GPU API. The allocator moved to the place that owns the process: `weft-server/src/main.rs` and `weft-tui/src/main.rs` each declare `static ALLOCATOR: mimalloc::MiMalloc` through a direct `mimalloc` dependency, so the same allocator on the same version still runs everything we benchmark and ship, and `weftdb` now carries no allocator feature at all — the plan's own lane row names this slice at `main.rs` (`basicautomation.io/projects/weftdb/docs/release-plan:126`). GPU is opt-in the same way: the workspace asks splimes for `default-features = false, features = ["serde"]`, `weft-server` and `weft-bench` add `gpu` themselves, and `weftdb`'s interpolation benches take it as a dev-dependency. Distinct packages in the normal graph: `weft-line-protocol` and `weft-reduce` 77 → 25, `weft-orchestration` 267 → 231, `weftdb` 266 → 227; `cargo tree -p weftdb -i wgpu -e normal` and `-i mimalloc` now return nothing. Two keeps are deliberate: splimes' `serde` stays on because `weftdb::BatchedMeasurement` holds a `splimes::Resolution` and derives `Serialize`/`Deserialize`, and turso's other default, `fts`, stays off exactly as it already was — an attempt to re-add it pulled `tantivy`, `zstd`, `datasketches` and friends, +435 lines of `Cargo.lock`, for full-text search nothing in this workspace uses. `tracing-subscriber` became a dev-dependency of `weftdb` (only test code installs a subscriber). One consequence for our own numbers: `cargo bench -p weftdb` used to inherit mimalloc and now runs on the system allocator, so those nine criterion benches are not comparable across this commit; the nightly regression track (EVI-5) uses `weft-bench`, which never linked `weftdb` and never had mimalloc, so no baseline moves there.*

#### L-FMT: **X-FRAME** Frame registry, v7 envelope, `read_frame*`/`describe_frame`, `FrameFault` classes (absorbs FRE-4, TAG-2)

*#94: the three frame versions are named in one place, `weft_physical_type::frame_registry` — 5 single-block, 6 paged, 7 envelope, `layout_of`, `FrameExtension`, `FrameInfo`, `FrameFault { Integrity, Undecodable { newer_format } }` and `fault_class()`, with `KNOWN_EXTENSIONS` deliberately **empty** because an extension id is a permanent namespace. The envelope (`wrap_frame_envelope` in `weft-physical-type/src/weftseg.rs`) stores the older frame verbatim, magic, version and CRC included, for 16 bytes of overhead, so every byte-for-byte pin in this repo still holds and a legacy reader still answers `UnsupportedVersion { found: 7 }`; `frame_parts` verifies that CRC before it trusts a single header field, and `EnvelopeBodyMismatch` catches a header that disagrees with a body which is already under the checksum. Reading is now routed by **what the file says**: `weftdb/src/types/frame_read.rs` probes the header (`frame_layout_of`) instead of trusting `descriptor.format_version`, and its `FrameFaultError` reproduces the historical `decoding paged segment {path}: {sentence}` byte-for-byte, at all six call sites. Nothing opts into v7 yet — writers keep emitting 5 and 6, because `weftdb/src/types/segment_store.rs:7022` promises an unconfigured deployment bytes that are historical. `error::Code::FrameUndecodable` finally has a producer: a frame from a newer version is 503 `incompatible_store` and everything undecodable-but-current is 500, asserted in `weft-server/tests/error_contract.rs` by corrupting a real `.weftseg` (one byte, and a re-stamped-CRC version bump), which also shows the store surviving a damaged frame and the other aspect still reading. 306 `weft-physical-type` and 400 `weftdb` lib tests pass.*

#### Legacy lane

**FRE-14** Legacy data-directory marker, numbered migrations and measurement upgrade test — *two of its three parts are in: 14a makes the build **refuse** a 0.1.x rows-mode directory instead of opening it as an empty store (`store_format`'s probe and the refusal at open), and 14b gives that tree a reader — `weftdb::rows_mode` discovers the series under `<subject>/<aspect>/measurements.db`, reads one subject into a store scoped to its `(database, subject)`, and records the reading in that store's own index under `rows_mode_import:<database>:<subject>`, which is what makes a second reading a refusal rather than a doubling of rows. `the_v010_rows_mode_tree_reads_into_a_store_of_its_own_database` takes the tree the release itself wrote and carries all 371 of its rows into a store of that tree's own database — 237 `price`, 54 `temp`, 80 `flow`, the non-null subset of `rows.csv`, each arriving at the instant its writer stamped, a thousand times the number the grid spells — and afterwards every file of the tree is still byte for byte what the release left. What remains is 14c: the route an operator runs, the numbered migrations that register `metadata.db`'s schema, and a reading of a tree too big to hold one aspect in RAM. One trap is pinned where the two trees meet: the same release stamped its rows-mode instants in **millis** (`v0.1.0:weftdb/src/types/database/inputs.rs:142`) and its Storage-v2 instants in **seconds** from the same value grid, so neither leg may read the unit off the numbers it is holding.*

#### → **EVI-4** Artifact pipeline

out-of-tree runs, real-volume temp dirs, argv execution, criterion import

#### **EVI-8A** Benchmark adapter v2 I

BenchSystem trait, lifecycle runner, process model

#### **W3 · Gate, serve path, input domain**

no gate of its own

#### Store lane

**D-S10** Write-once durable seal with id assigned at commit (+ contained frame/sidecar paths) — *reviewed; on `durability/base`, not yet on main*

#### → **D-S11** Rollup into segment_index.db, folded in the seal and swap transactions

*reviewed; on `durability/base`, not yet on main*

#### **ROB-6** Bounded decimals

the plain form is at most 1,024 digits, at every parse site (absorbs FRE-8a)

#### **EVI-8B** Benchmark adapter v2 II

agreement gate, engine provenance, f64 arm

#### **SOA-5** Soak ingest client

strict outcome classes, keyed retry, write-ahead ledger, receipts

#### **W4 · Auth, config, ILP fix**

no gate of its own

#### Store lane

**D-S12** Startup recovery, quarantine with TTL, fsck endpoint, /ready report (+ the C5 fault policy) — *in review, round 7*

#### **TAG-0** Fix ILP series merging

`measurement=` required (L-INGEST)

#### L-FMT: **ROB-8** Frame decode hardening

DecodeLimits from the request budget, cross-checks

#### **SOA-6** Soak oracle core

expected index, duplicate detectors, offline verify

#### **W5 · Ingest wiring, whole-store backup, legacy seal**

ticks **7.4 Whole-store backup manifest**

#### Store lane

**D-S16** Whole-store backup with hard-linked frames; restore_store and in-place restore with adoption

#### → **D-S15** Partial sidecar v4

CRC trailer, frame-stem naming, frame_crc stamp, tmp+rename, backfill

#### → **D-S19** Seal-backed legacy aspects

storage_mode, legacy ingest and reads through SegmentStore (store lane only if it edits the store)

#### L-INGEST

**D-S14** HTTP ingest wiring: Idempotency-Key, detached tasks, body limit, backpressure, graceful shutdown

#### **ROB-10** Admission I

route classes, per-class semaphores, PermitBody

#### **SEC-8** Startup ordering, exposure matrix, auth-off guard, metrics auth

*an interim loopback Host/Origin guard is on main (#66)*

#### → **SEC-10** Exposure and secrets hygiene

log sanitiser, umask, OTLP endpoint redaction

#### **EVI-13** DuckDB adapter I

weft-xbench crate, seeded lock, load and interpolation arms

#### **EVI-16** Honesty pages I

not the right tool, benchmark and accuracy methodology, precision

#### **W6 · Durability CI, store split, scheduler**

ticks **7.2 WAL & crash consistency** (crash matrix, kill test and power-loss run green; decision 20)

#### **SEC-7** Key reload

SIGHUP and the admin endpoint

#### **SEC-9** Audit

fsynced JSONL attempt/outcome log, detached audited execution, `weft_audit` events

#### → **ROB-11** Admission II

query timeout, work-bound CPU slots, Busy to 503, explicit runtime

#### **SOA-10** Derived-read checks

maintenance invariance, interpolation, downsample, compression

#### **SOA-14** Server hooks

build info, store identity and shutdown state on /ready; OTLP print redacted

#### **EVI-14** DuckDB adapter II

downsample, storage bytes, DECIMAL arm, nightly smoke

#### **W7 · Post-split lanes open; security and packaging close**

ticks **TLS on `weft-server`** and **API-key/token auth + basic RBAC + audit log** (SEC-13), **7.4 Documented RPO/RTO** (EVI-19), **Measurement bulk ingest routed through the `.weftseg` seal** (D-S19 + D-S20) and **First cross-engine report** (EVI-15; numbers regenerated in W14)

#### open lane

**TAG-5** Control-plane series schema, SeriesIntern, SeriesCatalog, layout stamp

#### seal lane

**D-S20** Change log replaces the per-timestamp unbatched queue for seal-backed aspects

#### read lane

**ROB-12** Bounded range and value-range reads, plus storage-read metrics

#### → **ROB-13** Bounded stored downsample and point lookups

corrected claims (absorbs EVI-24)

#### **ROB-7** Ingest decode bounds

row cap, decoded-byte weight, non-finite input is 400 (L-INGEST)

#### **ROB-23r** Probe-only admin listener

a directory-open error is Definite, not poison

#### **ROB-5** Legacy queue-consumer panics

legacy metadata writes wrapped

#### **SEC-13** Security acceptance

end-to-end run and overhead numbers

#### **EVI-15** First cross-engine report

WeftDB vs DuckDB (needs the reference host)

#### **EVI-19** Documented RPO/RTO

`docs/durability-and-recovery.md`

#### **W8 · Tags core, memory budget**

ticks **Honesty pages shipped** (EVI-17) and **Packaging** (PAC-2/9/11, the PAC-5b/6 config docs, PAC-10 after auth; wording per decision 21); SEC-14 refreshes **Security process**

#### open lane

**PAC-6** Library store options, generated configuration reference and registry scan

#### → **TAG-9** Frame error classes in recovery

fsck re-bind; restore adoption of series

#### seal lane

**TAG-7** Tagged seal in the library (gated) with series-scoped ledger

#### maint lane

**TAG-6** Series-partitioned maintenance with multi-plan swaps

#### read lane

**TAG-8** Library series reads: selector, single-series rule, read-time binding check (after TAG-7)

#### **FRE-9a** OpenAPI generated from code

framework, probes and compute endpoints

#### **EVI-17** Honesty pages II

when WeftDB wins, GPU tuning and economics

#### **W9 · Read semantics, limits, upgrade legs**

ticks **7.3 Corruption detection** (D-S12 + ROB-8/9/22), **Compatibility tests** (FRE-13 + PAC-14a) and **Upgrade/rollback procedure, exercised against the previous release** (PAC-14a legs A and C against v0.1.0; re-run on the rc in W14)

#### read lane

**X-READ** Read-time newer-wins merge across overlapping segments, per series

#### maint lane

**ROB-20** Maintenance resource limits, k-way merge, re-split of oversized frames

#### open lane

**ROB-22** Suspect-frame policy and background-decode crash-loop breaker

#### L-INGEST

**ROB-18** Two-phase ingest admission, total body deadline, panic mapping by phase

#### storage read handlers lane

**TAG-10** HTTP read surface: selectors on every read, /series, stats, freeze-time rename

#### **FRE-10a** Contract tests

probes, compute endpoints, metrics and roles

#### **SOA-16** Soak upgrade lane

previous on-disk generation to candidate under kills

#### **W10 · Tag gate flip, compaction closes**

ticks **7.5 Compaction** (ROB-21) and **Semver policy + `CHANGELOG.md`** (STABILITY.md + CHANGELOG since v0.1.0)

#### read lane

**ROB-15** Pagination contract freeze: append-tolerant cursor v1 (after TAG-10)

#### **PAC-15** Operator documentation

install paths, production checklist, honest status

#### **W11 · Contract candidate, beta tag, calibration**

ticks **7.6 Quotas/limits** (ROB-24 evidence), **B-tags** (TAG-12) and **Panic audit on server paths** (ROB-2/3/4 + ROB-24)

#### **FRE-9b** OpenAPI

storage and operator endpoints — the last change before the beta tag

#### Extend the release tag grammar to `vX.Y.Z-beta.N` (`TAG_RE` in `scripts/release/verify.sh` accepts only `vX.Y.Z` and `vX.Y.Z-rc.N` today, so a beta …

tag would fail the release workflow's verify job)

#### Approve and push the **v1.0.0-beta.1** tag on FRE-9b's merge *(owner)*

once the grammar accepts it, the release workflow runs on that tag push and drafts the beta release

#### → **SOA-17** Calibration on a pre-grown store, frozen acceptance profiles, `scripts/crash-soak.sh`

on the beta tag

#### **FRE-10b** Contract tests

storage and operator endpoints, plus coverage — tests and CI only, during calibration

#### → **FRE-16** CI compatibility gates

OpenAPI breaking-change check, fixture guard, golden coverage — tests and CI only, during calibration

#### **ROB-24** Limits and overload evidence

frozen configuration documentation

#### **W12 · Phase 7 acceptance**

ticks **Phase 7 acceptance run**

#### **W13 · Freeze**

ticks **Public surface declared and frozen**; **Legal review** must be closed before the cut

#### **FRE-18** rc.1 freeze cut and layout-2 baseline fixtures

the OpenAPI breaking-change check blocks

#### Approve and push the **v1.0.0-rc.1** tag on FRE-18's merge *(owner)*

the release workflow runs on that tag push and drafts rc.1

#### **W14 · RC verification on release artifacts**

ticks **Every performance claim in the README links to a benchmark artifact**; re-confirms **Upgrade/rollback procedure** and refreshes **First cross-engine report**

#### **EVI-21** 1.0 evidence run at the rc

strict claims, cross-engine matrix re-run

#### **PAC-18** Dress rehearsal

compatibility matrix with the N-1 leg, container and systemd jobs on the rc

#### **W15 · 1.0.0**

ticks **README *Project status* table updated to reflect 1.0** and closes **Semver policy + `CHANGELOG.md`**

#### → **PAC-18** Cut 1.0.0

binaries, image, release notes

#### Approve and push the **v1.0.0** tag *(owner)*

the release workflow runs on that tag push and drafts the 1.0.0 release
