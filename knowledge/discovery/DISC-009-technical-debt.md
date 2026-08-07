---
id: DISC-009
title: Discovery — Technical Debt
version: 1.0.0
status: Frozen
owner: Architecture
reviewers:
  - Vedant
created: 2026-08-07
updated: 2026-08-07
milestone: M1
category: Discovery
priority: High
depends_on:
  - DISC-001
  - DISC-005
  - DISC-007
  - DISC-008
required_by:
  - DISC-010
related_decisions:
  - ADR-0008
  - ADR-0010
tags:
  - discovery
  - investigation
  - technical-debt
risk: Medium
complexity: Medium
---

# DISC-009 — Discovery: Technical Debt

Investigation 9 of 10, per `OV-001`. Evidence and claim ids refer to
`knowledge/discovery/evidence/README.md`.

Two inputs: the queue accumulated across `DISC-001`–`DISC-008`, and a fresh
scan for debt nobody had flagged (`EVD-028`).

## Observed Facts

### Fresh scan

- **TODO density is three** across both apps (KC-195) — all deliberate
  pending-decision markers in `brand.ts` and the FAQ page, none abandoned
  work. Roughly one per 10,000 lines of source.
- **Both apps are TypeScript `strict`** (KC-196). The API additionally sets
  `strictNullChecks` and `noImplicitAny` explicitly.
- **Four type suppressions and eleven non-test `any` usages** across both
  apps (KC-197).
- **Both coverage gates are 90%** on statements, branches, functions and lines
  (KC-198) — but the API's are declared under a **`global`** key, so coverage
  is aggregate, not per file.
- **The web coverage gate excludes two directories** (KC-199):
  `components/vision/**`, which **does not exist**, and
  `components/cinematic/**` — 3 files, 145 lines, **imported by nothing**.
- **The API is one major version behind** on NestJS (10) and Prisma (5)
  (KC-200); the web app is current on Next 15 and React 19.
- **No unused runtime dependencies** were found (KC-201).

### The inherited queue

Every item carried forward from a prior investigation, with its origin:

| # | Item | Origin | Severity |
| --- | --- | --- | --- |
| 1 | Rating aggregates desync silently; feed search ranking | KC-142, KC-152 | **High** — `ADR-0008` resolves |
| 2 | No e2e coverage of checkout → payment → confirmation | KC-121 | **High** |
| 3 | 1,045 zero-priced placeholder products | KC-030, KC-049 | **High** — publish checks now agreed (KC-192) |
| 4 | Three NFRs unmeasured (performance, availability, accessibility) | KC-171, KC-172 | **High** — `axe` agreed (KC-176) |
| 5 | `searchVector` + its GIN index invisible to Prisma | KC-144 | Medium |
| 6 | Two invariants app-layer-only (`ProductView` XOR, `Coupon.value`) | KC-143 | Medium |
| 7 | `turbo run typecheck` is a silent no-op | KC-061 | Medium |
| 8 | Lint runs in no CI job | KC-062 | Medium |
| 9 | Two committed lockfiles; declared PM is not CI's | KC-063 | Medium |
| 10 | Shared types hand-duplicated, nothing enforces sync | KC-056–058 | Medium |
| 11 | Media durability rests on one VM volume + rsync | KC-026 | Medium |
| 12 | Event bus at-most-once, no durability | KC-165 | Deferred — `ADR-0010` |
| 13 | Inventory "partial index" comment describes a plain index | KC-145 | Low |
| 14 | `OrderStatus.REFUNDED` unreachable | KC-178 | Low — being fixed (KC-190) |

## Interpretation

**This codebase carries unusually little accidental debt, and a meaningful
amount of deliberate debt.** Three TODOs, four suppressions, eleven `any`s,
strict mode on both sides, no unused dependencies, and rationale comments dense
enough that `DISC-001` called `.gitignore` an institutional-memory artifact.
The debt that exists is mostly *decisions deferred*, not *corners cut* — and
almost all of it was found by this Discovery rather than left as a known
backlog, which is itself a finding: nobody was tracking it.

**The most valuable finding is the coverage gate being softer than it looks**
(KC-198, KC-199). Every prior investigation leaned on "90% coverage, both apps,
enforced in CI" as evidence of quality — `DISC-001` cited it, `DISC-003` used
it to soften the endpoint-existence assumption, `DISC-004` noted it. That
confidence needs three qualifications:

1. **The API's threshold is aggregate, not per file.** A thoroughly tested
   module can carry an untested one across the line without the gate failing.
2. **The web gate excludes `components/cinematic/**`** — 145 lines that no
   route imports. The exclusion does not merely skip testing them; it
   **conceals that they are dead.** Had they been inside the gate, they would
   have failed it, and someone would have asked why they existed.
3. **`components/vision/**` is excluded and does not exist**, so the config has
   outlived a directory that was deleted.

None of this makes the 90% figure dishonest. It makes it a *different* claim
than it reads as, and every downstream investigation that leaned on it inherits
the qualification.

**Dead code hiding inside a coverage exclusion is the sharpest single item
here.** It is small — 145 lines, three animation components — but the mechanism
is what matters: an exclusion added for a plausible reason (animation
components are awkward to unit-test) became the reason nobody noticed the code
was orphaned.

**Three of the four High items are already resolved in principle.** Rating
desync has `ADR-0008`; placeholder publishing has agreed validation (KC-192);
accessibility has agreed `axe` coverage (KC-176). Only **missing e2e coverage
of the payment path** has no decision attached, and it is the one I would rank
first: it is the journey the business cannot afford to have silently break, CI
already runs a real stack capable of exercising it, and today it is verified
only by the owner having tested it manually once (KC-052).

**The framework lag is not urgent but has a deadline shape.** NestJS 10 and
Prisma 5 are each one major behind. Neither is unsupported, and there is no
functional pressure. The cost of deferring is that major-version upgrades
compound: the gap between "one behind" and "two behind" is where upgrades stop
being routine. Worth doing during a quiet period rather than under pressure.

**The build-tooling items (7, 8, 9) are individually trivial and collectively
a pattern.** A declared `typecheck` command that silently does nothing, a lint
task that runs nowhere, and two lockfiles where the declared package manager is
not the one CI uses. Each is a five-minute fix. Together they mean **the root
`package.json` advertises five commands of which one is a no-op and one is
unenforced** — a developer trusting the documented interface gets less than
they think, which is the same failure shape as the coverage gate.

**Media durability (item 11) is now the top operational risk in the project.**
`ADR-0010` accepted single-node topology *on the explicit basis* that recovery
relies on the documented backup and restore procedure rather than on
redundancy. **That restore has never been performed** (KC-205).

So the reasoning chain is: no redundancy, accepted because backups cover it;
backups never restored, so their sufficiency is unknown. Product imagery lives
in one Docker volume moved by rsync, and for a jewellery store **imagery is the
product** — losing it is not degraded service but catastrophic inventory loss
that no amount of order data recovers.

This re-weights above every other item here, including the payment e2e gap.
A missing test means a bug ships; an unverified restore means the business may
not survive a disk failure. It is also the cheapest to close — restore into a
scratch environment once and record that it worked.

## Hidden Assumptions

- **"No unused dependencies" is inference** (KC-201) from import scanning, and
  two false positives were already identified. Transitively-used or
  config-only packages could be miscounted either way.
- **Dead-code detection covered `components/cinematic` only**, prompted by the
  coverage exclusion. No systematic dead-code sweep was run across either app.
- **Coverage percentages were read from configuration, not from a run.** The
  gate is 90%; the actual figure could be far higher, and no report was
  inspected.
- **Dependency currency is judged against my knowledge of release trains**,
  not a registry query. Version recency may be stale.
- **Severity ratings are my judgement**, weighted by blast radius and
  reversibility, not by any agreed rubric.

## Strengths

- **Very low accidental debt** — three TODOs, four suppressions, eleven `any`s
  across ~10k lines of source.
- **Strict TypeScript on both sides**, with the API explicit about it.
- **No unused dependencies**, and the web app is current on its framework.
- **Coverage gates exist and are enforced in CI at all**, which most projects
  of this size skip entirely.
- **Debt is overwhelmingly deliberate** — deferred decisions with reasons,
  not shortcuts.
- **Every item in the inherited queue was found by reading, not by failure.**
  None of this reached production as an incident.

## Weaknesses

- **The coverage gate is softer than every prior investigation assumed**
  (KC-198, KC-199) — aggregate rather than per-file, with a dead directory
  excluded from it.
- **145 lines of dead code**, concealed by that exclusion, plus a stale
  exclusion for a directory that no longer exists.
- **The payment path has no automated end-to-end test** (KC-121) — the highest
  unresolved item on the list.
- **Restore has never been performed** (KC-205), while `ADR-0010` leans on it
  for the reliability the topology deliberately does not provide. The single
  largest operational risk found in Discovery.
- **Two framework majors behind on the API**, with compounding upgrade cost.
- **Build tooling advertises more than it delivers** — a no-op `typecheck`, an
  unenforced lint, two lockfiles.
- **No debt was being tracked anywhere** before this investigation.

## Questions

1. ~~Should the payment path get e2e coverage?~~ → **RESOLVED** (KC-202):
   yes, agreed and to be automated.
2. ~~Delete `components/cinematic`, or wire it?~~ → **RESOLVED** (KC-203):
   deleted. Both it and `components/vision` existed to help the client choose a
   design direction; that purpose is served. **Acted on** — the directory and
   both coverage exclusions are gone, and the suite verified green afterwards
   (KC-204).
3. ~~Should the API coverage threshold move from global to per-file?~~ →
   **Partly answered by measurement** (KC-204): the web app achieves 96.98%
   against a 90% gate, so the aggregate threshold is absorbing far less slack
   than feared. The API's achieved figure is still unmeasured — carried to
   `recommendations` as a cheap check rather than a change.
4. **When do NestJS 10 → 11 and Prisma 5 → 6 happen?** → still open;
   **owner decision**, not urgent.
5. ~~Has a restore ever been performed?~~ → **RESOLVED** (KC-205): **no.**
   See the re-weighting below.
6. ~~Should the build-tooling trio be fixed as one pass?~~ → linting confirmed
   not performed (KC-206). Carried to `recommendations` as a single small pass.

## Recommendations

- **Keep** — the low-debt discipline: strict types, minimal suppressions,
  TODOs used as deliberate flags rather than abandonment markers.
- **Keep** — coverage gates in CI, while correcting what they are believed to
  guarantee.
- **Improve — first** — exercise a restore from backup, and record that it was
  done (KC-205). `ADR-0010`'s acceptance of single-node risk rests entirely on
  a procedure nobody has run.
- **Improve** — add e2e coverage for checkout → payment → confirmation
  (KC-202).
- **Done** — `components/cinematic` deleted, both stale coverage exclusions
  removed, suite verified at 96.98% afterwards (KC-203, KC-204).
- **Improve** — fix the build-tooling trio in one pass; each is minutes, and
  together they restore trust in the documented commands.
- **Improve** — schedule the NestJS and Prisma majors deliberately rather than
  letting the gap widen.
- **Removed** — `components/cinematic` and both coverage exclusions, done
  during this investigation's Discussion pass.

### Debt this investigation does *not* re-litigate

Items already carrying an accepted decision are listed for completeness, not
reopened: rating desync (`ADR-0008`), event-bus durability (`ADR-0010`,
deferred with triggers), placeholder publishing (KC-192), accessibility
(KC-176), and `OrderStatus.REFUNDED` (KC-190).

## Architecture Review

- **Does it hold up?** Yes, and one item was re-ranked on new evidence rather
  than defended: KC-205 moved media durability above the payment e2e gap.
- **Does it contradict another investigation?** It **qualifies** several.
  Every prior investigation that cited "90% coverage enforced in CI" as
  evidence of quality inherits KC-198's clarification that the API threshold is
  aggregate. KC-204 measures the web side and finds the concern small there.
- **Interaction with a prior decision.** `ADR-0010` accepted single-node
  topology on the basis of backup and restore. KC-205 establishes that basis is
  untested — the ADR is not wrong, but its central assumption is unverified.
- **Scope discipline.** Dead code was deleted because the owner authorised it
  during the pass; nothing else was changed. The e2e specs, restore drill and
  tooling fixes are recorded, not performed.

**Frozen 2026-08-07** by owner sign-off. Revision requires the full
Discussion → Review cycle (KC-054).

## Confidence Level

**High (89%)** after the Discussion pass, raised from 86%.

Configuration and scan facts are direct observation at 95–100% — TODO counts,
tsconfig flags, coverage thresholds and exclusions, dependency versions, and
the absence of imports for `components/cinematic`.

One cap lifted during Discussion: coverage is no longer read from
configuration alone. The web suite was **run** (KC-204) — 330 tests, 96.98%
statements — which closes the question of how much slack the aggregate
threshold absorbs, at least for the web app. The API's achieved figure remains
unmeasured.

What still caps this: **severity ratings are judgement**, not measurement. The
inherited queue's High/Medium/Low column reflects my weighting of blast radius
and reversibility against no agreed rubric, and a different engineer could
reasonably reorder it — as the Discussion pass demonstrated, when KC-205 moved
media durability above the payment e2e gap that had been ranked first.

Per `OV-001` the investigation cannot exceed its weakest load-bearing claim.
The severity ordering is what `DISC-010` will build its Improve list on, and it
is inference-tier by nature.

### Cross-cutting extraction check

- **Domain/integration events** — owned by `domain-discovery` (done). One debt
  note: the at-most-once property (KC-165) is deferred debt under `ADR-0010`
  rather than an open finding.
- **Non-functional requirements** — owned by `business-vision` and
  `technical-architecture`, both complete. This investigation adds that three
  NFRs remain unmeasured (KC-171, KC-172), with accessibility now scheduled
  for `axe` coverage (KC-176) and the other two unaddressed.
