---
id: DISC-008
title: Discovery — Hidden Business Rules
version: 1.1.0
status: Frozen
owner: Architecture
reviewers:
  - Vedant
created: 2026-08-07
updated: 2026-08-07
milestone: M1
category: Discovery
priority: High
depends_on:
  - DISC-005
  - DISC-007
required_by:
  - DISC-009
related_decisions:
  - ADR-0007
  - ADR-0009
tags:
  - discovery
  - investigation
  - hidden-business-rules
risk: High
complexity: Medium
---

# DISC-008 — Discovery: Hidden Business Rules

Investigation 8 of 10, per `OV-001`. Evidence and claim ids refer to
`knowledge/discovery/evidence/README.md`.

**Risk is High**: this investigation consolidates rules that currently exist
only in code, database constraints and conversation. Several are
customer-facing, and one class of them is contradicted by published copy.

## Observed Facts

### The rules that are properly encoded

**Order lifecycle** (KC-177) — an explicit transition table, enforced:

```text
PLACED     → CONFIRMED | CANCELLED
CONFIRMED  → PROCESSING | CANCELLED
PROCESSING → SHIPPED | CANCELLED
SHIPPED    → DELIVERED
DELIVERED  → (terminal)
CANCELLED  → (terminal)
REFUNDED   → (terminal, and unreachable — KC-178)
```

**Return lifecycle** (KC-180):

```text
REQUESTED         → APPROVED | REJECTED
APPROVED          → REFUND_PROCESSING
REFUND_PROCESSING → REFUNDED   (refund amount mandatory)
REJECTED          → (terminal)
REFUNDED          → (terminal)
```

No cancellation path, no re-request after rejection — exactly matching the
policy the owner confirmed (KC-146).

**Return eligibility** (KC-179): the order must be `DELIVERED`, and each order
item may have at most one return request.

**Coupon validation** (KC-181), six checks in order: exists / not soft-deleted /
active → within `validFrom`–`validTo` → subtotal meets `minOrderAmount` →
global redemptions below `maxRedemptions` → this user's redemptions below
`maxRedemptionsPerUser` → for `FIRST_ORDER`, zero prior orders.

**Inventory reservation** (KC-183) is concurrency-safe *by construction*.
Reserve, release and commit go through conditional raw `UPDATE`s that carry the
invariant in the `WHERE` clause:

```sql
WHERE variant_id = $1 AND (quantity_on_hand - quantity_reserved) >= $2
```

An oversell fails at the database rather than being checked and then acted
upon. Release clamps with `GREATEST(…, 0)`; adjustment is guarded by
`quantity_on_hand + delta >= quantity_reserved`.

**Reviews** (KC-184): anyone may review any product without buying it.
`verifiedPurchase` is a *computed badge* — true when the user has a `DELIVERED`
order containing that product — not a gate. Reviews are created `PENDING`; only
`APPROVED` reviews are displayed or counted in rating aggregates.

**Five database CHECK constraints** carry invariants Postgres enforces
regardless of application state (KC-134, `DISC-005`).

### The rules that are missing, unenforced, or contradicted

**There is no return time window** (KC-179). The FAQ states returns are
accepted *"within 7 days of delivery"*. **No such check exists anywhere.** A
customer could request a return years after delivery and the system would
accept it.

**Publishing enforces nothing** (KC-185). Products are created `DRAFT`, and
`status` is a plain optional field on `UpdateProductDto`. There is no check on
price, name, description, media or variants at the `DRAFT → PUBLISHED`
transition.

**`OrderStatus.REFUNDED` is unreachable** (KC-178). No transition targets it;
refunds live entirely on the `ReturnRequest` lifecycle. An order containing a
refunded item stays `DELIVERED`.

**`FIRST_ORDER` counts cancelled orders** (KC-182). Eligibility is
`prisma.order.count({ where: { userId } })` — every order the user ever placed,
regardless of status. A customer whose only previous order was **cancelled** is
permanently ineligible for a first-order coupon.

**Two invariants live only in application code** (KC-143): `ProductView`'s XOR
between `userId` and `anonymousId`, and `Coupon.value`'s type-dependent meaning
(0–100 for `PERCENTAGE`, minor units for `FLAT`/`FIRST_ORDER`).

### Rules asserted to customers with nothing behind them

Consolidated from every prior investigation. This is the launch-gating table,
now complete:

| Claim | Where | Reality |
| --- | --- | --- |
| COD available under ₹10,000 | FAQ | Client ruled COD out (KC-109) |
| Returns within 7 days | FAQ | **No time window in code** (KC-179) |
| "Start a return from your order history" | FAQ | No customer-facing returns UI (KC-117) |
| Customisation available | FAQ | No such capability |
| Monthly "Jewel Box" subscription | `/subscriptions`, footer | No model, no module; deferred (KC-106) |
| "WhatsApp us" | Footer | Email-only; credential-blocked (KC-097) |
| Free shipping over ₹999 / on all orders | Sale bar, PDP, checkout | Three variants, no backing rule (KC-012) |
| Dispatched within 24 hours | Checkout | No dispatch SLA anywhere (KC-013) |
| Tarnish-resistant plating | FAQ | Product claim; needs client to stand behind it |
| 99.9% availability | `PRODUCT.md` NFR-2 | No mechanism; superseded by `ADR-0010` |

## Interpretation

**The transactional rules are in excellent shape; the promotional ones do not
exist.** Everything governing money, stock and state — order transitions,
return transitions, coupon stacking, inventory reservation — is explicit,
enforced, and in several cases enforced at the database rather than trusted to
application flow. Everything governing what the business *promises* is copy.

That split is not an accident of quality. It reflects where the effort went:
the transactional rules were derived from `DATABASE.md` and the milestone
specs, while the promotional claims were written as storefront copy by whoever
was filling in a template. Nobody ever cross-checked one against the other,
because they live in different files and no process compares them.

**Inventory reservation is the single best piece of engineering found in
Discovery.** Putting the invariant in the `WHERE` clause of a conditional
`UPDATE` means an oversell is impossible under concurrency rather than
improbable — no read-then-write race exists to lose. Most e-commerce codebases
check availability and then decrement, and discover the difference on their
first traffic spike.

**The 7-day return window is the most consequential missing rule** (KC-179).
The other unbacked promises cost goodwill; this one costs money, indefinitely.
The system will accept a return request on a two-year-old delivered order, and
the admin has no basis in the UI to reject it beyond judgement. It is also the
cheapest to fix — one comparison against `OrderStatusHistory`'s `DELIVERED`
timestamp.

**Publishing enforces nothing, and that is about to matter** (KC-185). Today
the only publisher is the owner, and the one placeholder that reached the
storefront was deliberate (KC-052). But the catalog contains 1,045 zero-priced
`Untitled Draft NNNN` rows awaiting client data entry (KC-030, KC-049), and the
client is the party who will be publishing them. A publish action that
validates nothing, operated by someone learning the tool, against a thousand
placeholders, is a foreseeable incident rather than a hypothetical one.

**`FIRST_ORDER` counting cancelled orders is a genuine hidden rule** (KC-182) —
implicit in the implementation, stated nowhere, and reachable. A customer
places an order, cancels it, and is then permanently barred from the
first-order discount the marketing email offered them. Whether that is right is
a business call; that nobody has made it is the finding.

**`OrderStatus.REFUNDED` being unreachable is a smaller version of the same
shape** (KC-178). The enum promises a state the machine cannot enter, and it is
exposed in the web type union and the customer's order history. Nothing breaks
— but a status that can never occur is a lie the schema tells about itself.

**These rules have no home.** That is the structural finding. The order
transition table lives in `orders.service.ts`; return eligibility in a comment;
the returns policy in the owner's head and this document; the reservation
invariant in a SQL string. `ADR-0009` already routes Returns and Shopping to
`PRM-DOMAIN`, which is where the invariants belong — this investigation is the
input for that.

## Hidden Assumptions

- **Rules were extracted from service layers.** A rule enforced in a
  controller, guard, DTO decorator or database default would be missed. DTO
  validation in particular was not systematically read.
- **"No time window exists" is absence-of-evidence** (KC-179), from reading
  `returns.service.ts` and its eligibility comment. A check elsewhere in the
  request path would not have been seen.
- **`FIRST_ORDER` behaviour is inferred from one query** — `order.count` with
  no status filter. The consequence for cancelled orders follows logically but
  was not exercised against a running system.
- **The promises table aggregates claims across investigations**, some sourced
  from `EVD-002`'s superseded screenshots. The FAQ and `brand.ts` entries were
  re-verified in current source; the sale-bar and checkout copy were not.
- **"Publishing enforces nothing" was established by reading the DTO and
  service**; a validation pipe or interceptor applying elsewhere would change
  this.

## Strengths

- **Both lifecycles are explicit transition tables**, not scattered
  conditionals — legible, testable, and hard to violate accidentally.
- **Inventory reservation is race-free by construction** (KC-183), not by
  convention.
- **Coupon validation is ordered and complete** — six checks covering time,
  value, global limits, per-user limits and type-specific eligibility.
- **Review moderation is the right default** — unmoderated at write, approved
  before display, aggregates computed from approved only.
- **Refund amounts are mandatory** at the `REFUNDED` transition; a refund
  cannot be recorded without a number.
- **Five invariants sit in the database**, immune to application bugs.
- **The returns policy matches its implementation exactly** (KC-146, KC-180) —
  rare alignment between a stated policy and enforced code.

## Weaknesses

- **No return time window** (KC-179) while the FAQ promises seven days —
  unbounded liability, and the cheapest fix on this list.
- **Publishing validates nothing** (KC-185), with 1,045 placeholders and a
  client about to operate it.
- **Ten customer-facing claims have no system behind them** — the table above.
- **`FIRST_ORDER` silently penalises customers who cancelled** (KC-182).
- **`OrderStatus.REFUNDED` is exposed but unreachable** (KC-178).
- **Two invariants are application-only** (KC-143); a mis-set `Coupon.value` is
  a money bug the database will accept.
- **No rule has a specification.** Every finding above was recovered by reading
  code; none could have been learned from a document.

## Questions

1. ~~Should a return time window be enforced, and at what length?~~ →
   **RESOLVED** (KC-186): **10 days from delivery**, a blanket global rule, and
   **editable from the admin panel** rather than fixed in code. See the new
   capability this implies, below.
2. ~~Should publishing require a completeness check?~~ → **RESOLVED**
   (KC-188): **no**. Publishing stays an unguarded admin action; correctness of
   published data is the admin's responsibility, not the system's. Recorded at
   85% confidence — see the note on that claim.
3. ~~Should `FIRST_ORDER` ignore cancelled orders?~~ → **RESOLVED** (KC-189):
   **no** — the current behaviour is deliberate. It is an anti-abuse rule;
   place-cancel-repeat would otherwise farm the discount indefinitely.
4. ~~Should `OrderStatus.REFUNDED` be reachable?~~ → **RESOLVED** (KC-190):
   **made reachable**, not removed.

**Still open:**

5. When does the promises table get resolved — one pass, or per claim as each
   capability lands? → **owner decision**; `RUNBOOK` step 0 gates it either
   way.
6. **What condition makes an order REFUNDED?** (KC-191) Returns are per order
   item, so an order with some items refunded needs a defined rule, and
   whether a partially refunded order stays DELIVERED. → `DOM-RETURNS` via
   `PRM-DOMAIN`. Natural starting point: every order item has a REFUNDED
   return. Not decided here.

## Recommendations

- **Keep** — both transition tables, and treat them as the model for any future
  state machine in this system.
- **Keep** — the conditional-`UPDATE` reservation pattern, and codify it in
  `STD-DATABASE` at M5. It is the reference for any future
  check-then-act problem.
- **Keep** — review moderation as designed, and the `verifiedPurchase` badge
  rather than a purchase gate.
- **Keep** — `FIRST_ORDER`'s treatment of cancelled orders (KC-189); it is a
  deliberate anti-abuse rule. **Improve** its visibility: state it wherever
  coupons are documented for the client, since the customer who triggers it
  cannot see why they were refused.
- ~~**Keep** — publishing as an unguarded admin action.~~ **Reversed by
  Amendment A1** (KC-192): publish-time completeness checks will be added.
- **Improve** — implement the 10-day return window (KC-186), and design the
  settings store it needs as a general mechanism rather than a single column.
- **Improve** — make `REFUNDED` reachable once `DOM-RETURNS` defines the
  condition (KC-190, KC-191).
- **Improve** — resolve the promises table before the demo banner comes down.
  `deploy/RUNBOOK.md` step 0 already gates this.
- **Remove** — nothing. `OrderStatus.REFUNDED` stays and becomes reachable.

### Two decisions with implications beyond their answer

**The return window needs a settings store that does not exist** (KC-187).
"Editable from the admin panel" is a larger requirement than "10 days". There
is no `Setting`, `Config` or `AppSetting` model among the 27, and no
return-window constant anywhere in either app. This is the **second new
capability Discovery has surfaced**, after the shareable cart (KC-129), and
like that one it needs a `FEAT-` specification through `PRM-FEATURE` rather
than being inferred from a sentence.

It is also the more consequential of the two, because a settings store is
infrastructure others will build on: the moment one admin-editable value
exists, free shipping thresholds, dispatch SLAs and the low-stock threshold
become natural candidates. Worth designing as a general mechanism once rather
than as a `returnWindowDays` column.

**Making REFUNDED reachable requires a rule nobody has written** (KC-191).
Returns are per order item. An order with three items, one refunded, has no
defined status — the decision is *when* an order becomes REFUNDED, and whether
a partially refunded order stays DELIVERED. `DOM-RETURNS` owns this.

**The FAQ is now wrong twice about returns.** It claims 7 days; the rule is 10,
and previously nothing enforced any window at all. Both corrections belong in
the same copy pass.

### Handed to `PRM-DOMAIN`

`ADR-0009` routes **Returns** and **Shopping** to `PRM-DOMAIN` first. This
investigation is the primary input for Returns. That domain's invariants are
now settled and complete:

- Eligibility: order `DELIVERED`, one return per order item (KC-179).
- **Window: 10 days from delivery, global, admin-configurable** (KC-186).
- Lifecycle: `REQUESTED → APPROVED|REJECTED`, `APPROVED → REFUND_PROCESSING`,
  `REFUND_PROCESSING → REFUNDED`; `REJECTED` and `REFUNDED` terminal (KC-180).
- No customer cancellation, no re-request after rejection; exceptions out of
  band (KC-146).
- Refund amount mandatory at `REFUNDED`.
- **Open for the spec to decide**: what makes the *order* REFUNDED (KC-191).

## Amendments

Per `KC-054`, a Frozen document changes only by explicit navigation with the
change recorded. The body below stays as Frozen at v1.0.0; amendments are
additive and dated.

### A1 — 2026-08-07, publish validation reversed; FAQ reclassified (EVD-027)

**Trigger.** The owner corrected two readings from the Discussion pass.

**1. Publish-time checks WILL be added** (KC-192), reversing KC-188.

The v1.0.0 reading — that publishing stays unguarded and correctness is the
admin's responsibility — was wrong. The owner's "all dependent on admin" was
confirming the finding, not accepting it.

KC-188 was recorded at **85% confidence with the ambiguity flagged
explicitly**, and that flag did its job: the claim was the only one in this
investigation below full confidence, and it is the only one that turned out
wrong. Recorded here as evidence that the confidence discipline earns its
keep — a claim written at 100% would have propagated silently into `DOM-`
specs and implementation.

Proposed check set, as a **starting point for specification, not a conclusion**:
non-zero price on every variant; a name that is not an auto-generated
placeholder; a non-placeholder description; at least one variant; at least one
image. Which of these are hard blocks versus warnings is a design decision.

This materially changes the risk posture around KC-185: 1,045 zero-priced
placeholders and a client learning the tool now have a system check between
them.

**2. The FAQ is placeholder copy, not committed answers** (KC-193).

Both questions and answers are subject to replacement. This reframes — but does
not remove — five entries in the promises table:

| Source | Standing after A1 |
| --- | --- |
| FAQ — COD, return window, "start a return from order history", customisation, tarnish resistance | **Placeholder copy to be rewritten.** Not commitments to honour or retract |
| Sale bar, checkout copy, footer links, `/subscriptions` | **Unchanged** — live product surfaces, not placeholders |

The `RUNBOOK` step 0 gate is unaffected: placeholder or not, none of it may
reach production as-is. What changes is the *nature* of the fix — the FAQ needs
authoring, the others need reconciling.

**3. The settings store is confirmed as a general mechanism** (KC-194), not a
`returnWindowDays` column. Anticipated early consumers: free shipping
threshold, dispatch SLA, low-stock threshold — each currently hardcoded or
unbacked.

**Confidence unchanged at 89%.** One claim reversed, one reclassified, no
observation altered. KC-179 still sets the ceiling.

## Architecture Review

- **Does it hold up?** Yes. The rule extraction is direct observation; the two
  absence-of-evidence findings are labelled as such.
- **Does it contradict another investigation?** No. It **completes** several:
  the promises table consolidates claims from `DISC-002` through `DISC-007`
  into one list, and it closes `DISC-002`'s residual `DRAFT → PUBLISHED`
  question (KC-185).
- **Two new capabilities surfaced**, both needing `PRM-FEATURE`: an
  admin-editable settings store (KC-187) and the order-level REFUNDED rule
  (KC-191). Recorded rather than designed here.
- **Scope discipline.** This investigation recovers rules and records
  decisions. It does not implement the return window, design the settings
  store, or rewrite the FAQ.

**Frozen 2026-08-07** by owner sign-off. Revision requires the full
Discussion → Review cycle (KC-054).

## Confidence Level

**High (89%)** after the Discussion pass.

Positive rule extraction is direct observation at 95–100% — transition tables,
validation sequences, SQL predicates and DTO shapes were all read in current
source.

The cap comes from two places. **Negative claims rest on absence of evidence**:
"no return window exists" and "publishing validates nothing" (KC-179, KC-185)
were established by reading the service and DTO layers, and a check in a guard,
pipe or decorator elsewhere in the request path would not have been seen. And
**rules were extracted from service layers only** — DTO decorators in
particular were not systematically read, so this investigation under-reports
input validation.

Per `OV-001` the investigation cannot exceed its weakest load-bearing claim.
KC-179 carries the most weight of any finding here and is absence-of-evidence,
so it sets the ceiling. A single grep of the returns request path against a
running instance would settle it.

The Discussion pass raised confidence only marginally, which is honest: it
resolved dispositions rather than correcting observations. One claim — KC-188,
publish validation — is recorded at 85% rather than 100%, because the owner's
answer confirmed the finding before stating a position and the two readings
differ materially. It is flagged for correction rather than assumed settled.

### Cross-cutting extraction check

- **Domain/integration events** — owned by `domain-discovery` (done, KC-150).
  One rule-level note: `return.requested` and `return.refunded` fire on
  transitions this investigation documents, so the event catalogue and the
  transition table are consistent.
- **Non-functional requirements** — owned by `business-vision` and
  `technical-architecture`, both complete. NFR-2's superseded 99.9% figure
  appears in the promises table above because it is the same class of problem:
  a commitment with no mechanism behind it.
