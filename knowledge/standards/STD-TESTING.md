---
id: STD-TESTING
title: Jwel / ELYSIAN — Standard: Testing
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
  - STD-000
required_by: []
related_decisions:
  - ADR-0010
tags:
  - standards
  - testing
risk: Medium
complexity: Medium
---

# STD-TESTING

## Scope

Unit, integration and end-to-end testing across both apps, and the coverage
gates in CI.

**Not covered:** what CI runs and when (`STD-CICD`), accessibility checks
(`STD-ACCESSIBILITY`).

## Rules

1. **Tests are co-located with their subject** — `x.service.spec.ts` beside
   `x.service.ts`.
   *Rationale:* KC-025, KC-065. Every one of the 22 API modules carries at
   least one spec. Co-location is what keeps tests updated with the code.

2. **Coverage gates stay at 90%** for statements, branches, functions and
   lines, on both apps.
   *Rationale:* KC-198. Measured web coverage is 96.98% (KC-204), so the gate
   is a floor, not a ceiling being scraped.

3. **Coverage exclusions are for generated or type-only files, never for code
   that is merely hard to test.** If code cannot justify a test, delete it.
   *Rationale:* KC-199 — an exclusion added for a plausible reason concealed
   145 lines of dead code for months. This is the rule that finding produced.

4. **The payment path has automated end-to-end coverage:** checkout → payment →
   confirmation.
   *Rationale:* KC-121, KC-202. CI already runs a real stack; the one journey
   the business cannot afford to break silently was the one not driven.

5. **A degraded path is tested in the degraded state.**
   *Rationale:* KC-059 — CI points Elasticsearch at an unreachable node so the
   Postgres fallback is genuinely exercised.

6. **A bug fix adds the test that would have caught it.**
   *Rationale:* the ordinary ratchet; cheap at the moment of the fix and
   expensive later.

7. **Test doubles for external vendors live behind the same port as the real
   adapter** — e.g. `MockPaymentProvider` resolving when `NODE_ENV` is not
   production.
   *Rationale:* keeps CI free of vendor credentials and matches `STD-API`
   rule 7's ports-and-adapters confinement.

## Examples

**Compliant** — the exclusion list covers only generated and type-only files:

```ts
coverage: { exclude: ['lib/api/types.ts', '**/*.d.ts'] }
```

**Non-compliant** — excluding real components because testing them is awkward:

```ts
coverage: { exclude: ['components/cinematic/**', 'components/vision/**'] }
```

## Exceptions

A temporary exclusion is permitted while a subsystem is actively being written,
and must carry a comment naming the condition for its removal. An exclusion
with no removal condition is rule 3's failure mode.

## Enforcement

- Rules 1, 2, 3: **CI**, via the Jest and Vitest coverage thresholds.
- Rule 4: **CI**, once the specs exist — currently outstanding (KC-202).
- Rules 5, 6, 7: **human review.**
- Note: the API's thresholds are declared `global`, so coverage is aggregate
  rather than per file (KC-198). Its achieved figure is unmeasured; measuring
  it is a cheap check worth doing once.
