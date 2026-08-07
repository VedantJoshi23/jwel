---
id: DOM-RETURNS
title: Jwel / ELYSIAN — Domain: Returns
version: 1.1.0
status: Frozen
owner: Architecture
reviewers:
  - Vedant
created: 2026-08-07
updated: 2026-08-07
milestone: M5
category: Domains
priority: High
depends_on:
  - ARCH-001
  - CONSTITUTION
required_by: []
related_documents:
  - DISC-005
  - DISC-008
related_decisions:
  - ADR-0008
  - ADR-0009
tags:
  - domain
  - returns
risk: High
complexity: Medium
---

# DOM-RETURNS

**Depth tier: Full** — this domain owns data and carries independent business
rules, several of which exist nowhere else in the system.

## 1. Overview

Returns owns the lifecycle of a customer's request to send back a purchased
item and receive a refund. It decides **eligibility**, tracks the request
through an approval and refund workflow, and records the history of that
workflow. It does not move money and does not change order state — it commands
the domains that do.

This domain carries the highest ratio of policy-to-code in the system: rules
the owner has decided that are currently expressed, at best, by a unique
constraint.

## 2. Ownership

**Owns** *(from `ARCH-001` §1.1)*

- `ReturnRequest` — the request, its reason, status and refund amount
- `ReturnStatusHistory` — append-only lifecycle record
- Return **eligibility** determination
- The return lifecycle state machine

**Explicitly does NOT own**

- **Order status.** A return never mutates `Order.status`. What makes an order
  `REFUNDED` is Invariant 8.
- **Refund execution.** Money movement belongs to Payments; Returns commands it.
- **Stock restoration.** Inventory owns the arithmetic; Returns commands it.
- **The customer relationship** for exception handling — out-of-band per
  Invariant 6.

## 3. Invariants

Every invariant is sourced. No invariant is invented at this layer.

| # | Invariant | Source |
| --- | --- | --- |
| 1 | A return may only be requested against an order whose status is `DELIVERED`. | KC-179 |
| 2 | Each `OrderItem` may have **at most one** `ReturnRequest`, ever. Enforced by a unique constraint on `order_item_id`. | KC-141, KC-179 |
| 3 | A return must be requested **within 10 days of delivery**. The window is a single global value, not per product or category, and is **editable by an administrator** — `returns.window_days`, default 10 (`FEAT-SETTINGS-STORE`). | KC-186 |
| 4 | The lifecycle is `REQUESTED → APPROVED \| REJECTED`; `APPROVED → REFUND_PROCESSING`; `REFUND_PROCESSING → REFUNDED`. `REJECTED` and `REFUNDED` are terminal. No other transition is permitted. | KC-180 |
| 5 | A refund amount is **mandatory** when transitioning to `REFUNDED`. | KC-180 |
| 6 | A customer may **not** cancel a pending request, and may **not** re-request after a rejection. Exceptions are handled out of band, by email or WhatsApp. | KC-146 |
| 7 | Every status transition appends to `ReturnStatusHistory`; history is never updated or deleted. | KC-133, `STD-DATABASE` r3 |
| 8 | An `Order` becomes `REFUNDED` only when **every** `OrderItem` on it has a `REFUNDED` return. A partially refunded order remains `DELIVERED`. | Owner decision, 2026-08-07 |
| 9 | Partial-return state must be **derivable and visibly surfaced** to administrators. An order displaying `DELIVERED` while carrying one or more refunded items is rendered with a visual differentiator (e.g. highlighted status text) so an admin can tell the two apart without opening the order. | Owner decision, 2026-08-07 |

**Invariants 8 and 9 were settled by the owner on 2026-08-07**, closing
KC-191. `DISC-008` established that `OrderStatus.REFUNDED` is unreachable
(KC-178) and that the owner wants it reachable (KC-190), but left the condition
open.

**The resolution deliberately adds no enum value.** A partially refunded order
stays `DELIVERED` in the data model, and the distinction is carried in the
**presentation layer** instead. That is the right trade: `PARTIALLY_REFUNDED`
would be a schema change rippling through the order state machine, the web type
union and every status filter, to express something that is already derivable
from the returns attached to the order.

**Invariant 9 is what stops that being a loss of information.** Without it, an
admin looking at a `DELIVERED` order has no way to know part of it came back
without opening it. With it, the state is visible where decisions are made.

**Consequence for implementation:** the admin order list query must include
enough return state to derive the flag — an order is *partially returned* when
at least one, but not all, of its items has a `REFUNDED` return. This is a read
concern, not a stored field; storing it would create a second source of truth
for something the returns table already knows (`STD-DATABASE` r9).

## 4. API Surface

*From `ARCH-001`; not reinvented here.*

**Customer**

- `POST /returns` — request a return for an order item
- `GET /returns` — list the caller's returns
- `GET /returns/:id` — detail

**Admin**

- `GET /admin/returns` — queue, filterable by status
- `PATCH /admin/returns/:id/status` — advance the lifecycle

There is **no cancel endpoint, and none may be added** (Invariant 6).

**Note:** the customer endpoints exist but no storefront UI reaches them
(KC-117). Wiring them is agreed (KC-123). The UI must expose **request and
status only** — a cancel control would be the natural thing for a frontend
developer to add and would violate Invariant 6.

## 5. Events

**Publishes** *(from `ARCH-001` §3)*

- `return.requested` — on creation
- `return.refunded` — on transition to `REFUNDED`

**Consumes**

- None.

Both events are consumed by Notification. Per `ARCH-001` §3.1 the bus is
**at-most-once**: a lost `return.refunded` means a customer is not notified of
their own refund. The refund itself is unaffected — it is recorded in
`ReturnRequest` — so the effect is re-derivable, which is the mitigation
`ADR-0010` prefers over durability.

## 6. Data Ownership

| Table | Notes |
| --- | --- |
| `return_requests` | Unique on `order_item_id` (Invariant 2). Indexed on `status` for the admin queue |
| `return_status_history` | Append-only; indexed `(return_id, occurred_at)` |

**Reads, does not own:** `order_items` and `orders` — to establish eligibility
(Invariants 1 and 3). This is a permitted cross-context **read** under
`STD-API`'s exception clause; it is never a write.

**Requires but does not own:** the settings store holding the return window
(Invariant 3). Built as `FEAT-SETTINGS-STORE` (2026-08-07) — a general
mechanism, not a `returnWindowDays` column, per KC-194. Returns owns what
`returns.window_days` **means** and what its default is; Settings owns the
table, the type and the validation.

## 7. Dependencies

**Allowed** — matching `ARCH-001`'s context map exactly:

- **Ordering** — read, for eligibility
- **Payments** — command, to execute a refund
- **Inventory** — command, to restore stock
- **Audit log** — shared infrastructure
- **Settings** — read, for the return window (`FEAT-SETTINGS-STORE`)

**Forbidden**

- Writing `orders`, `order_items`, `payments` or `inventory_items` directly.
- Emitting any event this domain does not own.
- Any dependency on Reviews, Recommendation, Search, Catalog or Content.

## 8. Edge Cases & Validations

1. **Return requested on day 10 versus day 11.** The window is measured from
   the `DELIVERED` entry in `OrderStatusHistory`, not `Order.updatedAt`, which
   moves for unrelated reasons.
2. **Return requested on an order delivered before the window existed.** The
   rule applies from its introduction; pre-existing delivered orders are
   evaluated against it and will mostly be ineligible. Worth a deliberate
   decision before enabling, since it silently closes returns on historical
   orders.
3. **Window changed while a request is pending.** Eligibility is evaluated at
   **request time**, not re-evaluated later. Shortening the window must not
   retroactively invalidate a request already accepted.
4. **Second request on the same order item.** Rejected with a clean 409, not a
   raw database constraint error.
5. **Rejected, then the customer contacts support.** There is no re-request
   path (Invariant 6). Resolution is manual and out of band.
6. **Two admins advance the same return concurrently.** The second transition
   must fail against the transition table rather than overwrite the first.
7. **`REFUNDED` without a refund amount.** Rejected (Invariant 5).
8. **All items on a multi-item order refunded separately.** The last one to
   reach `REFUNDED` triggers the order-level transition (Invariant 8).
9. **Single-item order, fully refunded.** Invariants 8 and 9 must not conflict:
   one item refunded out of one is *complete*, not partial. The order becomes
   `REFUNDED` and carries no partial-return differentiator.
10. **Order with a rejected return.** A `REJECTED` return is not a refund. It
    does not make the order partially returned and must not trigger Invariant 9's
    differentiator — otherwise every rejected request permanently marks an
    otherwise-clean order.
11. **Refund fails at the payment provider.** The return must not sit in
    `REFUND_PROCESSING` silently forever. No timeout or alert currently exists —
    **recorded as a gap**, not solved here.

## Constitution compliance

| Law | How this spec satisfies it |
| --- | --- |
| 1 | §4 states the customer UI does not exist rather than implying it does; §8.9 records the missing timeout as a gap |
| 2 | Every invariant cites its source; Invariant 8 is marked as a new decision rather than presented as inherited |
| 3 | Invariant 3's window supersedes the FAQ's 7-day claim explicitly (KC-186) |
| 4 | Invariants 2 and 7 are enforced in the database; the window (3) is application-layer because it depends on runtime configuration |
| 5 | §7 forbids all cross-context writes; refunds and stock are commanded |
| 6 | Not applicable to this domain |

## Open items

- ~~Invariant 8 needs owner confirmation~~ — **settled 2026-08-07**, together
  with Invariant 9's admin differentiator.
- ~~**The settings store does not exist** (KC-187)~~ — **built 2026-08-07**
  (`FEAT-SETTINGS-STORE`). Invariant 3 is now enforced in
  `returns-eligibility.ts`, measured from the `DELIVERED` entry in
  `OrderStatusHistory` per §8.1 and evaluated at request time per §8.3.
- **Edge case 2** — retroactive application to historical delivered orders.
  **Now live rather than hypothetical**: enforcing the window closed returns on
  every order delivered more than 10 days ago, with no announcement. Whether
  that is the intended treatment of pre-existing orders remains the owner's
  call; widening `returns.window_days` temporarily is the lever if it is not.
- **A `DELIVERED` order with no `DELIVERED` history row** is refused with a
  contact-support message rather than assigned an invented delivery date. It
  should not occur — every transition writes a history row — so it is a data
  defect, and Invariant 6 already routes exceptions out of band.
- **Edge case 11** — no failure handling for a stuck `REFUND_PROCESSING`.

All invariants in this specification are now sourced. It is ready to Freeze.
