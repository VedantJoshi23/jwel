---
id: ADR-0021
title: Product Q&A is a new bounded context, not a Reviews extension
version: 0.1.0
status: Accepted
owner: Architecture
reviewers:
  - Vedant
created: 2026-08-12
updated: 2026-08-12
milestone: M6
category: Decisions
priority: High
depends_on:
  - ARCH-001
required_by: []
related_documents: []
related_domains:
  - DOM-REVIEWS
related_decisions:
  - ADR-0008
tags:
  - architecture
  - bounded-contexts
  - qa
risk: Medium
complexity: Low
---

# ADR-0021 — Product Q&A is a new bounded context, not a Reviews extension

## Context

The client wants a public, per-product question-and-answer space — customers
ask questions about a product, and the admin *or other customers* can answer,
in the shape of a webnovel-community/Discord-style thread rather than a
storefront FAQ. Both questions and answers can be upvoted. Nothing here
requires pre-approval before it's visible; the admin moderates reactively.

`ARCH-001` §1.1 declares fourteen bounded contexts (`DISC-006`). None of them
fits:

- **Reviews** is the closest surface match — customer-submitted, per-product,
  moderated content — but its aggregate shape is fundamentally different.
  `DOM-REVIEWS` owns exactly **one `Review` per `(productId, userId)`**
  (Invariant 5, a unique constraint), written once, moderated through a single
  `PENDING → APPROVED/REJECTED` gate before anything is public (Invariant 3).
  Q&A needs **many questions per product, many answers per question, from many
  users**, visible the moment they're posted, with upvotes on both questions
  and answers. Forcing this into Reviews would either violate its own
  documented ownership (§2 "Explicitly does NOT own") or quietly turn one
  domain into two unrelated aggregate shapes sharing a name.
- **Content** owns banners and homepage scheduling — editorial content the
  admin authors, not customer-generated conversation.
- **Recommendation** owns view/co-occurrence signals, not text a human wrote.

No existing context's Owns/Does-NOT-own split (`ARCH-001` §1.1) covers
threaded, multi-party, product-scoped conversation.

## Decision

**Declare a new bounded context, Product Q&A**, in `ARCH-001` §1.1 (Amendment
A4).

**Owns**: `Question`, `Answer`, upvotes on each, and each one's visibility
state (visible / removed by moderation).

**Explicitly does NOT own**: product identity (reads Catalog for name, slug,
image — the same read-only relation pattern `DOM-REVIEWS` already uses for
`product`/`user` on `adminListPending`, not a command); user identity (reads
Identity for asker/answerer display); review content (Reviews stays exactly
what it is today — this ADR changes nothing about it).

**Moderation model — reactive, not a pre-approval gate.** A question or
answer is publicly visible the instant it's posted; an admin can remove one
after the fact. This is a deliberate departure from `DOM-REVIEWS`'s
`PENDING`-first model, not an oversight — it is the shape the client asked
for (owner decision, 2026-08-12), and matches the community-conversation
framing (Discord, webnovel comment threads) rather than the storefront-review
framing.

## Consequences

1. `ARCH-001` §1.1 gains a fifteenth row (Amendment A4, this ADR).
2. `DOM-PRODUCT-QA` will be authored **Full** tier — imminent, non-trivial
   work, per the same "depth follows work" reasoning `ADR-0009` already
   established for Shopping and Returns.
3. `FEAT-PRODUCT-QA` follows the domain spec, per `OV-007`.
4. `DOM-REVIEWS` is untouched — no invariant, API surface, or data-ownership
   line in it changes. This ADR's `related_domains` entry is informational
   (it explains why Q&A isn't folded into Reviews), not a dependency edge.
5. Product Q&A reads Catalog (product display) and Identity (asker/answerer
   display) the same way Reviews already reads both — an allowed read
   dependency, not a command, so no `ADR-0008` (command-in/event-out)
   question is opened by this decision.

## Alternatives Considered

- **Extend `DOM-REVIEWS` to also cover Q&A.** Rejected — see Context. The
  unique-per-user constraint, the pre-moderation gate, and the "exactly one
  review" shape are load-bearing invariants of Reviews as it exists today;
  bending them to fit a many-per-user threaded model would either break
  Reviews' own documented invariants or produce two unrelated data shapes
  hiding under one domain name.
- **Fold Q&A into Content.** Rejected — Content owns admin-authored editorial
  material (banners, homepage scheduling). Q&A is customer-generated and has
  its own moderation and upvote mechanics Content has no shape for.
- **No new context; treat Q&A as a Catalog sub-feature.** Rejected — Catalog's
  `ARCH-001` row is explicit that it does not own "Review content"; the same
  reasoning excludes customer-authored Q&A content, which is a different kind
  of thing from product truth.

## Cross References

- `ARCH-001` §1.1 — the context table this amends (Amendment A4).
- `DOM-REVIEWS` — the domain this deliberately does not extend, and the
  precedent for the read-only Catalog/Identity relation pattern this new
  context reuses.
- `ADR-0009` — "depth follows work," the reasoning `DOM-PRODUCT-QA`'s Full-tier
  authoring reuses.
- `OV-007` — the Feature Specification protocol `FEAT-PRODUCT-QA` follows next.
