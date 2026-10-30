---
title: "Phase 8 — Commercial hardening — notes"
summary: "The prose, findings and finished-work write-ups that sit behind the roadmap checklist for this section."
order: 19
group: Roadmap notes
---

# Phase 8 — Commercial hardening — notes

*The checklist for this section is in the [roadmap](https://github.com/basic-automation/weftdb/blob/main/ROADMAP.md). What follows is the writing that used to sit between its items.*

**Acceptance:** a design partner can deploy WeftDB, ingest, run Weft-Bench, inspect
metrics, recover from a restart, and file useful support tickets.

## Security

TLS, API keys/token auth, basic RBAC, service accounts, secrets, encryption at rest, audit logs, vuln process

## Compliance readiness

SOC 2, HIPAA (where targeted), GDPR delete/export, retention, tenant isolation

## Packaging

static binaries, Docker, Compose, Helm (later), systemd, config schema, migration/upgrade/rollback

## Observability

Prometheus, Grafana, OTel, structured logs, bench dashboard, query profiles

## Licensing/legal

open-core vs commercial, comparative-benchmark terms, kdb+ restrictions, dependency + codec licenses, customer-data handling, trademark use. **Owner decisions 2026-10-08:**

## **Licence: `MIT OR Apache-2.0`**, the Rust ecosystem's dual licence, for every WeftDB crate

`LICENSE-MIT` and `LICENSE-APACHE` at the root and in every crate, `license = "MIT OR Apache-2.0"` in `[workspace.package]`. Earlier commits remain available under MIT. `splimes` (its own repository) stays MIT.

## **Copyright holder: Justin Icenhour**, as an individual, and the only one

His employer has signed off. Every commit so far is his (some carry `test@example.com` as the author email; AI-co-authored commits carry Claude trailers). No crate was on crates.io yet, so relicensing needed no one else's consent.

## **Contribution terms: DCO or CLA, the contributor's choice.**

`git commit -s` on every commit, or the CLA ([`CLA.md`](https://github.com/basic-automation/weftdb/blob/main/CLA.md)), version 1, adapted from the ASF ICLA, with Justin Icenhour as the counterparty) signed once by a pull request comment. Contributions are licensed `MIT OR Apache-2.0`. The `contribution-terms` workflow passes a pull request when either holds; see [CONTRIBUTING.md](https://github.com/basic-automation/weftdb/blob/main/CONTRIBUTING.md#contribution-terms)).

## **Enforce it (owner, once on main):**

create the `cla-signatures` branch with `signatures/cla/v1.json`, tag the main commit carrying CLA.md version 1 as `cla-v1` and protect the tag with a ruleset (commands in the workflow's header), then require the `contribution-terms` check in branch protection.

## **kdb+/KDB-X: excluded from published benchmarks** unless KX consents in writing

See the [Legal review](https://github.com/basic-automation/weftdb/blob/main/ROADMAP.md#legal-review).

## **Codec patents: gate the flagged opt-in codecs.**

The advisory float/timestamp codecs are behind `experimental-codecs` and the bit-sliced value codec behind `bitsliced-codec` (the [Phase 6.1 codec gate](https://github.com/basic-automation/weftdb/blob/main/ROADMAP.md#phase-6--compression-v2--high)).

## **With counsel:**

Amazon US 11,308,093 against the default FOR codec; the Tiger Data family (both ingest paths); the SAP family, before the Phase 6.2 design; **WEFTDB** trademark clearance; the benchmark policy — which competitor editions may be run and published, dataset redistribution, and the claims wording; the package licence expression for the two crates with adapted code, `(MIT OR Apache-2.0) AND Apache-2.0` ([Phase 6.1](https://github.com/basic-automation/weftdb/blob/main/ROADMAP.md#phase-6--compression-v2--high)); CLA v1 — a successors-and-assigns clause and any outbound-licence undertaking, before the CLA is enforced.

## Still open

open-core vs commercial split; customer-data handling.
