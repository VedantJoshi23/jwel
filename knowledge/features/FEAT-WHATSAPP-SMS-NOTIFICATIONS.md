---
id: FEAT-WHATSAPP-SMS-NOTIFICATIONS
title: Jwel — Feature: WhatsApp & SMS Transactional Notifications
version: 0.1.0
status: Proposal
owner: Architecture
reviewers: []
created: 2026-07-09
updated: 2026-07-09
milestone: M6
category: Features
priority: High
depends_on:
  - DOM-NOTIFICATION
  - ADR-0003
required_by: []
related_documents: []
related_domains:
  - DOM-NOTIFICATION
related_features: []
related_decisions:
  - ADR-0003
tags:
  - feature
  - notification
  - whatsapp
  - sms
risk: Medium
complexity: Medium
---

## Feature: WhatsApp & SMS Transactional Notifications

### 1. Overview

Extends `NotificationsService` from email-only (Resend) to a
WhatsApp-first, SMS/email-fallback multi-channel dispatcher, per
`ADR-0003`. Covers order confirmation, shipment tracking updates
(consuming `DOM-SHIPPING`'s events), and refund confirmation — the same
three message types the existing email path already sends, now with a
higher-read-rate primary channel and a real fallback instead of a silent
skip.

### 2. Owning Domain

**Owning domain:** `DOM-NOTIFICATION` — channel selection, fallback
ordering, and delivery logging are what this feature is actually about.

**Other domains involved** (dependencies only; Notification calls none
of them — it only consumes events they publish, per `DOM-NOTIFICATION`
§7's "no outbound dependency" position):

- **Order, Returns, Shipping** each publish the events this feature's
  channel logic reacts to (`order.confirmed`, `return.requested`,
  `return.refunded`, `ShipmentCreated`/etc.) — no new event is invented
  here; this feature is entirely about what Notification *does* once an
  already-declared event arrives, not about adding new cross-domain
  calls.

### 3. Acceptance Criteria

- [ ] A customer who has opted into WhatsApp receives order confirmation,
      shipment updates, and refund confirmation via WhatsApp using a
      Meta-approved template — not a plain-text message (Meta rejects
      unapproved business-initiated templates outright, this isn't
      optional).
- [ ] A customer who has not opted into WhatsApp (or whose WhatsApp send
      fails) receives the same message via SMS (MSG91); if SMS also fails
      or no phone is on file, falls back to email — never a silent drop
      (Invariant 1).
- [ ] A customer with no notification preference ever set defaults to
      the WhatsApp → SMS → email order, not an unconfigured/undefined
      state.
- [ ] No WhatsApp message is attempted for a customer without a recorded
      opt-in — this is a hard gate, not a best-effort attempt Meta might
      reject (Invariant 2).
- [ ] Every send attempt (successful, failed, or skipped for lack of
      opt-in) is recorded in the delivery log with enough detail to
      answer a support query without checking Resend/Meta/MSG91's own
      dashboards (Invariant 3).
- [ ] A duplicated triggering event (e.g. a replayed `ShipmentDelivered`
      webhook) does not send the same notification twice (Edge Case,
      `DOM-NOTIFICATION` §8).
- [ ] A customer can view and change their channel preference from their
      profile.
- [ ] An admin can view the delivery log to answer "did this customer's
      notification actually send."

### 4. API Surface

Restated from `DOM-NOTIFICATION` §4, not reinvented here:
`PATCH /api/v1/me/notification-preferences`,
`GET /api/v1/admin/notifications/delivery-log`.

### 5. Events

#### Publishes

None (Notification never originates an event, per `DOM-NOTIFICATION` §5).

#### Consumes

`order.confirmed`, `return.requested`, `return.refunded`,
`ShipmentCreated`, `ShipmentPickedUp`, `ShipmentOutForDelivery`,
`ShipmentDelivered`, `ShipmentNdrRaised`, `ShipmentRtoInitiated` — an
exact match to `DOM-NOTIFICATION` §5's declared Consumes list, no new
event added at this layer.

### 6. Data Changes

Restated from `DOM-NOTIFICATION` §6: new tables
`notification_preferences`, `notification_delivery_log`. No existing
table's ownership changes.

### 7. Edge Cases & Validations

Restated and made feature-concrete from `DOM-NOTIFICATION` §8:

1. WhatsApp number differs from account phone — preference record has
   its own `whatsappNumber` field, tested independently of `User.phone`.
2. All three channels fail — surfaces in the admin delivery log as fully
   failed, not swallowed.
3. Preference changed mid-order-lifecycle — each notification's channel
   choice is evaluated at send time, tested with a preference change
   between two notifications for the same order.
4. Duplicate triggering event — delivery log dedupe key prevents a
   double-send, tested with a replayed event.

### 8. Non-Functional Considerations

Checked against Standards already validated for jwel in Oriveda's
sandbox run (`examples/m4-standards-jwel-walkthrough.md`, corrected by
the M8 audit) plus this project's own `STD-OBSERVABILITY` — jwel does
not yet have STD-API/STD-DATABASE/STD-TESTING formalized in its own
`knowledge/standards/`, flagged here rather than silently assumed
settled (same gap `FEAT-SHIPPING` already named).

| Standard | Relevant? | Notes |
| --- | --- | --- |
| STD-API | Yes | New endpoints follow the existing `api/v1` envelope/versioning convention; no deviation. |
| STD-OBSERVABILITY | Yes | Per-channel send success/failure should be one of the metrics `STD-OBSERVABILITY` requires (a `notification_send_total{channel,status}` counter) — this feature is a natural first real consumer of that Standard once both exist. |
| STD-TESTING | Yes | Fallback-ordering and opt-in-gate logic (Edge Cases 2–4) need real test coverage, not just a happy-path WhatsApp-succeeds test — this is exactly the kind of branching logic this codebase's testing discipline already treats as a first-class concern (e.g. the Payments idempotency tests). |
| Security | Yes | WhatsApp/MSG91 webhook endpoints (delivery status callbacks) must be signature/token-verified before being trusted, same posture as the Stripe and (planned) Shiprocket webhooks — never trust an unauthenticated callback claiming a message was delivered or failed. |
| Accessibility | Not applicable | This feature has no new customer-facing UI beyond a simple preference toggle, which reuses existing form components; no new accessibility pattern introduced. |
| Data Portability (NFR-9-equivalent) | Yes | Same reasoning as Storage/Payment — `NotificationChannelPort` keeps Resend/Meta/MSG91 swappable without touching the domain logic that decides *when* to send, only *how*. |

### 9. Definition of Done

- [ ] `NotificationChannelPort` + three adapters (Resend — already
      exists, wrap it; Meta Cloud API; MSG91), unit-tested against mocked
      clients.
- [ ] Prisma migration for `notification_preferences`,
      `notification_delivery_log`.
- [ ] WhatsApp message templates submitted to Meta for approval — tracked
      as a lead-time item (`DOM-NOTIFICATION` §9), not a same-sprint
      engineering task.
- [ ] Fallback-ordering logic tested for every failure combination named
      in §7 above.
- [ ] Customer preference UI + admin delivery-log view shipped.
- [ ] `README.md`/`BACKEND.md` updated once implemented, same as every
      other milestone's documentation practice.
