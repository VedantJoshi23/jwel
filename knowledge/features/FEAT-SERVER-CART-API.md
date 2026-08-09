---
id: FEAT-SERVER-CART-API
title: 'Jwel / ELYSIAN — Feature: Server-Side Cart (API)'
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
  - FEAT-SHAREABLE-CART
required_by: []
related_documents:
  - STD-DATABASE
  - STD-SECURITY
related_domains:
  - DOM-SHOPPING
related_decisions: []
tags:
  - feature
  - shopping
  - api
risk: High
complexity: High
---

# FEAT-SERVER-CART-API

## 1. Overview

The server-side cart existed but could only ever hold a signed-in user's items,
one line per variant. `DOM-SHOPPING` had since settled five invariants it could
not express — including one the schema actively contradicted.

**This is the API half only.** The storefront still uses its `localStorage`
cart; nothing user-visible changes. That is deliberate: the migration of the
storefront is a second change, reviewable on its own, and shipping the two
together would make a diff nobody can hold in their head.

## 2. Owning Domain

**Owning domain: `DOM-SHOPPING`.**

## 3. The schema contradicted an invariant

`cart_items` carried `@@unique([cartId, variantId])` — one line per variant per
cart. `DOM-SHOPPING` consequence (a) records that this is **incompatible** with
two invariants settled after it was written:

- **Invariant 4** — gift wrap is per line, so the same ring must be able to
  appear wrapped and unwrapped.
- **Invariant 15** — merging two carts keeps differing configurations as
  separate lines.

The conflict predates the merge decision: Invariant 4 was settled on
2026-08-06 and the constraint was never revisited. Dropped here, in a
hand-written migration (KC-144), with a plain index on `cart_id` taking over
the lookup the unique was incidentally providing.

`cart_share_items` was already created without it (`FEAT-SHAREABLE-CART`), so
this brings the live cart in line with the snapshot table rather than the other
way around.

**Line identity is now the row id**, with *same variant, same configuration*
matched in application logic on add. Which means `PATCH /cart/items/:variantId`
stopped identifying anything — a variant can appear twice — so lines are
addressed by **line id**.

## 4. Guest carts — Invariant 5

A cart belongs to **either** a registered user **or** a guest session, never
neither. Prisma cannot express that XOR, so the service does: exactly one of
the two columns is ever written.

A guest identifies its cart with an `x-guest-cart-token` header, and every cart
route is public with an optional JWT — a guest has a cart and must be able to
use one without an account.

**A signed-in user always wins.** A request carrying both a token and a guest
header uses the account and ignores the header. Otherwise anyone could read or
edit a guest cart by presenting its token alongside their own login, and a
guest token is an unauthenticated bearer credential travelling in a header.

**A request with neither is refused**, not handed an empty cart — an empty cart
would quietly discard whatever the shopper just added.

## 5. Claiming — Invariants 6, 12-15 and 17

`POST /cart/claim` hands a guest cart to the account that just signed in.

| Situation | Result |
| --- | --- |
| No guest cart, or an empty one | `nothing_to_claim` |
| Account cart empty | `adopted`, no prompt (Invariant 12) |
| Both non-empty, no strategy | **`conflict`, and nothing changes** |
| `merge` | Sums matching lines, keeps differing configurations separate (15, 1) |
| `replace` | Account cart → wishlist, then the guest cart wins (13, 17) |

**The API never decides.** With two non-empty carts and no strategy it reports
the conflict and touches nothing: Invariant 12 forbids silently discarding
either side, so the prompt belongs to the client and the choice to the
customer.

### The direction in Invariant 17 is easy to get backwards

Both carts belong to the same person, so "replace" is ambiguous in a way it was
not for a shared cart. It means **keep what I am holding now** — the guest cart
— and send the older account cart to the wishlist. The reverse would discard
what they assembled seconds ago.

Two supporting details:

- Lines are **re-parented, not copied**, so the price snapshot each line was
  created with survives (Invariant 3). Copying would silently reprice at merge
  time.
- Wishlist saves are **upsert-and-ignore** (Invariant 14) and a failure is
  logged rather than thrown — a failed save must not strand the customer
  between two carts.

**What replace loses**, and the UI must say so: `WishlistItem` carries no
quantity, gift wrap or note, so three gift-wrapped rings come back as one
wishlist entry. "Moved to your wishlist", never "we saved your cart".

## 6. Edge Cases & Validations

1. **Same variant, two configurations.** Two lines. *Verified live: plain and
   gift-wrapped are separate; a second plain add sums into the plain one.*
2. **Quantity set to zero.** Removes the line (Invariant 2) rather than storing
   a value the CHECK would reject.
3. **A line id from someone else's cart.** 404 — lines are looked up within the
   caller's own cart.
4. **Guest token plus a login.** Account wins. *Verified live.*
5. **Neither identity.** `401`. *Verified live.*
6. **A wishlist that does not exist yet** at replace time. Created.

## 7. Definition of Done

Verified against the live API:

| Case | Result |
| --- | --- |
| Guest adds plain, wrapped, then plain again | **2 lines**; plain summed to 3 |
| Request with no identity | **401** |
| Login with both carts non-empty | `conflict`, nothing moved |
| `replace` | guest cart kept; **older account cart in the wishlist** |
| `merge` | matching line summed to 3, other kept; wishlist untouched |
| Empty account cart | `adopted`, no prompt |
| Guest header alongside a login | account cart returned |

- [x] `@@unique([cartId, variantId])` dropped, hand-written migration applied.
- [x] Lines addressed by line id; configuration-aware add.
- [x] Guest carts via header, with the account-wins rule.
- [x] `POST /cart/claim` with merge/replace/conflict.
- [x] 795 API tests green.

## 8. What comes next, and what is still open

**The storefront still uses `localStorage`.** Everything above is unused by the
shipped UI until the migration lands — deliberately, so that change can be
reviewed on its own.

Two things become possible only after it:

- **Gift wrap and note in a shared cart.** `FEAT-SHAREABLE-CART` §10 records
  that the API, snapshot and shared view all handle them while the sender's
  browser cart cannot supply them. The server cart can.
- **Invariant 17's prompt.** The API reports `conflict`; nothing shows it yet.

**Guest carts are never expired.** A cart row per guest browser, forever. Not a
problem at this volume, and a retention policy is a decision rather than an
oversight — the same open question as `cart_shares`.
