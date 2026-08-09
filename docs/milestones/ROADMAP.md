# Roadmap — what is left, and how to finish it

**Status: advisory.** Per `ADR-0007`, `knowledge/` is authoritative and `docs/`
is not. Every item below points at the Frozen document that owns it; where this
file and that document disagree, **the document wins and this file is wrong**.

Written 2026-08-09, after Tiers 1–4 of the M6 feature work completed. It is a
snapshot, not a spec — expect it to go stale, and correct it by deleting entries
rather than by growing it.

---

## How to read this

Work is grouped by **who can finish it**, because that is the constraint that
actually blocks things here — not effort.

| Group | Blocked on | Count |
| --- | --- | --- |
| **A. Client decisions** | Someone deciding what the business promises | 10 |
| **B. Deployment** | Doing it, at deploy time | 4 |
| **C. Engineering** | Ordinary build work | 12 |
| **D. Deferred features** | Client feedback already given: not now | 3 |
| **E. Accepted, not to fix** | Recorded so nobody "fixes" them by accident | 4 |

**Nothing here is a defect in shipped behaviour.** Every item is either a
promise nobody has decided about, a capability that exists but is not reachable,
or a gap that is written down where it will be found.

---

## A. Client decisions — the launch blocker

`deploy/RUNBOOK.md` step 0 gates going live on this, and it is now executable:

```bash
cd apps/web && pnpm claims:audit --strict   # exits 1 while any remain
```

**10 of 13 tracked claims are outstanding.** Each is copy that promises
something the system does not do. They are not engineering work: most need
somebody to decide whether the business keeps the promise or withdraws it.

| Claim | What has to happen |
| --- | --- |
| Cash on Delivery | **Delete.** The client ruled COD out (KC-109); no capability is coming |
| Tarnish-resistant plating | **Client stands behind it, or it goes.** The only claim software cannot settle |
| Dispatched within 24 hours | Client sets a real commitment, or the copy stops making one |
| Arrives in 3–6 business days | Blocked on `FEAT-SHIPPING`; a guess until then |
| Unworn / original packaging | Confirm the shop will actually refuse a worn piece |
| Customisation on select styles | Delete, or the client staffs the Contact page for it |
| Free shipping over ₹999 | **Client sets one threshold**, then it becomes a setting checkout applies |
| "Jewel Box" subscription | Remove the section and footer link, or build it — it is a product, not copy |
| Live order tracking | Reword to describe the status timeline, which is honest and already works |
| Newsletter sign-up | Remove the footer form, or connect a mailing provider |

**Instructions.** For each: decide keep or withdraw. If withdrawn, delete the
copy and set the registry entry to `resolved` in
`apps/web/lib/storefront-claims.ts` — the test suite fails if the registry and
the copy disagree, in either direction, so it cannot drift. If kept, it becomes
an engineering item and moves to group C.

**Two are one decision away from being cheap:** *free shipping* becomes a
`FEAT-SETTINGS-STORE` key the moment a number exists, and *live tracking* is a
wording change.

---

## B. Deployment

Do these **at deploy time**, in this order. All four are recorded in the
runbook so they are found there rather than here.

### B1. Transactional email actually sends — `RUNBOOK` step 0a

**Nothing reaches any customer today.** `NotificationsService` sends from
`orders@jwel.example`, a domain that does not exist; with no `RESEND_API_KEY` it
logs and skips, which is why nothing has visibly broken.

1. Buy the shop's domain (step 0 of the runbook does this anyway).
2. Verify it in Resend — **a Gmail address cannot be a sending domain**, only a
   domain you control.
3. Update the `from` address in `notifications.service.ts` to match.
4. Set `RESEND_API_KEY`.
5. Confirm: place an order, check the confirmation arrives.

Until this is done, order confirmations, return updates and refund notices go
nowhere.

### B2. Storefront claims — `RUNBOOK` step 0

Group A, run as a gate. `pnpm claims:audit --strict` must exit 0 before the
demo banner comes down.

### B3. Reporting definitions agree — `RUNBOOK` step 0b

The admin dashboard deducts refunds; **Metabase queries the database directly
and does not**. The two will disagree by the refund total.

*Owner decision, 2026-08-08: revisit at or before deployment.* The fix is a
database **view** carrying the formula that both read — the only construction
where the definition cannot drift. It needs a hand-written migration (KC-144)
and turns the dashboard query into raw SQL.

Until then: do not quote revenue from Metabase, or apply the same exclusions by
hand — cancelled orders out, `REFUNDED` return amounts deducted.

### B4. Start Elasticsearch

`deploy/docker-compose.elasticsearch.yml` exists and the production stack does
not run it, so **every customer is served by the Postgres fallback today**.
Search works either way — the storefront calls `/search`, which degrades
server-side — but typo tolerance, facets and autosuggest only exist when
Elasticsearch is up.

1. Bring the compose file up alongside the stack.
2. `POST /admin/search/reindex` — builds the index from Postgres.
3. Confirm: search a misspelling (`daimond`) and expect a match.

---

## C. Engineering

Ordinary build work, roughly in value order. Each names the document that owns
the rule.

### C1. Notify customers when a return moves — `FEAT-CUSTOMER-RETURNS` §9
A customer who requests a return sees it in their Returns tab **and nowhere
else**. `return.requested` and `return.refunded` are consumed by Notification,
which is email-only and unconfigured (B1). Depends on B1; after that it may
already work — verify before building.

### C2. Reviews Invariant 8 — deleted users — `DOM-REVIEWS`
The public review read path has no deleted-user branch, so a soft-deleted
customer's name may still render. Add the filter; it is a read-path change.

### C3. Search facets — `DOM-SEARCH`, `FEAT-STOREFRONT-SEARCH` §8
Elasticsearch already computes metal, category, certification and price-range
buckets. Nothing renders them. This is a UI design question — where filters
live on the results page — more than plumbing. Needs B4 to be visible.

### C4. Per-line gift wrap UI — `FEAT-STOREFRONT-SERVER-CART` §7
The schema, API, share and adoption all carry it (Invariant 4). Nothing sets
it. Also a design question: where a per-line control lives in the cart layout.

### C5. Sorting search results — `FEAT-STOREFRONT-SEARCH` §3
Removed deliberately: `/search` ranks by relevance and has no sort parameter,
and leaving an inert dropdown would have been the fourth dead control found
this milestone. Restoring it needs a sort parameter on the search API **and** an
equivalent in the Postgres fallback, or the two paths disagree.

### C6. Content Invariants 5 and 6 — `DOM-CONTENT`
Invariant 5's constraint is a one-line migration. Invariant 6's magic-byte and
image-dimension checks on upload are unbuilt — an upload path currently trusts
the declared MIME type further than it should.

### C7. Stuck `REFUND_PROCESSING` — `DOM-RETURNS` §8.11
No failure handling. A refund that fails part-way leaves a return in that state
with nothing to move it. The reconciliation-sweep pattern
(`FEAT-ORDER-RECONCILIATION`) is the model to copy.

### C8. Guest cart and share retention — `FEAT-SERVER-CART-API` §8, `FEAT-SHAREABLE-CART` §10
One `carts` row per guest browser and one `cart_shares` row per share, forever.
Not a problem at this volume. **A retention policy is a decision first** — how
long should a shared bag work? — then a sweep.

### C9. Coupon Invariant 3 in published terms — `DOM-PRICING`
A rule customers hit without warning. Copy plus a client decision, but small.

### C10. Split `Coupon.value` — `DOM-PRICING`
So each discount type can be database-constrained rather than trusted to
application logic. A migration and a refactor; Law 4 argues for it.

### C11. Claim guest views on **login** — `FEAT-GUEST-VIEW-CLAIM` §8
Only registration is covered. A returning customer who browses as a guest and
then signs in leaves those views behind. **Not a straight copy of the
registration path**: a login claim would let a learned `anonymousId` attach
history to an existing account at any time, so it needs the same 24-hour bound
and a fresh look at whether the trade holds.

### C12. Tune the co-occurrence threshold — `DOM-RECOMMENDATION` Invariant 8
5 is a guess, as the invariant says. It is a setting now
(`recommendations.min_co_occurrence`) so tuning needs no deploy — but **no
report says what it should be**. Needs real order volume first.

---

## D. Deferred — client has already said not now

Do not start these without a fresh decision. All three are `status: Proposal`.

| Feature | Blocked on |
| --- | --- |
| `FEAT-SHIPPING` | Shiprocket; the client's account is blocked (KC-101) |
| `FEAT-WHATSAPP-SMS-NOTIFICATIONS` | WhatsApp **Business API** credentials. The number we have is a click-to-chat contact, which is a different thing |
| `FEAT-FRAUD-RISK-SCORING` | Withdrawn with COD (KC-109). Nothing to score |

---

## E. Accepted — recorded so nobody "fixes" them

| Item | Why it stays |
| --- | --- |
| Return window applied to historical orders | Owner decision, 2026-08-07. Orders delivered before the window existed lost their return path, deliberately |
| 30-minute unpaid-order expiry | Owner decision, 2026-08-08, over the ~17 minutes an earlier note proposed. Too short cancels an order someone is still paying for |
| No Razorpay expiry-event dependency | Owner decision, 2026-08-08. A declined dependency, not an unanswered question — the sweep derives the same result from state we own |
| Soft delete is not erasure — `DOM-IDENTITY` | A deleted user's PII remains in `users`. **Becomes an item the moment a real erasure request arrives**, which is a legal question, not a technical one |

---

## What is *not* on this list, and why

**Verification that exists and passes.** Worth knowing what is now enforced
rather than trusted, because these are the things that will catch the next
regression:

- **Law 1 on storefront copy** — the claims registry, checked against the real
  source files in both directions.
- **Law 5 on module boundaries** — `architecture.spec.ts` fails the build if any
  module outside Catalog writes the product row or emits its events.
- **WCAG 2.1 AA regressions** — `axe` over 23 surfaces including the checkout
  form and all ten admin routes.
- **The payment path** — driven end to end in a browser, asserting the order
  reaches `CONFIRMED` from the server, not from the confirmation page.
- **Backups** — restored, twice, with the two defects that drill found fixed.

**Accessibility beyond automated checks.** `STD-ACCESSIBILITY` rules 3–7 are
human review, and **no screen-reader testing has been done by anyone on any
surface**. That is not an engineering task with a definition of done; it is a
session with a screen reader and someone who knows how to use one. Worth
scheduling before launch, not after.

**Performance budgets.** `STD-PERFORMANCE` says plainly that no budget is
measured (KC-172), so the standard cannot be enforced by CI. Setting one is a
decision about what "fast enough" means for this shop.
