---
id: ADR-0020
title: Aurora dark theme removed after live evaluation — one palette going forward
version: 0.1.0
status: Accepted
owner: Architecture
reviewers:
  - Vedant
created: 2026-08-11
updated: 2026-08-11
milestone: M12
category: Decisions
priority: Medium
depends_on:
  - CONSTITUTION
  - ADR-0018
  - ADR-0019
required_by: []
related_documents:
  - STD-ACCESSIBILITY
related_decisions:
  - ADR-0018
  - ADR-0019
tags:
  - frontend
  - design
risk: Low
complexity: Low
---

# ADR-0020 — Aurora removed; one palette going forward

## Context

`ADR-0018` shipped Aurora — a dark, glass-heavy second theme, switchable at
runtime from a homepage toggle — as an explicit experiment, with a named exit
condition: adopt it fully or delete it by 2026-11-10. `ADR-0019` then promoted
the *mechanism* Aurora introduced (glass materials, scroll motion, pill
controls) to the baseline both themes shared, on the reasoning that the
classic palette itself needed the same craft, not just Aurora.

Aurora was evaluated live rather than waiting for the exit date. Having used
both, the owner's decision was direct: the classic crimson/ivory palette
already reads as premium once `ADR-0019`'s materials and motion landed, and a
second dark palette was ongoing maintenance cost — a second set of contrast
numbers to keep correct, a second set of `axe` scans, a toggle and its
supporting state — with no offsetting benefit once the thing it was meant to
prove (that the redesign could look premium) had already landed on the
palette everyone actually uses. This is `ADR-0018`'s exit condition exercised
early, not skipped — a decision on an explicit fork ("adopt or delete") made
as soon as the fork was actually decidable, rather than waited out.

## Decision

**Remove Aurora in full.** Not disabled, not hidden behind a flag — deleted,
so there is exactly one implementation of the storefront's visual language to
maintain, matching `ADR-0018`'s own framing of what "delete" meant if that
branch of the fork were taken.

Removed:
- `lib/theme.ts`, `lib/theme-store.ts`, and their tests — the theme-switching
  state and the no-flash boot script.
- `components/theme/` (`ThemeToggle` and its test) — the toggle itself, and
  its entry point on the homepage hero.
- The `[data-theme='aurora']` palette block in `app/globals.css`, and the
  blocking inline script + the `suppressHydrationWarning` it required in
  `app/layout.tsx`.
- The Aurora `axe` pass and `seedAuroraTheme` helper in
  `e2e/accessibility.spec.ts` — nine tests across public pages and admin.

Kept, because `ADR-0019` is right that they're separable from Aurora
specifically:
- The `--glass-*` material system and the `.material-chrome` /
  `.material-panel` / `.material-panel-deep` / `.material-card` /
  `.material-raised` classes — still the classic palette's own glass
  treatment, not an Aurora artifact.
- Scroll-triggered materialise motion (`components/motion/reveal.tsx`) and
  pill-shaped controls (`rounded-full` buttons/inputs/badges) — both already
  applied to classic directly, independent of any second palette existing.
- The CSS-variable colour indirection in `tailwind.config.ts` — still what
  makes a white-label palette swap a `globals.css` edit, regardless of
  whether a second theme exists to switch to.

## Consequences

1. **One palette, one set of contrast numbers, one `axe` pass.** The
   maintenance surface `ADR-0019`'s consequence 5 flagged as Aurora's main
   ongoing cost is gone.
2. **`ADR-0018`'s exit condition is resolved, not deferred.** The 2026-11-10
   date no longer applies — there is nothing left pending on it.
3. **The colour-indirection mechanism stays**, even though its immediate
   reason (switching to Aurora) is gone — it still serves `ADR-0018`'s
   original secondary purpose, a white-label palette swap without touching
   component code, and removing it would be pure churn for no benefit.
4. **`STD-ACCESSIBILITY` rule 8** ("every selectable theme is scanned") is
   retained as standing guidance rather than deleted — it was correct
   independent of Aurora and should apply again if a second theme ever
   ships — but is currently unenforced, since there is nothing for it to
   apply to.
5. Full test suite, typecheck, and `axe` pass re-verified after removal (see
   this ADR's companion commit) — no regression expected since everything
   removed was additive and self-contained, and that held.

## Revisit Criteria

- A second theme (dark mode, seasonal, white-label client variant) is
  proposed again — the indirection mechanism and the `.material-*` system
  are the foundation it would build on; this ADR is not a statement that
  theming is a bad idea, only that *this* implementation of it didn't earn
  its keep once evaluated live.

## Cross References

- `ADR-0018` — Aurora's original build; annotated to point here.
- `ADR-0019` — the material/motion promotion this decision leaves intact.
- `STD-ACCESSIBILITY` rule 8 — retained as guidance, marked unenforced.
