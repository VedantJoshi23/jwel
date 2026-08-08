---
id: FEAT-PAYMENT-E2E
title: 'Jwel / ELYSIAN — Feature: End-to-End Coverage of the Payment Path'
version: 0.1.0
status: Review
owner: Architecture
reviewers:
  - Vedant
created: 2026-08-08
updated: 2026-08-08
milestone: M6
category: Features
priority: High
depends_on:
  - STD-TESTING
  - DOM-ORDERING
required_by: []
related_documents:
  - DISC-009
  - STD-CICD
  - FEAT-ORDER-RECONCILIATION
related_domains:
  - DOM-ORDERING
  - DOM-PAYMENTS
related_decisions:
  - ADR-0005
tags:
  - feature
  - testing
  - payments
risk: Medium
complexity: Medium
---

# FEAT-PAYMENT-E2E

## 1. Overview

`STD-TESTING` rule 4 requires automated end-to-end coverage of checkout →
payment → confirmation. `DISC-009` ranked its absence the highest-value gap in
the codebase (KC-121), and the reasoning was uncomfortable: **CI already ran a
real stack**, with a real Postgres, a real API and a real browser. It drove
browsing, search, auth and the admin panel. The one journey the business cannot
afford to break silently was the only one nobody drove.

## 2. Owning Domain

**Owning domain: `DOM-ORDERING`**, whose checkout orchestration this exercises,
crossing into Payments and Inventory exactly as production does.

## 3. Acceptance Criteria

1. A shopper can go from product page to placed order in a browser.
2. The order is verified **from the server**, not from the confirmation page.
3. It reaches `CONFIRMED`, not merely `PLACED`.
4. The bag is emptied by a successful checkout.
5. An order is visible only to the shopper who placed it.
6. Anonymous and empty-bag checkout are handled before submit, not by an error
   after it.

### On criterion 2, which is the whole point

The confirmation page renders from URL parameters. A test that asserts against
it proves the client can build a URL — nothing more. Reading the order back
from `/profile` is what proves it was written, and asserting `CONFIRMED` rather
than `PLACED` is what proves the **reaction chain** ran: payment row written,
`payment.succeeded` emitted, Ordering reacted and moved the order.

`PLACED` there would mean the order exists but the reaction never landed —
precisely the state `FEAT-ORDER-RECONCILIATION` sweeps up. Nothing above unit
level had ever exercised that chain.

## 4. What is real, and what is not

CI resolves `MockPaymentProvider`, so no money moves and no Razorpay modal
opens. **Everything else is the production path**: order and items written in
one transaction, stock reserved, `Payment` row created, event emitted, order
confirmed, `order.confirmed` published and picked up by Notification.

The mock is not a shortcut past the interesting part. The client branches on
`checkout.simulated`, which the **server** decides — so the test drives the
same submit handler a real shopper uses, right up to the gateway boundary.

## 5. Two constraints the tests are shaped around

Both were found by running them, not by reading code.

### 5.1 The auth rate limit

Auth endpoints allow **5 requests per minute per IP** unless `NODE_ENV=test`,
and the CI job ran the API as `development`. `auth.spec.ts` already spent 4 of
those 5 registrations.

So the suite was **one auth test away from failing** before this feature
existed, and the failure would have surfaced in a browser as a form that did
nothing — a 429 looks nothing like a rate limit from the outside.

Two changes, together:

- The e2e job now starts the API with `NODE_ENV=test`, which the throttle
  comment names as exactly this case. It is the only value in the API that
  reads `test`, and payments are unaffected — the mock provider is selected
  whenever `NODE_ENV` is not `production`.
- This spec registers **twice in total**, not once per test: a serial describe
  shares one shopper, and only the isolation test needs a second identity.

### 5.2 Hydration

Every form here is a client handler on a server-rendered element, so **a click
that lands before hydration is silently swallowed** — no error, no state
change, and the failure surfaces three steps later somewhere less obvious.
Measured while writing these: against a dev server the first "Add to bag"
click did nothing at all.

Handled by a bounded `networkidle` wait plus, for add-to-bag, a retry guarded
on the bag's own count so it can never add a second line. The `networkidle`
timeout is deliberately short: it never settles on a page whose `/_next/image`
request stalls — the intermittent optimizer hang `storefront.spec.ts`
documents — and the default 30s turned two tests into 35-second tests waiting
for something that was never coming. Bounding it took the pair from 36s to
6.5s.

## 6. Edge Cases & Validations

1. **Shared session between serial tests.** Necessary to stay inside the rate
   limit, and it means tests inherit each other's bag. Each clears
   `jwel-cart` before it starts.
2. **Seeded stock is finite.** `prisma:seed` creates ten units; this spec
   spends two. A future test that places more should check that budget rather
   than meet it as a confusing "could not place order". *(Found by exhausting
   it locally.)*
3. **A stalled image request.** Navigations use `domcontentloaded` and the
   hydration wait is bounded, so the optimizer hang cannot fail a test that is
   not about images.
4. **The stranger's context.** A separate browser page, so no token and no
   cart leak into the isolation assertion.

## 7. Definition of Done

Verified locally against an **isolated stack** — a scratch database on the
disposable Postgres, the API on :4001, and a **production** web build on :3100,
matching how CI runs it. Deliberately not the machine's production stack on
:3000/:4000, which the repo's Playwright config would otherwise have reused.

| Run | Result |
| --- | --- |
| `checkout.spec.ts` alone, clean database | 5 passed |
| Whole suite, clean database | **17 passed** (admin, auth, checkout, storefront) |
| Before bounding the hydration wait | two tests at 36s |
| After | the same two at 6.5s |

- [x] Payment path driven end to end in a browser.
- [x] Order verified server-side and asserted `CONFIRMED`.
- [x] Cart clearing, ownership isolation, anonymous and empty-bag cases.
- [x] Suite kept inside the auth rate limit, and CI's API given the throttle
      setting the code documents for automated suites.
- [x] Hydration race handled deterministically, without fixed sleeps.
- [x] Existing specs still pass unchanged.

## 8. What this does not cover

**A real gateway.** Nothing here exercises Razorpay's modal, its signature
verification, or its webhook. `ADR-0005` makes Razorpay the sole provider and
its adapter has unit tests, but the seam between the browser, the gateway and
the webhook remains untested by anything automated — and cannot be tested
without credentials CI does not hold.

That is a smaller gap than the one this closes, and it is the one that is left.
Recorded so it is not mistaken for covered.
