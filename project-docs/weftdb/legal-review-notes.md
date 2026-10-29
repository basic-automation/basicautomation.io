---
title: "Legal review — notes"
summary: "The prose, findings and finished-work write-ups that sit behind the roadmap checklist for this section."
order: 26
group: Roadmap notes
---

# Legal review — notes

*The checklist for this section is in the [roadmap](https://github.com/basic-automation/weftdb/blob/main/ROADMAP.md). What follows is the writing that used to sit between its items.*

*Before publishing comparative results. The research and business notes this belongs to are in the [docs](/projects/weftdb/docs/research-and-business-notes).*

## Review each competitor's benchmark-publication terms (kdb+ especially)

disclose configs; include reproduction instructions; check dependency + **compression-codec patents/licenses**; document trademark usage; clarify whether benchmark data may be redistributed

## **kdb+/KDB-X (owner decision 2026-10-08): excluded from every published benchmark unless KX consents in writing.**

No published report, README figure or claim may include a kdb+/KDB-X result without that consent on file.

## **WeftDB's own terms (2026-10-08):**

`MIT OR Apache-2.0`; contributions by DCO sign-off or the CLA; sole copyright holder Justin Icenhour, with his employer's sign-off. Detail under [Phase 8](https://github.com/basic-automation/weftdb/blob/main/ROADMAP.md#phase-8--commercial-hardening--required-for-paid-beta).

## **Codec patents (2026-10-08):**

the flagged opt-in codecs are gated (`experimental-codecs`, `bitsliced-codec`); the default FOR codec stays ungated pending counsel (the [Phase 6.1 codec gate](https://github.com/basic-automation/weftdb/blob/main/ROADMAP.md#phase-6--compression-v2--high)).

## **Open with counsel:**

Amazon FOR (US 11,308,093), Tiger Data, SAP (before Phase 6.2), **WEFTDB** trademark clearance, and the benchmark policy: which competitor editions may be run and published, whether the datasets may be redistributed, and the wording of claims. Also the package licence expression for `weft-physical-type` and `weft-reduce`, and CLA v1's successors-and-assigns clause and any outbound-licence undertaking.
