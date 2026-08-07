---
id: ADR-0009
title: Domain specifications follow work, not discovery
version: 0.1.0
status: Accepted
owner: Architecture
reviewers:
  - Vedant
created: 2026-08-06
updated: 2026-08-06
milestone: M1
category: Decisions
priority: High
depends_on: []
required_by: []
related_documents:
  - DISC-006
related_domains:
  - DOM-NOTIFICATION
  - DOM-RISK
  - DOM-SHIPPING
related_decisions:
  - ADR-0007
tags:
  - governance
  - domains
  - process
risk: Low
complexity: Low
---

# ADR-0009 — Domain specifications follow work, not discovery

## Context

`DISC-006` derived a bounded-context map of **fourteen contexts**. This project
has **three** `DOM-` specifications, and two of them describe capabilities that
do not exist:

| Spec | Reality |
| --- | --- |
| `DOM-SHIPPING` | No shipping code exists (KC-095); blocked on the client's Shiprocket account (KC-101) |
| `DOM-RISK` | Fraud scoring closed as not-required (KC-110) |
| `DOM-NOTIFICATION` | Implemented, email-only; WhatsApp/SMS pending (KC-097) |

The documented domain set is close to the inverse of the real one — the
largest documentation gap Discovery found.

The obvious response is to write eleven more specifications. This project's own
history argues against it: **two of three existing `DOM-` specs rotted, and
they rotted because they were written ahead of the work.** Writing eleven
speculative specs would reproduce that failure at four times the scale, and
`ADR-0007` already establishes that a document which drifts from reality while
still reading as authoritative is worse than no document.

## Decision

**A `DOM-` specification is written when its context is about to be worked on,
not when it is discovered.**

Discovery's job was to *find* the fourteen contexts. It does not follow that
all fourteen need documents now.

### Tiering as of 2026-08-06

| Tier | Contexts | Rationale |
| --- | --- | --- |
| **Author now** | **Shopping** (cart + wishlist), **Returns** | Both have imminent, non-trivial work |
| **When touched** | Catalog, Search, Recommendation | Frontend wiring only — the domain itself is not changing |
| **Defer** | Identity, Inventory, Pricing, Payments, Ordering, Content, Notification, Reporting | Stable, working, untouched |

**Shopping** carries the most change: the cart moves server-side (KC-126),
gift-wrap granularity flips to per-item (KC-147), and a shareable cart is a
genuinely new capability with unanswered rules (KC-129, KC-130) — snapshot or
live view, merge or replace. A data migration plus new aggregate behaviour is
what a domain specification is for.

**Returns** is urgent for a different reason. The policy — no customer
cancellation, no re-request after rejection (KC-146) — exists **only in a
unique constraint that expresses half of it and explains none of it**. The
returns UI is about to be built (KC-123), and a developer adding a cancel
button is doing the obvious, natural thing that nothing in the codebase would
prevent.

### Running `PRM-DOMAIN` out of milestone order

Oriveda's sequence is M2 Constitution → M3 Architecture → M5 Domains. That
order assumes greenfield. This project is brownfield with active development,
and its work queue reaches Shopping and Returns well before M5 would.

**`PRM-DOMAIN` is authorised to run now for Shopping and Returns** (KC-161).

This is explicit navigation under the owner's own stated principle (KC-048,
KC-054): commitments hold by default and are renegotiated openly, never
dropped silently. Blocking weeks of frontend work on milestone sequencing is
not in the project's favour; building the returns UI with no specification and
reconstructing the policy later from a unique constraint is how the present
documentation gap arose.

### Correcting the two stale specs

`DOM-SHIPPING` and `DOM-RISK` are annotated in place as specifying contexts
that are not implemented (KC-162). Per `ADR-0007` neither body is rewritten —
a status note is the correct instrument, and neither is deleted, because
superseded work is retained.

## Consequences

1. **Twelve contexts have no specification, deliberately.** That is a recorded
   decision, not an oversight — this ADR is where a future reader finds out
   why.
2. **The tiering is a snapshot, not a rule.** As work moves, contexts move up.
   The tier table above should be updated when it does, not treated as fixed.
3. **Specs stay close to the code they describe**, which is the property that
   `DOM-SHIPPING` and `DOM-RISK` lost.
4. **Milestone order is now advisory for `PRM-DOMAIN` in this project.** Any
   further out-of-order run should be recorded the same way, not treated as
   precedent for skipping the sequence generally.

## Alternatives Considered

- **Write all fourteen `DOM-` specs before proceeding.** Rejected — weeks of
  work, most of it for stable contexts nobody is touching, and it would
  reproduce exactly the rot already visible in two of three existing specs.
- **Write none; rely on Discovery's context map.** Rejected — `DISC-006` maps
  boundaries and coupling, not invariants. It cannot carry the returns policy,
  and that policy is about to be violated by a reasonable developer doing a
  reasonable thing.
- **Keep strict milestone order and delay the frontend work.** Rejected — the
  cost is real and immediate, the benefit is procedural, and the owner's stated
  position on commitments explicitly permits navigating this openly.

## Trade-offs

Specifying only what is about to change means the context map lives in
`DISC-006` while invariants live in scattered `DOM-` specs — so "what does this
system guarantee?" has no single answer document until M3 Architecture provides
one. Accepted, because the alternative buys that completeness with eleven
documents likely to be wrong by the time anyone reads them.

## Cross References

- `DISC-006` — the fourteen-context map, KC-149, KC-160, KC-161, KC-162.
- `DISC-005` KC-146 — the returns policy this makes urgent to specify.
- `DISC-004` KC-126, KC-129 — the Shopping changes.
- `ADR-0007` — documentation authority; why a stale authoritative-sounding
  document is worse than none.
- `OV-006` / `PRM-DOMAIN` — the protocol being run out of order.
