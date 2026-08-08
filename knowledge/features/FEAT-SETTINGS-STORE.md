---
id: FEAT-SETTINGS-STORE
title: 'Jwel / ELYSIAN — Feature: Admin-Editable Settings Store'
version: 0.1.0
status: Review
owner: Architecture
reviewers:
  - Vedant
created: 2026-08-07
updated: 2026-08-07
milestone: M6
category: Features
priority: Critical
depends_on:
  - ARCH-001
  - CONSTITUTION
required_by:
  - DOM-RETURNS
related_documents:
  - DOM-RETURNS
  - STD-API
  - STD-DATABASE
  - STD-SECURITY
related_decisions:
  - ADR-0014
tags:
  - feature
  - infrastructure
  - settings
risk: Medium
complexity: Medium
---

# FEAT-SETTINGS-STORE

## 1. Overview

`DOM-RETURNS` Invariant 3 requires a **10-day return window that an
administrator can change**. No mechanism exists to hold such a value — there is
no `Setting`, `Config` or `AppSetting` model among the 28 (KC-187).

The obvious implementation is a `returnWindowDays` column somewhere. The owner
rejected that in favour of a **general mechanism** (KC-194), and the reasoning
holds: the moment one admin-editable value exists, the free-shipping threshold,
the dispatch SLA and the low-stock threshold all become candidates. Each is
currently hardcoded or, worse, asserted in storefront copy with nothing behind
it at all (`DISC-008`).

This feature builds that mechanism, with the return window as its first
consumer.

## 2. Owning Domain

**None. This is shared infrastructure, not a bounded context** — the same
category as `audit-log`, `metrics` and `storage` in `ARCH-001` §1.2. It owns no
business concept; it holds values other contexts interpret.

**This is a deliberate deviation from `OV-007`**, which requires every feature
to name exactly one owning domain. That rule assumes a feature expresses a
business capability. An infrastructure feature has none to express, and forcing
one — naming `DOM-RETURNS` because it happens to be the first consumer — would
be worse than admitting the gap: it would make a general mechanism look like
Returns' property, and the next consumer would inherit a dependency on a domain
it has nothing to do with.

Surfaced rather than resolved silently, per `OV-006`'s own rule about
dependencies that a protocol did not anticipate.

**The ownership split that makes this work:**

| Concern | Owner |
| --- | --- |
| Storage, typing, validation, admin surface, audit | Settings (shared infrastructure) |
| The **meaning and default** of any individual key | The consuming domain |

`DOM-RETURNS` owns what `returns.window_days` *means* and what its default is.
Settings owns the table it lives in. Exactly how `audit-log` works: it owns the
table, each domain owns what it writes there.

**`ARCH-001` §1.2 needs amending** to list `settings` alongside the other
shared services. Recorded in the Definition of Done.

## 3. Acceptance Criteria

1. Settings are a **declared registry**, not free-form keys. A key that is not
   in the registry cannot be read or written.
2. Every setting declares a **type, a default, and a validation rule**. Reading
   a setting never returns `null` — an unset setting returns its declared
   default, so the system works before anyone opens the admin page.
3. Values are **validated on write** against the declared rule. A return window
   of `-5` or `"soon"` is refused with a message naming the constraint.
4. Reads are **typed**. A store that returns `string` everywhere pushes parsing
   to every caller and guarantees one of them gets it wrong.
5. Changing a setting is **audit-logged** with the actor, the key, the old
   value and the new one (`STD-SECURITY` r8).
6. The **first consumer is `returns.window_days`**, default `10`, which
   `DOM-RETURNS` Invariant 3 requires.
7. Only `ADMIN` may read or write settings. There is no customer-facing
   settings endpoint.

## 4. API Surface

**New** — admin only, role-guarded per `STD-API` r2:

- `GET /admin/settings` — every declared setting with its current value,
  default, type and description.
- `PATCH /admin/settings/:key` — set one value.

Settings are deliberately **not exposed publicly**. A storefront that needs one
gets it through the endpoint that already serves the surrounding data, rather
than through a general configuration endpoint that would invite reading
anything.

## 5. Events

**Publishes** — none.
**Consumes** — none.

A settings change is a synchronous admin action. Publishing an event would
imply something reacts asynchronously, and nothing does; the next read simply
sees the new value.

## 6. Data Changes

**New table** `settings`:

| Column | Notes |
| --- | --- |
| `key` | Primary key. Must match a registry entry |
| `value` | `TEXT`. Stored as text and parsed per the registry's declared type |
| `updated_at` | |

**Why text rather than a typed column per setting.** A typed column per
setting is a migration per setting, which defeats the purpose of a general
mechanism. Text plus a typed registry keeps the schema stable while keeping
callers type-safe — the trade is that the database cannot enforce the type, so
the registry does, and per `STD-DATABASE` r6 that limitation is documented at
the schema with the enforcing module named.

**Only overridden settings are stored.** A row exists only once someone changes
a value; defaults live in the registry, in code. This means deleting a row
resets to default, and a fresh environment needs no seed.

## 7. Edge Cases & Validations

1. **Unknown key.** `PATCH /admin/settings/nonsense` is a 404, not a silent
   insert. Free-form keys are how a settings table becomes a junk drawer.
2. **Reading a setting with no row.** Returns the declared default. The system
   must work before anyone has opened the admin page — including on the very
   first request after deploy.
3. **A stored value that no longer parses.** If a registry type is tightened
   later, an existing row may become invalid. Reads must fall back to the
   default and surface the problem rather than crash a customer request. A
   return window that will not parse must not take down returns.
4. **Concurrent writes.** Last write wins. Settings change rarely and by one
   admin; anything more is unwarranted.
5. **Setting a value equal to the default.** Stores a row. Harmless, and
   simpler than special-casing — the operator explicitly chose that value.
6. **Return window changed while a request is pending.** `DOM-RETURNS`
   Invariant 3 evaluates eligibility at request time; a later change does not
   retroactively invalidate an accepted request (`DOM-RETURNS` §8.3).
7. **Audit of a first-time change.** The old value is the *default*, not null —
   otherwise the trail cannot show what actually changed.

## 8. Non-Functional Considerations

| Standard | Bearing |
| --- | --- |
| **`STD-API`** | Admin-only and role-guarded (r2). Unknown keys use the standard error envelope (r4). |
| **`STD-DATABASE`** | The type constraint cannot live in the database — a single `value TEXT` column serves several types — so the registry enforces it and the limitation is documented at the schema (r6). Defaults are not stored, so there is no second source of truth (r9). |
| **`STD-SECURITY`** | Admin mutations are audit-logged (r8). Settings are never exposed publicly. |
| **`STD-TESTING`** | Registry validation and default-fallback are branching logic; every §7 edge case needs a test (r6). Edge case 3 especially — the failure mode is a customer-facing crash. |
| **`STD-CODE`** | The registry is data, declared in one place, not scattered constants. |

**Law 1 check.** A settings endpoint that lists a key the system does not
actually read would be a surface asserting a capability that does not exist.
Every registry entry must have a real consumer, or not be declared.

## 9. Definition of Done

Verified end to end against a scratch Postgres (port 5436) with the API booted
against it, a seeded order delivered 20 days ago, and a real admin token:

| Case | Result |
| --- | --- |
| `GET /admin/settings` as a customer / anonymously | **403** / **401** |
| `GET /admin/settings` with no rows stored | `value: 10`, `overridden: false` |
| `PATCH /admin/settings/nonsense` | **404**, naming the declared keys |
| `PATCH returns.window_days` to `-5` | **400** — *"it must be at least 1"* |
| `PATCH returns.window_days` to `14` | **200**, row stored, audit `{from: 10, to: 14}` |
| Return requested on an order delivered 20 days ago | **400** — *"The 14-day return window for this order closed on 2026-08-01"*, no `return_requests` row written |
| Admin widens the window to `30`, same request retried | **201**, no restart — the next read sees the new value |

The audit entry on the **first** change reads `from: 10` — the default, not
null — which is §7.7 working.

- [x] `settings` table and migration (hand-written — `prisma migrate dev`
      cannot diff this schema, KC-144).
- [x] Typed registry with default, type and validation per setting.
- [x] `returns.window_days` declared, default 10, and **actually consumed** by
      returns eligibility.
- [x] `GET`/`PATCH` admin endpoints, role-guarded.
- [x] Changes audit-logged with old and new values.
- [x] Unparseable stored values fall back to the default rather than throwing.
- [x] Every §7 edge case covered by a test (22 in `settings.service.spec.ts`,
      9 in `returns-eligibility.spec.ts`, 5 added to `returns.service.spec.ts`).
- [x] `ARCH-001` §1.2 amended to list `settings` as shared infrastructure
      (Amendment A2, v1.2.0).
- [x] `DOM-RETURNS` updated — Invariant 3, §6, §7 and Open items (v1.1.0).

## 10. What this closed, and what it opened

Invariant 3 was previously enforced by **nothing**: `create` checked only that
the order was `DELIVERED` and that the item had no existing request, so an
order delivered a year ago was as returnable as one delivered this morning.

That means enforcing the window **changed behaviour for existing orders** —
`DOM-RETURNS` §8.2, previously hypothetical, is now live: every order delivered
more than 10 days before 2026-08-07 lost its return path.

**Owner decision, 2026-08-07: existing orders are left as they are.** No grace
period, no backdating. Recorded rather than assumed, because the consequence
falls on customers who cannot see it happen — `DOM-RETURNS` §8.2 and Open items
carry the same decision.
