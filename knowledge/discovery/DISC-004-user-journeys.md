---
id: DISC-004
title: Discovery — User Journeys
version: 1.0.0
status: Frozen
owner: Architecture
reviewers:
  - Vedant
created: 2026-08-06
updated: 2026-08-06
milestone: M1
category: Discovery
priority: High
depends_on:
  - DISC-001
  - DISC-002
  - DISC-003
required_by:
  - DISC-005
related_documents:
  - PRODUCT.md
related_decisions:
  - ADR-0005
  - ADR-0007
tags:
  - discovery
  - investigation
  - user-journeys
risk: High
complexity: Medium
---

# DISC-004 — Discovery: User Journeys

Investigation 4 of 10, per `OV-001`. Evidence and claim ids refer to
`knowledge/discovery/evidence/README.md`.

Re-derived from **current source** (`EVD-015`). The screenshot-based journey
claims from intake (`EVD-002`) were point-in-time and are treated as
corroboration only, never as the primary record — per KC-051.

**Risk is High**: this investigation finds that several capabilities counted as
built in `DISC-003` are unreachable by the customer, which changes what the
product actually does.

## Observed Facts

### The customer's path, as built

**Home → category → detail → cart → checkout → pay → confirm.** Every step
exists and connects. Verified in source:

- **Discovery**: home renders hero, banners, category tiles and a bestsellers
  rail; `/collections/[slug]` lists with filters (category, price, metal) and
  sort; `/product/[slug]` shows variants, media, certification, price and
  reviews. (KC-002 corroborated)
- **Cart**: `/cart` lists lines with quantity and remove, gift-wrap and
  newsletter toggles, subtotal, and routes onward. (KC-011)
- **Checkout**: a single page — address, coupon apply, shipping method, order
  summary — ending in an order creation call. (KC-014)
- **Payment**: Razorpay's hosted `checkout.js` opens as an embedded modal;
  the handler returns `razorpay_order_id`, `razorpay_payment_id` and
  `razorpay_signature`, which are posted to `/payments/verify`.
- **Confirmation**: `/checkout/confirmation?orderId=…&total=…`.
- **Account**: `/profile` with Overview, Orders and Addresses tabs. (KC-010)
- **Auth**: email/password plus Google, Facebook and Apple, with `next=`
  redirect preservation. (KC-009)

### Where the built path diverges from the specified one

**Checkout requires login** (KC-113). An unauthenticated visitor gets "Please
log in to continue to checkout" and a link to `/login?next=/checkout`. The gate
is deliberate and graceful — it preserves intent through the redirect — but
`PRODUCT.md` FR-1 specifies guest checkout, and there is none.

**The cart is client-side only** (KC-114). A zustand store persisted to
localStorage. `cart-store.ts` records why: *"Backend (apps/api) has no
persisted Cart API yet … so no server-side cart round-trip is needed for MVP."*
That comment is now stale — the API has a cart module with five endpoints and
`Cart`/`CartItem` models — but the behaviour stands: **carts do not survive a
device change or a cleared browser store.**

**Search reaches the fallback, not the search engine** (KC-116). The search
page calls `getProducts` with `q=` against `/products`, whose own DTO documents
that parameter as the *"Postgres trigram fallback — Elasticsearch is the
primary search path"*. The `search` module's three endpoints, including
autocomplete, are never called. There is no autosuggest surface.

### Five built capabilities the customer cannot reach

Verified by enumerating every `apiFetch` path in `apps/web/lib/api` against the
controller route inventory (KC-093), then confirming no component or storefront
route references the capability (KC-115):

| Capability | API surface | Reachable from storefront |
| --- | --- | --- |
| Wishlist (FR-6) | 4 endpoints, incl. `shared/:shareToken` | **No** — zero UI references |
| Recommendations (FR-15) | 6 endpoints — trending, FBT, personalised, recently-viewed | **No** — zero UI references |
| Customer returns (FR-11) | request/list/detail | **No** — admin UI only |
| Server-side cart | 5 endpoints | **No** — localStorage instead |
| Elasticsearch search (FR-3) | 3 endpoints | **No** — trigram fallback instead |

**Customers cannot initiate a return** (KC-117). The API exists, admin returns
management is fully wired, but the only storefront occurrences of "returns" are
static copy pages. The FAQ tells customers to *"Start a return from your order
history"* — which is not possible.

**Recommendations have no surface at all** (KC-118). Six endpoints, backed by
`ProductView` and `ProductCoOccurrence`, invisible to customers.

### What the e2e suite confirms — and what it does not cover

Read in full for Question 5 (KC-120): 159 lines, 12 tests, none skipped.
Coverage is storefront browsing (homepage, search, product detail, 404,
add-to-bag), admin RBAC (three redirect cases) and authentication (register,
duplicate email, wrong password, re-login).

**It corroborates the unreachability findings.** No test references wishlist,
recommendations or returns — had a journey existed, an e2e spec would have been
the likely place to find it. The search test drives the header box to
`/search?q=` and resolves through `/products?q=`, confirming KC-116 from an
independent direction (KC-122).

**And it surfaces its own gap** (KC-121): **no e2e test exercises checkout,
payment, order confirmation, returns, wishlist or recommendations.** The suite
stops at add-to-bag. CI runs an E2E job against a genuinely real stack —
migrated database, seeded fixtures, production web build — and that stack is
never driven through the one journey the business depends on. The payment path
was verified manually instead (KC-052), which is how it came to be trusted.

### One genuinely new capability

Every other gap in this investigation is **built-and-unwired** or (in
`DISC-003`) **specified-and-unbuilt**. A **shareable cart** (KC-129) is
neither: it appears in no FR, no ADR and no model. `Cart` has no share token
and there is no public cart read endpoint.

It is the first requirement Discovery has surfaced that did not already exist
somewhere in the project's history — which is itself a small validation that
the evidence base was reasonably complete. It needs backend work and a `FEAT-`
specification through `PRM-FEATURE`; it is deliberately not designed here.

Three recorded constraints for whoever specifies it (KC-130):

- **The server-side cart move is a prerequisite** — a localStorage cart cannot
  be shared.
- **The no-guest-checkout rule applies** (KC-125) — a recipient must register
  before checking out. Consistent with the database-growth rationale, and
  arguably reinforces it: a shared cart becomes an acquisition surface.
- **Contents drift.** Price and stock can change between share and open, so the
  spec must decide whether a shared cart is a snapshot or a live view, and what
  a merge-or-replace rule is when the recipient already has a cart.

### The admin journey is complete

Admin pages call ~14 distinct admin API paths covering products, categories,
collections, coupons, orders, returns, users, inventory, CMS and analytics
(KC-119). Every admin capability inventoried in `DISC-003` is reachable. **The
API/UI gap is a storefront phenomenon, not a system-wide one.**

## Interpretation

**The money path is complete; the paths around it are not.** Everything
required to take payment — browse, select, cart, authenticate, pay, confirm —
works end to end. What is missing is everything that makes a customer *return*:
saving items for later, being recommended something, searching well, resolving
a problem without email.

This is a different shape from `DISC-003`'s finding. That investigation found
capabilities **unbuilt** at the system's outer edge — shipping, notifications.
This one finds capabilities **built and unwired**: the server work is done, the
UI was never connected. Wishlist, recommendations, cart persistence and
Elasticsearch search all exist, are tested, and sit behind endpoints nothing
calls.

That is a more troubling category. Unbuilt work is visible — it shows up as an
empty module and a `Proposal` spec. Unwired work looks finished from every
angle except the customer's: the tests pass, the coverage gate is green, the
endpoint responds. `DISC-003` counted FR-3, FR-6, FR-11 and FR-15 as **Built**
on exactly that basis, and recorded the limitation as a Hidden Assumption
("endpoint existence is treated as capability"). This investigation is that
assumption coming due.

**FR-15 is the sharpest case.** `PRODUCT.md` designated AI recommendations as
the single differentiator to ship in MVP, chosen specifically because "the
wireframe already has UI slots for this on homepage and PDP" — the reasoning
was that it required the *least* net-new UX. The engine was built, the
behavioural data model exists, and the UI slots were never filled. The one
feature picked for being easy to surface is the one that was not surfaced.

**The stale cart comment shows how this happens.** A decision was made
correctly at the time — no persisted cart API existed, so localStorage was
right — recorded honestly in a comment, and then the API arrived and nothing
revisited the note. No single step was wrong. The system drifted into
inconsistency through correct local decisions, which is exactly the failure
Oriveda's "knowledge outlives implementation" principle is meant to catch.

**Guest checkout is a real journey decision, not an oversight.** The auth gate
is graceful and preserves `next=`. But `PRODUCT.md`'s Journey B has Rohan
checking out "as guest or with quick signup", and gifting purchasers are the
most login-averse segment there is. Requiring registration before payment is a
known conversion cost; whether it is worth paying is a business call, not a
technical one.

## Hidden Assumptions

- **Absence of a call site is treated as absence of a journey.** KC-115–118
  rest on grepping `apiFetch` paths and component references. A capability
  reached through an indirection I did not trace would be missed. The
  cross-check (route inventory vs. call sites vs. component references) makes
  this unlikely but not impossible.
- **Reachability is not usability.** This investigation establishes that paths
  connect, not that they work well. No flow was exercised against a running
  system.
- ~~**The Playwright e2e suite was not read.**~~ **Resolved** (KC-120–122):
  read in full. It corroborates the negative claims rather than contradicting
  them, and adds a finding of its own — see below.
- **"The admin journey is complete" rests on call-site counting**, not on
  walking each admin task end to end.
- **PRODUCT.md's journeys are used as the comparison baseline**, and per
  `DISC-002` its persona layer is superseded. Journeys A and C describe premium
  buyers who are no longer the target; comparing against them risks importing
  obsolete assumptions. Journey D (everyday repeat customer) is the one that
  still matches KC-045.

## Strengths

- **The purchase path is complete and coherent** — no dead ends, no missing
  steps between landing and paid order.
- **Auth preserves intent.** `next=/checkout` means an interrupted purchase
  resumes where it stopped rather than dumping the customer on a homepage.
- **Payment handoff is clean** — hosted modal, signature verification
  server-side, no card data touching the app (consistent with `ADR-0005`).
- **The admin journey is genuinely finished** (KC-119) — every inventoried
  admin capability is reachable and wired.
- **The account area exists and is populated** — orders and addresses are real,
  server-backed surfaces, not placeholders.
- **The unwired capabilities are built, not imagined.** Closing these gaps is
  frontend work against tested endpoints, which is a far better position than
  needing the backend built.

## Weaknesses

- **Four specified capabilities are invisible to customers** — wishlist,
  recommendations, customer returns, Elasticsearch search. All built, all
  unreachable.
- **The FAQ instructs customers to do something impossible** (KC-117) —
  starting a return from order history. A support burden that lands on the
  client, not a technical failure.
- **Carts are lost across devices and browser clears** (KC-114), with a
  server-side cart already built and unused. `PRODUCT.md` Journey C explicitly
  promises cross-device cart and wishlist sync.
- **Search quality is below what is built** (KC-116) — trigram fallback in
  place of the Elasticsearch path, with no autosuggest.
- **No guest checkout** (KC-113) against an explicit FR-1 requirement.
- **The stale `cart-store.ts` comment** asserts something no longer true, and
  is the kind of note a future contributor would trust.

All questions resolved in the Discussion pass (EVD-016, EVD-017).

1. ~~Should the unwired capabilities be surfaced?~~ → **RESOLVED** (KC-123,
   KC-128): **all of them.** Recommendations, customer returns and the
   wishlist — including its shareable link — are to be surfaced.
2. ~~Should search move to the Elasticsearch path?~~ → **RESOLVED** (KC-124):
   yes, conditional on Elasticsearch being present. The Postgres fallback must
   remain working — CI depends on it deliberately.
3. ~~Is guest checkout wanted?~~ → **RESOLVED** (KC-125): **no, deliberately.**
   Requiring registration grows the customer database and enables post-checkout
   functionality. The built behaviour is correct; FR-1's guest-checkout clause
   is superseded.
4. ~~Should the cart move server-side?~~ → **RESOLVED** (KC-126): yes, for
   cross-device persistence, using the existing API.
5. ~~Do the e2e specs encode journeys this reading missed?~~ → **RESOLVED**
   (KC-120–122): no. They corroborate the findings.

6. ~~Are the remaining unwired endpoints dead code or staged work never run?~~
   → **RESOLVED**: staged work never run. All five are being wired.
7. ~~Should the wishlist be surfaced?~~ → **RESOLVED** (KC-128): yes, with its
   shareable link.

**Still open:**

8. Should checkout-to-payment gain e2e coverage? → `technical-debt`. The
   business-critical path is currently verified only by manual testing.
9. **How should a shared cart behave?** (KC-129, KC-130) — snapshot or live
   view; merge or replace when the recipient already has a cart; what happens
   when price or stock has drifted since sharing. → `PRM-FEATURE`, not
   Discovery. Recorded so the questions are not rediscovered at build time.

## Recommendations

- **Keep** — the purchase path exactly as built; it is complete and clean.
- **Keep** — `next=` intent preservation through auth.
- **Keep** — the admin journey; it is the most finished surface in the product.
- **Keep** — the login-before-checkout gate (KC-125). It is a deliberate
  decision, not a missing feature, and `PRODUCT.md` FR-1's guest-checkout
  clause is superseded by it.
- **Improve** — surface recommendations (KC-123). Designated MVP
  differentiator, endpoints built, UI slots already reserved by the wireframe.
- **Improve** — surface the wishlist and its shareable link (KC-128),
  completing FR-6 and Journey A's sharing loop. Frontend-only; the share-token
  endpoint already exists.
- **Improve** — specify the shareable cart (KC-129) through `PRM-FEATURE`
  before building it. It is the one item here that needs a design decision
  rather than wiring.
- **Improve** — wire customer returns (KC-123); this also retires the FAQ's
  false "start a return from your order history" instruction.
- **Improve** — move the cart server-side (KC-126), delivering Journey C's
  cross-device promise and retiring the stale `cart-store.ts` comment.
- **Improve** — move search to the Elasticsearch path (KC-124), **keeping the
  Postgres fallback intact** — CI exercises it by pointing at an unreachable
  node, and that check is worth preserving.
- **Improve** — add e2e coverage for checkout through payment to confirmation.
  It is the only journey the business cannot afford to have silently break, and
  it is the one the suite does not touch.
- **Improve** — correct the stale comment in `cart-store.ts` regardless of
  whether the cart moves.
- **Remove** — nothing. No built capability should be deleted; the gap is
  wiring, not excess.

## Architecture Review

- **Does it hold up?** Yes, and it is now double-sourced: call-site enumeration
  and the e2e suite agree independently.
- **Does it contradict another investigation?** It **corrects** `DISC-003`,
  whose FR table read endpoint existence as capability. Recorded there as
  Amendment A2, dropping its confidence 89% → 85%. That is the intended
  behaviour of the protocol — a later investigation with a better method
  revising an earlier one explicitly rather than silently.
- **Effect on prior requirements.** FR-1's guest-checkout clause is superseded
  by KC-125. FR-3, FR-6, FR-11 and FR-15 are re-rated by A2.
- **Scope discipline.** This investigation maps journeys and records decisions
  about them. It does not implement the wiring, design the recommendation
  surface, or write the missing e2e specs.

All owner questions are resolved. Two items travel forward: e2e coverage of the
payment path (Question 8, to `technical-debt`) and the shareable-cart design
(Question 9, to `PRM-FEATURE`). Neither undermines a finding here.

**Frozen 2026-08-06** by owner sign-off. Revision after this point requires the
full Discussion → Review cycle, not a silent edit (KC-054).

## Confidence Level

**High (93%)** after the Discussion pass, raised from 88%.

The positive journey mapping is direct observation at 95–100% — routes, auth
gating, payment handoff and account surfaces were all read in current source.

The cap comes from the negative claims, which carry this investigation's weight.
KC-115–118 at 95% assert that capabilities are *unreachable*, established by
enumerating call sites and component references. That is a stronger method than
the single greps behind `DISC-003`'s negative claims — it cross-checks three
independent signals — but it remains proof of absence, and the Playwright specs
were not read (Question 5).

The e2e suite has now been read (KC-120–122) and **corroborates every negative
claim** from an independent direction — no test references the capabilities
this investigation found unreachable, and the search test confirms the fallback
path. Two independent methods agreeing is materially stronger than either
alone, which is what lifts the cap.

The residual 7% is that reachability is still not usability: no flow was
exercised against a running system, so this investigation establishes that
paths connect, not that they work well. Per `OV-001` that is the weakest
load-bearing limitation, and closing it needs a running deployment rather than
more reading.

### Cross-cutting extraction check

- **Domain/integration events** — owned by `domain-discovery`. Nothing new
  surfaced here; the journey layer consumes API calls, not events directly.
- **Non-functional requirements** — owned by `business-vision` (done) and
  `technical-architecture` (pending). One journey-relevant NFR is worth
  forwarding: NFR-6 mobile-first, which this investigation did not assess, and
  which matters more than usual given `PRODUCT.md`'s own observation that most
  Indian e-commerce traffic is mobile.
