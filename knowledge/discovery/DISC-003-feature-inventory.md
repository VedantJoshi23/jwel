---
id: DISC-003
title: Discovery — Feature Inventory
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
required_by:
  - DISC-004
related_documents:
  - PRODUCT.md
related_decisions:
  - ADR-0001
  - ADR-0003
  - ADR-0004
  - ADR-0007
tags:
  - discovery
  - investigation
  - feature-inventory
risk: Medium
complexity: Medium
---

# DISC-003 — Discovery: Feature Inventory

Investigation 3 of 10, per `OV-001`. Evidence and claim ids refer to
`knowledge/discovery/evidence/README.md`.

Everything here is verified against the **current source tree** (`EVD-011`),
not inherited from `EVD-002`/`EVD-004`, whose screenshots depict a superseded
iteration (KC-051).

## Purpose

Establish what capabilities exist today, fully or partially — separating what
is built from what is specified, promised, or merely intended.

## Observed Facts

**Scale.** 83 HTTP endpoints across 22 API modules; 33 Next.js routes (20
storefront, 13 admin). Products carries the most endpoints (15), then auth (8),
users (7), collections and recommendations (6 each). Notifications and storage
expose none — internal services. (KC-093, KC-018, KC-023)

**Requirement coverage.** `PRODUCT.md`'s FR-1…FR-23 mapped against source.
`PRODUCT.md` is advisory per `ADR-0007`; this table records coverage, not
obligation.

| FR | Capability | State | Evidence |
| --- | --- | --- | --- |
| FR-1 | Authentication | **Built** | 8 endpoints; email/password + Google, Facebook, Apple OAuth |
| FR-2 | Catalog browsing | **Built** | products, categories, collections; filters and sort |
| FR-3 | Search | **Built** | `search`, `search/autocomplete`, admin reindex; Elasticsearch with documented Postgres fallback |
| FR-4 | Product detail | **Built** | variants, media, certification, reviews |
| FR-5 | Reviews & ratings | **Built** | incl. moderation queue — `admin/reviews/pending`, `admin/reviews/:id/moderate` |
| FR-6 | Wishlist | **Built** | incl. shareable link — `wishlist/shared/:shareToken` |
| FR-7 | Cart | **Built** | items CRUD; gift-wrap and note at cart level |
| FR-8 | Coupons | **Built** | `coupons/validate` + admin CRUD/deactivate |
| FR-9 | Checkout | **Built** | custom form + Razorpay embedded modal (KC-014) |
| FR-10 | Order tracking | **Partial** | status timeline via `OrderStatusHistory`; **no shipment tracking reference** — depends on FR unbuilt shipping |
| FR-11 | Returns | **Built** | request, status transitions, refund |
| FR-12 | Product comparison | **Not built** | no endpoint, no route |
| FR-13 | Gift recommendation engine | **Not built** | no endpoint, no route |
| FR-14 | Personalized collections | **Partial** | `me/recommendations`, `recently-viewed` exist; no curated-grid surface |
| FR-15 | AI recommendations | **Built** | `recommendations/trending`, `frequently-bought-together`, `me/recommendations`, backed by `ProductView`/`ProductCoOccurrence` |
| FR-16 | Try-on preparation | **Not built** | no occurrence in source |
| FR-17 | Product management | **Built** | CRUD, media upload/reorder, CSV bulk import |
| FR-18 | Inventory management | **Built** | `low-stock`, per-variant adjust |
| FR-19 | Order management | **Built** | admin list, status advance |
| FR-20 | User management | **Built** | admin list, suspend, roles |
| FR-21 | Analytics dashboard | **Built, differently** | own `analytics/dashboard`; **PostHog absent** (KC-075) |
| FR-22 | Discount management | **Built** | admin coupon CRUD |
| FR-23 | CMS | **Partial** | homepage banners only; the UI says so itself (KC-037) |

FR-12, FR-13 and FR-16 are all in `PRODUCT.md`'s own Future Scope, so their
absence is consistent with the plan rather than a shortfall against it.

**Three ADR-backed capabilities have no implementation:**

- **Shipping / Shiprocket** — `ADR-0001`, `DOM-SHIPPING`, `FEAT-SHIPPING`
  specify it. Zero occurrences of "shiprocket" in either app. (KC-095)
- **Fraud risk scoring** — `ADR-0004`, `DOM-RISK`,
  `FEAT-FRAUD-RISK-SCORING` specify it. No implementation. (KC-096)
- **WhatsApp / SMS notifications** — `ADR-0003`, `DOM-NOTIFICATION`,
  `FEAT-WHATSAPP-SMS-NOTIFICATIONS` specify it. The notifications module is
  **Resend email only**. The storefront footer nevertheless advertises
  "WhatsApp us". (KC-097, KC-016)

All six of those `DOM-`/`FEAT-` documents carry `status: Proposal`, milestone
M5/M6 (KC-098).

**Subscriptions is promised to customers and does not exist.** `/subscriptions`
renders a three-step explainer and a register CTA from `brand.ts`, and the
footer links it. There is **no `Subscription` model** among the 27 Prisma
models and no subscriptions module. Existing subscribers are directed to
"Contact us" to skip, pause or cancel. (KC-099)

**The event bus is genuinely wired.** Seven modules publish or consume —
notifications, metrics, orders, payments, returns, search, products (KC-100),
corroborating the owner's testimony (KC-066) from the source side.

## Interpretation

**The transactional core is complete and the periphery is not.** Every step of
the customer's money path — browse, search, detail, cart, coupon, checkout,
pay, track, return, review — is built and, per `DISC-001`, covered by a 90%
CI gate. That is the hard part, and it is done.

What is missing clusters in one place: **everything that happens after payment
and outside the application**. Shipping, delivery notification and fraud
screening are precisely the capabilities that reach into the physical and
third-party world, and all three are specified-but-unbuilt. This is a coherent
shape, not scattered neglect — it is what a system looks like when it has been
built inward-out and stopped at its own boundary.

`DISC-002`'s KC-088 explains part of it. With the aggregated client owning
inventory and fulfilment, shipping integration is less obviously the platform's
job than it appeared when `ADR-0001` was decided. The question of whether
`ADR-0001` still applies is now a live one — not because the ADR was wrong, but
because the boundary moved after it was written.

**Three unbuilt features are honestly marked; one is not.** KC-098 matters:
every `DOM-`/`FEAT-` document for the unbuilt capabilities says `Proposal`.
Nobody overclaimed. The gap is between *specs* and *code*, which is normal and
visible.

Subscriptions is different in kind. It is not an internal proposal — it is a
**customer-facing promise on the live storefront**, with a manual email
fallback ("Contact us") standing in for a system that does not exist. The
storefront is currently gated behind "Demo store — orders are for preview
only", so nobody has been misled yet. At launch, that changes.

The same pattern appears in the footer's "WhatsApp us" (KC-016), and it
rhymes with the unconditional shipping and dispatch promises
`DISC-002` handed to `hidden-business-rules` (KC-012, KC-013). **A recurring
theme is emerging: the storefront's copy promises more than the system
delivers.** Individually each is minor; together they are a class of risk worth
a Law in M2 rather than four separate fixes.

**Analytics diverged deliberately.** FR-21 specified PostHog; what exists is a
first-party `analytics/dashboard` with revenue, AOV, orders-by-status and top
products. That is a real capability, not a shortfall — the requirement was met
by different means, and only the PRD's naming of a vendor makes it look like a
gap.

## Hidden Assumptions

- **Absence of a keyword is treated as absence of a feature.** KC-095 and
  KC-096 rest on greps for "shiprocket", "fraud" and "risk". A shipping
  integration under a generic name, or risk logic embedded in orders without
  the word, would not have been found.
- **Endpoint existence is treated as capability.** 83 routes were counted, not
  exercised. A route that exists and misbehaves counts as "Built" here. The 90%
  CI gate (KC-059) makes this less risky than it sounds, but it is still an
  assumption.
- **The FR mapping assumes `PRODUCT.md`'s FR list is the right yardstick.**
  Per `ADR-0007` it is advisory, and per `DISC-002` its strategy layer is
  superseded. The FR *decomposition* survives that (it is wired into code and
  UI via `FR-NN`), but measuring completeness against it imports its
  assumptions.
- **"Partial" is a judgement, not a measurement.** FR-10, FR-14 and FR-23 were
  each placed there by reading intent against implementation.

## Strengths

- **The complete transactional loop is built**, from browse to refund, with no
  gaps in the money path.
- **Recommendations ship as a real capability** (FR-15) — the one AI
  differentiator `PRODUCT.md` designated for MVP — backed by first-party
  behavioural data rather than a bought-in service.
- **Admin coverage is broad**: ~30 endpoints spanning catalog, inventory,
  orders, returns, users, moderation, CMS and operational tasks like search
  reindex and co-occurrence backfill (KC-094).
- **Review moderation and wishlist sharing exist** — both easy to skip, both
  specified, both built.
- **Search degrades gracefully** — Elasticsearch with a documented Postgres
  fallback, exercised in CI by pointing at an unreachable node (KC-059).
- **The event bus connects seven modules** (KC-100), so cross-module reactions
  are real infrastructure rather than direct calls.
- **Unbuilt work is honestly labelled** in every internal spec (KC-098).

## Weaknesses

- **`/subscriptions` promises a capability that does not exist** (KC-099), on a
  page linked from every footer, with a manual email process as the fallback.
  The highest-priority item in this investigation, and the cheapest to fix
  before launch.
- **"WhatsApp us" is advertised with no WhatsApp integration** (KC-097,
  KC-016).
- **FR-10 order tracking is structurally incomplete** — a status timeline
  without a shipment reference, because shipping is unbuilt. The customer can
  see that an order moved to SHIPPED but cannot track it.
- **Three ADRs are decided but unimplemented** (KC-095–097), and at least one
  (`ADR-0001`) may no longer be correct under `DISC-002`'s boundary. A decided
  ADR with no code and a changed premise is a liability: it reads as settled
  when it is not.
- **The storefront over-promises as a pattern**, not as isolated bugs —
  subscriptions, WhatsApp, free shipping, 24-hour dispatch.
- **`PRODUCT.md`'s MVP/Future split no longer describes delivery.** CMS was
  Future Scope and is built (KC-076); shipping was implied MVP and is not.

## Questions

All owner-facing questions were resolved in the Discussion pass (EVD-012,
EVD-013). Retained with their answers.

1. ~~Is `ADR-0001` (Shiprocket) still the intended path?~~ → **RESOLVED**
   (KC-101): yes. Deferred by an **external blocker** — the client's Shiprocket
   account is blocked and an application to restore it is pending. `ADR-0001`
   stands; FR-10's missing tracking reference is blocked, not descoped.
2. ~~Are WhatsApp/SMS still committed?~~ → **RESOLVED** (KC-102): yes, next in
   sequence, blocked on client-supplied mail and WhatsApp credentials.
   Implementation planned as a separate session.
3. ~~Is fraud scoring still committed?~~ → **RESOLVED** (KC-103, KC-106):
   deferred to proposed status pending client feedback. Rationale and revisit
   triggers recorded in `FEAT-FRAUD-RISK-SCORING`'s header note; `ADR-0004` is
   not reversed.
4. ~~Is Subscriptions real?~~ → **RESOLVED** (KC-104, KC-106): a real programme
   — a monthly "Jewel Box" at 30% saving with curated delivery — but **deferred**
   alongside fraud scoring, flagged proposed pending client feedback.

**Still open:**

5. Should the unconditional storefront promises be made conditional or backed
   by real rules? → `hidden-business-rules` (DISC-002 Q16). Now **launch-gating**
   — see below.
6. Do the 83 endpoints behave as their names suggest? → `technical-debt`; not
   answerable by inventory.
7. Is there shipping or risk logic under different naming? → `technical-debt`,
   closing this investigation's grep-level assumption.

### Carried forward: the promise/capability gap is now launch-gating

Deferring the two features resolves the *engineering* question and leaves the
*copy* question open (KC-108). Four claims are live on the storefront with no
system behind them and, after this decision, no scheduled delivery date:

| Promise | Where | Reality |
| --- | --- | --- |
| Monthly Jewel Box subscription | `/subscriptions` + every footer | No model, no module; deferred |
| "WhatsApp us" | Footer | Email-only notifications; credential-blocked |
| COD under ₹10,000 | FAQ | Prepaid-only; no COD anywhere (KC-105) |
| Free shipping / 24-hour dispatch | Sale bar, PDP, checkout | No backing rule (KC-012, KC-013) |

The "Demo store — orders are for preview only" banner is the **only** thing
currently preventing customer exposure. Whatever removes that banner must
resolve this table in the same change. Handed to `hidden-business-rules` as
its highest-priority item.

## Recommendations

- **Keep** — the built transactional core; it is the asset everything else
  hangs from.
- **Keep** — first-party recommendations and analytics, which meet FR-15 and
  FR-21 without vendor dependency.
- **Keep** — the `status: Proposal` discipline on unbuilt specs (KC-098). It is
  why this investigation could separate specified from built at all.
- **Improve** — reconcile storefront promises with system capability before
  launch. Subscriptions and WhatsApp are the two live claims with nothing
  behind them.
- **Improve** — complete or rescope FR-10 once Question 1 is settled; a
  tracking timeline without a tracking reference is a half-capability the
  customer sees.
- **Improve** — revisit `ADR-0001`, `ADR-0003` and `ADR-0004` — not necessarily
  to change them, but to record whether they still hold after `DISC-002`.
- **Improve** — when subscriptions is revisited, author `FEAT-SUBSCRIPTIONS`
  through `PRM-FEATURE` rather than inferring scope from `brand.ts` copy. The
  programme spans recurring payments (a second Razorpay integration), RBI
  e-mandate and pre-debit-notice compliance, per-cycle human curation, and
  customer self-service for skip/pause/cancel — materially more than the
  missing model implies. Deliberately **not** authored during Discovery: M6
  owns feature specification, and Discovery inventories rather than designs.
- **Remove** — nothing built. The removal candidates are *promises*, not code —
  see the launch-gating table above.

## Architecture Review

- **Does it hold up?** Yes. The positive inventory is direct observation from
  current source; the Discussion pass changed no fact, only disposition.
- **Does it contradict another investigation?** No. It **extends** `DISC-002`'s
  promise/capability finding from two instances to five and escalates it to
  launch-gating (KC-108), and it corroborates KC-066's working event bus from
  the source side (KC-100).
- **Effect on prior decisions.** `ADR-0001` confirmed still-intended (KC-101).
  `ADR-0003` confirmed committed (KC-102). `ADR-0004` deferred but not reversed,
  with rationale and revisit triggers recorded in its feature spec. No ADR is
  left silently unbuilt.
- **Scope discipline.** This investigation inventories capability. It does not
  specify the subscription feature, design the risk engine, or rewrite
  storefront copy — those belong to M6, a future `PRM-FEATURE` run, and the
  owner respectively.

**Frozen 2026-08-06** by owner sign-off.

## Confidence Level

**High (89%)** after the Discussion pass.

Positive claims are near-certain: endpoint counts, route inventory, model
checks and spec status headers are all direct observation at 95–100%, taken
from current source rather than the superseded screenshots.

The cap comes from the negative claims. "Shipping is not implemented" and
"fraud scoring is not implemented" rest on keyword searches (KC-095, KC-096 at
95% and 90%), and absence of a keyword is weaker evidence than presence of one.
Per `OV-001` the investigation cannot exceed its weakest load-bearing claim,
and KC-096 at 90% is it — with the "Built" judgements themselves resting on
endpoint existence rather than exercised behaviour.

Question 7 would close the naming gap cheaply. Neither residual doubt affects
the headline finding: the transactional core is complete, and the periphery
that reaches into the physical world is not.

The Discussion pass raised confidence only marginally, which is the honest
outcome — it resolved *dispositions* (what happens next to four capabilities)
rather than correcting any observation. The inventory itself was accurate as
drafted.

### Cross-cutting extraction check

- **Domain/integration events** — owned by `domain-discovery`, and strengthened
  here: seven modules confirmed publishing or consuming on the event bus
  (KC-100), corroborating KC-066 from source rather than testimony.
- **Non-functional requirements** — owned by `business-vision` (done, KC-073)
  and `technical-architecture` (pending). Not this investigation's check.
