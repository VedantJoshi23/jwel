---
id: ADR-0019
title: Glass materials, motion, and pill controls promoted from Aurora-only to the storefront and admin baseline
version: 0.2.0
status: Accepted
owner: Architecture
reviewers:
  - Vedant
created: 2026-08-10
updated: 2026-08-11
milestone: M12
category: Decisions
priority: Medium
depends_on:
  - CONSTITUTION
  - ADR-0018
required_by:
  - ADR-0020
related_documents:
  - DESIGN
  - STD-ACCESSIBILITY
related_decisions:
  - ADR-0018
  - ADR-0020
tags:
  - frontend
  - design
risk: Medium
complexity: Low
---

# ADR-0019 — Glass and motion become baseline design language

> **Extended by `ADR-0020` (2026-08-11).** Per Law 2, annotated rather than
> rewritten. This ADR's own premise — proved here — is what made Aurora
> removable without losing anything: once glass materials, motion and pill
> controls were promoted to the *baseline* both themes shared, Aurora's dark
> palette was the only thing left that was actually Aurora-specific.
> `ADR-0020` removed that palette and the toggle; everything this ADR added
> (the `--glass-*` system, `Reveal`/`RevealSection`, `rounded-full` controls)
> stayed exactly as built. The "Review Gate" section below, and any mention of
> "both themes," describes the moment this ADR shipped, not the current state.

## Context

`ADR-0018` built glass materials, spring motion, and rounded controls as an
Aurora-only experiment, deliberately kept off the classic palette so the
shipped design was "provably unchanged." Having lived with that for a day, the
owner's assessment was that the classic storefront itself doesn't read as
premium: flat panels, no motion, and 6px "boxy" buttons undersell a brand whose
whole pitch is that affordable imitation jewellery doesn't have to *look* or
*feel* affordable. That is a judgment about the shipped default, not about
Aurora — the request was explicit that the classic ivory/crimson palette stays,
the *treatment* of it changes.

## Decision

**Glass materials and scroll motion are no longer gated to Aurora.** The
`.material-*` classes and `components/motion/reveal.tsx` from `ADR-0018` now
apply under both themes:

1. Each theme defines its own `--glass-*` custom properties (background alpha,
   border, shadow, the bright top edge) in `app/globals.css`; the `.material-*`
   rules read only those variables, never the theme name. One set of glass
   rules serves both palettes — classic gets a warm frosted-ivory glass with a
   soft shadow, Aurora keeps its dark-ground glass unchanged.
2. `Reveal`/`RevealSection` no longer read `useThemeStore` at all — the
   materialise-on-scroll animation runs regardless of theme. `Reveal`'s own
   Aurora-only gate is deleted along with the theme dependency.
3. Interactive controls move from a 6px box to `rounded-full`: `Button`,
   `Badge`, `Input`, the header search bar, `VariantSelector`'s pills (this was
   already `DESIGN.md` §3's spec — "pill-group" — the box radius was
   implementation drift, not a deliberate choice), pagination's numbered links,
   and the collection-page category filter chips. `Card` moves from
   `rounded-none` to `rounded-m`. Product photography frames are the
   deliberate exception — `DESIGN.md` §2.4 already states luxury references
   avoid rounded photo frames, and that reasoning still holds; the roundness
   lives in the controls around the imagery, not the imagery itself.
4. Radius tokens in `tailwind.config.ts` move from `{s: 6px, m: 14px}` to
   `{s: 10px, m: 18px, l: 28px}` — everything still on `rounded-s`/`rounded-m`
   (dropdowns, fieldsets, form panels, accordions) gets rounder without being
   individually touched, and without becoming a pill where a pill would look
   broken (a `<select>`, a `<fieldset>`, a `<details>` accordion).

## Two defects this surfaced, both fixed here

**The sticky header never actually stuck.** `.material-chrome` set
`position: sticky` on the nav-row `<div>`, but that div's containing block was
`<header>`, and `<header>`'s only content was the announcement bar plus the nav
row — roughly 120px total. `position: sticky` can only stick within the bounds
of its containing block; once the user scrolled past `<header>`'s own ~120px,
the "sticky" row had nowhere left to stick to and scrolled away with the page.
This is invisible in a screenshot at scroll position zero, which is very
likely why `ADR-0018` shipped it without catching it. Fixed by moving the
announcement bar to a sibling *before* `<header>` and putting
`material-chrome` on `<header>` itself, whose containing block is `<body>` —
full page height, so the header now stays pinned indefinitely.

**Every glass surface with a Tailwind `bg-*` utility next to its `material-*`
class was rendering opaque.** `.material-chrome`/`.material-panel`/
`.material-panel-deep`/`.material-card` all set `background-color` in
`@layer components`; several usages also carried a Tailwind `bg-*` utility
(`bg-canvas`, `bg-surface`, `bg-footer-bg`, `bg-surface-alt`) on the same
element for the pre-`ADR-0018` flat look. Tailwind's generated stylesheet
orders `@layer utilities` *after* `@layer components`, so the utility silently
won regardless of source order in the component file — the header, both
product-card call sites, the footer, and the admin sidebar were all
computing a fully opaque background despite `.material-chrome`/`.material-card`
correctly matching and setting a translucent one. Caught by inspecting
`getComputedStyle(...).backgroundColor` after the sticky-header fix still
showed `rgb(255, 255, 255)` with no alpha channel where `rgba(255, 255, 255,
0.78)` was expected. Fixed by deleting the redundant `bg-*` utility from all
four call sites — `.material-*` already supplies the background for both
themes. `.material-raised` (buttons, inputs, badges) never set
`background-color` itself, so its `bg-*` pairings were never affected.

## Consequences

1. **`ADR-0018`'s "classic is provably unchanged" consequence is superseded**,
   per Law 2 — recorded here, not silently edited into the original. Classic
   now changes visibly: glass chrome, motion, pill controls, rounded cards.
   What survives from `ADR-0018` unchanged: the token-indirection mechanism
   (`--color-*` custom properties, channel-space RGB for opacity modifiers),
   the two-palette structure, the reduced-motion/-transparency/-contrast
   handling, and the exit condition's *shape* (a design decision needs a
   trigger, not a quiet indefinite life) — only its content changes, per the
   next section.
2. **The Aurora `axe` pass in `e2e/accessibility.spec.ts` no longer doubles as
   "does glass introduce contrast regressions" coverage for classic** — glass
   now ships on classic too, and the *original* classic `axe` runs
   (`STD-ACCESSIBILITY` rule 2) are what catch regressions there. Verified: all
   532 unit/component tests and the full classic + Aurora `axe` suite pass
   after this change (see verification log).
3. **No coverage exclusions, no parallel components** — same discipline as
   `ADR-0018`, unchanged. `Reveal` lost a dependency (theme store) rather than
   gaining one.
4. **This is the second round of "does it feel premium," not the last.** A
   three-agent independent review (below) is the acceptance gate for this
   round; further rounds follow the same pattern if it does not reach
   consensus.

## Revised Exit Condition

`ADR-0018`'s exit condition ("Aurora adopted or deleted by 2026-11-10") is
**superseded, not deleted** (Law 2). Aurora's fate as a *second theme* is still
open and still governed by that date. What changes here: glass, motion, and
pill controls are no longer part of that decision — they are the baseline for
both themes now, and reverting them would be reverting the classic redesign
itself, not "letting an experiment expire." If Aurora is deleted on
`ADR-0018`'s date, this ADR's material/motion/radius work stays; only the dark
palette and the toggle leave.

## Review Gate

Three independent agents reviewed every storefront page and the admin
surfaces reachable without a seeded account, each without seeing the others'
notes, and were asked to reach their own verdict on whether the site now reads
as premium for an accessible-price imitation-jewellery brand. Findings and the
resulting changes are recorded in this ADR's revision history / commit trail
rather than restated here, per Law 2 — check `git log` on this file and the
components it names for what each round changed.

## Cross References

- `ADR-0018` — the Aurora theme and the material/motion mechanism this
  promotes to baseline.
- `DESIGN.md` §2.4 (radius), §3 (`VariantSelector` pill-group spec).
- `STD-ACCESSIBILITY` rule 8 — every selectable theme is scanned; still true,
  unaffected by this change since both palettes already carried their own
  `axe` coverage.
