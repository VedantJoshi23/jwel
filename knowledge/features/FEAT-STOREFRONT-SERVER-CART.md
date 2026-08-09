---
id: FEAT-STOREFRONT-SERVER-CART
title: 'Jwel / ELYSIAN — Feature: The Storefront Moves to the Server Cart'
version: 0.1.0
status: Review
owner: Architecture
reviewers:
  - Vedant
created: 2026-08-09
updated: 2026-08-09
milestone: M6
category: Features
priority: High
depends_on:
  - DOM-SHOPPING
  - FEAT-SERVER-CART-API
  - FEAT-SHAREABLE-CART
required_by: []
related_documents:
  - FEAT-CLAIMS-GATE
  - STD-SECURITY
related_domains:
  - DOM-SHOPPING
related_decisions: []
tags:
  - feature
  - shopping
  - storefront
risk: High
complexity: High
---

# FEAT-STOREFRONT-SERVER-CART

## 1. Overview

The bag lived in `localStorage`. `DOM-SHOPPING` models carts as rows with
invariants attached, and **none of them could be enforced against a store the
API could not see** — no cross-device persistence, no guest-cart claiming, no
per-line gift wrap, and Invariant 17's prompt had nothing to prompt about.

`FEAT-SERVER-CART-API` built the server half. This is the storefront moving
onto it, and the removal of the zustand store.

## 2. The seam held

Every consumer went through `useCart()`, so the migration is mostly one file.
Two things had to change at the callers:

- **Lines are addressed by line id**, not variant id — a variant can appear
  twice with different gift options (Invariant 1).
- **Mutations are asynchronous.** Callers that fired and forgot now have a
  promise, and the cart page distinguishes *loading* from *empty*, because
  showing "your bag is empty" while it loads tells a shopper their items are
  gone.

Adding sends **only the variant and the quantity**. The old store carried its
own copy of the name and the price and could drift from the catalogue; now the
server holds both, so nothing sent from the browser can disagree with it.

Prices shown come from each line's **snapshot** (Invariant 3) — a bag shows
what the pieces cost when they went in.

## 3. Invariant 17's prompt, at last

`ClaimGuestCart` hands this browser's guest bag to the account that just signed
in. The first call carries **no strategy**: the API answers `conflict` when both
bags hold something and changes nothing, because Invariant 12 forbids
discarding either side without being told to.

**Mounted in the storefront chrome, not on the cart page**, for two reasons
found while wiring it:

- the claim must run even when the account bag is **empty** — that is the
  silent-adoption case, and the cart page returns early on an empty bag, so it
  would never have run;
- someone signing in lands wherever they were going, which is usually not
  `/cart`.

**The wording carries the invariant.** Both bags belong to the same person, so
"replace" has to say which survives: *"Keep the bag I was just building — move
the older pieces to my wishlist"*. And it says *moved to your wishlist*, never
"we saved your bag", because a wishlist entry carries no quantity, gift wrap or
note.

A failed claim is silent: the guest bag stays, the account bag is untouched,
and the next sign-in tries again. Alarming someone mid-login helps nobody.

## 4. Two dead controls found on the way

The cart page had a **gift-wrap checkbox and a newsletter opt-in that were
local state going nowhere** — never sent, never stored, never read.

- **Gift wrap** is per line (Invariant 4), which a single cart-level switch
  cannot express even in principle. The control is gone; the server now holds
  the real thing, and the shared-cart sender carries it — closing
  `FEAT-SHAREABLE-CART` §10's gap.
- **The newsletter opt-in has nothing behind it at all**: no list, no provider,
  no endpoint. The checkbox is gone and the claim is now tracked in the
  storefront claims registry, where the footer's sign-up form still stands as
  outstanding. Collecting clicks nobody reads is worse than not asking.

## 5. Edge Cases & Validations

1. **A visitor who never adds anything.** No guest token is created, so no cart
   row exists. Reads send no header and get nothing.
2. **Storage unavailable.** No token, no cart — degraded, never broken.
3. **Loading versus empty.** Distinguished; see §2.
4. **Signing out.** The query is keyed by token, so the next identity's bag is
   fetched rather than the previous one lingering.
5. **A stale guest token after a successful claim.** Cleared, since it now
   points at a deleted cart and would be offered again next sign-in.
6. **A conflict left unresolved.** The token is kept until the customer
   chooses — clearing it early would make the guest bag unreachable.

## 6. Definition of Done

Verified against a live API and a production web build:

| Case | Result |
| --- | --- |
| Whole e2e suite | **41 passed** |
| Guest bag meets account bag at sign-in | prompt shown, **not** resolved silently |
| "Keep both" | merged; both pieces in the bag afterwards |
| Web unit suite | 468 passed |

- [x] `useCart` backed by the API; the zustand store deleted.
- [x] All eight consumers migrated, including the shared-cart adoption.
- [x] Guest identity via `x-guest-cart-token`, created lazily.
- [x] Invariant 17's prompt, in the chrome so it always runs.
- [x] Gift options carried into a shared cart.
- [x] Two dead controls removed; the newsletter claim registered.
- [x] An e2e for the guest-meets-account journey, which nothing could exercise
      before.

## 7. What is still open

- **Per-line gift wrap has no UI yet.** The schema, the API, the share and the
  adoption all carry it; nothing on the cart page sets it. That is a design
  question — where a per-line control lives in this layout — rather than a
  missing capability.
- **Guest carts are never expired**, one row per guest browser. Same open
  question as `cart_shares`: a retention policy is a decision.
- **The newsletter form in the footer still posts nowhere.** Now tracked as a
  claim rather than silently accepted.
