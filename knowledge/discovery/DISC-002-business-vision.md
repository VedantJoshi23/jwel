---
id: DISC-002
title: Discovery — Business Vision
version: 1.0.0
status: Frozen
owner: Architecture
reviewers:
  - Vedant
created: 2026-08-06
updated: 2026-08-06
milestone: M1
category: Discovery
priority: Critical
depends_on:
  - DISC-001
required_by:
  - DISC-003
related_documents:
  - PRODUCT.md
related_decisions:
  - ADR-0007
tags:
  - discovery
  - investigation
  - business-vision
risk: Medium
complexity: Medium
---

# DISC-002 — Discovery: Business Vision

Investigation 2 of 10, per `OV-001`. Evidence and claim ids refer to
`knowledge/discovery/evidence/README.md`.

**Risk: Medium.** The business is a commission marketplace; the *system* is
deliberately not. The Architecture Review pass established that the multi-vendor
relationship is conducted entirely outside the software, so the single-tenant
first-party model is correct by design. The high-risk finding raised in v0.2.0
is withdrawn — see the Interpretation's second revision.

## Purpose

Establish what business this is, who it serves, and what it sells — well
enough that M2 Constitution can encode non-negotiables without inventing them.

## Observed Facts

**From the owner directly (EVD-001, EVD-006, EVD-007):**

- The product is prelaunch; no real customers. (KC-001)
- The target buyer shops for **everyday jewellery, imitation especially** —
  not fine or investment jewellery. (KC-045)
- It serves as **both a real commercial product and a portfolio build**.
  (KC-046)
- Every recorded capability is a **live commitment**, not aspirational.
  (KC-047)
- Commitments are revisable — but by explicit navigation, never a silent drop,
  when something poses a security risk, exceeds budget, or is otherwise against
  the project's interest. (KC-048, widened by KC-054 to cover document changes
  generally.)
- Deployed data is synthetic: `rzp-live-`/`rzp-refund-`/`rzp-stockcheck-`
  test accounts, plus deliberate payment-and-refund test traffic. (KC-039,
  KC-052)

**From the deployed storefront (EVD-002):**

- Public brand is **ELYSIAN**; the repository and admin portal use the internal
  name **Jwel**. (KC-004)
- Copy positions the brand around festive and heirloom craft — "Timeless
  craft, festive spirit", Kundan chokers, temple jhumkas, pearl sets,
  meenakari rings, "heirloom pieces". (KC-005)
- Observed price points are ₹2,499 and ₹2,500. A BIS Hallmark badge and
  92.5 sterling silver / rhodium plating detail appear on the published
  product. (KC-008)
- A persistent bar reads "Demo store — orders are for preview only."

**From PRODUCT.md (EVD-005 — advisory per `ADR-0007`):**

- Positions the product as "a **premium** jewellery e-commerce platform for the
  Indian market", benchmarked against Tanishq, BlueStone and CaratLane, with AI
  personalization as the differentiating whitespace. (KC-068)
- **Four of five personas target premium buyers** — bridal/high-value (Anika),
  gifting (Rohan), luxury self-buyer (Meera), plus an internal admin persona.
  Only Persona 4 (Priya — everyday daily-wear, price-sensitive, trend-driven)
  matches the owner's stated buyer. (KC-069)
- **Revenue model is premised on precious metal**: margin on gold/diamond
  jewellery sales as primary, plus making-charge/markup tiering "industry-
  standard in Indian jewellery". (KC-070)
- **Gold-rate-linked pricing recurs throughout** — FR-4, FR-17, Persona 5,
  revenue item 2, and Open Question 1 (which gold-rate data source to use) —
  with **no implementation anywhere in either app**. (KC-071)
- **FR-2's taxonomy has already been revised** to a client-provided one:
  Oxidised Silver, Nazariya, Kids' silver, Toe rings, Adjustable rings. The FR
  text notes it replaced "the placeholder category list this FR originally
  named". (KC-072)
- Ten NFRs are declared (NFR-1 to NFR-10); NFRs 1–8 are stated as non-optional
  for MVP. (KC-073)

## Interpretation

> **Revised 2026-08-06** after the Discussion pass (EVD-009). The Draft framed
> this as a choice between two positionings — premium versus everyday. That
> framing was too small. The answer is a third thing: a different *business
> model*. The Draft's reasoning is retained below the revision because its
> evidence still holds; only its conclusion was undersized.

> **Revised again 2026-08-06** after the Architecture Review pass (EVD-010).
> The v0.2.0 revision below correctly identified the *business* as a
> marketplace, then wrongly concluded the *system* must model one. The owner's
> clarification draws the boundary explicitly: it does not. The v0.2.0 text is
> retained beneath the current reading, per `OV-000`'s treatment of superseded
> claims — twice-corrected reasoning is worth keeping visible.

### The system boundary excludes the marketplace (KC-087, KC-088, KC-089)

The platform provides **no digital infrastructure to the contracted shops**.
Transactions, goods and charges between the client and its jewellers happen
entirely outside the software. The domain abstraction the owner states is:

> **client + contracted shops = one (new) client**

That aggregated client owns the inventory as far as the system is concerned.
The contracted shops are an extension of the client, invisible to the software.

This is the most important architectural constraint recorded in Discovery,
because it defines what the system is deliberately **not** responsible for. Its
consequences reverse three findings from v0.2.0:

**1. The single-tenant data model is correct, not deficient (KC-089).** The
observation in KC-082 stands — there is no seller concept in the 27 models. The
conclusion drawn from it was wrong. Seller entities, per-seller inventory,
order splitting, commission calculation, settlement and payouts are absent
because they are **out of scope**, not because they were overlooked. Nothing in
the data model needs to change for the marketplace arrangement.

**2. Commission needs no representation (KC-090).** It is settled between the
client and its jewellers by business arrangement. The platform never holds funds
in trust, never splits a payment, never owes a settlement. Razorpay's existing
single-payee flow is correct as built.

**3. Trust obligations do not cross an organisational boundary after all
(KC-091).** With one merchant of record, certification claims, dispatch timing,
free shipping and returns are the client's to keep — discharged against a single
counterparty. The enforcement problem v0.2.0 raised does not exist. What remains
is ordinary: the client must be able to honour what the storefront promises,
which is the same obligation any retailer has.

**`ADR-0001`, `ADR-0004` and `ADR-0005` are therefore undisturbed** (KC-092).
The re-examination flagged against them in v0.2.0 is withdrawn: client-owned
fulfilment via Shiprocket, buyer-side fraud scoring, and Razorpay as sole
single-payee provider are all sound under the correct system model.

### What the marketplace framing still changes

Two things survive the correction, because they are about the business rather
than the system:

- **Product mix follows contracted supply** (KC-083) — primarily imitation,
  premium where a contracted jeweller carries licences or certificates, with a
  Premium Collection anticipated later. Certification remains load-bearing;
  the system displays what the client asserts, and the client stands behind it.
- **Flexible branding is a real NFR** (KC-084), driven by a year of expected
  strategy movement, and already partly built in `brand.ts`.

### Why this correction matters more than the error

Discovery's purpose is to establish what is true before specifications are
written on top of it. Had `PRM-ARCHITECTURE` run against v0.2.0, it would have
designed a Seller aggregate, a settlement mechanism and a payment-splitting
integration — a large body of work for a business arrangement that never
touches the software. That is precisely the waste an evidence-driven,
question-asking protocol exists to prevent, and it was caught by asking rather
than assuming.

---

### Superseded interpretation, v0.2.0 (retained per OV-000)

*Correct that the business is a marketplace; wrong that the system must model
one. Retained because its reasoning about the business model still holds.*

### The business is a marketplace (KC-078, KC-079, KC-080)

The premium first-party strategy is abandoned outright. What replaces it is not
"the same shop selling cheaper jewellery" — it is a **platform that does not own
inventory at all**. Multiple contracted jewellers list and sell their own
products; the platform connects them to customers and takes an **intermediation
commission**. Product mix follows contracted supply: primarily imitation, but
premium with licences or certificates wherever a contracted jeweller carries it,
with a Premium Collection anticipated later (KC-083).

Three consequences follow immediately.

**1. The data model has no seller (KC-082).** This is the largest gap between
intent and implementation found anywhere in Discovery. Across 27 Prisma models
there is no Seller, Vendor or Merchant entity. `Product` has no owning-seller
relation — a product belongs to the store. `Role` is `CUSTOMER | STAFF | ADMIN`
with no merchant role. There are no commission, payout or settlement models.
`Payment` is one row per `Order` carrying a single amount with no split.
Inventory is store-owned. Every marketplace primitive is absent: seller
onboarding and KYC, product ownership, per-seller inventory, order splitting
across sellers, commission calculation, settlement and payouts, per-seller
returns and seller-scoped permissions.

**2. Certification stays load-bearing, and becomes harder.** Under the
everyday-imitation reading, the `CertificationType` enum and the BIS Hallmark
badge (KC-008) looked decorative. Under KC-083 they are essential — and now
carry an authenticity burden the platform cannot discharge itself, because the
claim originates with a third-party jeweller. A marketplace asserting a
hallmark on a seller's behalf is making a representation about goods it has
never handled.

**3. Money flow inverts.** First-party retail collects revenue and recognises
margin. A commission marketplace collects on behalf of others and owes a
settlement — the platform's revenue is a fraction of a payment it holds in
trust. Razorpay remains viable (`ADR-0005` still stands) but split settlement is
a materially different integration from the single-payee flow that exists.

### Why the drift went unnoticed

The Draft's original reasoning survives and now explains *how* rather than
*whether*. **KC-072** — the FR-2 taxonomy already rewritten to Nazariya,
Oxidised Silver, Kids' silver — was real client input landing at one point in
the document without propagating. **KC-071** — gold-rate pricing specified five
times and implemented nowhere — is the same signal: the implementation stopped
following the PRD some time ago. Both are now explained by a business model that
moved while the specification did not.

*(End of superseded v0.2.0 interpretation.)*

### Branding: a requirement, already partly met

Flexible branding not tied to one domain (KC-084) is a genuine non-functional
requirement, absent from PRODUCT.md's NFR-1..10, driven by an expectation that
strategy and product-market fit will move over roughly the first year.

It is also already partly built. `apps/web/lib/brand.ts` (KC-085) is an explicit
white-label configuration layer: *"every string, nav item, category, product
type, and piece of copy that appears in the UI is sourced from this object."*
Its coverage claim is storefront-UI-wide but untested at the edges — domain,
email templates, API-side copy and seeded data are not obviously included.

**This corrects the Draft on KC-050.** The festive/Kundan copy is not leftover
drift that nobody noticed. `brand.ts` records the ELYSIAN rename as a
"mechanical rename only" and carries TODOs stating the description and brand
story are pending a positioning decision, "flagged pending, not silently
rewritten" (KC-086). It is a recorded open decision, deliberately preserved so
nothing breaks before a narrative is agreed — the same discipline `ADR-0007`
requires for advisories.

### ELYSIAN and Jwel (KC-081)

The dual identity is deliberate, not drift: **Jwel** is the portfolio identity
for the owner's resume; **ELYSIAN** is the client-facing commercial brand. One
codebase serves both. This makes the dual-purpose constraint (KC-046) concrete
— the two audiences are addressed by *name*, at different layers, and
`brand.ts` is the seam between them.

---

### Original Draft interpretation (retained per OV-000)

**The written strategy and the stated strategy are two different businesses.**

`PRODUCT.md` describes a premium gold-and-diamond retailer competing with
Tata-backed incumbents on trust, certification and heritage, monetised through
metal margin and making charges. The owner describes an everyday
imitation-jewellery store. These are not variations on a theme — they differ in
buyer, price point, competitive set, trust mechanics and revenue mechanics.
Almost nothing transfers cleanly except the transactional loop.

The most telling evidence is **KC-072**. When real client input arrived, it
landed in FR-2 and rewrote the taxonomy into unmistakably everyday-imitation
categories — Nazariya, Oxidised Silver, Kids' silver. The repositioning has
therefore *already begun*, at exactly the point where reality touched the
document, and stopped there. Personas, revenue model, competitor analysis and
pricing strategy were never revisited. This reads as a document overtaken by
its own project rather than a considered strategic choice.

**The absent gold-rate engine is the same story told twice.** The PRD treats
gold-rate-linked pricing as load-bearing, and `EVD-008` finds no trace of it in
the source. Under the premium reading that is a serious unbuilt dependency.
Under the imitation reading it is *correctly absent* — imitation jewellery has
no spot-metal price to track. The implementation has been quietly following the
owner's strategy, not the PRD's, for some time.

The storefront sits between the two. Its price points (₹2,499–2,500) and
92.5 silver detail are consistent with everyday/imitation, but its copy —
heirloom, festive, temple jhumkas, "Timeless craft" — is inherited premium
positioning. **KC-050**'s tension resolves as: the copy is a leftover, not a
deliberate aspiration.

Per `ADR-0007`, this conflict has a defined resolution. `PRODUCT.md` is
advisory; the owner's stated intent binds. The PRD is not *wrong* — it was
sound work against its own assumptions, and its competitor analysis, NFRs and
functional decomposition retain real value. It is simply no longer describing
this business.

*(End of retained Draft interpretation. Confirmed correct in direction by
KC-078, but its scope was too narrow — see the revision above.)*

**Dual purpose is a genuine constraint, not a caveat.** Commercial-and-portfolio
(KC-046) means the codebase is read by two audiences with different standards:
a client who needs it to sell jewellery, and a reviewer assessing engineering
judgement. `DISC-001` found practices that only make sense under the second
reading — self-documenting `.gitignore`, a `ci.yml` that records and corrects
its own wrong hypothesis, 90% coverage gates on a prelaunch store. That is
worth preserving explicitly rather than treating as over-engineering.

## Hidden Assumptions

- **"Imitation" is treated as excluding precious metal**, so the gold-rate
  engine is read as correctly absent. The published product is 92.5 sterling
  silver with rhodium plating and a BIS Hallmark — real, hallmarked metal, not
  costume jewellery. The category boundary is fuzzier than this investigation
  assumes.
- ~~**The PRD is assumed stale rather than a live target.**~~ **Resolved** —
  KC-078 confirms abandonment outright.
- ~~**Storefront copy is assumed leftover, not deliberate.**~~ **Resolved, and
  the assumption was wrong** — KC-086 shows it is a deliberately flagged
  pending decision recorded in `brand.ts`, not unnoticed drift.
- ~~**Marketplace scale is assumed unstated.**~~ **Dissolved** by KC-088 —
  seller count is invisible to the system, so it constrains nothing
  architecturally.
- ~~**Fulfilment ownership is assumed unresolved.**~~ **Dissolved** — the
  aggregated client owns fulfilment (KC-088, KC-091).
- ~~**Commission mechanics are assumed unspecified.**~~ **Dissolved** for the
  system — settled outside it (KC-090). Still a real business question, but not
  one the software answers.
- **The aggregation is assumed to hold operationally.** KC-088 is a clean
  abstraction; whether the client can actually keep the storefront's promises
  (KC-012, KC-013) while depending on third parties it does not control is a
  business risk the software cannot see. The system correctly models one
  merchant; reality has several. This investigation records the abstraction, not
  a judgement about its durability.
- **KC-091 is inference, not owner statement.** The single-counterparty
  consequence follows from KC-088, but the owner framed the boundary, not this
  implication.
- **Price points from two products** are treated as indicative of catalog
  positioning. 1,045 of 1,047 products are ₹0 placeholders (KC-030), so the
  observed price range rests on a very small sample.
- **Revenue is assumed to follow positioning.** No pricing, margin or unit-
  economics evidence exists for the imitation model. Nobody has stated what
  replaces making-charge tiering.

## Strengths

- **The buyer is now stated plainly** (KC-045) — the single most important
  input to M2, and it was missing entirely at intake.
- **Client input is already flowing into the taxonomy** (KC-072), so there is a
  real feedback channel from the actual business into the specs.
- **The PRD's durable assets survive repositioning.** Its ten NFRs, functional
  decomposition (FR-1 to FR-23) and the `FR-NN` identifiers wired through the
  code and UI remain valid regardless of which buyer is served.
- **The transactional loop is buyer-agnostic.** Auth, catalog, cart, checkout,
  orders, returns, reviews work identically for either strategy — the built
  system is not stranded by the divergence.
- **Explicit, principled flexibility** (KC-048) — commitments firm by default,
  revisable by explicit navigation. This is close to a constitutional amendment
  rule already.
- **`ADR-0007` resolves this conflict without ceremony.** The authority
  question was settled before it was needed.

## Weaknesses

- **The PRD's strategic layer is obsolete and still reads as authoritative.**
  Personas, competitor analysis, revenue model and pricing strategy describe a
  business the project is not building. `ADR-0007` makes it advisory, but a
  reader encountering §1–3 and §9 has no in-document signal that they are
  stale.
- ~~**The system cannot express the business it is now for.**~~ **Withdrawn**
  (KC-089). It expresses exactly the business it is scoped to serve.
- ~~**A commission model exists as an intention with no mechanics.**~~
  **Withdrawn** as a system weakness (KC-090) — out of scope by design.
- ~~**Trust obligations now cross an organisational boundary.**~~ **Withdrawn**
  (KC-091) — one merchant of record, one counterparty.
- **The client-side boundary is undocumented anywhere but here.** KC-088 is the
  constraint that makes the entire architecture correct, and it exists only as
  an owner statement captured in this investigation. Nothing in the codebase,
  `PRODUCT.md`, or the ADRs records that multi-vendor concerns are deliberately
  out of scope. A future contributor seeing a jewellery marketplace with no
  seller entity would reasonably read it as an omission — as this investigation
  did at v0.2.0. This belongs in the Constitution or an ADR.
- **The storefront's promises still need a keeper** (KC-012, KC-013). The
  enforcement problem dissolves, but the underlying commitments do not: free
  shipping, dispatch within 24 hours and the certification badge remain
  unconditional claims with no visible backing rule.
- ~~**Storefront copy sells the wrong product.**~~ Revised: the mismatch is
  real but was already recorded as a pending decision in `brand.ts` (KC-086).
  It is an open decision, not an oversight.
- ~~**Two brand identities in play.**~~ **Resolved** — deliberate and now
  documented (KC-081): Jwel is the portfolio identity, ELYSIAN the commercial
  brand.
- **White-label coverage is claimed but unverified** (KC-085). `brand.ts`
  asserts every UI string flows through it; domain, email templates, API-side
  copy and seed data are not obviously in scope, and no test enforces the
  claim. KC-084 makes this a real requirement rather than a nicety.
- **Competitive positioning is unexamined for the real market.** Tanishq/
  BlueStone/CaratLane are the wrong comparison set for everyday imitation
  jewellery, where the competitors are marketplace sellers and D2C fashion
  brands with entirely different trust and price mechanics.
- **NFR-3 and NFR-8 are contradicted by the built system** (KC-074, KC-075):
  ECS and Redis versus docker-compose on one VM with no Redis; PostHog absent
  while Sentry — never named in the PRD — is what is actually wired in. NFRs
  declared non-optional are partly unmet and partly superseded without record.

## Questions

Questions 1–5 from the Draft are resolved by EVD-009 and struck through.
The Discussion pass replaced them with harder ones.

1. ~~Is the premium strategy abandoned or merely unbuilt?~~ → **RESOLVED**:
   abandoned (KC-078).
2. ~~What replaces the revenue model?~~ → **RESOLVED in kind**: intermediation
   commission (KC-080). Mechanics remain open — now Question 9.
3. ~~ELYSIAN or Jwel?~~ → **RESOLVED**: both, deliberately (KC-081).
4. ~~Is the festive copy leftover?~~ → **RESOLVED**: a flagged pending
   decision, not drift (KC-086).
5. ~~Does "imitation" exclude hallmarked silver?~~ → **RESOLVED**: product mix
   follows contracted supply and may include certified premium (KC-083).
6. Should NFR-3/NFR-8 be restated to match the built system, or should the
   system change? → `technical-architecture`.
7. Who are the real competitors for a jewellery marketplace? →
   `recommendations`. The comparison set is now marketplaces, not retailers.

**Raised at v0.2.0, dissolved by the system boundary (KC-087–092):**

8. ~~How many jewellers, self-serve or concierge?~~ → **DISSOLVED** — invisible
   to the system.
9. ~~Commission mechanics?~~ → **DISSOLVED** for the software — settled outside
   it (KC-090). Remains a live business question for the owner.
10. ~~Who fulfils, and who owns the delivery promise?~~ → **DISSOLVED** — the
    aggregated client does (KC-088).
11. ~~Who is accountable for a seller's certification claim?~~ → **DISSOLVED**
    as a platform question — the client asserts, the system displays (KC-091).
12. ~~Does the existing catalog belong to a seller?~~ → **DISSOLVED** — it
    belongs to the client, like all inventory.
13. ~~What is the migration path to multi-tenant?~~ → **DISSOLVED** — no
    migration is needed or wanted.

**Still open:**

14. **Where should the "no multi-vendor concerns in the system" boundary be
    recorded** so it is not rediscovered as an omission? → recommend an ADR;
    **owner decision** on instrument.
15. Should NFR-3/NFR-8 be restated to match the built system? →
    `technical-architecture` (unchanged from Question 6).
16. What backs the unconditional storefront promises — free shipping, 24-hour
    dispatch, certification (KC-012, KC-013)? → `hidden-business-rules`.
17. Who are the real competitors, now that the customer-facing proposition is a
    single-brand everyday-jewellery store? → `recommendations`.

## Recommendations

- **Keep** — the buyer definition (KC-045) as the anchor for every downstream
  spec.
- **Keep** — the PRD's NFRs and FR decomposition; they survive repositioning
  and are already wired into code and UI.
- **Keep** — the explicit-navigation stance on commitments (KC-048/KC-054) and
  carry it into the Constitution's amendment rule.
- **Keep** — the engineering practices that only make sense under the portfolio
  reading; make their preservation deliberate rather than incidental.
- **Improve** — mark `PRODUCT.md` §1–3 and §9 as superseded strategy at the
  top of the file, pointing to this investigation. Per `ADR-0007` the body must
  **not** be rewritten to match; a status note is the correct instrument.
- **Keep** — `brand.ts` as the white-label seam (KC-085); KC-084 promotes it
  from convenience to requirement. Verify its coverage claim and extend it to
  domain, email and API-side copy.
- **Keep** — the practice `brand.ts` demonstrates: flag a pending decision in
  place rather than silently rewriting (KC-086). Same instinct as `ADR-0007`
  and the `.gitignore`/`ci.yml` rationale from `DISC-001`. Worth naming in the
  Constitution.
- **Improve** — specify commission mechanics before M2. It is the revenue
  model; "commission" alone is a category, not a specification.
- **Improve** — mark `PRODUCT.md` §1–3 and §9 as superseded strategy at the top
  of the file, pointing here. Per `ADR-0007` the body must **not** be rewritten.
- **Improve** — resolve the pending `brand.ts` copy decision now that the buyer
  and product mix are settled.
- **Remove** — the premium *first-party* strategy from any binding role: the
  metal-margin revenue model (KC-070), gold-rate-linked pricing (KC-071) and
  the Tanishq/BlueStone/CaratLane comparison set. All are superseded by
  KC-078–080. They stay in `PRODUCT.md` as advisory history per `ADR-0007`;
  what is removed is their authority, not the text.

- **Improve** — record the client-aggregation boundary (KC-088) as an ADR. It
  is what makes the single-tenant model correct rather than naive, and it
  currently exists only inside this investigation.

### Handed to M3 Architecture

The v0.2.0 draft of this section claimed a seller-shaped hole was the central
architectural problem. **That is withdrawn.** M3 should be run on the system as
built: single merchant of record, client-owned inventory, single-payee payments.

What M3 does inherit is the *boundary itself* — `PRM-ARCHITECTURE` should state
explicitly, in the bounded-context map, that supplier relationships,
inter-party settlement and multi-vendor fulfilment lie outside every context.
An architecture that does not say what it excludes invites the exclusion being
"fixed" later by someone who does not know it was deliberate.

## Confidence Level

**High (94%)** after the Architecture Review pass.

Every load-bearing claim is now fact-tier and owner-stated: the business model
(KC-078–080), the brand split (KC-081), the product-mix rule (KC-083), the
branding NFR (KC-084) and — decisively — the system boundary (KC-087–089). The
questions that capped v0.2.0 at 92% did not get answered so much as **dissolved**:
they were consequences of an over-read that the boundary clarification removed.

The residual 6% is two things. KC-091 (single counterparty for trust
obligations) is inference from KC-088 rather than an owner statement. And the
durability of the client-aggregation abstraction is unassessable from here — the
system correctly models one merchant while reality has several, and whether that
holds operationally is a business risk no code reading can evaluate.

**Freezable.** Note this investigation was wrong twice before settling: it
under-read the divergence at v0.1.0 and over-read the consequences at v0.2.0.
Both corrections came from the owner, both are retained in place rather than
edited away, and the resulting reading rests on direct statement rather than
inference. Per `OV-001`, confidence reflects the evidence behind the current
conclusion — not the number of revisions it took to reach it.

## Architecture Review

- **Does it hold up?** Yes. Every load-bearing claim is fact-tier — owner
  statements or direct schema observation.
- **Does it contradict another investigation?** It does not contradict
  `DISC-001` (Frozen), which is structural and business-model-agnostic. But it
  **invalidates a working assumption** several later investigations would
  otherwise have inherited: `data-model`, `domain-discovery`,
  `technical-architecture` and `hidden-business-rules` must each be run against
  a marketplace, not a retailer. That is recorded here so none of them starts
  from the wrong premise.
- **Does it contradict prior decisions?** Three pre-Oriveda ADRs were written
  under first-party assumptions and need re-examination — `ADR-0001`
  (Shiprocket: who ships?), `ADR-0005` (Razorpay sole provider: split
  settlement?), and `ADR-0004` (fraud risk scoring: seller-side risk is a
  different problem from buyer-side). Flagged, not re-decided — that is
  `PRM-ARCHITECTURE`'s work.
- **Scope discipline.** This investigation states the business model and its
  consequences. It does not design the seller domain, choose a settlement
  mechanism, or rank the migration path.

**Second review, 2026-08-06 (EVD-010).** The v0.2.0 finding — that the domain
model was missing a seller — is withdrawn. The contradiction flagged against
`ADR-0001`, `ADR-0004` and `ADR-0005` is withdrawn with it (KC-092); all three
stand as decided.

The hand-off to later investigations is correspondingly reversed: `data-model`,
`domain-discovery`, `technical-architecture` and `hidden-business-rules` should
be run **against the system as built** — single merchant, client-owned
inventory, single-payee payments — with KC-088 recorded as the boundary that
makes this correct rather than incomplete.

**Frozen 2026-08-06** by owner sign-off. KC-088's system boundary is now
settled input for M2 Constitution and M3 Architecture. Revision after this
point requires the full Discussion → Review cycle, not a silent edit (KC-054).

### Cross-cutting extraction check

`OV-001` requires `business-vision` to check explicitly for non-functional
requirements.

- **Non-functional requirements — found.** NFR-1 to NFR-10 in `PRODUCT.md` §6
  (KC-073), with NFRs 1–8 declared non-optional for MVP. **Plus one not in that
  list**: flexible, non-domain-bound branding sustained over roughly a year of
  strategy change (KC-084), stated by the owner during Discussion and partly
  implemented in `brand.ts`. It belongs with the NFRs and is recorded here
  because `PRODUCT.md` never captured it. Two are contradicted
  by the built system (KC-074, KC-075) and handed to `technical-architecture`
  as Question 6. The rest are unverified — no evidence exists that P95 load
  time, 99.9% availability, WCAG 2.1 AA or search latency have ever been
  measured. That absence is itself a finding for `technical-debt`.
- **Domain/integration events** — owned by `domain-discovery`, not this
  investigation.
