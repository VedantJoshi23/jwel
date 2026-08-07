---
id: STD-DATABASE
title: Jwel / ELYSIAN — Standard: Database
version: 1.0.0
status: Frozen
owner: Architecture
reviewers:
  - Vedant
created: 2026-08-07
updated: 2026-08-07
milestone: M4
category: Standards
priority: Critical
depends_on:
  - CONSTITUTION
  - STD-000
required_by: []
related_decisions:
  - ADR-0014
  - ADR-0015
tags:
  - standards
  - database
risk: High
complexity: Medium
---

# STD-DATABASE

## Scope

Schema design, migrations and data access against PostgreSQL via Prisma.

**Not covered:** index tuning for latency (`STD-PERFORMANCE`), access control
(`STD-SECURITY`).

`DISC-005` rated the existing schema the strongest artifact in the project
(95%). **These rules are largely a transcription of conventions already held
without exception** — the value is making them binding for the next 27 models,
not changing the first 27.

## Rules

1. **Money is stored as integer minor units (paise). Never float or decimal.**
   *Rationale:* KC-131. Floating-point currency is a correctness bug that
   surfaces as pennies and ends as reconciliation work.

2. **Historical boundaries snapshot; they do not reference.** An order stores
   what was sold — name, variant, unit price, shipping address — not foreign
   keys to mutable rows.
   *Rationale:* KC-132. Otherwise renaming a product silently rewrites order
   history, and the original values are unrecoverable.

3. **History is append-only.** Status histories, redemptions, view logs and
   audit entries are inserted, never updated or deleted.
   *Rationale:* KC-133. `CouponRedemption` also makes limits enforceable by
   `COUNT()` rather than a mutable counter, which is what makes concurrent
   checkout safe.

4. **An invariant goes in the database where it can be expressed** — CHECK
   constraint, unique constraint, or a predicate in the `WHERE` clause of a
   conditional `UPDATE`. **This is Constitution Law 4.**
   *Rationale:* KC-134, KC-183. Application-layer enforcement fails silently
   and corrupts data.

5. **Check-then-act against shared state is written as one conditional
   `UPDATE`,** carrying the invariant in its `WHERE` clause.
   *Rationale:* KC-183, the reference pattern. A read followed by a write has a
   race between them; a conditional update does not.

6. **Where Prisma cannot express a constraint, the limitation is documented in
   the schema and the enforcing service named.**
   *Rationale:* KC-143. The gap is then visible rather than assumed closed.

7. **Raw SQL is permitted and must be justified in place.** Currently: CHECK
   constraints, the reservation updates, and `searchVector` with its GIN index.
   *Rationale:* KC-144 — the `searchVector` index is invisible to Prisma's
   drift detection, which is a real cost that must be a conscious one.

8. **Primary keys are UUID; user-visible entities soft-delete.**
   *Rationale:* UUIDs avoid enumeration on public order and product URLs;
   soft delete keeps historical orders referentially intact after a product is
   delisted.

9. **A denormalised aggregate has exactly one owning context and an idempotent
   recompute that can run in bulk.**
   *Rationale:* KC-142 and `ADR-0008`. `Product.avgRating` had two owners and
   could desync silently while feeding search ranking. Bulk recompute is what
   survives a seed script or CSV import bypassing the service.

## Examples

**Compliant** — the invariant is in the predicate, so an oversell cannot occur:

```sql
UPDATE inventory_items
   SET quantity_reserved = quantity_reserved + $2
 WHERE variant_id = $1
   AND (quantity_on_hand - quantity_reserved) >= $2
```

**Non-compliant** — a race lives between the two statements:

```ts
const inv = await prisma.inventory.findUnique({ where: { variantId } });
if (inv.quantityOnHand - inv.quantityReserved >= qty) {
  await prisma.inventory.update({ ... });   // another checkout may have won
}
```

## Exceptions

Rule 4 yields where Prisma genuinely cannot express the constraint — then
rule 6 applies: document it and name the enforcing service. Two such cases
exist (`ProductView`'s XOR, `Coupon.value`'s type-dependent meaning).

## Enforcement

- Rules 1, 2, 3, 8: **schema review.** Visible in `schema.prisma` on read.
- Rules 4, 5, 9: **human review**, and the highest-value thing to look for in
  any PR touching stock, money or aggregates.
- Rule 7: visible in migration diffs.
- No automation proposed. These are design judgements; a linter would produce
  false confidence.
