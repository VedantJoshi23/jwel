---
id: FEAT-CUSTOMER-RETURNS
title: 'Jwel / ELYSIAN — Feature: Customer-Initiated Returns'
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
  - DOM-RETURNS
  - FEAT-SETTINGS-STORE
  - FEAT-CLAIMS-GATE
required_by: []
related_documents:
  - DISC-003
  - STD-ACCESSIBILITY
related_domains:
  - DOM-RETURNS
related_decisions: []
tags:
  - feature
  - returns
  - storefront
risk: Medium
complexity: Low
---

# FEAT-CUSTOMER-RETURNS

## 1. Overview

The FAQ has told customers to *"start a return from your order history"* since
the page was written. Order history had no such control. The customer return
endpoints existed and **no storefront surface reached them** (KC-117) — returns
were admin-initiated, which is to say a customer had to email and hope.

That was `self-serve-returns` in the claims registry, and this feature is what
lets it be marked resolved rather than deleted.

## 2. Owning Domain

**Owning domain: `DOM-RETURNS`.** No backend change: `POST /returns`,
`GET /returns` and `GET /returns/:id` already existed, already enforced every
invariant, and already carried the return window as of `FEAT-SETTINGS-STORE`.

This is a storefront feature over an API that was finished before it.

## 3. Acceptance Criteria

1. A customer can request a return **per order item**, from order history.
2. The control appears only on `DELIVERED` orders.
3. An item that already has a request shows its status instead of a second
   control.
4. A Returns tab lists every request with its status.
5. A refusal shows **the API's own message**, not a generic one.
6. **No cancel control, anywhere.**
7. A rejected request points out of band and offers no re-request.

### On criteria 6 and 7

`DOM-RETURNS` Invariant 6: a customer may not cancel a pending request and may
not re-request after a rejection; exceptions are handled out of band.

`DOM-RETURNS` §4 goes further and says why it is worth repeating: a cancel
control is *"the natural thing for a frontend developer to add"*. So the rule
is stated at the component, and a test asserts no button anywhere in the form
says cancel or withdraw. The API has no cancel endpoint either — verified, it
404s — but the absence is a decision, not an oversight, and code that only
happens to be correct drifts.

## 4. API Surface

**None added.** The storefront calls the three endpoints that already existed.

Returns are per **order item**, not per order, because that is how the domain
models them: each item may have at most one request, ever, enforced by a unique
constraint.

## 5. Design decisions worth recording

**Return state is read from `GET /returns`, not from the order.** The customer
order endpoint does not carry return state, and the Returns tab loads the
returns list anyway — so cross-referencing by order-item id avoids both a
backend change and a second source of truth for the same fact.

**The control is offered only on delivered orders.** Invariant 1 refuses
anything else, and a button that exists to produce a 400 is a surface asserting
a capability the system does not have.

**Refusals show the API's message.** It is the only party that knows *why*, and
its message is specific — *"The 10-day return window for this order closed on
2026-07-29"* names the date. A generic "could not start that return" would
throw that away and generate a support email.

## 6. Edge Cases & Validations

1. **An item already returned.** Shows the request's status; no second control
   (Invariant 2, which the API enforces with a 409 — verified).
2. **The return window has closed.** The API refuses with the closing date, and
   the form stays open so the customer can read it.
3. **A rejected request.** Says to reply to the order email. No re-request
   button, by Invariant 6.
4. **An order that is not delivered.** No control at all.
5. **Notes left empty.** Sent as `undefined`, not an empty string.
6. **A multi-item order.** Each item is independent — one may be returned while
   the others are kept, which is exactly the partial-return case
   `FEAT-ORDER-REFUND-STATE` handles on the other side.

## 7. Non-Functional Considerations

| Standard | Bearing |
| --- | --- |
| **`STD-ACCESSIBILITY`** | Every field is labelled (rule 7), the refusal is `role="alert"`, and return status is a text badge, never colour alone (rule 6). The profile page is already under the `axe` scan. |
| **`STD-TESTING`** | Every §6 case has a test, including the one guarding Invariant 6. |
| **`STD-API`** | No new endpoint; the existing contract is used as specified. |

**Law 1 check.** This feature removes a Law 1 violation rather than risking
one: the FAQ's claim becomes true.

## 8. Definition of Done

Verified against a live API — a real order driven to `DELIVERED`, then returned
through the exact calls the UI makes:

| Case | Result |
| --- | --- |
| Request a return | `REQUESTED`, reason and notes stored |
| `GET /returns` | the request, with its product name — what the Returns tab renders |
| Second request, same item | **409** *"A return has already been requested for this item"* |
| Delivery backdated 20 days | **400** *"The 10-day return window for this order closed on 2026-07-29"* |
| `DELETE /returns/:id` | **404** — no cancel endpoint exists |

- [x] Request control per item on delivered orders.
- [x] Returns tab with per-request status and refunded amount.
- [x] API refusals surfaced verbatim.
- [x] No cancel or re-request control; a test guards it.
- [x] 13 tests added; 414 web tests green.
- [x] `self-serve-returns` marked **resolved** in the claims registry.
- [x] `DOM-RETURNS` §4 updated — it recorded this UI as unbuilt.

## 9. What is still not built

**Nothing tells the customer their return moved.** `return.requested` and
`return.refunded` are consumed by Notification, which is email-only and
currently unconfigured in most environments. A customer who requests a return
sees it in this tab and nowhere else until they come back and look.

Recorded rather than assumed: the tab makes the state *visible*, not *pushed*.
