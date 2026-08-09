---
id: FEAT-GUEST-VIEW-CLAIM
title: 'Jwel / ELYSIAN — Feature: Guest View History Claimed at Sign-Up'
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
  - FEAT-RECOMMENDATION-RAILS
required_by: []
related_documents:
  - DOM-IDENTITY
  - STD-SECURITY
related_domains:
  - DOM-RECOMMENDATION
  - DOM-IDENTITY
related_decisions: []
tags:
  - feature
  - recommendations
  - identity
risk: Medium
complexity: Low
---

# FEAT-GUEST-VIEW-CLAIM

## 1. Overview

`DOM-RECOMMENDATION` Invariant 9: *a guest's `anonymousId` view history
transfers to the user on registration when it is the same session, so
first-session personalisation survives sign-up.*

Nothing in the auth module referenced `anonymousId`. A visitor who browsed for
twenty minutes and then created an account started their personalisation from
nothing — the views existed, keyed to a guest id that the new account had no
relationship to.

## 2. Owning Domain

**Owning domain: `DOM-RECOMMENDATION`**, which owns `ProductView`.

**New dependency: Identity → Recommendation, by command.** `AuthService` calls
`RecommendationsService.claimGuestViews` rather than writing `product_views`
itself — Law 5, and the same shape as Reviews commanding Catalog
(`ADR-0008`). Recommendation reads four other contexts and writes none of them;
this keeps that true in the other direction too.

## 3. "Same session", when the server has no session

A guest has no session to compare against, so the rule needs a server-side
expression. Two things bound the claim, and they bound different risks:

| Risk | Bound |
| --- | --- |
| A *different browser* | The client sends the id out of its own `localStorage` — same browser is true by construction |
| A *forged* id | A **24-hour recency window** on the views claimed |

The second is the one worth stating. An `anonymousId` is unguessable, but it
travels in a registration payload, so it can be learned. Without a time bound,
anyone who learned another person's id could inherit their entire browsing
history and read it back through the recommendations it produces. Invariant 3
exists to keep views un-joinable to a person; this keeps them un-transferable
to the wrong one.

**24 hours rather than a typical 30-minute session**: someone can browse in the
morning and sign up that evening from the same browser, and that is plainly the
same person. It is still short enough to honour §8.6's *"not a much earlier
visit"*.

## 4. Failure is not allowed to cost an account

The claim runs **after** the account is created and outside its transaction,
and a failure is caught and logged.

A failed claim costs a little personalisation. A claim that propagated would
cost someone the account they just made — which is a far worse trade, and an
easy one to get wrong by putting the call one line earlier.

## 5. Edge Cases & Validations

1. **No `anonymousId` sent.** Nothing is claimed; registration is unaffected.
   The field is optional, and a client that never browsed has nothing to send.
2. **An id nobody browsed with.** Claims zero rows. *Verified: `201`.*
3. **Views older than the window.** Left behind. *Verified: a view backdated
   three days stayed unclaimed while a same-day view under the same id
   transferred.*
4. **A registration that was refused.** No claim runs — the duplicate-email
   check throws first.
5. **The XOR.** `anonymousId` is cleared in the same write that sets `userId`,
   because Invariant 2 permits exactly one of them and a row with both
   satisfies neither.
6. **Storage unavailable in the browser.** `getAnonymousId` returns null, the
   field is omitted, registration proceeds.

## 6. Non-Functional Considerations

| Standard | Bearing |
| --- | --- |
| **`STD-SECURITY`** | The window bounds what a forged id can claim. The field is length-capped and optional. |
| **`STD-API`** | An additive optional field on `RegisterDto` — no existing client breaks. |
| **`STD-TESTING`** | Every §5 case has a test, including that a failed claim still returns the account. |

**Law 5 check.** Identity commands Recommendation and writes none of its
tables.

## 7. Definition of Done

Verified against the live API:

| Case | Result |
| --- | --- |
| Guest view, then register with that id | row moves from `anonymous_id` to `user_id`; recently-viewed returns it from the token alone |
| Same id, one view today and one three days old | today's claimed, the older one **left unclaimed** |
| Forged id nobody browsed with | `201`, nothing claimed |
| Register with no id at all | `201` |

- [x] `claimGuestViews` on Recommendation, bounded and XOR-safe.
- [x] Identity commands it; failure cannot cost the registration.
- [x] `RegisterDto.anonymousId`, optional and length-capped.
- [x] The web client sends it from `register()` rather than from each form.
- [x] 11 tests added; API and web suites green.

## 8. What this does not do

**Login is not covered — only registration**, which is what the invariant says.
A returning customer who browses as a guest and then signs in to an existing
account leaves those views behind.

That is arguably the more common case, and it is a different decision rather
than an oversight: a login claim would let anyone who learned an id attach
another person's history to their **existing** account at any time, so it would
need the same bound and a fresh look at whether the trade is still worth it.
Recorded in `DOM-RECOMMENDATION` §8.6 rather than assumed.
