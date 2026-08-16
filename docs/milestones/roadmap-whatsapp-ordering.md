# Roadmap — WhatsApp Ordering (Wati)

**Status: advisory.** Per `ADR-0007`, `knowledge/` is authoritative and `docs/`
is not. `ADR-0022` is the decision this roadmap sequences; where the two
disagree, the ADR wins and this file is wrong. Written 2026-08-16, immediately
after the client approved the pre-built-platform path and named Wati
(`ADR-0022`). No engineering has started yet — this is the plan, not a log.

---

## What this is

End-to-end ordering over WhatsApp: a customer browses the catalogue, builds a
cart, pays by QR code or payment link, and gets a delivery estimate, without
leaving the conversation — reading and writing the **same** `Cart` and `Order`
records the website already uses, via Wati as the WhatsApp Business Platform
layer (`ADR-0022`).

## What does not need to be rebuilt

Worth restating before the task list, so nothing below gets re-derived from
scratch by accident: `Cart` already belongs to a user account, not a browser
(`DOM-SHOPPING`); checkout (`POST /orders`) is already one endpoint regardless
of caller; `PaymentProviderPort` already exists as a swappable boundary
(`DOM-PAYMENTS` §2); the product catalogue already has a public read API
(`DOM-CATALOG` §4). Every phase below is either new surface area or a new way
of reaching what already exists — not a parallel system.

---

## Phase 0 — Decisions & vendor setup

*Blocked on: client + Wati's own onboarding. No code.*

- [x] ~~Resolve `ADR-0003`'s open annotation~~ — **decided 2026-08-16**
      (`ADR-0023`): Wati carries transactional notifications too, not only
      ordering. One number, one integration.
- [ ] **Confirm Wati's actual per-message rate card** before treating
      recurring cost as fully known. Subscription pricing is now confirmed
      first-party (below); the per-message rate card is not — Wati's own
      pricing page has a rate-calculator section that renders blank even in
      a full print capture. Convergent third-party reporting (not Wati's
      own stated numbers) puts utility/marketing markup around 19–20% over
      Meta's rate, but **authentication-category markup around 257%** —
      worth confirming directly given Phase 2's OTP step touches that
      category. **The ₹999 Pay-as-you-go plan is the practical way to close
      this** — buy it, send a batch of real utility-template messages, and
      read the actual per-message deduction off the dashboard rather than
      trusting any reported figure, this project's own included.
- [x] ~~Confirm Wati plan tier against expected message volume~~ — **first-party
      pricing confirmed 2026-08-16** (`ADR-0022` Consequence 2, quarterly
      billing): Growth ₹2,699/mo (3 users, 1 channel), Pro ₹5,799/mo (5
      users, "Best Value"), Business ₹16,799/mo (5 users). Given no order
      volume yet exists, **start on the ₹999 Pay-as-you-go plan** rather
      than committing to Growth — it also happens to be how the rate-card
      question above gets answered, so it's the right first step twice
      over. Move to Growth once real volume and the rate card both justify
      it.
- [ ] Wati signup + WhatsApp Business Account verification (handled through
      Wati's own onboarding flow, not a separate direct Meta application).
- [ ] Decide the first-contact UX: a message arrives from a phone number with
      no matching jwel account — auto-create an account, or prompt sign-up
      before anything else proceeds? This shapes Phase 1's identity-linking
      design, so it's a decision, not an implementation detail to default.

## Phase 1 — Governance: write the spec before the code

*Blocked on: Phase 0's decisions.*

- [ ] Author the Feature Specification(s) this work needs, per `OV-007`
      (`PRM-FEATURE`) — this project's own rule is that a Feature
      Specification is Frozen individually before implementation begins, and
      nothing below has one yet. Likely shape: one feature covering identity
      linking + catalogue feed (owning domain probably `DOM-IDENTITY` or a new
      thin `DOM-WHATSAPP-CHANNEL`, to be settled when the spec is drafted —
      not decided in this roadmap), and a second covering the ordering
      pipeline itself (owning domain probably `DOM-ORDERING`, per `OV-007`'s
      "exactly one owner" rule — Payments and Catalog would be dependencies,
      not co-owners).
- [ ] Check every cross-domain call the spec proposes against each involved
      domain's already-declared `Allowed` list (`OV-007`'s per-call rule) —
      in particular, does `DOM-ORDERING`'s Allowed list already cover calling
      whatever new Wati-adapter surface Payments ends up owning, or does that
      need a `DOM-PAYMENTS`/`DOM-ORDERING` spec revision first.

## Phase 2 — Foundation: identity & catalogue

*Blocked on: Phase 1's Frozen spec.*

- [ ] Phone verification (OTP) linking a WhatsApp number to a `User` account
      — new or existing, per Phase 0's first-contact decision. Extends
      `DOM-IDENTITY`. **Send the OTP over SMS (MSG91), not WhatsApp** —
      `ADR-0023` Consequence 2's reported ~257% markup on
      authentication-category WhatsApp messages makes SMS the cheaper
      default here, not just the fallback `DOM-NOTIFICATION` Invariant 1
      already treats it as.
- [ ] Catalogue feed to Wati — keeps product name, price, photo, and stock
      visible to the WhatsApp catalogue in sync with `DOM-CATALOG`. One-way:
      jwel is the source of truth, Wati's copy is a projection.
- [ ] Wati integration sits behind its own adapter/port, matching `STD-API`
      rule 7 and `ADR-0022`'s own stated posture — not called ad hoc from
      wherever it's first needed.

## Phase 3 — The ordering pipeline

*Blocked on: Phase 2.*

- [ ] Wati webhook receiver — inbound cart/order events from Wati's
      checkout bot, signature-verified before anything is trusted
      (`STD-SECURITY` rule 5's DTO-validation posture, applied to a new
      inbound surface the same way Razorpay's webhook already is).
- [ ] Order & payment reconciliation — a completed WhatsApp order becomes a
      real `Order` + `Payment` row, indistinguishable from a website order
      afterward. This is the one piece with no shortcut regardless of
      platform choice (`ADR-0022` Consequence 3).
- [ ] `PaymentProviderPort` gains a payment-link/QR method — Razorpay
      Payment Links or its UPI QR API, additive to the existing port, not a
      second payment system (`ADR-0022` Consequence 5).
- [ ] Message templates drafted and **submitted for Meta approval early** —
      order confirmation, payment request, delivery estimate. Approval
      turnaround is a lead-time risk to the launch date, not engineering
      effort (`DOM-NOTIFICATION` §9 already flagged this pattern for the
      separate notifications feature; it applies here too).

## Phase 4 — Admin visibility & operations

*Blocked on: Phase 3.*

- [ ] WhatsApp orders appear in the existing admin order list, clearly
      channel-tagged — not a second dashboard support has to learn.
- [ ] Delivery/shipment status messages over WhatsApp reuse `DOM-SHIPPING`'s
      existing events once wired to Wati's send API.
- [ ] A short runbook addition: how to debug a WhatsApp order that's stuck
      (mirrors the existing `deploy/RUNBOOK.md` pattern for other operational
      procedures).

## Phase 5 — Testing & launch

*Blocked on: Phase 4.*

- [ ] A mock/sandbox Wati provider for automated tests, behind the same port
      as the real adapter — the same shape `MockPaymentProvider` already
      uses (`STD-TESTING` rule 7), not a special case for this one vendor.
- [ ] End-to-end test on Wati's sandbox number: browse → cart → pay →
      confirmation.
- [ ] Go-live checklist addition — new env vars, webhook URL registration
      with Wati — added to `deploy/RUNBOOK.md`/`deploy/GO-LIVE.md` rather
      than tracked only here, so it survives this file going stale.

---

## Open questions this roadmap does not answer

- Wati's actual rate-card markup over Meta's per-message cost — see Phase
  0's second bullet; still unconfirmed against Wati's own materials.
- Whether reconciliation (Phase 3) calls `POST /orders` directly or needs a
  dedicated ingestion path — a call for whoever drafts Phase 1's spec, once
  Wati's actual webhook payload shape is known.
- Cost visibility per channel/per order (`DOM-NOTIFICATION` §9's existing
  open question) now has a second WhatsApp cost source once Wati is live —
  still undesigned.
