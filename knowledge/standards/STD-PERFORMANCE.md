---
id: STD-PERFORMANCE
title: Jwel / ELYSIAN — Standard: Performance
version: 1.0.0
status: Frozen
owner: Architecture
reviewers:
  - Vedant
created: 2026-08-07
updated: 2026-08-07
milestone: M4
category: Standards
priority: Medium
depends_on:
  - CONSTITUTION
  - STD-000
required_by: []
related_decisions:
  - ADR-0010
  - ADR-0016
tags:
  - standards
  - performance
risk: Medium
complexity: Medium
---

# STD-PERFORMANCE

## Scope

Query and page performance, and the growth path in `ARCH-001` §5.

**Not covered:** availability (`ADR-0010`), infrastructure sizing.

**This Standard is deliberately short.** NFR-1's targets have never been
measured (KC-172), and writing detailed rules against unmeasured targets would
be exactly the claim/reality gap Law 1 forbids. It states what is known and what
must be measured before more is written.

## Rules

1. **A new read path on a growing table ships with an index chosen for it**, or
   a stated reason it does not need one.
   *Rationale:* KC-135 — existing indexes were chosen against named access
   patterns (BRIN on `Order.createdAt` for reporting, GIN trigram on product
   name, composites for the PDP review path). The convention is deliberate
   choice, not blanket indexing.

2. **List endpoints paginate** — restated from `STD-API` rule 5 because it is
   the most common performance failure.
   *Rationale:* 1,047 products already (KC-030).

3. **Search load stays off the transactional primary** where Elasticsearch is
   available, with the Postgres path as the degraded fallback.
   *Rationale:* `ADR-0016`; `ARCHITECTURE.md`'s original reasoning — "search
   traffic spikes don't degrade transactional DB".

4. **A denormalised aggregate exists to avoid a known expensive query, and says
   which one.**
   *Rationale:* `Product.avgRating` avoids a COUNT/AVG over reviews on every
   PLP and PDP read; `ProductCoOccurrence` avoids a self-join across all order
   history. Both are documented in the schema. An undocumented denormalisation
   is a correctness risk with no stated benefit (see `STD-DATABASE` rule 9).

5. **A performance claim is measured before it is made.** No NFR target,
   runbook line or client-facing statement asserts a latency or throughput
   figure that has not been observed.
   *Rationale:* **Constitution Law 1.** NFR-1's P95 < 2.5s and sub-300ms search
   have never been measured (KC-172), and NFR-2's 99.9% was withdrawn by
   `ADR-0010` for precisely this reason.

## Examples

**Compliant** — the index names the access pattern it serves:

```prisma
// PDP read path: approved reviews for a product, newest first.
@@index([productId, moderationStatus, createdAt(sort: Desc)])
```

**Non-compliant** — a target asserted with nothing behind it:

```md
NFR-1: P95 page load < 2.5s on 4G.   <!-- never measured -->
```

## Exceptions

None. Rule 5 has no exception; an unmeasured performance claim is a Law 1
violation regardless of how confident the author is.

## Enforcement

- Rules 1–4: **human review**, visible in schema and migration diffs.
- Rule 5: **human review**, and enforced at launch by `RUNBOOK` step 0.
- **Gap:** no load testing, synthetic checks or performance budget exist
  (KC-172). Until one does, this Standard cannot be enforced by CI, and says so
  rather than implying it can.
