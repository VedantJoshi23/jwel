---
id: DISC-005
title: Discovery — Data Model
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
  - DISC-002
  - DISC-004
required_by:
  - DISC-006
related_documents:
  - DATABASE.md
related_decisions:
  - ADR-0005
  - ADR-0006
  - ADR-0007
tags:
  - discovery
  - investigation
  - data-model
risk: Low
complexity: High
---

# DISC-005 — Discovery: Data Model

Investigation 5 of 10, per `OV-001`. Evidence and claim ids refer to
`knowledge/discovery/evidence/README.md`.

Read from `schema.prisma` in full (761 lines, 27 models, 15 enums), the six
migrations' CHECK constraints, and the review-aggregate write path (`EVD-019`).

**Risk is Low** — unusually, for a Discovery investigation. This is the
strongest artifact examined so far, and the findings are refinements rather
than corrections.

## Observed Facts

### Conventions, held consistently

- **Money is integer minor units (paise) everywhere** — Order, OrderItem, Cart,
  Coupon, Payment, ReturnRequest. The header states the rule: *"never
  Float/Decimal for currency."* No monetary float or decimal column exists.
  (KC-131)
- **All primary keys are UUID**, with the stated reason: avoiding sequential-ID
  enumeration on public product and order URLs.
- **snake_case at SQL level via `@map`/`@@map`**, camelCase in the client —
  applied without exception.
- **Soft delete (`deletedAt`) on User, Product, Category, Coupon**, to preserve
  referential integrity for historical orders after a product is delisted.

### Immutability at the historical boundaries (KC-132)

- `Order.shippingAddress` is a **JSON snapshot**, not an FK to `Address`,
  annotated *"RESOLVED (was open in DATABASE.md Milestone 2)"* — historical
  accuracy survives the user editing or deleting the saved address, with no
  separate snapshot table.
- `OrderItem` carries `productNameSnapshot`, `variantSnapshot` (JSON) and
  `unitPriceMinorUnits`.
- `CartItem` carries `priceSnapshotMinorUnits`.

### Five append-only ledgers (KC-133)

`CouponRedemption`, `OrderStatusHistory`, `ReturnStatusHistory`, `ProductView`,
`AuditLog`. `CouponRedemption` is append-only *by design*, so redemption limits
are enforced by `COUNT()` rather than a mutable counter — avoiding races under
concurrent checkout.

`AuditLog` deliberately omits `onDelete` on its actor FK: *"losing the 'who' on
a historical entry by cascading a user deletion would defeat the point of an
audit trail."*

### Invariants enforced in the database (KC-134)

Five named CHECK constraints, in Postgres rather than only in application code:

| Constraint | Rule |
| --- | --- |
| `non_negative_stock` | `quantity_on_hand >= 0 AND quantity_reserved >= 0` |
| `reserved_not_exceeding_on_hand` | `quantity_reserved <= quantity_on_hand` |
| `positive_quantity` | `quantity > 0` |
| `rating_range` | `rating BETWEEN 1 AND 5` |
| `valid_date_range` | `valid_to > valid_from` |

### Indexing against stated access patterns (KC-135)

BRIN on `Order.createdAt` for date-range reporting — with a note that BRIN
ignores sort direction, so no `Desc` is specified. GIN trigram on
`Product.name`. Composite indexes matching the PDP review read path
(`productId, moderationStatus, createdAt Desc`) and the admin low-stock
dashboard. `ProductCoOccurrence` canonicalises pairs so `productAId` is always
the lexicographically smaller, giving each unordered pair exactly one row.

### What the model says about decisions taken this week

- **`Wishlist.shareToken` already exists** (KC-136) — the shareable wishlist
  (KC-128) needs **no schema change**.
- **`Cart` has no share token** (KC-137) — the shareable cart (KC-129) does.
  `Wishlist.shareToken` is an exact in-repo precedent for the pattern.
- **`Cart.guestToken` exists**, unique-nullable alongside a unique-nullable
  `userId` (KC-138) — the model already supports a pre-login cart that is later
  claimed by a user.
- **`Order.userId` is non-nullable** (KC-140) — the schema already encodes the
  no-guest-checkout rule decided in KC-125.
- **No `Subscription` model** exists, confirming KC-099 at model level.
- **No Seller/Vendor entity**, correct per the KC-089 boundary.

## Interpretation

**This is the best-executed artifact in the project.** The conventions are not
merely stated in a header — they are held across 27 models without drift, and
the places where a rule could not be enforced are documented rather than
quietly skipped. `DISC-001` found that habit in `.gitignore` and `ci.yml`; it is
strongest here.

**The snapshot discipline is the standout decision.** Orders, order items and
cart lines all capture value at the moment of the transaction rather than
pointing at mutable catalog rows. This is the difference between an order
history that stays true and one that silently rewrites itself when a product is
renamed or repriced — and it is the class of bug that is nearly impossible to
fix retroactively, because the original values are gone.

**Invariants sit at the right layer.** Stock non-negativity, reserved-not-
exceeding-on-hand and rating range are in the database, where no application
bug or manual query can violate them. Where Prisma could not express a
constraint — `ProductView`'s XOR, `Coupon.value`'s type-dependent meaning — the
schema says so explicitly and names the enforcing service (KC-143). That is the
correct handling: the gap is visible rather than assumed closed.

**The unused cart tables are well designed, not abandoned.** `DISC-004` found
`Cart`/`CartItem` unreachable from the storefront. Read at model level they are
complete and thoughtful — price snapshots, a unique `(cartId, variantId)`,
cascade on delete, guest-token support. The server-side cart move (KC-126) is
therefore a *wiring* exercise against a model that already anticipated it,
which is a materially better position than it appeared from the frontend.

`Cart.guestToken` deserves a specific note: it is **not** made obsolete by the
no-guest-checkout decision. Guest *carts* and guest *checkout* are different
things — a visitor still fills a cart before registering, and `guestToken` is
how that cart survives until they do (KC-138). Removing it would break the
funnel the registration requirement depends on.

**The gift-wrap mismatch resolves in the model's favour** (KC-147). Gift wrap
is per line item, as `CartItem.giftWrap`/`giftNote` already model it. The
storefront's single cart-level toggle is the side that must change, and it must
change **as part of** the server-side cart move (KC-126) rather than after —
migrating a cart-level flag into a per-item column without deciding this first
is how the inconsistency would have become a data bug rather than a UI task.

**The denormalized rating aggregates are the one real fragility** (KC-142). The
schema comment offers *"trigger or application-layer write-through"*; no
migration creates a trigger, so it is application-layer only, in
`reviews.service.ts`. Any write path that bypasses that service — a seed
script, a bulk import, a manual SQL correction — desynchronises `avgRating` and
`ratingCount` silently. They feed search ranking's popularity signal, so the
failure mode is not a wrong number on a page but subtly wrong result ordering,
which nobody notices.

**The strict return rule is deliberate** (KC-146). `ReturnRequest.orderItemId`
is unique, which cleanly enables partial returns per item. The Draft read the
resulting terminal-rejection behaviour as possibly unintended; the owner
confirms it is intended. A rejected return cannot be re-requested, **and** a
pending request cannot be cancelled by the customer — exceptions are handled
out of band by email or WhatsApp.

That resolves the schema question and creates a UI requirement the schema does
not express: the customer returns surface to be wired under KC-123 must offer
**request and status only, and no cancel control**. A cancel button would be
the natural thing for a frontend developer to add, and it would contradict a
policy that lives nowhere in the code.

One dependency worth noting (KC-148): the stated fallback channel is "email or
WhatsApp", and WhatsApp is not yet implemented (KC-097, KC-102). Email is the
only working channel for this policy today. Not an objection — the policy is
sound at the expected volume — but its viability rests on one of two promised
channels.

## Hidden Assumptions

- **The schema is read as the source of truth for runtime behaviour.** Prisma's
  model and the live database can diverge; no drift check was run against a
  running instance. `Product.searchVector`'s raw-SQL index (KC-144) means part
  of the real schema is invisible to Prisma, so a drift check would not catch
  everything anyway.
- **CHECK constraints are assumed active.** They were read from migration SQL,
  not verified against a live database.
- **"No trigger exists" rests on grepping migrations** for `CREATE TRIGGER` and
  `CREATE FUNCTION`. A trigger created outside the migration history would be
  missed — and would not be in version control, which is its own finding.
- **Index appropriateness is assumed from stated intent.** No query plan was
  examined and no data volume exists to profile against.
- **The gift-wrap mismatch (KC-139) rests partly on `EVD-002`**, whose
  screenshots are superseded. The UI may have changed; the model has not. The
  decision in KC-147 makes the model authoritative either way, so this no
  longer carries weight.

## Strengths

- **Money handling is correct everywhere** — integer minor units, no float,
  no exceptions.
- **Snapshot discipline at every historical boundary**, with the
  `Order.shippingAddress` decision recorded as resolved against a previously
  open question.
- **Invariants in the database**, not only in application code.
- **Append-only ledgers**, including a race-safe coupon redemption design that
  anticipates concurrent checkout.
- **Indexes chosen deliberately**, with access patterns and BRIN's semantics
  stated inline.
- **Documented limitations.** Where Prisma cannot express a constraint, the
  schema names the gap and the service that closes it.
- **The audit log survives user deletion**, by deliberate FK design.
- **The cart model already supports what was decided this week** — guest
  carts, price snapshots, per-line integrity.

## Weaknesses

- **Rating aggregates can desynchronise silently** (KC-142) and feed search
  ranking. Single write path, no trigger, no reconciliation job.
- **Gift-wrap granularity mismatch** between model and UI (KC-139) — now
  resolved in principle (KC-147), but still a required UI change coupled to the
  cart migration.
- **The returns policy is confirmed but unencoded** (KC-146). No customer
  cancellation and no re-request after rejection are real rules that exist in
  no spec and no code comment — only in the unique constraint, which expresses
  half of it and explains none of it.
- **Part of the schema is invisible to Prisma** (KC-144) — `searchVector` and
  its GIN index live in a hand-authored migration.
- **A comment describes an index as partial when it is not** (KC-145). Minor,
  but it is the one place where the schema's documentation is wrong rather
  than incomplete.
- **Two type-dependent invariants live only in application code** (KC-143) —
  documented, but a mis-set `Coupon.value` is a real money bug that the
  database will accept.

## Questions

1. ~~Should a rejected return be re-requestable?~~ → **RESOLVED** (KC-146):
   no, deliberately — and customers cannot cancel a pending request either.
   Exceptions go out of band.
2. ~~Should gift wrap be per-item or per-cart?~~ → **RESOLVED** (KC-147):
   per item. The UI changes, not the model.

**Still open:**

3. Should rating aggregates gain a reconciliation job or a DB trigger? →
   `technical-debt`.
4. Does the live database match the migration history? → `technical-debt`;
   needs a running instance.
5. Should `Coupon.value`'s type-dependent meaning be split into two columns, so
   the database can constrain each? → `technical-architecture`.
6. **Where should the returns policy live** now that it is confirmed but
   unencoded — no customer cancellation, no re-request after rejection? →
   `hidden-business-rules`. It is currently a rule with no home in code or
   spec, and the returns UI depends on honouring it.

## Recommendations

- **Keep** — every convention in the header. They are held consistently and
  should become a `STD-DATABASE` standard in M5 essentially as written.
- **Keep** — the snapshot discipline. It is the model's most valuable property.
- **Keep** — DB-level CHECK constraints, and prefer them over application
  validation wherever expressible.
- **Keep** — `Cart.guestToken`. It supports guest carts, which the
  registration-before-checkout decision depends on rather than replaces.
- **Improve** — add a reconciliation path for rating aggregates, or a trigger.
  The silent-desync failure mode is the model's weakest point.
- **Keep** — the returns lifecycle as modelled (KC-146). The unique constraint
  is the policy, correctly expressed.
- **Improve** — record the returns policy somewhere binding before the returns
  UI is built: no customer cancellation, no re-request after rejection,
  exceptions out of band. Today it exists only in this investigation.
- **Improve** — change the gift-wrap UI to per-item as part of the cart
  migration (KC-147), not as a follow-up.
- **Improve** — correct the "partial index" comment.
- **Remove** — nothing. No model is redundant; the unused ones are pending
  wiring, not excess.

## Confidence Level

**Very high (95%)** after the Discussion pass.

Every claim is direct observation of version-controlled source — schema
declarations, migration SQL, and one service file. There is no inference-tier
claim carrying weight in this investigation, which is why it sits above every
prior one.

Both open model questions are now resolved by owner decision, and both resolved
*in the schema's favour* — the model was right about returns and right about
gift wrap. That is unusual enough to be worth stating: this is the only
investigation so far where the implementation needed no correction.

The cap is that **the schema was read, not the database**. CHECK constraints
were read from migration files rather than verified live; no drift check was
run; and `searchVector`'s raw-SQL index means Prisma's own drift detection
would not be authoritative either (KC-144). Per `OV-001` the investigation
cannot exceed its weakest load-bearing assumption, and "the live database
matches its migration history" is that assumption. Question 4 closes it, and
needs a running instance rather than more reading.

## Architecture Review

- **Does it hold up?** Yes. Every load-bearing claim is direct observation of
  version-controlled source, and both Discussion questions confirmed the
  model rather than correcting it.
- **Does it contradict another investigation?** No. It **strengthens**
  `DISC-004`: the unused cart tables are complete and well designed, so the
  server-side cart move is wiring rather than construction. It confirms
  `DISC-002`'s KC-089 boundary at model level (no seller entity) and `DISC-003`'s
  KC-099 (no subscription model).
- **Two hand-offs carry real weight.** `hidden-business-rules` inherits an
  unencoded returns policy (KC-146) plus the two application-layer-only
  invariants (KC-143). `technical-debt` inherits the rating-aggregate desync
  risk (KC-142) and the Prisma-invisible `searchVector` index (KC-144).
- **Scope discipline.** This investigation reads the model and records
  decisions about it. It does not migrate the cart, redesign the aggregates, or
  author `STD-DATABASE`.

**Frozen 2026-08-06** by owner sign-off.

### Cross-cutting extraction check

- **Domain/integration events** — owned by `domain-discovery`. The model
  contributes one input: `ProductCoOccurrence` is maintained incrementally on
  every `order.confirmed` event, making it the only precomputed recommendation
  signal and a real consumer of the event bus.
- **Non-functional requirements** — owned by `business-vision` (done) and
  `technical-architecture` (pending). Two model-level NFR contributions to
  forward: the denormalized rating aggregates and the BRIN/GIN index choices
  are both explicit read-performance decisions serving NFR-1.
