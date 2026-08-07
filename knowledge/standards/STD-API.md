---
id: STD-API
title: Jwel / ELYSIAN — Standard: API
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
  - ADR-0008
  - ADR-0012
tags:
  - standards
  - api
risk: Medium
complexity: Medium
---

# STD-API

## Scope

The HTTP surface of `apps/api`, and interaction between bounded contexts.

**Not covered:** authentication mechanics (`STD-SECURITY`), query performance
(`STD-PERFORMANCE`).

## Rules

1. **Routes are versioned under a global prefix** (`/api/v1`), set once in
   `main.ts` rather than per controller.
   *Rationale:* a version baked into individual routes cannot be changed
   uniformly.

2. **Admin routes are prefixed `admin/` and role-guarded.**
   *Rationale:* ~30 admin endpoints already follow this (KC-094); the prefix is
   what makes "is this surface privileged?" answerable by reading the path.

3. **Request bodies are DTOs validated by the global `ValidationPipe`.** No
   controller parses raw input.
   *Rationale:* a single validation layer means one place to audit. 34 DTO
   files already exist.

4. **Errors return the standard envelope** produced by `AllExceptionsFilter`.
   Controllers do not hand-craft error shapes.
   *Rationale:* the web client parses one shape (`ApiErrorEnvelope`).

5. **List endpoints paginate** using the shared `PaginationQueryDto`, returning
   `{ items, page, pageSize, total }`.
   *Rationale:* the catalog is already 1,047 products (KC-030); unbounded list
   endpoints are a latent outage.

6. **Cross-context interaction is command in, event out** — a context calls the
   owning context's service and the owner emits its own event. **This is
   Constitution Law 5**, restated here because it is where API authors meet it.
   *Rationale:* `ADR-0008`. The one violation produced a correctness bug in a
   different context (KC-142, KC-152).

7. **Ports and adapters are used only at vendor boundaries** — currently
   payments and storage.
   *Rationale:* KC-155. Abstracting elsewhere adds indirection with no
   portability benefit; NFR-9 asks for portability where a vendor exists, not
   everywhere.

8. **An external dependency that can be unavailable has a defined degraded
   path**, and that path is exercised.
   *Rationale:* Elasticsearch degrades to Postgres, and CI proves it by
   pointing at a dead node (KC-059). A fallback nobody exercises does not work.

## Examples

**Compliant** — Reviews asks Catalog to recompute; Catalog owns write and event:

```ts
// reviews.service.ts
await this.catalogRating.recompute(productId);   // command in
// catalog emits `product.upserted` itself       // event out
```

**Non-compliant** — Reviews writes another context's table and emits its event:

```ts
await this.prisma.product.update({ where: { id }, data: { avgRating } });
this.eventBus.emit('product.upserted', { productId: id });
```

## Exceptions

A context may **read** another context's tables where the alternative is worse
coupling — `coupons` reads `order` for first-order eligibility (KC-157), and
Reporting reads across all contexts by design. **Writes are never excepted.**
A read exception is documented at the call site.

## Enforcement

- Rules 1, 3, 4, 5: enforced structurally by NestJS configuration; a violation
  generally fails a test.
- Rule 2: human review; a missing `@Roles` decorator is the failure mode, and
  `apps/web/e2e/admin.spec.ts` covers the redirect path.
- Rules 6, 7, 8: **human review only.** No lint rule detects a cross-context
  Prisma write. `DISC-006`'s three-signal method (imports, events, table
  access) is the audit if one is needed.
