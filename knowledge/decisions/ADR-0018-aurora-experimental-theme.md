---
id: ADR-0018
title: Aurora — a second, opt-in visual theme carried alongside the shipped design
version: 0.3.0
status: Superseded
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
  - ADR-0007
  - ADR-0013
required_by:
  - ADR-0019
  - ADR-0020
related_documents:
  - DESIGN
  - STD-ACCESSIBILITY
  - DISC-009
related_decisions:
  - ADR-0013
  - ADR-0019
  - ADR-0020
tags:
  - frontend
  - design
  - experiment
risk: Medium
complexity: Medium
---

# ADR-0018 — Aurora, a second opt-in visual theme

> **Superseded by `ADR-0020` (2026-08-11) — Aurora itself is removed.** Per
> Law 2, this is annotated rather than rewritten or deleted; the reasoning
> below was correct for what it decided at the time, including the part that
> turned out wrong once tried. Two things changed, in order:
>
> 1. **`ADR-0019` (2026-08-10)** superseded this ADR's Consequences claim that
>    classic is "provably unchanged" — glass materials, scroll motion, and
>    pill-shaped controls were promoted from Aurora-only to the baseline both
>    themes shared, because the *classic* storefront itself didn't read as
>    premium on its own.
> 2. **`ADR-0020` (2026-08-11)** then removed Aurora itself, having been
>    evaluated live: the classic palette already read as premium once
>    `ADR-0019`'s materials and motion landed, and a second palette was
>    ongoing cost with nothing left to prove. This is this ADR's own exit
>    condition ("adopt fully or delete by 2026-11-10") exercised early, not
>    skipped.
>
> What survives, unaffected by either change: the `--glass-*` material system,
> the scroll-motion and pill-control language, and the colour-indirection
> mechanism — all promoted or generalised, none deleted. What's gone: the
> two-palette structure, the toggle, and everything below that describes
> switching between them. Read `ADR-0019` for the two real bugs its build
> surfaced along the way (a sticky header that silently never stuck; four
> glass surfaces silently rendering opaque under a Tailwind layer-order
> conflict) and `ADR-0020` for the removal itself.

## Context

The owner wanted to try a different design language on the storefront — Apple's
fluid-interface and translucent-material rules (`design-update.md`): dark
ground, glass surfaces, spring motion — **without** replacing the ivory/crimson
design that ships today, and with a button on the homepage to switch between
them.

Two facts from the project's own history shaped how this was built.

**First, this has been tried before and it rotted.** A concept-pitch redesign
once lived in `apps/web/components/cinematic/` and `components/vision/`, behind
a coverage exclusion in `vitest.config.mts`. The pages it served were retired in
`276133a`; the components were not. Nobody noticed, because the exclusion was
exactly what stopped anyone noticing — recorded as KC-199 and cleaned up on
2026-08-07 under `DISC-009`. A second design experiment carried in the same
repository is the same shape of risk, and needs a different structure.

**Second, this palette has failed accessibility before.** `STD-ACCESSIBILITY`
rule 5 predicts that a mood-optimised luxury palette will fail as text, and the
first `axe` run proved it: gold on gold at 2.36:1 and 2.52:1, plus success and
warning badges at 4.29:1 and 3.62:1. A *second* full palette — darker, with
translucent surfaces whose effective background is a blend rather than a flat
colour — is strictly the harder case.

## Options Considered

- **A parallel component tree** (`components/aurora/…`), route group, or a
  second app. Maximum freedom, and the exact structure that produced the
  `components/cinematic/` dead code: two implementations of every surface, one
  of which stops being exercised the moment attention moves.
- **A branch, never merged.** Zero risk to `main`, and unusable — the point is
  to click between the two designs on a running site, and a long-lived design
  branch diverges from the storefront it is meant to be compared against.
- **Token indirection plus material classes, one component tree.** Every colour
  moves behind a CSS custom property keyed on `data-theme`; components opt into
  a *material role* rather than a look. Chosen. Costs a mechanical rewrite of
  `tailwind.config.ts` and buys a whole-app reskin with no component branching
  on the theme.

## Decision

**One component tree, two palettes, selected by `data-theme` on `<html>`.**

1. Colour tokens in `apps/web/tailwind.config.ts` resolve to CSS custom
   properties holding **raw RGB channels**, wrapped as
   `rgb(var(--…) / <alpha-value>)`. Channel-space is not a stylistic choice:
   this codebase uses Tailwind opacity modifiers heavily, and a variable
   holding a finished colour would break every one of them silently.
2. Both palettes live in `app/globals.css`. `classic` is `:root`;
   `aurora` is `[data-theme='aurora']`.
3. Glass is expressed as four material classes — `.material-chrome`,
   `.material-panel`, `.material-panel-deep`, `.material-card`,
   `.material-raised` — which are **inert under `classic`** and translucent
   under Aurora. A component asks for a role; it never asks which theme is on.
4. Motion tokens live in `lib/motion.ts` and are applied by
   `components/motion/reveal.tsx`, Aurora-only.
5. `classic` is the default for every visitor. The choice persists to
   `localStorage` and is stamped before first paint by a blocking inline script
   in the root layout, because an effect would flash the wrong theme on every
   load.
6. The toggle exists on the homepage only, and says *experimental* in its
   accessible name — Law 1: the surface may not assert more than Aurora is.

## Consequences

1. **The classic design is unchanged, and that is checkable.** Every Aurora
   rule is scoped under `[data-theme='aurora']`; with no attribute present,
   nothing in this change applies. The one shared edit is the token
   indirection, which resolves to the same hexes it replaced.
2. **Aurora is scanned by `axe`, not trusted by eye.**
   `e2e/accessibility.spec.ts` runs seven public pages and two admin pages a
   second time with the theme seeded. The palette values in `globals.css` are
   provisional until that passes, and carry their measured ratios in comments.
   This does **not** certify Aurora as AA — automated checks reach about a
   third of WCAG, and claiming more would violate Law 1.
3. **No coverage exclusions, and no parallel components.** Everything added
   under `lib/**` and `components/**` counts toward the 90% gate
   (`STD-TESTING` rules 2–3). This is the direct countermeasure to KC-199: the
   mechanism that hid the last experiment is not available to this one.
4. **`prefers-reduced-motion`, `prefers-reduced-transparency` and
   `prefers-contrast` are handled**, per `design-update.md` §14. Translucency
   and motion are both preferences a visitor can decline, and a theme built on
   them has to answer for that.
5. **Accepted cost: a second palette to maintain.** Any new colour token now
   needs two values, and a token added to only one theme renders wrong in the
   other. This is the main carrying cost, and the main argument for the exit
   condition below.
6. **The admin inherits the theme but has no switch.** An admin who wants out
   returns to `/`. Deliberate — the toggle is a design experiment's entry
   point, not an admin preference.

## Exit Condition

Law 3 requires that a deferral carry a named trigger rather than going quiet.
This one is explicit:

> **By 2026-11-10 (three months), Aurora is either adopted as the storefront's
> design — at which point `classic` is deleted and the indirection collapses to
> one palette — or it is deleted in full: `globals.css`'s aurora block, the
> material classes, `lib/theme*.ts`, `components/theme/`,
> `components/motion/`, the toggle, and the Aurora `axe` pass.**

Deleting it must be one commit's work, and the structure above is what keeps it
that way. If the date passes with no decision, that is itself the finding —
record the extension here with its reason, per Law 2. What must not happen is
the third option: Aurora quietly staying half-alive because nobody chose.

## Revisit Criteria

- The exit condition's date arrives.
- A third theme is proposed — the two-palette structure holds, but the
  maintenance argument in consequence 5 gets materially worse.
- `prefers-color-scheme` becomes a real requirement. Aurora is deliberately
  *not* an OS dark mode; if the store needs one, that is a different decision
  and this indirection is the foundation it would build on, not the answer.

## Cross References

- `DISC-009` / KC-199 — the `components/cinematic/` dead code this is
  structured to avoid repeating.
- `STD-ACCESSIBILITY` rules 5 and 6, and its revision recording the Aurora
  `axe` pass.
- `STD-TESTING` rules 1–3 — co-located tests, the 90% gate, and the rule that
  exclusions are for generated files and never for code that is hard to test.
- `DESIGN.md` §2 — the token set Aurora mirrors; advisory under `ADR-0007`.
- `design-update.md` — the design philosophy Aurora implements.
