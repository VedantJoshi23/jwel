---
id: FEAT-RECOMMENDATION-RAILS
title: 'Jwel / ELYSIAN — Feature: Recommendation Rails'
version: 0.1.0
status: Review
owner: Architecture
reviewers:
  - Vedant
created: 2026-08-09
updated: 2026-08-09
milestone: M6
category: Features
priority: Medium
depends_on:
  - DOM-RECOMMENDATION
  - FEAT-SETTINGS-STORE
required_by: []
related_documents:
  - STD-ACCESSIBILITY
  - STD-SECURITY
related_domains:
  - DOM-RECOMMENDATION
related_decisions: []
tags:
  - feature
  - recommendations
  - storefront
risk: Medium
complexity: Medium
---

# FEAT-RECOMMENDATION-RAILS

## 1. Overview

`DOM-RECOMMENDATION`'s six endpoints all existed with **nothing calling them** —
including `POST /products/:id/views`, which the recently-viewed and personalised
rails are computed from. So the rails had no data to be built out of even in
principle: `product_views` was empty because nothing had ever written to it.

Two owner decisions from 2026-08-07 were also unimplemented, and one of them
was actively making the storefront lie.

## 2. Owning Domain

**Owning domain: `DOM-RECOMMENDATION`.**

## 3. Invariant 8 was enforced nowhere

*"A product pair is only recommendable at co-occurrence count ≥ 5. Below that
threshold the pair is treated as noise and not surfaced."*

The query ordered by count and took the top N with **no minimum**, so a pair
bought together once was surfaced under a heading that says *frequently*. Two
people who happened to buy the same two things is not a pattern.

**The threshold is now a setting, not a constant**, because the invariant says
what it is in as many words: *"a starting heuristic to be tuned against real
data, not a tuned figure"*. `recommendations.min_co_occurrence`, default 5.
Tuning it should not require a deploy — and the owner's phrasing when they set
it was *"we will start with 5 and tune it periodically"*.

The filter is applied **in the query**, not after it, so a product with fifty
noisy pairs and three real ones does not have the real ones pushed out of the
`take`.

## 4. The cold-start fallback had to go

Enforcing the threshold surfaced something worse. `getFrequentlyBoughtTogether`
topped the rail up with **same-category bestsellers** whenever co-occurrence
returned fewer than `limit` items — so the first live test still showed the
noisy pair: filtered out of the query, straight back in through the fallback.

It made a heading that says **frequently bought together** describe items
nobody bought together. That is Law 1, not a nicety.

`DOM-RECOMMENDATION` §8.2 had already decided this, before the code was
written to contradict it:

> **Resolved** by Invariant 8's minimum support of 5. Note the consequence: at
> current data volume the frequently-bought-together rail will correctly render
> **empty**, and the UI must handle that rather than showing a broken section.

So the fallback is removed and the rail renders nothing when there is no
signal. The product page already carries a separate popularity rail for the
cold-start case, under a heading that claims no co-purchase.

## 5. What was wired

| Surface | Rail | Rendered |
| --- | --- | --- |
| Product page | Frequently bought together | Server — depends only on the product |
| Product page | Recently viewed | Client — needs the guest identity in this browser |
| Home | Recommended for you / Trending now | Client — the heading follows the source |
| Home | Recently viewed | Client |
| Product page | *(view recorded)* | Client, on mount |

**The heading follows the source.** Calling a trending list "recommended for
you" would claim a personalisation that did not happen. The one place it can
still overstate is a signed-in customer with no purchase history, where the API
itself falls back to trending — accepted, because they *are* signed in and it
is the best recommendation available for them.

**A rail with nothing in it renders nothing at all** — not a heading above an
empty strip, which tells a shopper the shop is broken. On this catalogue that
is the common case, not the edge one.

## 6. The anonymous identity

Invariant 3: the `anonymousId` is **client-generated and never a real
identity**, and must not be joinable to a person. So it is a random UUID with
nothing derived from the device or the account — the only question it can
answer is *were these views the same browser*.

Kept in `localStorage` rather than a cookie deliberately: a cookie would ride
along on every API request, quietly turning an analytics key into something
that travels with authenticated calls. Storage being unavailable — private
browsing, blocked origin, full quota — degrades to no tracking, never to a
failed page.

View recording is **best-effort telemetry**: a failure is swallowed, because a
product page that errors because an analytics write failed is worse than a rail
one view out of date. Views are appended, never deduplicated — `ProductView` is
an event log and recency ranking needs the full history (Invariant 1).

## 7. Edge Cases & Validations

1. **A pair below the threshold.** Not surfaced; the rail renders empty.
   *Verified live at count 2 against a threshold of 5.*
2. **The threshold changed by an admin.** Takes effect on the next request.
   *Verified live: raised to 10, a pair at 6 stopped appearing.*
3. **A view with no identity at all.** Silent no-op, `204`, no row written —
   Invariant 2 allows it and the service already handled it.
4. **The product you are looking at.** Excluded from its own recently-viewed
   rail, which it would otherwise head the moment the view is recorded.
5. **A rail request that fails.** Renders as no rail, never as a failed page.
6. **Unpublished products.** Filtered by the existing `fetchPublishedInOrder`,
   per §8.5 — results go through Catalog's visibility rules rather than being
   served from stale co-occurrence rows.

## 8. Non-Functional Considerations

| Standard | Bearing |
| --- | --- |
| **`STD-ACCESSIBILITY`** | Rails are lists, so a screen reader announces how many. Thumbnails are `alt=""` — explicitly decorative (rule 4), since the link already carries the name. The pages stay under the `axe` scan: 23 passing. |
| **`STD-SECURITY`** | The anonymous id is random, browser-local and never joined to a person (Invariant 3). |
| **`STD-TESTING`** | The threshold has its own spec, including that it is read from the setting rather than hardcoded. |

## 9. Definition of Done

Verified against the live API and a production web build:

| Case | Result |
| --- | --- |
| Pair at count 2, threshold 5 | rail **empty**; heading absent from the rendered page |
| Pair at count 6 | rail shows the pair |
| Admin raises the threshold to 10 | pair at 6 disappears — **no deploy** |
| Guest view recorded | `204`; recently-viewed returns the product |
| View with no identity | `204`, no row |

- [x] Invariant 8 enforced, in the query, from a setting.
- [x] Cold-start fallback removed; §8.2's "renders empty" honoured.
- [x] View tracking wired — the first thing ever to write `product_views`.
- [x] Frequently-bought-together, recently-viewed, trending and personalised
      rails on the storefront.
- [x] API 771 green, web 468 green, 23 accessibility scans pass.

## 10. What is still not built

**Invariant 9 — a guest's view history transferring to their account on
registration** — remains unimplemented. Nothing in the auth module references
`anonymousId`, so a visitor who browses as a guest and then signs up starts
their personalisation from nothing.

Left out deliberately: it changes the **registration contract**, since the
client would have to send its `anonymousId` at sign-up, and that is a different
review from wiring rails. It is the natural next piece, and it is the
difference between first-session personalisation working and not.

**Nothing tunes the threshold from evidence yet.** 5 is a guess, as the
invariant says. It can now be changed without a deploy, which is what makes
tuning possible — but there is no report that says what it *should* be.
