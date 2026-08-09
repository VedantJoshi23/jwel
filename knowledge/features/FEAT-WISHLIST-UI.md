---
id: FEAT-WISHLIST-UI
title: 'Jwel / ELYSIAN — Feature: Wishlist and Wishlist Sharing'
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
required_by: []
related_documents:
  - DISC-003
  - STD-ACCESSIBILITY
  - STD-SECURITY
related_domains:
  - DOM-SHOPPING
related_decisions: []
tags:
  - feature
  - shopping
  - storefront
risk: Low
complexity: Low
---

# FEAT-WISHLIST-UI

## 1. Overview

`DOM-SHOPPING` §4 records the wishlist as *"exists; no storefront UI reaches
it"* (KC-115). Every endpoint was built — save, remove, read, and a public
read-by-share-token — and `Wishlist.shareToken` was generated for every
wishlist that ever existed. Nothing in the storefront referenced any of it.

This is the UI, including the share journey the token was created for.

## 2. Owning Domain

**Owning domain: `DOM-SHOPPING`.** No backend change.

## 3. Acceptance Criteria

1. A signed-in customer can save and unsave the **selected variant** from a
   product page.
2. A wishlist page lists saved pieces, removes them, and moves them to the bag.
3. The share link is reachable, copyable, and shareable to WhatsApp.
4. A shared view is **read-only** and **names nobody** (Invariant 9).
5. A shared link is **not indexable**.
6. A logged-out visitor is sent to log in rather than shown a control that
   would fail.

### On criterion 1, and why per-variant

Invariant 7: a wishlist line is unique per `(wishlistId, variantId)` and
carries **no quantity**. Saving is therefore a property of the variant, not the
product — the gold ring and the silver one are two entries, which is what a
customer choosing between them wants.

### On criterion 6

There is no guest wishlist, and Invariant 13 depends on that fact (a guest
choosing *replace* on a shared cart must sign in first, precisely because a
wishlist needs a registered user). So the product page offers a **log in to
save** link rather than a control that would 401, and the header icon appears
only when signed in. An icon that leads to a login wall advertises something
the visitor cannot use.

## 4. API Surface

**None added.** `GET /wishlist`, `POST /wishlist/items`,
`DELETE /wishlist/items/:variantId`, `GET /wishlist/shared/:shareToken`.

## 5. The share link

`Wishlist.shareToken` is an unguessable bearer credential, and Invariant 9 makes
what it opens **read-only, with the owner's identity never exposed**.

The API enforces that rather than trusting the client: `getByShareToken`
returns `{ items }` and nothing else — no user id, no email, no counts. Verified
against the live API, the response body contains neither.

The page adds three things the API cannot:

- **It says what sharing does.** *"Anyone with this link can see these pieces.
  They cannot change your list, and it does not show them who you are."* An
  invariant the owner cannot see is a promise they cannot rely on.
- **`noindex`.** An unguessable token is the only credential; a crawler that
  found one would turn a private link into a public page.
- **A 404 on a bad token**, rather than an error page — the link is simply not
  a thing, and saying more would confirm which tokens exist.

**WhatsApp is the share channel the journey named**, and it now works: the same
click-to-chat mechanism as the footer link, with no Business API involved.

## 6. Edge Cases & Validations

1. **Saving twice.** The API is idempotent — a second save returns the same
   wishlist rather than erroring. Verified: `201`, one item.
2. **An empty wishlist.** Says nothing is saved. The share box is hidden —
   sharing an empty list is a link that wastes the recipient's time.
3. **An unknown or retired share token.** 404, both at the API and the page.
4. **A real failure behind a share link.** A 500 surfaces rather than being
   flattened into "not found", which would hide an outage behind a friendly
   page. Covered by a test, because that mistake is easy to make in the same
   `catch`.
5. **Price on a saved piece.** Read live, not snapshotted at save time. A saved
   piece is a reminder, not a quote. Invariant 11 splits snapshot from live for
   a shared *cart*; a wishlist has no configuration to snapshot, so all of it
   is live.
6. **A saved variant that is later unpublished.** Not handled — see §9.

## 7. Non-Functional Considerations

| Standard | Bearing |
| --- | --- |
| **`STD-SECURITY`** | The share token is a bearer credential in a URL. It grants read-only access to items only, the endpoint is deliberately public, and the page is `noindex`. |
| **`STD-ACCESSIBILITY`** | The save control states its state in words with `aria-pressed`, rather than leaving a filled heart to carry it (rule 6). External links carry `rel="noopener noreferrer"` and an "opens in a new tab" hint. The pages are under the `axe` scan. |
| **`STD-TESTING`** | Every §6 case has a test, including the read-only guarantee — the shared page is asserted to offer no button that removes, adds or edits. |

## 8. Definition of Done

Verified against the live API and a production web build:

| Case | Result |
| --- | --- |
| Save an item | wishlist has 1 item, share token generated |
| `GET /wishlist/shared/:token`, unauthenticated | `{ items }` only — **no userId, no email** in the body |
| Unknown token | **404** at the API and the page |
| Save the same variant twice | `201`, still one item |
| Shared page rendered | product visible, `noindex` present |

- [x] Save/unsave per variant on the product page.
- [x] Wishlist page: list, remove, add to bag, share.
- [x] WhatsApp share link.
- [x] Shared view read-only, anonymous, `noindex`, 404 on bad token.
- [x] 18 tests added; 432 web tests green; 23 accessibility scans still pass.
- [x] `DOM-SHOPPING` §4 updated — it recorded this surface as missing.

## 9. What this does not do

- **A saved variant that is later unpublished or deleted still appears.** The
  API returns whatever the variant row says; nothing filters on publication
  state. A customer could open a saved piece and reach a 404. Worth fixing on
  the API side, where the same filter already exists for cart and search.
- **The shareable *cart* still does not exist** (KC-129, KC-137). It needs a
  share token on `Cart` and a public read endpoint, and it depends on the
  server-side cart, which the storefront also does not use yet. `DOM-SHOPPING`
  Invariants 11–17 specify it in full; this feature is the in-repo precedent
  those invariants point at.
- **Nothing notifies anyone.** Sharing is a link the owner sends themselves.
