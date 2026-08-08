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

Twenty-three scans. Nine unauthenticated pages — home, collection listing, product
detail, search results, empty cart, login, register, FAQ, shipping — plus the
populated cart, and three signed-in surfaces: profile, the orders tab, and the
checkout form.

Empty and populated cart are scanned separately because they are different
documents; the populated one carries quantity steppers, remove controls and a
live total. The orders tab is scanned separately because a tab panel's content
does not exist in the DOM until the tab is selected.

**The admin UI is covered too**, added immediately after the first version of
this feature — see §5.1. All ten admin routes, not a sample, because the first
defect found there existed on pages that happened not to be in the first list.

CI creates a throwaway admin with `admin:create`. Its credentials are fixed,
public and worthless: the database they exist in is built and destroyed by the
job. **Real admin credentials were offered and declined** — a fresh CI database
contains no real account, so they would buy nothing while putting a live secret
into workflow config and CI logs.

## 5. What it found

**Six real defects**, every one of them shipping, every one through human
review. None were suppressed.

| Where | Rule | Detail |
| --- | --- | --- |
| FAQ | `definition-list` *(serious)* | `<details>` wrapped directly in a `<dl>`. Invalid — a definition list may contain only `dt`, `dd` or `div` — and announces as a definition list with no items, which is worse than no semantics at all |
| Admin nav, active item | `color-contrast` *(serious)* | Gold on a gold tint: **2.36:1** against 4.5:1 |
| Admin status badges | `color-contrast` *(serious)* | `success` at 4.29:1 and `warning` at 3.62:1 on their own tints |
| Accent badge | `color-contrast` *(serious)* | **2.52:1** |
| Dashboard, returns queue | `select-name` *(critical)* | Filter `<select>`s with no accessible name — announced by their current value with no indication of what they control |
| Coupon create form | `label` *(critical)* | Fields labelled only by placeholder; the two date inputs not even that |

### 5.1 The palette findings are the ones NFR-5 predicted

`STD-ACCESSIBILITY` rule 5 names the risk exactly: *"NFR-5 flags the 'luxury
dark/gold palette' as the risk. Brand palettes optimised for mood are where
contrast failures concentrate."* Four of the six are that prediction coming
true.

They were fixed by **changing as little of the palette as possible**:

- `feedback.success` and `feedback.warning` darkened to the smallest value
  clearing 4.5:1 with margin (4.71:1 and 4.65:1). `error` already passed and is
  untouched.
- A new `brand.accentDeep` for gold **as text on light grounds** (4.64:1). The
  bright gold stays for borders and rules, where the requirement does not apply
  the same way.
- The admin nav's active item keeps its gold identity in the tint and a new
  left rule, and takes `ink-primary` for the label (16.3:1). Rule 6 in passing:
  the rule and the weight now carry the state too, not colour alone.

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
| First run, storefront only | **1 failure** — the FAQ's invalid `<dl>` |
| First run including the admin UI | **5 further failures** across four pages |
| After the fixes | **23 scans passed** |
| Whole e2e suite | **40 passed** |

- [x] `@axe-core/playwright` added; `pnpm test:a11y` runs the scans alone.
- [x] WCAG 2.1 AA tags only.
- [x] Twenty-three surfaces: nine public pages, the populated cart, three
      signed-in surfaces including the checkout form, and all ten admin routes.
- [x] CI creates a throwaway admin so the admin UI is reachable at all.
- [x] Readable violation output.
- [x] The defect it found is fixed, not suppressed.
- [x] `STD-ACCESSIBILITY` Enforcement updated — rule 2 is now CI, not "nothing
      is enforced".

## 8. What is still not verified

- **Rules 3-7 are human review.** Keyboard operability, contrast on the luxury
  palette, colour-as-sole-meaning, alt text quality, and error-to-field
  association are only partly reachable by any automated tool, and axe does not
  judge whether alt text is *meaningful*.
- **No screen-reader testing has been done** at all, by anyone, on any surface.

Recorded because a green accessibility job is exactly the kind of result that
gets mistaken for compliance.
