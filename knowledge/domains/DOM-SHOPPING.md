---
id: DOM-SHOPPING
title: Jwel / ELYSIAN — Domain: Shopping
version: 1.1.0
status: Frozen
owner: Architecture
reviewers:
  - Vedant
created: 2026-08-07
updated: 2026-08-07
milestone: M5
category: Domains
priority: High
depends_on:
  - ARCH-001
  - CONSTITUTION
required_by: []
related_documents:
  - DISC-004
  - DISC-005
related_decisions:
  - ADR-0009
tags:
  - domain
  - shopping
  - cart
  - wishlist
risk: High
complexity: High
---

# DOM-SHOPPING

**Depth tier: Full** — owns data, carries invariants, and has the most
in-flight change of any context.

## 1. Overview

Shopping owns what a customer has **selected but not yet bought**: the cart
they intend to purchase, and the wishlist they intend to remember. Both are
lists of product variants with a lifecycle shorter and looser than an order —
items appear, disappear and change quantity without consequence until checkout.

This domain is mid-migration. The cart is client-side today and moving
server-side; gift-wrap granularity is changing; and a shareable cart is a
genuinely new capability. This specification describes the **target** state and
marks what is not yet true.

## 2. Ownership

**Owns** *(from `ARCH-001` §1.1)*

- `Cart`, `CartItem` — the pre-purchase selection, its price snapshots,
  gift-wrap flags and guest-token identity
- `Wishlist`, `WishlistItem` — the saved selection
- **Share tokens** on both aggregates

**Explicitly does NOT own**

- **Prices.** Reads Catalog. `CartItem.priceSnapshotMinorUnits` is a snapshot
  *of* Catalog's price, not an independent price.
- **Stock.** Reads Inventory. A cart may hold an item that is out of stock;
  reservation happens at checkout, in Ordering.
- **Orders.** Converting a cart into an order is Ordering's job.
- **Customer identity.** Reads Identity.

## 3. Invariants

| # | Invariant | Source |
| --- | --- | --- |
| 1 | A cart line's identity is **variant + configuration**, not variant alone. Adding a variant with the *same* gift-wrap configuration increments the existing line; adding it with a *different* configuration creates a **separate line**. | Owner decision, 2026-08-07 — see the schema consequence below |
| 2 | `CartItem.quantity > 0`, enforced by the `positive_quantity` CHECK constraint. Reducing to zero removes the line. | KC-134 |
| 3 | Every cart line stores a **price snapshot** taken when the line was created. | KC-132, `STD-DATABASE` r2 |
| 4 | Gift wrap is **per line item**, not per cart. `CartItem.giftWrap` and `giftNote` are the model of record. | KC-147 |
| 5 | A cart belongs to **either** a registered user (`userId`) **or** a guest session (`guestToken`) — never neither. Both columns are unique-nullable. | KC-138 |
| 6 | A guest cart is **claimed** by a user on registration or login; its lines transfer rather than being discarded. | KC-138, KC-125 |
| 7 | A wishlist line is unique per `(wishlistId, variantId)`. Wishlists have no quantity. | schema |
| 8 | Every wishlist has a unique `shareToken`, generated at creation. | KC-136 |
| 9 | A shared view is **read-only to the recipient**. No write of any kind reaches the shared cart or wishlist through a share link, and the owner's identity is never exposed. | Owner decision, 2026-08-07 |
| 10 | Cart contents are **not reserved**. Holding an item in a cart confers no claim on stock. | KC-183 — reservation happens in Ordering |
| 11 | A shared cart is a **snapshot of items and configuration**, and **live for price, availability and coupon applicability**. Which variants, quantities and gift options were shared is fixed at share time; what they cost and whether they can be bought is resolved at open time. | Owner decision, 2026-08-07 |
| 12 | Opening a shared cart never silently discards the recipient's cart. If their cart is non-empty they are **asked**: *merge* or *replace*. If their cart is empty, the shared items are adopted with no prompt. | Owner decision, 2026-08-07 |
| 13 | **Replace** moves the recipient's current cart lines into their **wishlist** before adopting the shared items. A guest choosing replace is prompted to sign in first, because a wishlist requires a registered user. | Owner decision, 2026-08-07 |
| 14 | Moving a line to the wishlist is **upsert-and-ignore** on `(wishlistId, variantId)` — an item already wishlisted is not duplicated and does not error. | Owner decision, 2026-08-07 |
| 15 | **Merge** sums quantities for lines with matching configuration, and keeps differing configurations as separate lines (per Invariant 1). | Owner decision, 2026-08-07 |
| 16 | Adopted items are **copied** into the recipient's own cart and stop being live. The sender cannot affect a cart after it has been adopted. | Derived from Invariant 9 |
| 17 | A guest cart meeting a non-empty account cart on login prompts the same way (Invariant 12) with the same mechanics (13–15). **Replace keeps the cart the customer is currently holding** — the guest cart — and moves the older account cart to the wishlist. | Owner decision, 2026-08-07 |

**Invariants 9, 11 and 12 were settled by the owner on 2026-08-07**, closing
KC-130.

**Invariant 9** matters because a share token is an unauthenticated bearer
credential — anyone with the link has it. Read-only is what keeps a leaked link
from becoming a write capability against someone else's cart.

**Invariant 11 splits the two things a share could mean**, and the split is
right. *Items and configuration* are the sender's intent — "here is what I
picked" — and freezing them means the sender editing their own cart afterwards
does not silently rewrite what the recipient sees. *Price, availability and
coupon applicability* are facts about the world at open time, and showing stale
ones would put a recipient through checkout on a cart they cannot buy.

**Invariants 12–14 remove the data-loss problem** that a plain replace carried.
Nothing is silently discarded: the recipient chooses, and the discarded-by-
choice path preserves their items in the wishlist.

### Two consequences worth stating plainly

**(a) Invariant 1 requires a schema change.** `cart_items` currently carries
`@@unique([cartId, variantId])` — one line per variant per cart. That constraint
is **incompatible with per-line gift wrap** (Invariant 4) and with the merge
rule (Invariant 15): both require the same ring to appear twice, wrapped and
unwrapped.

This conflict predates the merge decision. Invariant 4 was settled on
2026-08-06 (KC-147) and the unique constraint was never revisited; the merge
question is simply what surfaced it. The constraint must be dropped, and line
identity becomes the row id, with "same variant, same configuration" matched in
application logic on add.

**(b) Invariant 11's snapshot needs storage that does not exist.** KC-137
recorded the requirement as "a share token on `Cart`" — that gives a *live*
view of the sender's cart, which is now only half of what is wanted. A snapshot
of items and configuration must be captured at share time and stored
separately, so the sender's later edits do not alter it.

That is a larger data-model addition than a token column, and it belongs in the
shareable-cart `FEAT-` spec at M6, not here.

### Accurate wording is a requirement, not a nicety

Cart lines carry **quantity, gift wrap and a gift note**. `WishlistItem` carries
`wishlistId`, `variantId` and `addedAt` — nothing else. Moving a cart line to
the wishlist therefore **loses quantity, gift wrap and the note**; three
gift-wrapped rings come back as one wishlist entry for the ring.

The prompt must say what actually happens — "we'll save these items to your
wishlist", not "we'll save your cart". Per Constitution Law 1, and per the
owner's own instruction that making the reduction without informing the user is
not acceptable UX.

## 4. API Surface

**Cart** *(server-side; exists in the API, not yet called by the web app —
KC-114)*

- `GET /cart` · `POST /cart/items` · `PATCH /cart/items/:variantId` ·
  `DELETE /cart/items/:variantId` · `DELETE /cart`

**Wishlist** *(**wired 2026-08-08** — `FEAT-WISHLIST-UI`; was KC-115, built with
no storefront UI reaching it)*

- `GET /wishlist` · `POST /wishlist/items` · `DELETE /wishlist/items/:variantId`
- `GET /wishlist/shared/:shareToken` — public, unauthenticated

**Shareable cart** — **does not exist** (KC-129, KC-137). Requires a share
token on `Cart` and a public read endpoint. `Wishlist.shareToken` is the exact
in-repo precedent, and as of `FEAT-WISHLIST-UI` that precedent now includes the
**UI** side too: a read-only shared view that names nobody, is `noindex`, and
404s on an unknown token. Invariants 11–17 are what the cart version adds on
top — snapshot-versus-live, and the merge/replace prompt a wishlist never
needs.

## 5. Events

**Publishes** — none today.

**Consumes** — none today.

Shopping is currently outside the event graph entirely (`ARCH-001` §3). This is
correct: nothing else in the system needs to react to a cart changing. If
abandoned-cart notification is ever wanted, that is the event this domain would
publish, and it would be a new decision, not an implied one.

## 6. Data Ownership

| Table | Notes |
| --- | --- |
| `carts` | `userId` and `guestToken` both unique-nullable (Invariant 5) |
| `cart_items` | Unique `(cart_id, variant_id)`; `positive_quantity` CHECK; price snapshot; per-line gift wrap |
| `wishlists` | Unique `share_token` |
| `wishlist_items` | Unique `(wishlist_id, variant_id)` |

**Reads, does not own:** `product_variants` (price, existence), `inventory_items`
(availability display only).

**Required but absent:** a share token on `carts`.

## 7. Dependencies

**Allowed** — matching `ARCH-001`'s context map:

- **Catalog** — read, for variant existence and price
- **Inventory** — read, for availability display
- **Identity** — read, to associate a cart or wishlist with a user

**Forbidden**

- Writing `product_variants` or `inventory_items`.
- Reserving stock. That is Ordering's, at checkout (Invariant 10).
- Creating orders.
- Any dependency on Payments, Returns, Reviews or Recommendation.

## 8. Edge Cases & Validations

1. **Guest fills a cart, then registers.** Lines transfer (Invariant 6). This
   is the funnel the no-guest-checkout decision (KC-125) depends on — breaking
   it means every registration loses its cart.
2. **Guest with a cart logs into an account that already has one.** Prompted,
   same as the shared-cart flow (Invariant 17). The prompt fires **only when
   both carts are non-empty** — an empty account cart adopts the guest cart
   silently, which is the common case.
3. **Price changes between add-to-cart and checkout.** The snapshot is
   informational; Ordering re-reads the live price at checkout. The customer
   must not be charged a stale price, and must not silently see a changed
   total. Which of "honour the snapshot" or "show the new price" applies is
   **Ordering's decision**, not this domain's.
4. **Variant is archived or soft-deleted while in a cart.** The line must not
   crash the cart view. Ordering rejects the checkout (KC-185's sibling
   behaviour — "no longer available for purchase").
5. **Out-of-stock item in the cart.** Permitted (Invariant 10). Surfaced at
   checkout, not on add.
6. **Migrating client-side carts to server-side.** **Resolved:** existing
   localStorage carts are **dropped** (owner decision, 2026-08-07). Acceptable
   because the storefront is prelaunch and every existing cart belongs to a
   test session. This decision does not survive launch — after go-live the same
   migration would be real customer data loss.
7. **Gift wrap during migration.** Today the UI has one cart-level toggle; the
   model is per-line (Invariant 4). The migration must set the flag on every
   line or the intent is lost. This must be handled **during** the move, not
   after (KC-147).
8. **A shared cart opened after prices or stock changed.** **Resolved:** live
   view (Invariant 11). Unavailable items and changed prices are shown as they
   are now, not as they were when shared. A coupon that no longer applies is
   not silently carried over.
9. **Recipient of a shared cart is not logged in.** They must register before
   checkout (KC-125). A shared cart is therefore an acquisition surface, which
   strengthens rather than conflicts with the registration requirement.
10. **Share token guessing.** Tokens must be unguessable; they are
    unauthenticated bearer credentials.
11. **Recipient opens a shared cart while holding their own.** They are
    prompted (Invariant 12). Neither outcome loses items.
12. **Guest recipient chooses replace.** Sign-in is required first (Invariant
    13), because a wishlist cannot exist without a registered user. This is a
    registration prompt at a moment of high intent, which is consistent with
    the no-guest-checkout rationale (KC-125).
13. **Guest recipient chooses merge.** No sign-in needed — merging into a
    guest cart is fine.
14. **Merging the same ring, one wrapped and one not.** Two separate lines
    (Invariants 1, 15). Quantities sum only within a matching configuration.
15. **Replace when an item is already in the wishlist.** Upsert-and-ignore;
    no duplicate, no error (Invariant 14).
16. **Sender edits their cart after sharing.** The recipient sees the
    *original* items — the share is a snapshot (Invariant 11). There is no
    versioning and no notification, and the sender is not told their link is
    now out of date with their cart.
17. **A shared item's variant is archived or deleted after sharing.** Shown as
    unavailable and **not copied** on adopt. An out-of-stock item *is* copied —
    carts permit that (Invariant 10) and stock is checked at checkout.
18. **Recipient opens the same shared link twice.** The second open prompts
    again. Not idempotent from the customer's side if they added items in
    between, which is acceptable given the prompt.

## Constitution compliance

| Law | How this spec satisfies it |
| --- | --- |
| 1 | §4 marks the shareable cart as not existing and the cart/wishlist APIs as unreached by any UI, rather than implying they are live |
| 2 | Every invariant is sourced; Invariant 9 is marked as new |
| 3 | The cart migration and gift-wrap change are recorded decisions (KC-126, KC-147), not silent drift |
| 4 | Invariants 1, 2, 7 are database constraints; 5 is structural |
| 5 | §7 forbids cross-context writes; stock reservation is explicitly Ordering's |
| 6 | Not applicable to this domain |

## Open items

Three of four are now settled:

- ~~Edge case 6~~ — **drop** existing localStorage carts (prelaunch only).
- ~~Edge case 8~~ — **live view** (Invariant 11).
- ~~Invariant 9~~ — **confirmed** read-only, plus Invariant 12's replace rule.

~~Edge case 2~~ — **settled 2026-08-07** by Invariant 17: prompt on login, same
mechanics as the shared-cart flow.

Three notes on Invariant 17 that the feature spec must not lose:

- **Direction matters and must be explicit.** Both carts belong to the same
  person, so "replace" is ambiguous in a way it was not for a shared cart. It
  means *keep what I am holding now* — the guest cart — and send the older
  account cart to the wishlist. The reverse would discard what the customer
  assembled seconds ago.
- **No sign-in sub-prompt is needed.** Invariant 13's guest blocker does not
  apply here: logging in is the trigger, so a wishlist exists by the time the
  choice is offered.
- **Login frequently happens inside checkout** (`/login?next=/checkout`), so
  this prompt can land between "check out" and the checkout page. Restricting
  it to the both-carts-non-empty case keeps it rare, and registration never
  triggers it at all — a new account has no prior cart.

**Carried to the shareable-cart `FEAT-` spec at M6:**

- Snapshot storage for shared items and configuration (consequence (b) above).
- Dropping `@@unique([cartId, variantId])` (consequence (a) above) — required
  by per-line gift wrap regardless of the shareable cart, so arguably it should
  land with the server-side cart migration instead.

The shareable cart needs a `FEAT-` specification at M6 before implementation
(KC-129). This domain spec defines its **boundary** and its rules; it does not
design the flow.
