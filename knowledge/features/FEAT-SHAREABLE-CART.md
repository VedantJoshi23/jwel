---
id: FEAT-SHAREABLE-CART
title: 'Jwel / ELYSIAN — Feature: Shareable Cart'
version: 0.1.0
status: Review
owner: Architecture
reviewers:
  - Vedant
created: 2026-08-08
updated: 2026-08-08
milestone: M6
category: Features
priority: Medium
depends_on:
  - DOM-SHOPPING
  - FEAT-WISHLIST-UI
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
  - storefront
risk: Medium
complexity: Medium
---

# FEAT-SHAREABLE-CART

## 1. Overview

`DOM-SHOPPING` recorded the shareable cart as **not existing** (KC-129,
KC-137), needing storage that had not been designed, and said it belonged in
its own `FEAT-` spec at M6. This is that spec, and its implementation.

It also closes the smaller defect flagged alongside `FEAT-WISHLIST-UI`: a saved
or shared item whose product is no longer on sale.

## 2. Owning Domain

**Owning domain: `DOM-SHOPPING`**, Invariants 9 and 11–16.

## 3. The design decision that shaped everything else

KC-137 recorded the requirement as *"a share token on `Cart`"*. **That would
have been wrong**, and `DOM-SHOPPING` consequence (b) says why: a token on the
live cart gives a *live view*, so the sender editing their own bag afterwards
silently rewrites what the recipient sees.

Invariant 11 wants both halves at once — **frozen in what, live in how much**:

| Fixed at share time | Resolved at open time |
| --- | --- |
| Which variants, how many, gift wrap and note | Price, availability |

So the snapshot is **its own table** (`cart_shares`, `cart_share_items`), and
it deliberately **stores no price**. Prices are read from the variant when the
link is opened, which makes the live half true *by construction* rather than by
remembering to refresh something.

It also stores **no owner**. Invariant 9 says a shared view never exposes the
sender's identity, and the surest way to honour that is never to record it —
verified: the response body contains no user id and no email.

## 4. Why the lines are sent by the client

`POST /cart/shares` takes the lines in its payload, which reads oddly for an
API until you notice the storefront cart lives in the browser
(`lib/cart-store`), not in `carts`. Sharing the server cart would share an
empty one, because nothing writes to it.

Nothing is trusted from that payload beyond *which variant* and *how many*: no
price is accepted or stored, so the worst a forged request can do is produce a
link to products that exist. Variants are validated at share time so a stale
browser cannot mint a link to nothing — but **availability deliberately is
not**, because that is an open-time fact and a piece selling out between share
and open must mark that line rather than 404 the whole link.

**Creating a share needs no account.** A guest has a cart (Invariant 5) and is
arguably the person most likely to be sending one to someone else.

## 5. Adopting — Invariants 12 to 16

| # | Rule | How |
| --- | --- | --- |
| 12 | Never silently discard the recipient's cart | Empty cart adopts with no prompt; a non-empty one is **asked**: merge or replace |
| 13 | Replace saves their pieces to their **wishlist** first | And a guest is prompted to sign in, because a wishlist needs a registered user |
| 14 | Wishlist moves are upsert-and-ignore | A failed save does not abort adoption; the message stays honest about what was saved |
| 15 | Merge sums matching lines | The cart store already sums by variant |
| 16 | Adopted lines are **copied** | Written into the local cart; the token is not retained, so the sender can never affect them again |

Invariant 13's guest case is **offered and explained, not hidden** — a choice
that silently disappears for guests is a worse answer than one that says why it
is unavailable.

Unavailable lines are never adopted, by either path.

## 6. The wishlist availability fix

Flagged in `FEAT-WISHLIST-UI` §9: a saved variant whose product was later
unpublished still appeared, and could be opened into a 404.

Fixed **asymmetrically**, which is the interesting part:

| Surface | Behaviour | Why |
| --- | --- | --- |
| The owner's own wishlist | **Shown**, marked *No longer available*, no link, no add-to-bag, still removable | They chose to save it. A list that quietly shrinks is worse than one that explains itself |
| A shared wishlist | **Filtered out** at the API | That URL is public; exposing the name and price of an unpublished product turns a wishlist into a catalogue leak |

A shared **cart** differs again: unavailable lines are *shown and marked*,
because the recipient should see the sender meant to send them. The wishlist's
public view has no such sender to represent.

## 7. Edge Cases & Validations

1. **Price changes after sharing.** The link shows the new price. *Verified
   live: 8500000 at share time, 9900000 after an update.*
2. **A product is unpublished after sharing.** The line is shown as
   unavailable, not dropped. *Verified live.*
3. **The same variant twice with different gift options.** Two lines
   (Invariant 1) — which is why `cart_share_items` deliberately carries **no**
   unique on `(shareId, variantId)`, unlike `cart_items`.
4. **A nonexistent variant.** Refused at share time with a 400.
5. **An unknown token.** 404 at the API and at the page.
6. **A real failure behind a share link.** Surfaces; only a 404 becomes
   `notFound()`.
7. **The clipboard refusing permission.** The link is still shown — a refused
   copy must not read as a failure to create it.
8. **Sharing twice.** Two links, each frozen at its own moment. The first keeps
   showing what was actually sent.

## 8. Non-Functional Considerations

| Standard | Bearing |
| --- | --- |
| **`STD-DATABASE`** | Hand-written migration (KC-144). `positive_quantity` CHECK mirrors `cart_items`. No stored price — the derivation lives where it is read (r9). |
| **`STD-SECURITY`** | The token is an unguessable bearer credential granting read-only access to items only. The page is `noindex`. Share creation is unauthenticated but cannot express anything but variant ids and quantities, and is bounded by a 100-line cap and the global throttle. |
| **`STD-ACCESSIBILITY`** | External links carry `rel="noopener noreferrer"` and a new-tab hint; status messages use `role="status"`/`role="alert"`. |

## 9. Definition of Done

Verified against the live API:

| Case | Result |
| --- | --- |
| Create a share, unauthenticated | token returned |
| Open it, unauthenticated | items with gift wrap and note; **no owner in the body** |
| Price changed after sharing | new price shown |
| Product archived after sharing | line shown, `available: false` |
| Same product on a shared **wishlist** | filtered out entirely |
| Nonexistent variant | **400** |
| Unknown token | **404** |

- [x] `cart_shares` / `cart_share_items`, hand-written migration, applied.
- [x] `POST /cart/shares`, `GET /cart/shared/:token`, both public.
- [x] Snapshot of items and configuration; price and availability live.
- [x] Merge / replace prompt with the wishlist move and the guest sign-in path.
- [x] Wishlist availability fixed, asymmetrically, with the reasoning recorded.
- [x] 44 tests added; 459 web tests and the API suite green.

## 10. What this does not do

- **Gift wrap and gift note are not shared yet from the storefront**, because
  the local cart does not carry them — `CartItem.giftWrap` is per line in the
  schema (Invariant 4) and the browser store has a single cart-wide checkbox.
  The API, the snapshot and the shared view all handle them; only the sender's
  cart cannot yet supply them. That gap belongs with the server-side cart.
- **`cart_items` still carries `@@unique([cartId, variantId])`**, which
  `DOM-SHOPPING` consequence (a) says must be dropped for per-line gift wrap.
  Untouched here deliberately: nothing in this feature writes `cart_items`, and
  dropping a constraint on a table this feature does not use would be an
  unrelated migration hiding inside a feature branch.
- **Shares are never expired or garbage-collected.** Every share is a row that
  lives forever. Not a problem at this volume, and a deletion policy is a
  decision — how long is a shared bag meant to work? — rather than an
  oversight.
