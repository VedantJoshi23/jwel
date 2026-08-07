---
id: DOM-IDENTITY
title: 'Jwel / ELYSIAN — Domain: Identity & Access'
version: 1.0.0
status: Frozen
owner: Architecture
reviewers:
  - Vedant
created: 2026-08-07
updated: 2026-08-07
milestone: M5
category: Domains
priority: Critical
depends_on:
  - ARCH-001
  - CONSTITUTION
required_by: []
related_documents:
  - DISC-005
  - DISC-008
related_decisions:
  - ADR-0006
tags:
  - domain
  - identity
risk: High
complexity: Medium
---

# DOM-IDENTITY

**Depth tier: Full** — owns authentication, roles and customer records.

## 1. Overview

Identity & Access owns who a user is, how they prove it, and what role they
hold. Every guarded surface in the system depends on it, and it depends on
nothing.

## 2. Ownership

**Owns** — `User`, `OAuthAccount`, `Address`, `Role` assignment,
authentication, session and token issuance, account suspension.

**Explicitly does NOT own** — what a user bought (Ordering); their cart or
wishlist (Shopping); their reviews (Reviews); the shipping address *on an
order*, which is an immutable snapshot Ordering owns.

## 3. Invariants

| # | Invariant | Source |
| --- | --- | --- |
| 1 | Roles are `CUSTOMER`, `STAFF`, `ADMIN`. There is **no merchant or seller role**, by decision. | KC-082, KC-089, `ARCH-001` §1.4 |
| 2 | Checkout requires an authenticated user — **guest checkout does not exist**, deliberately. | KC-125, KC-140 |
| 3 | Users **soft-delete**; historical orders, reviews and audit entries keep referential integrity. | KC-132 |
| 4 | An audit entry survives deletion of its actor — the `AuditLog` actor FK deliberately has no cascade. | KC-133 |
| 5 | Passwords are stored hashed (bcrypt); no credential is ever logged or exposed. | `STD-SECURITY` |
| 6 | JWT secrets are validated at boot for length and against known placeholders; the process refuses to start otherwise. | KC-168 |
| 7 | Authentication preserves intent — a redirect to login carries `next=` and returns the user where they were going. | KC-009 |
| 8 | Email is unique per user; OAuth accounts link to an existing user rather than creating a duplicate. | schema |

**Invariant 2 is a business decision, not a technical limitation** (KC-125):
requiring registration grows the customer database and enables post-checkout
functionality. `PRODUCT.md` FR-1's guest-checkout clause is superseded by it.

## 4. API Surface

**Public** — `POST /auth/register`, `POST /auth/login`, OAuth start and
callback for Google, Facebook and Apple.
**Authenticated** — `GET /me`, `PATCH /me`, address CRUD under `/me/addresses`.
**Admin** — `GET /admin/users`, `PATCH /admin/users/:userId/suspend`.

## 5. Events

**Publishes** — none. **Consumes** — none.

Identity is outside the event graph. Nothing in the system reacts to a user
being created; if a welcome message is ever wanted, that would be a new event
and a new decision.

## 6. Data Ownership

`users` (unique email; soft delete), `oauth_accounts`, `addresses`.

## 7. Dependencies

**Allowed** — audit log; metrics.

**Forbidden** — reading or writing any other context's tables. Identity is the
system's most depended-upon context and must remain its least dependent.

## 8. Edge Cases & Validations

1. **OAuth email matches an existing password account.** Must link, not
   duplicate (Invariant 8). The failure mode is two accounts and a customer who
   cannot find their orders.
2. **Suspended user with an in-flight order.** Suspension blocks access; it
   must not corrupt or cancel the order.
3. **Soft-deleted user's reviews and orders.** Remain, per Invariant 3. Their
   **name is not displayed on public reviews** — `DOM-REVIEWS` Invariant 8
   renders them anonymously, keeping the content and the verified badge. Orders
   are unaffected, being admin-only.
4. **Guest fills a cart then registers.** The cart transfers
   (`DOM-SHOPPING` inv. 6). This is the funnel Invariant 2 depends on.
5. **Login inside checkout** (`/login?next=/checkout`). Intent is preserved
   (Invariant 7), and may additionally trigger the cart-merge prompt
   (`DOM-SHOPPING` inv. 17).
6. **Placeholder JWT secret in production.** The process refuses to start
   (Invariant 6).

## Constitution compliance

Law 1 — Invariant 2 states guest checkout does not exist rather than leaving
FR-1's claim standing. Law 2 — sourced. Law 4 — Invariants 6 and 8 fail at boot
or at the database. Law 5 — no cross-context access at all.

## Open items

- ~~Edge case 3~~ — settled 2026-08-07: anonymous display
  (`DOM-REVIEWS` inv. 8).
- **Soft delete is not erasure.** A deleted user's PII remains in `users`. If a
  genuine erasure request ever arrives, a scrubbing path would be needed and
  none exists. Recorded, not solved.
