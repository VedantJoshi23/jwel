---
id: ADR-0003
title: WhatsApp (Meta Cloud API, direct) + MSG91 (SMS fallback) as Notification Channels
version: 1.0.0
status: Proposal
owner: Architecture
reviewers: []
created: 2026-07-09
updated: 2026-07-09
milestone: M3
category: Decision
priority: High
depends_on: []
required_by:
  - DOM-NOTIFICATION
tags:
  - notification
  - whatsapp
  - sms
  - decision
risk: Medium
complexity: Medium
---

# ADR-0003 — WhatsApp (Meta Cloud API, direct) + MSG91 (SMS Fallback) as Notification Channels

## Context

`NotificationsService` today only sends email via Resend, with a
graceful-degradation posture (log and skip if unconfigured — see its own
header comment). In India, WhatsApp read/response rates for
transactional messages (order confirmation, shipment updates, OTP)
meaningfully exceed email's — treating email as the only channel is
leaving the most-checked channel for this market's customers unused, for
exactly the messages (FR-9 checkout confirmation, FR-10 shipment
tracking, FR-11 refund confirmation) that most need to be seen promptly.

## Options Considered

- **Meta's own WhatsApp Cloud API, direct, no BSP middleman** for
  WhatsApp; **MSG91** for SMS fallback (when WhatsApp delivery fails or
  the customer never opted in). No per-message aggregator markup on the
  WhatsApp side; Meta still requires pre-approved message templates for
  any business-initiated (non-customer-initiated) conversation, same as
  every other option below. More integration work than a BSP (Meta's
  Cloud API is lower-level), but Resend's own direct-API-no-aggregator
  posture is exactly this codebase's existing pattern for email, and this
  keeps the same shape.
- **A WhatsApp BSP (Gupshup, Wati, Interakt) covering both WhatsApp and
  SMS in one dashboard/API.** Simpler integration (one vendor for both
  channels, template management in a UI), but adds a per-message
  aggregator margin, same trade-off Shiprocket accepted for shipping
  (`ADR-0001`) — reasonable, but this codebase's existing precedent
  (Resend direct, Stripe direct) favors going direct where the direct
  path isn't materially harder, which it isn't here for a template-based
  transactional use case.
- **Twilio for both channels.** Rejected as primary — reliable and
  well-documented, but WhatsApp+SMS pricing for Indian numbers is
  routinely less competitive than MSG91's India-focused SMS pricing or
  Meta's direct WhatsApp pricing; no clear advantage over the chosen
  combination for this market.

## Decision

WhatsApp via Meta's Cloud API directly (no BSP); SMS via MSG91 as the
fallback channel for a customer with no WhatsApp opt-in or a failed
WhatsApp delivery. Both sit behind a `NotificationChannelPort` alongside
the existing Resend email path — `NotificationsService` picks a channel
per customer preference (falling back email → SMS if WhatsApp isn't
opted in, never silently dropping a transactional message the way a
missing `RESEND_API_KEY` currently causes an intentional skip).

## Consequences

- WhatsApp template pre-approval (Meta requires every business-initiated
  message template approved in advance) adds lead time before launch —
  templates for order confirmation, shipment update, and refund
  confirmation must be submitted and approved before this feature can
  ship, not after.
- Direct Meta Cloud API integration means jwel owns webhook handling for
  delivery status and opt-in/opt-out — more integration surface than a
  BSP's dashboard would require, accepted for the same "go direct where
  reasonable" reasoning as Stripe/Resend.
- A customer with no WhatsApp number recorded, or who opts out, falls
  back to SMS (MSG91) or email — never a bounced notification with no
  fallback attempted.
- Cost is now channel-dependent per message rather than one flat email
  cost — `DOM-NOTIFICATION`'s Edge Cases should account for this in any
  future per-customer channel cost reporting.

## Revisit Criteria

Revisit toward a BSP if direct Meta Cloud API's operational overhead
(webhook handling, template-approval friction) proves costlier in
practice than a BSP's margin would have been — not a hypothetical
concern to design around before real send volume exists.
