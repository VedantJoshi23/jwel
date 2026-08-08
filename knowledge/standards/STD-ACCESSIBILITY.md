---
id: STD-ACCESSIBILITY
title: Jwel / ELYSIAN — Standard: Accessibility
version: 1.2.0
status: Frozen
owner: Architecture
reviewers:
  - Vedant
created: 2026-08-07
updated: 2026-08-07
milestone: M4
category: Standards
priority: High
depends_on:
  - CONSTITUTION
  - STD-000
required_by: []
related_decisions:
  - ADR-0013
tags:
  - standards
  - accessibility
risk: High
complexity: Medium
---

# STD-ACCESSIBILITY

## Scope

The storefront and admin UI in `apps/web`.

**Not covered:** API surfaces, which have no accessibility surface of their own.

**Current state, stated plainly:** NFR-5 commits to WCAG 2.1 AA. Until
2026-08-08 **no automated verification of any kind existed** (KC-171) — the
least-verified commitment in the project and the only one carrying legal
exposure.

`axe` now runs in CI over twenty-three surfaces — every public page, the
checkout form, and all ten admin routes (`FEAT-ACCESSIBILITY-AXE`). It found
**six real defects**, all shipping, all through human review: an invalid `<dl>`
on the FAQ, two unnamed filter `<select>`s, a coupon form labelled only by
placeholders, and three contrast failures. All fixed.

**Rule 5 predicted the contrast ones exactly.** Gold on gold measured 2.36:1
and 2.52:1, and the success and warning badges 4.29:1 and 3.62:1 — brand
colours optimised for mood, failing as text, which is what this rule says to
expect. The palette moved as little as possible: two feedback colours darkened
to the smallest value clearing 4.5:1, and a new `brand.accentDeep` for gold as
text on light grounds while the bright gold keeps borders and rules.

**This does not mean AA is met.** Automated checks cover roughly a third of
WCAG, and rules 3-7 remain human review. What changed is that the third which
regresses silently — a contrast ratio nudged by a palette tweak, an alt
attribute lost in a refactor — now fails the build instead of shipping.

## Rules

1. **The target is WCAG 2.1 AA**, storefront and admin.
   *Rationale:* NFR-5, declared non-optional for MVP.

2. **Automated accessibility checks run in CI** over key journeys, via `axe`
   in the existing Playwright suite.
   *Rationale:* KC-176. Automated checks catch perhaps a third of WCAG issues —
   but the third they catch are the ones that regress silently.

3. **Interactive elements are reachable and operable by keyboard**, with a
   visible focus state.
   *Rationale:* the most common AA failure, and the cheapest to avoid while a
   component is being written.

4. **Images carry meaningful alternative text**; decorative images are
   explicitly marked as decorative.
   *Rationale:* NFR-5 names alt text specifically. For a jewellery store,
   product imagery *is* the content, so empty alt on a product image is a
   content failure, not just a compliance one.

5. **Colour contrast meets AA** — 4.5:1 for body text, 3:1 for large text and
   UI boundaries.
   *Rationale:* NFR-5 flags the "luxury dark/gold palette" as the risk. Brand
   palettes optimised for mood are where contrast failures concentrate.

6. **Colour is never the sole carrier of meaning** — order and return statuses
   need a label or icon, not just a colour.
   *Rationale:* status badges are the admin UI's main colour-coded surface.

7. **Forms label their inputs**, and errors are associated with the field they
   describe.
   *Rationale:* checkout and login are the highest-consequence forms; an
   unlabelled field is unusable with a screen reader.

## Examples

**Compliant** — status carries a text label, not colour alone:

```tsx
<Badge tone="success">DELIVERED</Badge>
```

**Non-compliant** — meaning exists only in the colour:

```tsx
<span className="h-2 w-2 rounded-full bg-green-500" />
```

## Exceptions

A deviation is permitted where a third-party embed cannot be made compliant —
the Razorpay checkout modal is the realistic case. It must be documented at the
integration point, and the surrounding flow must remain navigable.

## Enforcement

- Rule 2: **CI** — `e2e/accessibility.spec.ts`, in the Playwright job, over
  every key journey including the checkout form.
- Rules 3–7: **human review**, still. Automated coverage does not reach them.
- Automated checks do not certify compliance. They catch regressions; they do
  not establish that AA is met. Claiming otherwise would violate Law 1.
