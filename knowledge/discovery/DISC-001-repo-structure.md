---
id: DISC-001
title: Discovery — Repository Structure
version: 1.0.0
status: Frozen
owner: Architecture
reviewers:
  - Vedant
created: 2026-08-05
updated: 2026-08-06
milestone: M1
category: Discovery
priority: High
depends_on: []
required_by:
  - DISC-002
tags:
  - discovery
  - investigation
  - repo-structure
risk: Low
complexity: Medium
---

# DISC-001 — Discovery: Repository Structure

Investigation 1 of 10, per `OV-001`. Template shape is `OV-001`'s own.
Evidence and claim ids refer to `knowledge/discovery/evidence/README.md`.

## Purpose

Establish how the codebase and its supporting assets are organised, and which
of those arrangements are deliberate patterns worth preserving versus
accidents worth correcting — before any later investigation reasons about
architecture or domains on top of that layout.

## Observed Facts

Fact-tier claims only. Each is directly observed in `EVD-003` (the repository)
unless noted.

- **Monorepo, two deployables.** pnpm 9 + Turborepo, `apps/*` and `packages/*`
  declared as workspaces. `apps/api` (NestJS 10, Prisma 5.22) and `apps/web`
  (Next.js App Router), each with its own Dockerfile. (KC-017)
- **`packages/` was declared but did not exist.** Both workspace globs
  referenced it; no such directory. **Removed 2026-08-06** at the owner's
  instruction — `pnpm-workspace.yaml` and `package.json:6-8` now glob `apps/*`
  only, with a comment recording why and what would justify reinstating it.
  Verified afterwards: `turbo run typecheck` still resolves both workspace
  packages.
- **Turbo pipeline defines five tasks** — `build` (depends on `^build`,
  outputs `.next/**` and `dist/**`), `dev` (uncached, persistent), `lint`,
  `typecheck`, `test` (outputs `coverage/**`).
- **The API is 22 feature modules** under `src/modules/`: analytics,
  audit-log, auth, cart, cms, collections, coupons, health, inventory,
  metrics, notifications, orders, payments, products, recommendations,
  returns, reviews, search, storage, uploads, users, wishlist. (KC-018)
- **Module internals follow one repeated shape** — `<name>.module.ts`,
  `<name>.controller.ts`, `<name>.service.ts`, a co-located `.spec.ts` beside
  each, and a `dto/` directory. **All 22 modules swept 2026-08-06** (KC-064):
  17 conform exactly. The five deviations each have a structural reason —
  `health` (controller-only probe, no service or dto), `metrics` and `uploads`
  (no dto), `notifications` (no controller — an event consumer, not an HTTP
  surface), `storage` (module plus `ports/` and `providers/`, a hexagonal
  port-adapter layout). Every module carries at least one co-located spec,
  ranging 1–5 (KC-065).
- **Cross-cutting concerns are centralised** in `src/common/`: `decorators`,
  `dto`, `enums`, `event-bus`, `filters`, `guards`, `interceptors`, `media`,
  `middleware`. Guards cover JWT, optional-JWT and roles; decorators cover
  current-user, public and roles.
- **An event bus exists** at `src/common/event-bus/` with a 55-line
  `events.ts` declaring six events: `order.confirmed`, `payment.succeeded`,
  `product.upserted`, `product.deleted`, `return.requested`,
  `return.refunded`.
- **The web app splits by route group** — `(storefront)` and `(admin)` under
  `app/`, so both are served by one Next.js deployment. 20 storefront routes,
  13 admin routes. (KC-023)
- **Web components are organised by feature**, not by type: `admin`, `auth`,
  `cart`, `cinematic`, `collection`, `common`, `home`, `layout`, `product`,
  `ui`.
- **Tests are co-located and numerous** — 56 `.spec.ts` in the API, 61
  `.test.ts(x)` in web, 3 Playwright e2e files. Test files sit beside the code
  they cover rather than in a mirrored tree. (extends KC-025)
- **`.gitignore` carries per-rule rationale.** Rules for the `.env.example`
  negation, `apps/api/scripts/*.js`, `apps/api/uploads/`, `deploy/backups/`
  and `apps/web/test-results/` each state why they exist, several naming the
  incident that motivated them. No build artifacts (`dist/`, `coverage/`,
  `*.tsbuildinfo`) and no uploads are tracked — verified against the index,
  not just the ignore file.
- **Deployment is self-hosted and composed**, not PaaS: `deploy/` holds a
  Caddyfile, nginx config, and five docker-compose files (api, postgres,
  elasticsearch, metabase, monitoring), plus `backup.sh`, `GO-LIVE.md`,
  `RUNBOOK.md` and a `monitoring/` directory.
- **One CI workflow** (`.github/workflows/ci.yml`) running four jobs —
  backend unit+integration behind a 90% coverage gate against a real Postgres
  service, frontend unit behind a 90% gate, typecheck for both apps via
  `tsc --noEmit`, and Playwright E2E against a real stack (API built and
  started, fixtures seeded, web production-built). E2E depends on both test
  jobs. All four passed on the most recent PR run, #31015972427, in 4m38s.
  (KC-059)
- **CI never invokes turbo** (KC-060). Every job runs `npm install` plus
  per-app npm scripts. Deliberate and documented in the workflow header: npm
  is "the only path that's actually been validated."
- **`turbo run typecheck` executes nothing** (KC-061) — the task is declared
  in `turbo.json` but neither app defines a `typecheck` script. Verified by
  running it: "No tasks were executed as part of this run."
- **Lint runs nowhere in CI** (KC-062), though both apps define a lint script
  and `turbo.json` declares the task.
- **Two lockfiles are committed** — `package-lock.json` (558 KB) and
  `pnpm-lock.yaml` (315 KB) — while `package.json` declares
  `packageManager: pnpm@9.0.0` and CI installs with npm. (KC-063)
- **Shared types are hand-duplicated across the API/web boundary** (KC-055–058):
  8 of 15 Prisma enums re-declared as string-literal unions in
  `apps/web/lib/api/types.ts`, plus ~15 input interfaces mirroring API DTOs
  (34 DTO files total). All currently in sync; nothing enforces that.
- **Documentation is stratified into three layers** — seven root-level
  subject documents (~3,500 lines), `docs/` (architecture, design,
  milestones M0–M14), and `knowledge/` (`DOM-`, `FEAT-`, `STD-`, `ADR-`).
  (KC-041, EVD-005)
- **Requirements carry `FR-NN` identifiers referenced from running UI copy** —
  `FR-18` on the Inventory page, `FR-23` on the CMS page. (KC-044)

## Interpretation

Stated as interpretation, not fact.

The repository was built by someone applying a consistent framework idiom
rather than improvising per module. The 22 API modules are close to
mechanically uniform, and `common/` holds exactly the concerns that would
otherwise be duplicated across them. This is NestJS's intended layout followed
faithfully — the structure is legible without a map, which is the main thing a
future team needs from it.

The `(storefront)` / `(admin)` route-group split, combined with the admin UI
rendering inside customer chrome (KC-028), reads as one application serving two
audiences by convention rather than two applications sharing a repo. That is
consistent with `ADR-0006`'s hybrid admin strategy, which suggests the layout
follows a recorded decision rather than drift.

**Confirmed by the owner** (KC-053, EVD-007): both the uniform module shape and
the route-group split are deliberate decisions. This moves the paragraphs above
from interpretation to confirmed intent. The consequence to carry forward is
that admin pages inherit storefront chrome and ship in the same Next.js bundle
— the accepted cost of the hybrid strategy, and a constraint on any later
proposal to harden the admin boundary.

The three documentation layers appear to have accreted in sequence — root-level
subject docs, then `docs/milestones/` as work was sequenced, then `knowledge/`
as durable artifacts were extracted. Nothing indicates a rule for which layer
a new document belongs in, and Oriveda adoption adds a fourth layer with an
explicit rule, which will make the ambiguity in the first three more visible
rather than less.

`.gitignore` is the strongest signal in the repository about how it is
maintained. Rules that record the incident that motivated them are a form of
institutional memory most repositories discard, and it is the same instinct
that motivates adopting Oriveda. It is also, currently, the *only* place that
kind of rationale is captured close to the code.

~~The declared-but-absent `packages/` directory most likely reflects a scaffold
default that was never exercised, not a deleted package — there is no import
or reference to a shared package anywhere in either app.~~

**Corrected 2026-08-06 (KC-055).** This inference was wrong. `packages/types`
was a *planned* shared-types package, and its absence was known and documented:
`apps/web/lib/api/types.ts` opens by stating its types are "hand-duplicated
here rather than imported from `packages/types`, which BACKEND.md §5 already
flags as not yet wired up across the monorepo — tracked as a follow-up so
frontend and backend types don't silently drift." The directory was never
scaffold noise; it was a deliberate intention that never got built, with the
duplication accepted as an interim cost. Retained struck-through rather than
deleted, per `OV-000`'s treatment of superseded claims.

## Hidden Assumptions

Where the interpretation above is doing work the evidence did not.

- ~~**Module uniformity is assumed from a sample.**~~ **Resolved** by the
  exhaustive 22-module sweep (KC-064). No longer an assumption.
- **"Legible without a map" is an assertion about a future reader**, not an
  observation. It has not been tested against anyone unfamiliar with the code.
- ~~**Test counts are file counts, not coverage.**~~ **Partly resolved**: CI
  enforces a 90% coverage gate on both apps and the most recent run passed
  (KC-059), so tests demonstrably pass and cover most lines. What they *assert*
  remains unexamined — a 90% gate measures execution, not meaningfulness.
- **The accretion story for documentation is a narrative** fitted to three
  layers existing. Commit history was not examined to confirm the order.
- ~~**`packages/` as vestigial scaffold is inference.**~~ **Resolved, and the
  inference was wrong** — see the correction in Interpretation (KC-055).

## Strengths

- **Uniform module shape.** A new API feature has an obvious, unambiguous
  layout to copy. This is the single most valuable structural property here.
- **Genuine cross-cutting layer.** `common/` prevents the guard/filter/DTO
  duplication that NestJS codebases usually accumulate by module 10 or so.
- **Co-located tests at real volume.** 117 test files across three levels
  (unit, integration, e2e) with tests beside their subjects — the arrangement
  that keeps tests being updated with the code.
- **Self-documenting `.gitignore`.** Rationale captured at the point of
  enforcement.
- **A working event bus.** Six named events, confirmed functional end to end
  against the live product (KC-066) rather than merely declared. Gives the
  eventual context map a factual seam to build on. Closes the
  domain/integration-events check `OV-001` mandates.
- **CI enforces 90% coverage on both apps** and runs E2E against a genuinely
  real stack — migrated database, seeded fixtures, production web build. This
  is stronger than the file counts alone suggested.
- **Deployment is version-controlled and runbooked.** `GO-LIVE.md`,
  `RUNBOOK.md`, `backup.sh` and composed infrastructure mean the deployment
  is reproducible rather than resident in someone's shell history.

## Weaknesses

- **Shared types are hand-duplicated with nothing enforcing sync.** The
  suspicion was confirmed and quantified: 8 Prisma enums and ~15 DTO shapes
  re-declared in `apps/web/lib/api/`. They are all correct *today* — this is
  latent risk, not present breakage. But no test, typecheck or CI step compares
  the two definitions, so the first divergence will surface as a runtime
  mismatch in a browser, not a red build. Adding a `PLATINUM_PLATED` to
  `schema.prisma` would ship green. The `packages/` glob that named the
  intended fix has now been removed, so the intention survives only in a
  comment in `types.ts` and in `pnpm-workspace.yaml`'s removal note.
- ~~**No stated rule for which documentation layer a document belongs in.**~~
  **Resolved** by `ADR-0007` (2026-08-06): `knowledge/` is authoritative,
  `docs/` and root `*.md` are advisory, and on conflict `knowledge/` wins.
- **`FR-NN` identifiers appear in customer-facing UI.** The Inventory and CMS
  pages surface internal requirement ids and scope caveats to whoever is
  logged in. Fine for an internal admin, but it is shipped product copy
  referencing a tracker the reader cannot access.
- **Rationale lives in `.gitignore` and nowhere else.** The habit is good and
  its scope is one file.
- **The turbo pipeline is largely decorative.** CI bypasses turbo entirely
  (KC-060), `turbo run typecheck` silently executes nothing because neither app
  defines the script (KC-061), and lint runs in no CI job at all (KC-062). The
  root `package.json` advertises five commands, of which one is a no-op and one
  is never enforced anywhere. A developer running the documented root typecheck
  gets a passing silence rather than a check.
- **Two lockfiles, and the declared package manager is not the one CI uses**
  (KC-063). `package.json` declares `pnpm@9.0.0`; CI installs with npm and says
  so deliberately. Both lockfiles are committed, so the tree CI validates is
  not necessarily the tree a `pnpm install` produces.

## Questions

Unresolved after the evidence was exhausted. Tagged with the investigation
that owns each, per `OV-001`'s cross-investigation rule. None block freezing
this investigation.

All six questions raised in the Draft have been resolved. Retained with their
answers rather than deleted, so the investigation records what was uncertain.

1. ~~Is `packages/` intended for future shared code, or vestigial scaffold?~~
   → **RESOLVED.** Neither reading was right: it was a planned `packages/types`
   package, documented as missing (KC-055). Owner ruled it unused to date; the
   glob was removed 2026-08-06.
2. ~~Are API/web shared types duplicated, and by how much?~~ → **RESOLVED**
   (KC-056–058): 8 of 15 Prisma enums plus ~15 DTO-mirroring interfaces. All in
   sync today, nothing enforcing it.
3. ~~Does `ci.yml` exercise both apps and all five turbo tasks?~~ →
   **RESOLVED** (KC-059–062): both apps yes, turbo tasks no — CI bypasses turbo
   entirely, `typecheck` is a no-op via turbo, and lint runs nowhere.
4. ~~Do all 22 modules follow the sampled shape?~~ → **RESOLVED** (KC-064):
   17 exactly; 5 deviate for structural reasons. Convention holds.
5. ~~Are the six declared events actually produced and consumed?~~ →
   **RESOLVED** (KC-066): confirmed working by the owner against the live
   published product's order/payment/refund lifecycle. Real integration seam.
6. ~~Which documentation layer is authoritative?~~ → **RESOLVED** by
   `ADR-0007`: `knowledge/` binds, `docs/` and root `*.md` are advisory.

## Recommendations

Keep / Improve / Remove, one line each. These feed M2 Constitution and M3
Architecture; they are not actions to take now.

- **Keep** — the uniform `module/controller/service/dto/spec` shape; it is the
  codebase's best structural asset and any Standard should encode it as-is.
- **Keep** — co-located tests at their current density.
- **Keep** — the self-documenting `.gitignore` convention, and consider it the
  model for how rationale should sit near code generally.
- **Keep** — `common/` as the only home for cross-cutting concerns.
- **Improve** — close the type-duplication gap now that `packages/` is gone.
  A shared package is one option; a generated-types step or a test asserting
  the web unions match `schema.prisma` are cheaper ones. The point is that
  *something* must fail when they diverge.
- **Improve** — make the turbo pipeline honest: add `typecheck` scripts to both
  apps, or drop the task from `turbo.json`. A declared command that silently
  does nothing is worse than no command.
- **Improve** — run lint in CI, or remove the lint task and both lint scripts.
- **Improve** — settle on one package manager and delete the other lockfile.
- ~~**Improve** — state one rule for documentation layers.~~ **Done** —
  `ADR-0007`.
- **Improve** — move `FR-NN` scope caveats out of shipped UI copy into the
  spec layer where the identifiers resolve.
- **Remove** — nothing. No part of the current structure is actively harmful.

## Confidence Level

**Very high (96%)** after the Revision pass, raised from 90%.

Both caps are gone. The intent question was settled by the owner (KC-053), and
the 3-of-22 sampling limitation was closed by an exhaustive sweep (KC-064) —
every load-bearing claim in this investigation is now directly observed rather
than extrapolated. All six open Questions are resolved. One inference was found
wrong and corrected in place (KC-055, the `packages/` reading), which is the
process working as intended rather than a reason to lower confidence.

The residual 4% is the two remaining Hidden Assumptions that no reasonable
amount of further work would close: "legible without a map" is an untested
assertion about a future reader, and the documentation-accretion narrative was
never checked against commit history. Neither is load-bearing for any
Recommendation above.

## Architecture Review

Per `OV-001`'s per-investigation lifecycle, checked before Freeze.

- **Does it hold up?** Yes. Every load-bearing claim is directly observed, and
  the one inference that failed review (`packages/` as scaffold) was corrected
  in place rather than quietly dropped.
- **Does it contradict another investigation?** No contradictions. Two
  hand-offs: KC-066 (working event bus) strengthens `domain-discovery`'s
  starting position beyond the 70%-confidence module-name guess in KC-022, and
  KC-056–063 hand `technical-debt` five concrete items it would otherwise have
  had to rediscover.
- **Scope discipline.** The type-duplication, turbo-pipeline, lint, and
  lockfile findings are recorded here because they were found here, but they
  belong to `technical-debt` for judgement about severity and sequencing. This
  investigation states them as facts and stops short of ranking them.

**Frozen 2026-08-06** by owner sign-off. Per `OV-001`, this investigation is
now trustworthy input for M2 Constitution and M3 Architecture without waiting
for the other nine. Revisions after this point require the same
Discussion → Review cycle, not a silent edit (KC-054).

### Cross-cutting extraction check

`OV-001` requires each investigation to explicitly check for commonly-missed
artifact types in its own evidence:

- **Domain/integration events** — owned by `domain-discovery`, but surfaced
  here: six events found in `common/event-bus/events.ts`, listed under
  Observed Facts and handed to that investigation with Question 5 attached.
- **Non-functional requirements** — owned by `business-vision` and
  `technical-architecture`, not this investigation. Not checked here.
