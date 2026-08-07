---
id: DOM-ORDERING
title: 'Jwel / ELYSIAN — Domain: Ordering'
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
  - ADR-0005
  - ADR-0008
tags:
  - domain
  - ordering
risk: High
complexity: High
---

# DOM-ORDERING

**Depth tier: Full** — the transactional hub. Owns the order lifecycle and
composes three other contexts into a single checkout transaction.

## 1. Overview

Ordering turns a cart into a durable, immutable record of a sale and moves it
through its lifecycle. It is the system's orchestrator: it reserves stock,
redeems a coupon and initiates payment as one unit of work, then advances the
order as the physical world catches up.

`DISC-006` found it correctly shaped — it imports four contexts and **nothing
imports it** (KC-149). A hub that depends downward and is depended on by nobody
can change without cascading.

## 2. Ownership

**Owns** — `Order`, `OrderItem`, `OrderStatusHistory`, the order lifecycle state
machine, and the checkout transaction that composes reservation, redemption and
payment initiation.

**Explicitly does NOT own** — payment execution (commands Payments); stock
arithmetic (commands Inventory); coupon validity (asks Pricing); return
lifecycle (Returns owns it); the cart it was created from.

## 3. Invariants

| # | Invariant | Source |
| --- | --- | --- |
| 1 | Transitions are `PLACED → CONFIRMED\|CANCELLED`, `CONFIRMED → PROCESSING\|CANCELLED`, `PROCESSING → SHIPPED\|CANCELLED`, `SHIPPED → DELIVERED`. `DELIVERED`, `CANCELLED`, `REFUNDED` are terminal. No other transition is permitted. | KC-177 |
| 2 | `Order.userId` is non-nullable — **an order cannot exist without a registered user**. | KC-140, KC-125 |
| 3 | Every order line stores immutable snapshots: product name, variant, and unit price at the moment of sale. | KC-132 |
| 4 | The shipping address is a **JSON snapshot**, never a foreign key to `Address`. | KC-132 |
| 5 | All monetary amounts are integer minor units. | KC-131, `STD-DATABASE` r1 |
| 6 | Stock is reserved during checkout by commanding Inventory; Ordering never writes `inventory_items`. | KC-183, Law 5 |
| 7 | Every status transition appends to `OrderStatusHistory`, which is never updated or deleted. | KC-133 |
| 8 | An order is confirmed **in reaction to `payment.succeeded`**, not by Payments writing to it. | KC-151, Law 5 |
| 9 | Checkout is rejected if any line's product no longer exists or is not purchasable. | KC-177 (service behaviour) |
| 10 | `REFUNDED` is reached only when every `OrderItem` has a `REFUNDED` return; a partially refunded order stays `DELIVERED` and is visibly differentiated for admins. | `DOM-RETURNS` inv. 8, 9 |
| 11 | An order left `PLACED` without a successful payment beyond a bounded window is **cancelled and its stock reservation released**, by a periodic sweep. The window exceeds the gateway's own session timeout plus a buffer. | Owner decision, 2026-08-07 |
| 12 | An order left `PLACED` whose `Payment` is `SUCCEEDED` is **confirmed** by the same sweep. Confirmation is idempotent. | Owner decision, 2026-08-07 |

### Invariants 11 and 12 — the reconciliation sweep

Two failure modes leave an order stuck at `PLACED`, and one mechanism resolves
both:

| Condition | Action |
| --- | --- |
| No successful payment, older than the window | Cancel; release reservation |
| `Payment.status = SUCCEEDED` | Confirm the order |

**Why a sweep rather than durable events.** The money movement is already
durable — the `Payment` row is committed and the gateway holds its own record.
Only the *reaction* was lossy. Re-deriving the reaction from durable state is
therefore sufficient, and it is the mitigation `ADR-0010` prefers over making
the bus durable. It also recovers from failures a durable bus would not: a
handler that threw, or a bug that skipped confirmation.

**Why not rely on a gateway webhook** for the abandonment half: webhook delivery
is itself at-most-once from this system's side, so a missed expiry callback
would leave a reservation stuck permanently. If Razorpay does emit such an
event, use it as the fast path and keep the sweep as the floor. **Whether that
event exists was not verified** — it must be checked against the provider's
webhook documentation rather than assumed.

**The sweep must alert when it finds anything.** A sweep that silently fixes
things conceals the bug that made fixing necessary.

## 4. API Surface

**Customer** — `POST /orders` (checkout), `GET /orders`, `GET /orders/:id`
**Admin** — `GET /admin/orders`, `PATCH /admin/orders/:id/status`

## 5. Events

**Publishes** — `order.confirmed`, consumed by Notification and Recommendation.
**Consumes** — `payment.succeeded`, from Payments.

This is the system's central chain and the reference implementation of Law 5's
command-in/event-out pattern (KC-151).

Per `ARCH-001` §3.1 the bus is at-most-once: a lost `order.confirmed` means no
confirmation email and no co-occurrence update. The order itself is unaffected,
and both effects are re-derivable — the mitigation `ADR-0010` prefers.

## 6. Data Ownership

`orders` (indexed `(userId, status)`; BRIN on `createdAt` for reporting),
`order_items` (indexed by order and variant), `order_status_history`
(append-only).

**Reads, does not own:** `product_variants` for price and availability at
checkout.

## 7. Dependencies

**Allowed** — Inventory (command), Pricing & Promotion (command/read), Payments
(command), Identity (read), Catalog (read), Audit log.

**Forbidden** — writing `inventory_items`, `coupons`, `payments`,
`return_requests` or any Catalog table; emitting another context's events; any
dependency on Reviews, Search, Recommendation or Content.

## 8. Edge Cases & Validations

1. **Concurrent checkout for the last unit.** Resolved by Inventory's
   conditional `UPDATE` (KC-183) — one checkout succeeds, the other gets a
   clean conflict. Ordering must surface that, not retry blindly.
2. **Price changed between cart and checkout.** The live price is authoritative;
   the cart snapshot is informational (`DOM-SHOPPING`). The customer must not be
   charged a stale price *or* silently shown a changed total.
3. **Payment never succeeds.** **Resolved** by Invariant 11 — the sweep cancels
   the order and releases the reservation after the window.
4. **`payment.succeeded` arrives twice.** Confirmation must be idempotent.
5. **Order cancelled after stock was reserved.** Reservation must be released,
   by commanding Inventory.
6. **Admin advances to an invalid next status.** Rejected by the transition
   table (Invariant 1), not silently applied.
7. **Coupon becomes invalid between validation and order creation.** Redemption
   is recorded in the same transaction as the order, so the limit check and the
   write cannot diverge.

## Constitution compliance

Law 1 — §8.3 records the missing reservation timeout rather than implying
completeness. Law 2 — every invariant sourced. Law 4 — Invariants 6 and 7 rest
on database-level enforcement. Law 5 — Invariants 6 and 8 are the reference
implementation.

## Open items

- ~~No reservation release timeout~~ — settled by Invariant 11.
- **The sweep is unbuilt**, as is the alert on non-empty sweeps.
- **The sweep window is unset.** It must exceed the gateway's session timeout;
  the owner's stated intent is that timeout plus roughly five minutes.
- Idempotency of `payment.succeeded` handling (edge case 4) is assumed, not
  verified — Invariant 12 makes it load-bearing.
