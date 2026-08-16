---
id: DOM-NOTIFICATION
title: Jwel — Domain: Notification
version: 1.0.0
status: Frozen
owner: Architecture
reviewers: []
created: 2026-07-09
updated: 2026-07-09
milestone: M5
category: Domains
priority: High
depends_on:
  - ADR-0003
required_by:
  - FEAT-WHATSAPP-SMS-NOTIFICATIONS
related_documents: []
related_domains: []
related_features: []
related_decisions:
  - ADR-0003
  - ADR-0023
tags:
  - domain
  - notification
risk: Medium
complexity: Medium
---

# Domain: Notification

**Depth tier: Full** — this domain carries independent business rules
(channel fallback ordering, opt-in policy) and specifies its own tables. It is
not a Thin projection despite being a pure event consumer today.

> **Adopted into the M5 Domain series 2026-08-07**, under `PRM-DOMAIN` /
> `OV-006`. Authored pre-Oriveda (2026-07-09) and **not rewritten** — per
> `ADR-0007`, an advisory document that holds up is adopted, not re-authored.
> It already follows `OV-006`'s eight-section structure.
>
> **Reconciled against `DISC-003`, `DISC-006` and `ARCH-001`:**
>
> **What is true today.** The notifications module is **Resend email only**
> (KC-097). It owns **no tables** — `DISC-006`'s table-access measurement found
> it touching no Prisma model at all (KC-153). It is a pure consumer of three
> events: `order.confirmed`, `return.requested`, `return.refunded` (KC-150). It
> has no controller and exposes no HTTP surface.
>
> **What this document specifies but does not yet exist:** WhatsApp and SMS
> channels, `notification_preferences`, `notification_delivery_log`, and the
> multi-channel fallback of Invariant 1. `ADR-0003` selected a provider;
> nothing was built.
>
> **This is committed work, not abandoned** (KC-102) — blocked on the client
> supplying mail and WhatsApp credentials, and planned as a separate session.
> That distinguishes it from `DOM-SHIPPING` (blocked externally) and
> `DOM-RISK` (closed as not required).
>
> **One architectural constraint this document predates.** `ARCH-001` §3.1
> establishes that the event bus is **in-process and at-most-once**, with no
> persistence, retry or dead-letter path (KC-165). A lost `order.confirmed`
> therefore means **no notification is sent and nothing records that one was
> missed** — Invariant 1's "never a silent drop" holds *within* a delivery
> attempt, but cannot hold if the triggering event never arrives. This is the
> gap `ADR-0010` defers behind named triggers, and **WhatsApp going live is
> trigger 1**: a dropped order confirmation stops being one lost email and
> becomes a support call. `notification_delivery_log` is a useful partial
> mitigation, since a missing row is at least detectable.
>
> **One dependency worth flagging.** `DOM-RETURNS` Invariant 6 routes all
> return exceptions — no cancellation, no re-request after rejection — to
> out-of-band contact "by email or WhatsApp" (KC-146, KC-148). Only email
> exists, so that policy currently rests on one of its two stated channels.
>
> Status moves `Proposal` → `Review` with the rest of the series. No rule
> changed.

**Tier:** Full — as of this revision it owns real data (channel
preference, delivery log) and real invariants (fallback ordering,
opt-in enforcement); the email-only version of this domain was
arguably Thin (stateless dispatch, no owned data at all), but that no
longer holds once WhatsApp/SMS and their opt-in/fallback rules exist.

## 1. Overview

Dispatches transactional messages (order confirmation, shipment
tracking updates, refund confirmation, return-request acknowledgement)
across email (Resend), WhatsApp (Meta Cloud API), and SMS (MSG91, per
`ADR-0003`), and owns per-customer channel preference and delivery
outcome so a failed send on one channel falls back rather than silently
disappearing.

## 2. Ownership

### Owns

- Per-customer notification channel preference (WhatsApp opted in/out,
  preferred fallback order).
- Delivery log — one row per attempted send, per channel, per event
  (for debugging "did the customer actually get this" and for the
  fallback-ordering invariant below to be checkable after the fact).
- Message templates per channel (WhatsApp's Meta-approved templates are
  a distinct concept from the existing Resend HTML/text templates —
  both live here).

### Explicitly Does NOT Own

*(restated from `ARCHITECTURE.md` §3's Service Boundaries table — this
domain's row is otherwise unchanged by this revision, only extended)*

- The business event that triggers a notification — Notification only
  ever listens for events other domains publish (`order.confirmed`,
  `return.requested`, `return.refunded`, and now `ShipmentCreated`/
  `ShipmentDelivered`/etc. per `DOM-SHIPPING`); it never originates one.
- Customer contact information itself — phone/email live on `User`
  (Identity's domain); Notification reads them, never writes them.

## 3. Invariants

### Invariant 1

> A transactional message always attempts a fallback channel if the
> preferred channel fails or isn't opted into — WhatsApp → SMS → email,
> in that order, never a silent drop. (Today's actual behavior — log and
> skip if `RESEND_API_KEY` is unset — is the one-channel special case of
> this rule with nowhere left to fall back to; this generalizes it.)

**Source:** New decision, this domain spec, extending
`notifications.service.ts`'s existing "best-effort, must never break the
triggering operation" posture (its own header comment) to a multi-channel
world where "best-effort" should mean "tried every available channel,"
not "tried the one channel and gave up."

### Invariant 2

> A WhatsApp business-initiated message is never sent to a customer who
> has not opted in, per Meta's own policy — an opt-out (or no opt-in
> recorded) routes straight to the next fallback channel, not a failed
> WhatsApp attempt.

**Source:** Meta's WhatsApp Business Platform policy (external
constraint, not a jwel business rule — but binding all the same, cited
here as the invariant's source per `OV-006`'s "new decision" option,
since it doesn't trace to an `OV-001` claim or an internal Law).

### Invariant 3

> A failed send on any channel is logged with enough detail to answer
> "did the customer get this" without needing to check the provider's own
> dashboard — the delivery log is this domain's own source of truth, not
> a convenience mirror of WhatsApp/MSG91/Resend's dashboards.

**Source:** New decision, this domain spec. Rationale: today, if an
email silently fails, the only record is a log line
(`notifications.service.ts`'s own `logger.error` call) — sufficient for
one channel with one failure mode, not sufficient once there are three
channels each with their own delivery/opt-in/policy failure modes to
distinguish between.

## 4. API Surface

- `PATCH /api/v1/me/notification-preferences` — customer-facing,
  channel opt-in/opt-out and fallback order (defaults: WhatsApp → SMS →
  email if no preference is ever set).
- `GET /api/v1/admin/notifications/delivery-log` — admin visibility into
  recent send attempts/outcomes, primarily for support/debugging
  ("customer says they never got their order confirmation").
- No change to the *inbound* surface — Notification still has no public
  endpoint that triggers a send; every send is event-triggered (§5).

## 5. Events

### Publishes

None — Notification is a pure consumer, same as before this revision;
extending it to more channels doesn't change that it never originates
an event.

### Consumes

`order.confirmed`, `return.requested`, `return.refunded` (already
consumed today), plus `ShipmentCreated`, `ShipmentPickedUp`,
`ShipmentOutForDelivery`, `ShipmentDelivered`, `ShipmentNdrRaised`,
`ShipmentRtoInitiated` (new, per `DOM-SHIPPING` §5 — this domain spec's
own consumption of Shipping's events is what actually delivers the
"shipment tracking" notifications `FEAT-SHIPPING`'s acceptance criteria
already assumed would happen, without over-specifying *how* inside that
feature spec).

## 6. Data Ownership

New tables:

- `notification_preferences` — `id`, `userId` (unique FK to `users`),
  `whatsappOptedIn` (boolean), `whatsappNumber` (nullable — may differ
  from the account's primary phone), `channelOrder` (ordered array or
  enum set), `updatedAt`.
- `notification_delivery_log` — `id`, `userId`, `channel` (enum:
  `WHATSAPP`, `SMS`, `EMAIL`), `templateKey`, `status` (enum: `SENT`,
  `FAILED`, `SKIPPED_NOT_OPTED_IN`), `providerRef`, `occurredAt`.

Both are new, cross-context read-reference to `users.id` only (no write)
— same boundary discipline as `DOM-SHIPPING`'s `shipments.orderId`.

## 7. Dependencies

### Allowed

- None outbound — Notification calls no other domain's service; it only
  reads `User.phone`/`User.email` (already an existing, narrow read) and
  calls its own three provider adapters (Resend, Meta Cloud API, MSG91),
  all internal to this domain's own infrastructure layer.

### Forbidden

- Writing to `users` (phone/email are Identity's to change, never
  Notification's).
- Originating a business event to trigger itself — every send is
  reactive to an event another domain already published; if a future
  feature seems to need Notification to *decide* when to notify someone
  (rather than react to an event), that decision belongs in whichever
  domain owns the triggering business fact, not here.

## 8. Edge Cases & Validations

- **Customer's WhatsApp number differs from their account phone number**
  (e.g. uses a different number for WhatsApp) — `notification_preferences
  .whatsappNumber` is deliberately a separate field from `User.phone`,
  not assumed identical.
- **All three channels fail for one message** (WhatsApp opt-out + SMS
  provider error + no email on file) — logged as fully failed in the
  delivery log and surfaced to the admin delivery-log view, not silently
  swallowed; per Invariant 1 this is the one case where there genuinely
  is nothing left to fall back to.
- **A customer opts out of WhatsApp mid-order** (between shipment
  creation and delivery) — each notification's channel decision is made
  at send time, not fixed for the order's whole lifecycle; a later
  shipment-update message correctly uses the now-current preference.
- **Duplicate delivery-triggering events** (e.g. a duplicated
  `ShipmentDelivered` webhook, per `DOM-SHIPPING` Edge Case 2) — the
  delivery log's own idempotency (dedupe on `(userId, templateKey,
  providerRef-equivalent-event-id)`) prevents sending the same
  notification twice, a genuinely new concern this domain didn't have
  when Shipping's events didn't exist yet.

## 9. Open Questions

- **WhatsApp template approval turnaround** (Meta's own review process)
  isn't something jwel controls the timeline for — `FEAT-WHATSAPP-SMS-
  NOTIFICATIONS`'s Definition of Done should treat template submission
  as a lead-time item, tracked separately from the engineering work.
- **Cost visibility per channel** (WhatsApp/SMS have real per-message
  cost, unlike Resend's current usage) isn't designed here — whether
  that becomes an Analytics-domain concern or stays purely operational
  (a provider dashboard) is undecided.
- ~~**Whether the WhatsApp channel here still means direct Meta Cloud
  API**~~ — **resolved 2026-08-16** (`ADR-0023`). It does not: the WhatsApp
  channel described in this domain now means Wati's template-send API, not
  a direct Meta Cloud API adapter. `§2` and `§7` below still describe the
  pre-`ADR-0023` shape (`ADR-0003`'s direct integration) and need revising
  to name Wati before `FEAT-WHATSAPP-SMS-NOTIFICATIONS` is built against
  them — tracked as the first item in
  `docs/milestones/roadmap-whatsapp-ordering.md`. The SMS (MSG91) and email
  (Resend) channels elsewhere in this document are unaffected.
