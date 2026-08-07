---
id: DISC-010
title: Discovery — Recommendations
version: 1.0.0
status: Frozen
owner: Architecture
reviewers:
  - Vedant
created: 2026-08-07
updated: 2026-08-07
milestone: M1
category: Discovery
priority: Critical
depends_on:
  - DISC-001
  - DISC-002
  - DISC-003
  - DISC-004
  - DISC-005
  - DISC-006
  - DISC-007
  - DISC-008
  - DISC-009
required_by: []
related_decisions:
  - ADR-0007
  - ADR-0008
  - ADR-0009
  - ADR-0010
tags:
  - discovery
  - investigation
  - recommendations
risk: Low
complexity: Medium
---

# DISC-010 — Discovery: Recommendations

Investigation 10 of 10, per `OV-001`. The synthesis: what this project should
**preserve, improve or discard**, rolled up from the nine Frozen investigations.

Per `OV-001` this is a synthesis output — it introduces no new evidence, and
its job is to be usable by `PRM-CONSTITUTION` (M2) and `PRM-ARCHITECTURE` (M3)
without re-reading all nine.

## Discovery in numbers

| | |
| --- | --- |
| Investigations | 10, all Frozen |
| Evidence items | 29 |
| Knowledge claims | 206 |
| ADRs authored during Discovery | 4 (`ADR-0007`–`ADR-0010`) |
| Claims superseded by later evidence | 4 (KC-015, KC-082, KC-188, and KC-050 revised) |
| New capabilities surfaced | 2 (shareable cart, settings store) |
| Confidence range | 85%–96% |

## Three findings that only the synthesis shows

Individually these were footnotes; together they are the most useful output of
Discovery.

### 1. Four times, the code was right and the specification was stale

| Specification said | Implementation did | Resolution |
| --- | --- | --- |
| Gold-rate-linked pricing (FR-4, FR-17, revenue §9) | Nothing — no such code | Superseded; wrong business model (KC-078) |
| Guest checkout (FR-1) | Login required | Superseded deliberately (KC-125) |
| NestJS on ECS + Redis (NFR-3) | Single-VM compose | Superseded (`ADR-0010`) |
| 99.9% availability (NFR-2) | No mechanism | Superseded (`ADR-0010`) |

Four for four. Every time a specification and the implementation disagreed, the
**implementation had made the better decision** and nobody had gone back to
update the document.

This is strong evidence that `ADR-0007`'s advisory/authoritative split was
correct rather than a compromise. Had the pre-Oriveda corpus been treated as
binding, Discovery would have generated four false defects and a plan to
"fix" working software.

### 2. The project's strongest habit is recording rationale beside the decision

Found independently in six places, by six different investigations:

- `.gitignore` — rules that name the incident that motivated them (`DISC-001`)
- `ci.yml` — a comment **correcting its own earlier wrong hypothesis** in
  place (KC-067)
- `schema.prisma` — decisions annotated *"RESOLVED (was open in DATABASE.md
  Milestone 2)"* (`DISC-005`)
- `brand.ts` — copy flagged pending a client decision, *"flagged pending, not
  silently rewritten"* (KC-086)
- `cart-store.ts` — why the cart is client-side (KC-114)
- `vitest.config.mts` — why a directory was excluded from coverage (KC-199)

Nobody mandated this. It is the practice that made Discovery tractable: roughly
a third of this investigation's fact-tier claims came from reading a comment
that explained *why*, not from inferring intent from code.

**It is also the practice most at risk from growth**, because it survives on
habit rather than rule. It is the single strongest candidate for a Law.

### 3. One failure mode recurs at six different layers

| Layer | The claim | The reality |
| --- | --- | --- |
| Storefront copy | COD, 7-day returns, subscriptions, WhatsApp, free shipping, 24h dispatch | Ten claims, no system behind them (`DISC-008`) |
| NFRs | 99.9% availability, WCAG 2.1 AA, P95 < 2.5s | Declared non-optional, never measured (`DISC-007`) |
| Build commands | `turbo run typecheck`, `lint` | One a silent no-op, one unrun (`DISC-001`, KC-206) |
| Coverage gate | "90%, enforced in CI" | Aggregate not per-file; a dead directory excluded (`DISC-009`) |
| Domain specs | Three `DOM-` documents | Two describe capabilities that do not exist (`DISC-006`) |
| API surface | 83 endpoints, "built" | Five capabilities unreachable from any UI (`DISC-004`) |

**Six layers, one shape: a surface asserts a capability the system does not
have.** Each was found by a different investigation and looked like an isolated
oversight. They are one problem — nothing in the project compares a claim
against its implementation, so claims drift freely.

This, not any individual defect, is the finding M2 should act on.

## Keep

What Discovery found working and worth protecting. These should survive into
Standards rather than being rediscovered.

**Engineering practice**
- Rationale recorded beside the decision, including self-correction (KC-067).
- Deliberate flags over silent rewrites — `brand.ts`'s pending-copy TODOs
  (KC-086), `status: Proposal` on unbuilt specs (KC-098).
- Very low accidental debt: 3 TODOs, 4 suppressions, strict TypeScript both
  sides (`DISC-009`).

**Structure**
- The uniform `module/controller/service/dto/spec` shape — 17 of 22 exact, 5
  deviating for structural reasons (KC-064).
- Module-per-bounded-context, which survived measurement three ways
  (`DISC-006`).
- `common/` as the sole home for cross-cutting concerns.
- Ports and adapters **confined** to payments and storage — the two vendor
  boundaries, and nowhere else (KC-155).
- Co-located tests; 330 web tests at 96.98% measured (KC-204).

**Design patterns worth codifying**
- **Command in, event out** — the Orders ↔ Payments seam, now `ADR-0008`.
- **Invariant in the `WHERE` clause** — conditional-`UPDATE` inventory
  reservation, race-free by construction (KC-183). The reference answer to any
  check-then-act problem.
- **Snapshot at historical boundaries** — orders, order items, cart lines
  capture value at transaction time (KC-132).
- **Append-only ledgers** — five of them, including race-safe coupon
  redemption via `COUNT()` (KC-133).
- **Invariants in the database** where expressible — five CHECK constraints
  (KC-134).
- **Defence in depth on exposure** — Swagger blocked in app *and* at the edge
  (KC-167).
- **Graceful degradation** — Elasticsearch to Postgres, exercised in CI.

**Product decisions**
- The complete transactional core, browse through refund (`DISC-003`).
- Login-before-checkout as a deliberate database-growth decision (KC-125).
- `FIRST_ORDER` counting cancelled orders as anti-abuse (KC-189).
- Review moderation with `verifiedPurchase` as a badge, not a gate (KC-184).
- `brand.ts` as the white-label seam, now backed by a stated NFR (KC-084).
- The client-aggregation boundary — supplier relationships deliberately
  outside every context (KC-088).

## Improve

Ordered by my weighting of blast radius against cost. Everything here has an
owner decision behind it already.

| # | Action | Why first | Origin |
| --- | --- | --- | --- |
| 1 | **Perform a restore from backup and record it** | `ADR-0010` accepted single-node risk *because* backups cover it. Never tested. Product imagery is the product | KC-205 |
| 2 | **Resolve the storefront claims before the demo banner comes down** | Ten live claims; `RUNBOOK` step 0 gates it | `DISC-008` |
| 3 | **Automate e2e for checkout → payment → confirmation** | The one journey the business cannot let break silently | KC-202 |
| 4 | **Publish-time completeness checks** | 1,045 placeholders, a client about to operate the tool | KC-192 |
| 5 | **Implement `ADR-0008`** — rating ownership + idempotent bulk recompute | Fixes a silent desync feeding search ranking | KC-158/159 |
| 6 | **Return window + general settings mechanism** | Unbounded return liability; settings is infrastructure others need | KC-186/194 |
| 7 | **Frontend completion** — recommendations, returns, wishlist + share, search → Elasticsearch, server-side cart | Five built capabilities customers cannot reach | `DISC-004` |
| 8 | **`axe` in the Playwright suite** | Only unmeasured NFR with legal exposure | KC-176 |
| 9 | **`DOM-SHOPPING` and `DOM-RETURNS`** via `PRM-DOMAIN` | Invariants exist only in constraints and conversation | `ADR-0009` |
| 10 | **Build-tooling pass** — no-op `typecheck`, unrun lint, dual lockfiles | Minutes each; restores trust in documented commands | KC-061/62/63, KC-206 |
| 11 | **Shared-type sync enforcement** | 8 enums + ~15 DTOs hand-duplicated, nothing detects drift | KC-056–058 |
| 12 | **NestJS 10 → 11, Prisma 5 → 6** | Not urgent; compounds if deferred | KC-200 |

## Remove

- **Done** — `components/cinematic` (145 lines) and two stale coverage
  exclusions (KC-203).
- **The authority of superseded specification content** — the premium
  first-party strategy, metal-margin revenue model, gold-rate pricing, NFR-2's
  99.9%, NFR-3's ECS/Redis, FR-1's guest checkout. Per `ADR-0007` the **text
  stays** as advisory history; what is removed is its binding force.
- **Nothing else.** No module, model or capability found in Discovery is
  redundant. The gaps are wiring and claims, not excess.

## Input to M2 Constitution

`OV-001`'s Definition of Done requires Recommendations be available to inform
M2. Five Law candidates, each grounded in a measured finding rather than
general principle:

1. **A surface may not assert a capability the system does not have.** Covers
   storefront copy, NFRs, build commands, coverage gates, domain specs and API
   surfaces — the six-layer pattern above. The single highest-value Law
   available.
2. **Rationale lives beside the decision it explains, and is corrected in
   place rather than deleted.** Codifies the project's strongest existing habit
   (KC-067) before growth erodes it.
3. **Commitments change by explicit navigation, never silently.** The owner's
   own stated principle (KC-048, KC-054), already exercised repeatedly during
   Discovery — deferrals with named triggers rather than open-ended ones.
4. **Knowledge outlives implementation.** Superseded work is annotated, not
   erased (`ADR-0007`). Four claims were superseded during Discovery and all
   four remain readable with their corrections.
5. **An invariant belongs at the lowest layer that can enforce it.** Database
   over application, `WHERE` clause over read-then-write (KC-134, KC-183).

Two further inputs M2 should have:

- **The client-aggregation boundary (KC-088)** is what makes the single-tenant
  model correct rather than naive. It exists only in `DISC-002`. It needs
  constitutional or ADR status before someone "fixes" the missing seller.
- **The dual-purpose constraint (KC-046)** — commercial product and portfolio
  simultaneously — explains practices that look like over-engineering for a
  prelaunch store and should be preserved deliberately.

## Input to M3 Architecture

- The fourteen-context map (`DISC-006`) is the starting point, with KC-088's
  exclusion stated **on** the map.
- Shipping has no context yet and will likely be the first module to import
  Orders, changing the hub's "nothing depends on me" property.
- The event bus is single-process and at-most-once (KC-165) — this bounds every
  event-driven decision, and is the real blocker on horizontal scaling.
- `ADR-0008`'s command-in/event-out rule is the reference pattern for
  cross-context interaction.

## Confidence Level

**High (91%).**

As a synthesis this introduces no new evidence; its reliability is inherited
from the nine Frozen investigations, which range 85%–96%. The Keep and Remove
lists are near-mechanical rollups of Frozen content and carry those documents'
confidence directly.

Two things cap it. **The Improve ordering is judgement** — blast radius against
cost, no agreed rubric, and `DISC-009` already demonstrated that ordering moves
on new evidence when KC-205 displaced the payment e2e gap from first place.
And **the three synthesis findings are interpretation**: the four-for-four
pattern, the rationale habit, and the six-layer claim/reality shape are readings
across investigations, each individually well-evidenced but assembled by me.

Per `OV-001` this cannot exceed its weakest load-bearing claim. The six-layer
pattern is what M2 is being asked to act on, and it is inference-tier — six
independently-observed facts, one asserted common cause.

## Architecture Review

- **Does it hold up?** As a rollup, yes — Keep and Remove are mechanical from
  Frozen content. The three synthesis findings are labelled as interpretation.
- **Does it contradict another investigation?** No. It aggregates.
- **`OV-001` Definition of Done for M1**: all ten investigations drafted,
  discussed and Frozen ✓; Recommendations captured and available to M2 and
  M3 ✓. The remaining DoD item — a worked example under `examples/` per
  `ADR-0002` — belongs to the Oriveda framework repository, not this project.
- **Scope discipline.** This document recommends. It implements nothing and
  authors no Constitution.

**Frozen 2026-08-07** — M1 Discovery complete.

### Cross-cutting extraction check

Both mandatory artifact types were checked by their owning investigations and
are complete: **domain/integration events** in `DISC-006` (KC-150, six events
with measured producer/consumer pairs) and **non-functional requirements** in
`DISC-002` (KC-073) and `DISC-007` (the ten-NFR scorecard), plus one NFR found
outside `PRODUCT.md`'s list — flexible non-domain-bound branding (KC-084).
