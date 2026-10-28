---
id: ADR-0031
title: Shared Services Are Implicitly Allowed; What Counts as Boundary Evidence
version: 0.2.0
status: Accepted
owner: Architecture
reviewers:
  - Vedant
created: 2026-10-28
updated: 2026-10-28
milestone: M8
category: Decisions
priority: High
depends_on:
  - ARCH-001
  - CONSTITUTION
required_by: []
related_documents:
  - DOM-CONTENT
  - DOM-RECOMMENDATION
  - DOM-SHOPPING
  - DOM-PRODUCT-QA
  - DOM-ORDERING
  - DOM-SHIPPING
related_decisions:
  - ADR-0008
  - ADR-0030
related_domains: []
related_features: []
tags:
  - decision
  - architecture
  - boundaries
risk: High
complexity: Low
---

# ADR-0031 — Shared Services Are Implicitly Allowed; What Counts as Boundary Evidence

## Context

The first `oriveda check boundaries` run against jwel (2026-10-28) reported
seven context → shared-service edges absent from the depending context's
`DOM-*` §7: Content → Settings; Recommendation → Settings, Storage;
Shopping → Storage; Product Q&A → Storage; Ordering → Metrics; Shipping →
audit-log, Settings.

The Frozen corpus is inconsistent rather than wrong: Catalog, Content,
Identity, Payments, Returns and Reviews list some shared services in §7; the
rest list none. `ARCH-001` §1.2 already says what these services are — they
"own no business concept and are imported by many contexts" — but never says
whether §7 must enumerate them.

The same run showed two further gaps: the composition root and cross-DTO test
files read as cross-context edges, and the engine could not see a planted
cross-context table write or event emission, because both go through
`PrismaService` / `EventBusService` — shared infrastructure.

## Decision

1. **Every context may use every `ARCH-001` §1.2 shared service** (`audit-log`,
   `metrics`, `storage` with its HTTP face `uploads`, `settings`, `health`)
   without listing it. A `DOM-*` §7 states **context-to-context** dependencies.
   Existing shared-service mentions in Frozen §7s are redundant, not wrong, and
   are left as written (`ADR-0007`: no rewrite for its own sake).
2. **The allowance holds only while shared services depend on no context.**
   Shared services and `common/` may import shared services, never a context
   module. `ARCH-001` §1.2's ownership split still binds inside the allowance:
   a context reads only the `settings` keys whose meaning its own `DOM-*` owns.
3. **Entrypoints are outside every context.** They wire or invoke context
   code by design, and boundary checks exclude them:
   - the composition root: `app.module.ts` and `main.ts`;
   - operational scripts: `src/prisma/seed*.ts`, `src/prisma/normalise-*.ts`
     and `apps/api/scripts/**`. They reuse a context's own code, e.g. Catalog's
     `deriveRating`, precisely so that no second copy exists (`ARCH-001` A3).

   *v0.2.0, 2026-10-28:* operational scripts were added after the
   policy-faithful boundary run flagged `seed-demo.ts` and
   `normalise-variant-sizes.ts` importing Catalog. v0.1.0 named only the
   composition root.
4. **`*.spec.ts` files are excluded from boundary checks**, as
   `common/architecture.spec.ts` already does. A test may legitimately
   construct across contexts — `common/validation/address.spec.ts` checks three
   contexts' address DTOs together *because* an address crosses them at
   checkout.
5. **Law 5 evidence is `common/architecture.spec.ts`, not the import graph.**
   It now holds closed table-, event- and module-ownership maps covering every
   context. A new Prisma model, domain event or module directory fails the build
   until it is assigned an owner. A clean `oriveda check boundaries` run is
   evidence for §7 dependency *direction* only.

## Consequences

- No Frozen `DOM-*` needs amending for the seven reported edges. The two
  Shipping edges stop being divergences under rule 1 (logged as `DIV-001`,
  `DIV-002`, resolved `spec-updated` by this ADR).
- Rule 2 is enforced, not asserted: a structural test fails if a shared module
  or a `common/` file imports a context.
- The ownership maps make a new table an architecture decision by force. That
  friction is the point. It is also a maintenance cost on every schema change.
- Known blind spots, stated in the test file: nested Prisma writes, raw SQL
  outside `inventory`, and a delegate reached through an alias are not
  attributed.

## Required Updates (applied 2026-10-28)

- **`ARCH-001` → v1.5.0, Amendment A5** (shared with `ADR-0030`, `ADR-0032`).
  §1.2 gains:
  > Every context may use these services without listing them in its `DOM-*`
  > §7, which states context-to-context dependencies only. The allowance holds
  > because they depend on no context; neither they nor `common/` may import a
  > context module (`ADR-0031`). Entrypoints — `app.module.ts`, `main.ts` and
  > the operational scripts — belong to no context.

  §1.3's last paragraph: replace "fails the build if any module outside Catalog
  writes the product row…" with "holds a table-, event- and module-ownership
  map for every context and fails the build on a write, emission or import that
  crosses one (`ADR-0031`)".

## Remediation

`common/architecture.spec.ts` gains eight tests. Both planted violations from
the Oriveda review, and a planted shared → context import, fail it.
`DIV-001`/`DIV-002` resolve `spec-updated` by rule 1.

## Alternatives Considered

- **Every §7 lists every shared service it uses.** Rejected: six Frozen
  amendments now, and one more on every incidental `MetricsService` injection.
  It records how a module is wired, not a boundary.
- **Treat shared services as contexts.** Rejected by `ARCH-001` §1.2 itself:
  that implies ownership they do not have.

## Revisit Criteria

- A shared service gains business logic, or needs to import a context → it is
  a context, and goes through `ARCH-001` like Product Q&A did (A4).
- The engine learns to attribute Prisma delegate and event-bus calls → rule 5
  can cite it alongside the structural test.
