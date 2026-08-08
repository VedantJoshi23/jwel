---
id: FEAT-ORDER-RECONCILIATION
title: 'Jwel / ELYSIAN — Feature: Order Reconciliation Sweep'
version: 0.1.0
status: Review
owner: Architecture
reviewers:
  - Vedant
created: 2026-08-08
updated: 2026-08-08
milestone: M6
category: Features
priority: Critical
depends_on:
  - DOM-ORDERING
  - ARCH-001
  - ADR-0010
required_by: []
related_documents:
  - DOM-PAYMENTS
  - STD-OBSERVABILITY
  - STD-TESTING
related_domains:
  - DOM-ORDERING
related_decisions:
  - ADR-0005
  - ADR-0010
tags:
  - feature
  - ordering
  - reliability
risk: High
complexity: Medium
---

# FEAT-ORDER-RECONCILIATION

## 1. Overview

`DOM-ORDERING` invariants 11 and 12 describe **one sweep resolving two ways an
order gets stuck at `PLACED`**. Invariant 11 — cancel an unpaid checkout and
release its stock — was already built as `expireStalePendingOrders`. Invariant
12 was not.

**Invariant 12 is the half where the money has already moved.** An order
reaches `CONFIRMED` by *reacting* to `payment.succeeded`. The bus is in-process
and at-most-once (`ARCH-001` §3.1), which makes that reaction the fragile link
in the system's central chain. A process restart between the payment write and
the emit, a handler that threw, or a bug that skipped confirmation each leave a
customer charged, holding an order that still reads "placed", with no
confirmation email.

Nothing detected that state, and nothing repaired it.

## 2. Owning Domain

**Owning domain: `DOM-ORDERING`.** Order status transitions are Ordering's, and
invariant 8 is explicit that an order is confirmed in reaction to
`payment.succeeded` rather than by Payments writing to it. The sweep re-derives
that same reaction and must therefore live in the same place.

**Dependencies:**

| Domain | Call | Allowed by |
| --- | --- | --- |
| Payments | **Read** `payment.status`, to find orders whose payment succeeded | `DOM-ORDERING` §7 already permits reading Payments for confirmation |
| Inventory | **Command** `release`, on the expiry half only | Existing, unchanged |

No new cross-context dependency and no new event.

## 3. Acceptance Criteria

1. A periodic sweep confirms orders that are `PLACED` with a `SUCCEEDED`
   payment.
2. Confirmation is **idempotent**. The sweep runs against orders the listener
   already handled, every five minutes, forever.
3. Confirmation emits `order.confirmed` exactly once per order, so the customer
   gets one confirmation email rather than one per sweep.
4. The status history records **why** the order moved, distinguishing a swept
   confirmation from a normal one.
5. The confirmation sweep **alerts** when it finds anything.
6. The expiry sweep does **not** alert. See §3.1.
7. An order the expiry sweep already cancelled is **never** resurrected, by
   either path.
8. Both halves increment a metric, so the rates are observable without reading
   logs.

### 3.1 Why only one half alerts

`DOM-ORDERING` says *"the sweep must alert when it finds anything — a sweep
that silently fixes things conceals the bug that made fixing necessary."* That
is right for invariant 12 and wrong for invariant 11, and the difference
matters more than the symmetry:

| Half | What a finding means |
| --- | --- |
| **Confirmation (12)** | A defect. The event was lost, and a real customer was charged and left unconfirmed. **Alert.** |
| **Expiry (11)** | A shopper abandoned a checkout. Ordinary behaviour on any storefront. **Log and count.** |

Alerting on abandoned checkouts would bury the alert that matters under
routine traffic, and an operator who learns to ignore the channel will ignore
it on the day invariant 12 fires. The expiry rate is still visible as
`order_reconciliation_total{outcome="expired"}`.

## 4. API Surface

**None.** No endpoint. Both halves are `@Cron(EVERY_5_MINUTES)`, and neither
is manually triggerable — a reconciliation that needs a human to run it does
not satisfy an invariant.

## 5. Events

**Publishes** — `order.confirmed`, the same event the listener publishes.
Deliberately the same: the point is to re-derive the *reaction that was lost*,
and that reaction includes the customer's confirmation email.

**Consumes** — `payment.succeeded`, unchanged.

## 6. Data Changes

**None.** The sweep reads `orders` and `payments`, and writes only the order
status and its history — both already Ordering's.

There is deliberately **no `reconciledAt` column** or similar. The status
history already records what happened and why, and a second marker would be a
stored derivation of it.

## 7. Edge Cases & Validations

1. **The listener and the sweep race.** Resolved by making the transition a
   conditional `updateMany` on `status: PLACED` rather than a read-then-write.
   The loser matches zero rows, emits nothing, and writes no history row. There
   are three independent triggers — browser callback, webhook, sweep — so this
   is routine, not exotic.
2. **An order paid *after* the expiry sweep cancelled it.** Not confirmed, by
   either path. The stock was released and may since have been sold, so
   confirming would promise goods that no longer exist. Alerts for a human
   decision — refund or re-source — which is the pre-existing behaviour, now
   reachable from the sweep too.
3. **A sweep run that finds nothing.** Silent. No alert, no metric increment.
   An alert that fires on the healthy path is not an alert.
4. **Several stuck orders in one run.** One alert naming the count, not one per
   order.
5. **An order with no payment row.** Not this sweep's business — it is
   invariant 11's, and only if it is also past the window.
6. **A payment that succeeded seconds ago.** Confirmed immediately; there is no
   age cutoff on this half. Invariant 11's window exists to avoid cancelling a
   checkout still in progress. There is no equivalent risk in confirming an
   order that is already paid, and waiting would only delay the customer's
   email.

## 8. Non-Functional Considerations

| Standard | Bearing |
| --- | --- |
| **`STD-OBSERVABILITY`** | The alert path is new: `logger.error` alone reaches nothing but the container log. `alertOperator` writes to the log **and** Sentry, which until now only saw thrown exceptions on a request path — a background sweep throws nothing and was invisible to it. |
| **`STD-TESTING`** | Idempotence is the load-bearing property (r6). `DOM-ORDERING`'s open items flagged it as *assumed, not verified*; invariant 12 makes it critical, and it is now both enforced by a conditional update and covered by tests. |
| **`ADR-0010`** | This is the reconciliation pattern that decision accepts **in place of** a durable bus. It also recovers from failures a durable bus would not: a handler that threw, or a bug that skipped confirmation. |
| **`STD-PERFORMANCE`** | Two indexed queries every five minutes over a small `PLACED` set. Not a concern at this catalogue's scale. |

**Law 1 check.** An order reading `PLACED` after the customer paid is a surface
asserting the opposite of what happened. This feature is Law 1 applied to order
state.

## 9. Definition of Done

Verified against a scratch Postgres, with an order deliberately left `PLACED`
against a `SUCCEEDED` payment — the exact state a lost event produces:

| Case | Result |
| --- | --- |
| Sweep run | confirmed **1**; order now `CONFIRMED` |
| Status history | `PLACED`, then `CONFIRMED — "Confirmed by reconciliation sweep — payment had succeeded"` |
| `order.confirmed` | emitted; Notifications picked it up and attempted the customer's confirmation email |
| Alert | logged at ERROR naming the count and the cause |
| Second run | confirmed **0** — idempotent against a real database |

- [x] Confirmation sweep implemented, `@Cron` every five minutes.
- [x] Transition made idempotent by conditional update, shared with the
      `payment.succeeded` listener.
- [x] Status history distinguishes a swept confirmation.
- [x] Confirmation sweep alerts to log **and** Sentry; expiry sweep does not.
- [x] `order_reconciliation_total{outcome}` for both halves.
- [x] A cancelled order is never resurrected.
- [x] Every §7 edge case covered by a test (9 added).
- [x] `DOM-ORDERING` open items updated.
- [x] `RUNBOOK` — what to do when the alert fires.

## 10. Two questions this raised, both since settled

**The sweep window: 30 minutes stands** *(owner decision, 2026-08-08)*.
`DOM-ORDERING`'s open items had asked for the gateway's session timeout plus
roughly five minutes — about 17 against Razorpay's ~12-minute modal session.
`ORDER_PAYMENT_TTL_MS` remains **30 minutes**, which supersedes that note.

The errors are not symmetric, which is why the more generous value wins: too
long merely holds stock on an abandoned checkout, while too short cancels an
order a shopper is still paying for — after which their payment lands on a
cancelled order and needs a manual refund (§7.2).

**The Razorpay expiry event: deliberately not pursued** *(owner decision,
2026-08-08)*. `DOM-ORDERING` had recorded this as needing verification against
the provider's documentation. It is now closed as a **declined dependency**
rather than an open question: the system does not build on third-party platform
behaviour where it can derive the same result from state it owns.

The sweep reads `orders` and `payments` — both this system's — so it is the
whole mechanism, not a floor beneath a provider event. Worth reading as a
general position rather than a one-off: `ADR-0005` makes Razorpay the sole
payment provider, so every dependency on provider-specific behaviour narrows
the room to change that later.
