---
id: FEAT-ACCESSIBILITY-AXE
title: 'Jwel / ELYSIAN — Feature: Automated Accessibility Checks'
version: 0.1.0
status: Review
owner: Architecture
reviewers:
  - Vedant
created: 2026-08-08
updated: 2026-08-08
milestone: M6
category: Features
priority: High
depends_on:
  - STD-ACCESSIBILITY
  - STD-TESTING
required_by: []
related_documents:
  - DISC-007
  - STD-CICD
  - FEAT-PAYMENT-E2E
related_domains: []
related_decisions: []
tags:
  - feature
  - accessibility
  - testing
risk: Medium
complexity: Low
---

# FEAT-ACCESSIBILITY-AXE

## 1. Overview

NFR-5 commits to **WCAG 2.1 AA**, storefront and admin, and it was declared
non-optional for MVP. `DISC-007` found **no automated verification of any kind**
(KC-171). `STD-ACCESSIBILITY` said so about itself, in its own Enforcement
section: *"Rule 2: CI, once `axe` lands. Currently nothing is enforced."*

That is the same shape as the storefront claims table — a document asserting a
capability that did not exist — and the standard names this the least-verified
commitment in the project and **the only one carrying legal exposure**.

## 2. Owning Domain

**None — this is verification infrastructure**, like the claims gate and
`architecture.spec.ts`. It owns no business concept.

## 3. Acceptance Criteria

1. `axe` runs in CI over key journeys, in the existing Playwright suite
   (`STD-ACCESSIBILITY` rule 2).
2. Checks are scoped to **WCAG 2.1 AA** tags — the standard's stated target,
   not axe's full ruleset.
3. A violation **fails the build**, with output naming the rule, the element
   and the fix.
4. Coverage includes the **checkout form**, which rule 7 calls the
   highest-consequence one.
5. The suite stays inside the auth rate limit.
6. Nothing claims this establishes AA compliance.

### On criterion 6

Automated checks catch roughly a third of WCAG issues. The standard is explicit
that claiming otherwise would violate Law 1, so both the spec's own
documentation and `STD-ACCESSIBILITY`'s updated Enforcement section say plainly
what this does: it stops the third that regresses **silently** — a contrast
ratio nudged by a palette tweak, an alt attribute lost in a refactor. Rules 3-7
remain human review.

## 4. Coverage

Thirteen scans. Nine unauthenticated pages — home, collection listing, product
detail, search results, empty cart, login, register, FAQ, shipping — plus the
populated cart, and three signed-in surfaces: profile, the orders tab, and the
checkout form.

Empty and populated cart are scanned separately because they are different
documents; the populated one carries quantity steppers, remove controls and a
live total. The orders tab is scanned separately because a tab panel's content
does not exist in the DOM until the tab is selected.

**Not covered: the admin UI.** It needs an `ADMIN` account, which the e2e job
does not create — `prisma:seed` writes one product and no users. That is a
gap worth closing, and rule 6 (colour is never the sole carrier of meaning)
points at the admin status badges specifically. Recorded rather than implied.

## 5. What it found on its first run

**A real defect**, immediately: the FAQ page wrapped `<details>` elements
directly inside a `<dl>`. A definition list may contain only `dt`, `dd` or
`div`, so this is invalid markup that a screen reader announces as a definition
list with no items — worse than no semantics at all. Rated *serious* by axe.

Fixed here as a plain `<ul>`. It had been shipping since the FAQ was written,
through every human review the page had.

## 6. Edge Cases & Validations

1. **A stalled `/_next/image` request.** Navigations use `domcontentloaded`,
   so the known optimizer hang cannot fail a test about markup.
2. **Axe and implicit browser contexts.** `AxeBuilder` rejects a page from
   `browser.newPage()` with *"Please use browser.newContext()"*. The signed-in
   describe creates a context explicitly.
3. **Auth budget.** One registration for the whole file, shared by a serial
   describe.
4. **Unreadable failures.** Axe's raw result object is illegible in a CI log,
   so violations are formatted to rule, impact, help URL and the offending
   selectors before being asserted.

## 7. Definition of Done

Verified against an isolated stack — scratch database, API on :4001, production
web build on :3100, as CI runs it.

| Run | Result |
| --- | --- |
| `accessibility.spec.ts`, first run | **1 failure** — the FAQ's invalid `<dl>` |
| After the fix | 13 passed |
| Whole e2e suite | **30 passed** |

- [x] `@axe-core/playwright` added; `pnpm test:a11y` runs the scans alone.
- [x] WCAG 2.1 AA tags only.
- [x] Thirteen surfaces including the checkout form.
- [x] Readable violation output.
- [x] The defect it found is fixed, not suppressed.
- [x] `STD-ACCESSIBILITY` Enforcement updated — rule 2 is now CI, not "nothing
      is enforced".

## 8. What is still not verified

- **Rules 3-7 are human review.** Keyboard operability, contrast on the luxury
  palette, colour-as-sole-meaning, alt text quality, and error-to-field
  association are only partly reachable by any automated tool, and axe does not
  judge whether alt text is *meaningful*.
- **The admin UI is unscanned** (§4).
- **No screen-reader testing has been done** at all, by anyone, on any surface.

Recorded because a green accessibility job is exactly the kind of result that
gets mistaken for compliance.
