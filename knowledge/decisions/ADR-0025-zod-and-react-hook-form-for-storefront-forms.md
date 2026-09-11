---
id: ADR-0025
title: zod and react-hook-form for Storefront Forms
version: 0.1.0
status: Accepted
owner: Architecture
reviewers:
  - Vedant
created: 2026-09-11
updated: 2026-09-11
milestone: M6
category: Decisions
priority: Medium
depends_on:
  - ADR-0013
required_by: []
related_documents:
  - STD-CODE
  - STD-TESTING
related_decisions:
  - ADR-0013
tags:
  - decision
  - frontend
  - forms
  - dependency
risk: Medium
complexity: Medium
---

# ADR-0025 — zod and react-hook-form for Storefront Forms

## Context

Every storefront form validates by hand. Checkout, the saved-address form on
the profile page, the product review form and the product question form each
keep their own `useState` per field and check them in their submit handler.
The consequences are uneven rather than severe:

- **Checkout's address fields rely on the browser's `required` attribute and
  nothing else.** There is no pincode format check, no inline message, and the
  field is labelled "Zip Code" in a store that ships only within India, while
  the header and product page call the same thing "Pincode".
- **The review form disables its submit button with no explanation.** A
  customer who has written a review but not picked a star rating sees an inert
  button and no reason.
- **The saved-address form and checkout validate the same address differently**,
  because each owns its own copy of the rules.

The more serious gap was server-side, and it is **not** what this decision
addresses. The order and saved-address DTOs accepted empty fields and any
pincode string; eleven historical orders have no state. That was fixed in the
API DTOs (commit `ba109bc`), where Law 4 puts it. Nothing in this ADR is load-
bearing for data integrity: the server refuses bad addresses whatever the
client does.

## Decision

Adopt **zod 4** for validation schemas and **react-hook-form 7** (with
`@hookform/resolvers` 5) for form state, in the four storefront forms above.

- Schemas live in `apps/web/lib/validation/`, one module per concern, and are
  the single client-side statement of each rule. The pincode rule there
  mirrors `apps/api/src/common/validation/address.ts`.
- `PincodeCheck` imports its pattern from the same module rather than keeping a
  fourth copy.
- Field errors render inline, next to the field, associated via
  `aria-describedby` and `aria-invalid` (STD-ACCESSIBILITY).
- Admin forms are **out of scope**. They are used by one operator, already
  surface server errors, and are not on a customer path.

**Recorded honestly: this was the owner's call against a recommendation.** On
reading the forms, the recommendation was to fix the server and add a shared
plain-TypeScript validator with no new dependency, because two of the four
forms have a single trivial rule each and the real defect was server-side. The
owner chose zod and react-hook-form for consistency across forms and as a base
for future ones. Both positions are reasonable; the trade-offs are below so the
choice can be revisited on its merits.

## Consequences

**Positive**

- One declarative schema per form, readable in one place, instead of rules
  spread through submit handlers.
- Consistent inline error presentation and accessibility wiring across every
  storefront form, including future ones.
- The address schema is shared by checkout and the profile page, so the two
  cannot drift.

**Negative**

- **A new runtime dependency on the checkout path.** zod and react-hook-form
  together add roughly 20 kB gzipped to the checkout route. To be measured when
  the change lands rather than asserted here (STD-PERFORMANCE r5).
- **Checkout is restructured on the payment path.** Its address state is
  interleaved with saved-address selection; moving it into react-hook-form
  touches the 414-line page that places orders. The e2e checkout spec is the
  guard, and it must pass unchanged in behaviour.
- **Two validation languages.** The API validates with class-validator, the web
  with zod. The rules are mirrored, not shared; a test on each side pins the
  pincode rule to the same accept/reject examples.

## Alternatives Considered

- **Plain TypeScript validators, no dependency** — the recommendation. Covers
  every current rule in a few dozen lines. Rejected by the owner in favour of a
  consistent library for current and future forms.
- **zod without react-hook-form** — keeps checkout's existing state handling
  and still centralises schemas. Rejected: it adds a dependency while leaving
  per-field state and error wiring hand-rolled in each form.
- **Share schemas between API and web** (for example zod on both sides) —
  would remove the mirroring. Rejected for now: it means replacing
  class-validator across 26 API modules, far outside this change's scope.

## Revisit Criteria

- **If the checkout bundle grows past what is acceptable once a performance
  budget exists** (KC-172), measure what these libraries contribute and
  consider the plain-validator alternative for the checkout route.
- **If the mirrored pincode tests ever diverge**, that is the signal to share
  the rule rather than mirror it.

## Cross References

- `ba109bc` — the server-side address fix this ADR deliberately does not replace.
- `ADR-0013` — Next.js App Router as the frontend.
- `STD-ACCESSIBILITY` — labelled forms and error association.
- `STD-TESTING` — co-located specs; the e2e checkout path is the guard here.
