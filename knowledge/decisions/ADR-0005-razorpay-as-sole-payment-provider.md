---
id: ADR-0005
title: Razorpay as the Sole Payment Provider, Stripe Dropped
version: 1.0.0
status: Accepted
owner: Architecture
reviewers: []
created: 2026-07-27
updated: 2026-07-27
milestone: M12
category: Decision
priority: Critical
depends_on: []
required_by: []
tags:
  - payments
  - decision
risk: High
complexity: Medium
---

# ADR-0005 — Razorpay as the Sole Payment Provider, Stripe Dropped

## Context

Every document in this repository — `PRODUCT.md` FR-9, `ARCHITECTURE.md`'s
deployment diagram, `SECURITY.md` §4, `DATABASE.md`'s `payments` notes — has
described the same split since Milestone 0: **Stripe live, Razorpay stubbed
behind the same port**. `StripePaymentProvider` is fully implemented;
`RazorpayPaymentProviderStub` throws `ServiceUnavailableException` on every
method, deliberately, so it can never be reached by accident.

The client has now decided to run on **Razorpay only**. This is a commercial
decision, not a technical one, and it is not a close call to re-litigate: the
storefront is India-only and INR-only, Stripe India is invite-only, and the
client's payout, GST and chargeback relationships all sit with one gateway.

Two facts make this cheaper than it looks, and one makes it more expensive:

- Cheap: `PaymentProviderPort` already exists and `PaymentsService` never
  branches on a gateway-specific event type — it consumes a provider-neutral
  `WebhookOutcome`. This is exactly the vendor-lock-in insurance `PRODUCT.md`
  NFR-9 committed to, now being cashed in for the first time.
- Cheap: Razorpay is INR-native and denominates in paise, matching the
  existing `*MinorUnits` convention with no conversion layer.
- **Expensive**: the port is not as provider-neutral as it looks.
  `CreatePaymentIntentResult` returns `{ providerRef, clientSecret }`, and
  `clientSecret` is a Stripe concept with no Razorpay equivalent. The port
  leaks its first implementation's vocabulary.

Separately and independently of the gateway choice: **the frontend has no
payment step at all.** `apps/web/lib/api/` contains no `payments.ts`, and
`checkout/page.tsx` calls `createOrder` and routes straight to the confirmation
page, discarding the `clientSecret` the API returns. Earlier milestone docs
filed this as "Stripe Elements deferred", which reads like a widget swap. It is
not — the client half of checkout has never been built.

## Options Considered

- **Razorpay Standard Checkout (hosted modal).** Razorpay's `checkout.js`
  renders the payment form in their own iframe; card details never touch a Jwel
  origin, so PCI scope stays at SAQ A — the same posture `SECURITY.md` §4
  already claims. Supports UPI, cards, netbanking and wallets with no
  per-method work, and UPI is not optional for an Indian storefront.
  Costs an external script tag and a CSP allowance.
- **Custom in-app payment form against Razorpay's APIs.** Full control over the
  checkout's visual design, which `DESIGN.md` would otherwise dictate. Rejected:
  substantially more work, widens PCI scope from SAQ A, and re-implements
  per-method flows (UPI intent, netbanking redirects) that the hosted modal
  handles. The storefront's design system does not extend into a payment form
  today, so there is nothing to match yet.
- **Razorpay Payment Links / hosted page.** Simplest possible integration.
  Rejected: the shopper leaves the storefront mid-checkout, which is a
  conversion cost a luxury-jewellery purchase can least afford.
- **Keep Stripe alongside Razorpay as a second live provider.** Rejected — the
  client will not hold two gateway accounts, and a second adapter nobody has
  credentials for is exactly the "reasoned-through but unproven" state
  Milestone 11 spent a whole milestone arguing against.

## Decision

**Razorpay is the sole payment provider, integrated via Standard Checkout.**
`StripePaymentProvider` is deleted rather than left dormant.

`PaymentProviderPort` **stays**, and `CreatePaymentIntentResult` is reshaped off
`clientSecret` to something Razorpay-shaped
(`{ providerRef, checkoutOrderId, keyId }`). Keeping the port with a single
implementation is deliberate: it is the thing making this swap a contained
change instead of a rewrite, and deleting it would discard that insurance at
the exact moment it proved its worth.

`PaymentProvider.STRIPE` is **retained as an unused Prisma enum member**. No row
has ever referenced it, and dropping an enum value costs a migration for no
benefit.

The `refund()` method that `PaymentProviderPort` has been missing since
Milestone 7 is added in the same pass — with one adapter instead of two, there
is no longer a reason to defer it.

## Consequences

- The port's return shape changes, so `PaymentsService`, `OrdersService`
  (whose `dto.paymentProvider ?? PaymentProvider.STRIPE` default flips to
  `RAZORPAY`), and the checkout response contract all move together. This is a
  breaking change to `POST /api/v1/orders`' response body.
- The webhook route changes from `/payments/webhook/stripe` to
  `/payments/webhook/razorpay`, with `X-Razorpay-Signature` (HMAC-SHA256 over
  the raw body) replacing Stripe's `constructEvent`. The port's existing
  contract — that an invalid signature **throws** rather than returning an
  `ignored` outcome — carries over unchanged and is still the right rule.
- **A new client-side trust boundary exists that did not before.** Standard
  Checkout returns a signature to the *browser*, and a browser-supplied result
  is attacker-controllable. It must be verified server-side, and even then the
  authoritative confirmation remains the signed webhook. This is the single
  easiest thing to get wrong in this integration.
- `RAZORPAY_KEY_ID` is public by design — it goes to the browser. The other two
  keys are server-only. Next.js inlines any `NEXT_PUBLIC_*` variable into the
  client bundle, so the naming discipline here is load-bearing, not cosmetic.
- Both apps enforce hard 90% coverage gates, so deleting the Stripe specs and
  adding the Razorpay/refund paths must land together with their tests.
- `PAYMENTS_MODE=simulated` and the whole demo-mode mechanism are unaffected —
  that logic is provider-independent, and `RUNBOOK.md` §13's argument for why a
  loud opt-in beats commenting the payments module out still holds exactly.
- The checkout E2E test blocked since Milestone 7 becomes unblockable-no-longer
  once real test-mode credentials exist — the first end-to-end proof that
  checkout works, which no milestone has ever had.

## Revisit Criteria

Revisit only if Razorpay's commercial terms change materially, or if expansion
outside India creates a market Razorpay does not serve — at which point the
port earns its keep a second time. Do **not** revisit to add a second provider
"for redundancy" without a concrete failure that redundancy would have
prevented; two live gateways is two sets of credentials, webhooks and
reconciliation for a shop that has not yet taken its first real payment.
