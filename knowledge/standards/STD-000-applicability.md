---
id: STD-000
title: Jwel / ELYSIAN — Standards Applicability
version: 1.0.0
status: Frozen
owner: Architecture
reviewers:
  - Vedant
created: 2026-08-07
updated: 2026-08-07
milestone: M4
category: Standards
priority: High
depends_on:
  - CONSTITUTION
  - ARCH-001
required_by: []
related_decisions:
  - ADR-0011
  - ADR-0014
tags:
  - standards
  - applicability
risk: Low
complexity: Low
---

# STD-000 — Standards Applicability

`OV-005` requires an explicit applicability decision for every candidate
category. **Silence is not a valid answer** — a category is either
Applicable-with-justification or Not-Applicable-with-reason.

This document is that determination. It is the index for the Standards series.

**Frozen 2026-08-07** — M4 complete. All ten Standards Frozen at v1.0.0.
Standards revise by version bump thereafter (see Lifecycle), unlike the
Constitution.

## Determination

| Category | Decision | Trigger / reason |
| --- | --- | --- |
| **Code** | **Applicable** — `STD-CODE` | Always applicable per `OV-005` |
| **Testing** | **Applicable** — `STD-TESTING` | Always applicable |
| **Security** | **Applicable** — `STD-SECURITY` | Always applicable; this system takes payments and holds PII |
| **API** | **Applicable** — `STD-API` | `ARCH-001` §1 declares external-facing boundaries; 83 HTTP endpoints (KC-093) |
| **Database** | **Applicable** — `STD-DATABASE` | `ADR-0014` records PostgreSQL as the datastore |
| **CI/CD** | **Applicable** — `STD-CICD` | The project ships; `ADR-0017` records the deployment target |
| **Observability** | **Applicable** — `STD-OBSERVABILITY` | Constitution §2 rigor is Enterprise-grade, which includes it by definition |
| **Performance** | **Applicable** — `STD-PERFORMANCE` | `ARCH-001` §5 declares a non-trivial growth path, and NFR-1 names targets (KC-073) |
| **Accessibility** | **Applicable** — `STD-ACCESSIBILITY` | `ARCH-001` §4 includes a user-facing UI layer; NFR-5 commits to WCAG 2.1 AA |
| **SEO** | **Applicable** — `STD-SEO` | Public, crawlable, server-rendered storefront; NFR-7, and SEO is the stated primary acquisition channel |

**All ten are applicable.** That is the honest outcome for a full-stack,
public, payment-taking e-commerce product, not a failure to narrow. No category
is skipped, so no skip-reason is required.

## What this does *not* mean

Applicability is not a licence for volume. `OV-005`'s necessity bar applies
**within** each Standard:

> Would inconsistency here cause friction or rework across more than one
> contributor or session? If yes, write it down. If it is a one-off preference
> with no real consistency cost, it does not need a Standard.

Several Standards below are consequently short. A Standard that restates
general good practice adds noise and dilutes the ones that carry real project
conventions.

## Relationship to the Constitution

Constitution §5.1 explicitly deferred six Keep items from Discovery to
Standards rather than promoting them to Laws. Those are the seed content:

| Deferred item | Lands in |
| --- | --- |
| Uniform module/controller/service/dto/spec shape (KC-064) | `STD-CODE`, `STD-API` |
| Co-located tests and coverage thresholds (KC-198, KC-204), plus payment-path e2e (KC-202) | `STD-TESTING` |
| Snapshot-at-boundaries and append-only ledgers (KC-132, KC-133) | `STD-DATABASE` |
| Ports and adapters confined to vendor boundaries (KC-155) | `STD-API` |
| Layered security posture and defence in depth (KC-166–168) | `STD-SECURITY` |
| Graceful degradation, e.g. Elasticsearch → Postgres | `STD-API`, `STD-PERFORMANCE` |

**No Standard may contradict a Law.** Per `OV-005`, a conflict found while
drafting is surfaced as a candidate Constitution amendment, never resolved in
the Standard's favour. None was found.

## Series index

| Standard | Priority | Note |
| --- | --- | --- |
| `STD-CODE` | High | Strictness, suppressions, module shape, dead code |
| `STD-API` | High | Versioning, DTOs, error envelope, pagination, Law 5 at the API layer |
| `STD-DATABASE` | Critical | Money, snapshots, ledgers, invariants-in-DB, conditional UPDATE |
| `STD-TESTING` | High | Co-location, 90% gates, exclusion policy, payment-path e2e |
| `STD-SECURITY` | Critical | Guards, boot-time secret validation, defence in depth, audit log |
| `STD-CICD` | High | What CI must verify — **including lint, which runs nowhere today** |
| `STD-OBSERVABILITY` | Critical | Pre-existing; adopted and reconciled, not rewritten |
| `STD-PERFORMANCE` | Medium | Deliberately short — targets are unmeasured |
| `STD-ACCESSIBILITY` | High | WCAG 2.1 AA; **nothing is verified today** |
| `STD-SEO` | High | SSR, structured data, sitemap/robots, noindex until go-live |

## Standards that record a gap rather than a convention

Three Standards state plainly that they cannot currently be enforced. That is
deliberate — per Constitution Law 1, a Standard claiming enforcement it does
not have would be the same defect it exists to prevent:

- **`STD-ACCESSIBILITY`** — no automated check of any kind exists (KC-171).
- **`STD-PERFORMANCE`** — no load test, budget or synthetic check exists
  (KC-172).
- **`STD-SECURITY`** — no dependency vulnerability scanning exists.

## Lifecycle

Standards revise by version bump — the ordinary specification lifecycle, *not*
the Constitution's ADR-plus-remediation bar. They are meant to evolve as the
project learns. Laws are not.

## Pre-existing Standard

`STD-OBSERVABILITY` was authored pre-Oriveda (2026-07-09, `status: Proposal`).
It is **adopted rather than rewritten**, reconciled against `DISC-007`'s
measured findings and moved into this series. Per `ADR-0007` its body is not
rewritten to match; where reality diverged, the reconciliation is recorded in
the document's own header note.
