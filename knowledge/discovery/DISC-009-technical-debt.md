---
id: DISC-009
title: Discovery — Technical Debt
version: 0.1.0
status: Discussion
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

**Media durability (item 11) deserves re-weighting under `ADR-0010`.** That ADR
accepted single-node topology and put the reliability burden on backup and
restore. Product imagery lives in a Docker volume moved by rsync — for a
jewellery store, where imagery *is* the product, losing it is not degraded
service but catastrophic inventory loss. `ADR-0010`'s acceptance of single-node
risk implicitly assumed restores work; nothing indicates the restore path has
been exercised.

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
- **Restore has not been demonstrated**, while `ADR-0010` leans on it for the
  reliability the topology does not provide.
- **Two framework majors behind on the API**, with compounding upgrade cost.
- **Build tooling advertises more than it delivers** — a no-op `typecheck`, an
  unenforced lint, two lockfiles.
- **No debt was being tracked anywhere** before this investigation.

## Questions

1. **Should the payment path get e2e coverage before launch?** → **owner
   decision**; my recommendation is yes, and first.
2. **Delete `components/cinematic`, or wire it?** 145 lines, imported by
   nothing. → **owner decision**.
3. **Should the API coverage threshold move from global to per-file?** →
   **owner decision**; it would likely fail initially, which is the point.
4. **When do NestJS 10 → 11 and Prisma 5 → 6 happen?** → **owner decision**;
   not urgent, but cheaper now than later.
5. **Has a restore from backup ever been performed?** → **owner decision** /
   operational. `ADR-0010` depends on the answer.
6. Should the build-tooling trio (no-op typecheck, unrun lint, dual lockfiles)
   be fixed as one small pass? → `recommendations`.

## Recommendations

- **Keep** — the low-debt discipline: strict types, minimal suppressions,
  TODOs used as deliberate flags rather than abandonment markers.
- **Keep** — coverage gates in CI, while correcting what they are believed to
  guarantee.
- **Improve** — add e2e coverage for checkout → payment → confirmation. The
  single highest-value item here.
- **Improve** — delete `components/cinematic` and the two stale coverage
  exclusions, or wire the components and test them. Not both states at once.
- **Improve** — exercise a restore from backup once, and record that it was
  done. `ADR-0010` rests on it.
- **Improve** — fix the build-tooling trio in one pass; each is minutes, and
  together they restore trust in the documented commands.
- **Improve** — schedule the NestJS and Prisma majors deliberately rather than
  letting the gap widen.
- **Remove** — `components/cinematic` (pending Question 2) and the
  `components/vision` exclusion, which points at nothing.

### Debt this investigation does *not* re-litigate

Items already carrying an accepted decision are listed for completeness, not
reopened: rating desync (`ADR-0008`), event-bus durability (`ADR-0010`,
deferred with triggers), placeholder publishing (KC-192), accessibility
(KC-176), and `OrderStatus.REFUNDED` (KC-190).

## Confidence Level

**High (86%).**

Configuration and scan facts are direct observation at 95–100% — TODO counts,
tsconfig flags, coverage thresholds and exclusions, dependency versions, and
the absence of imports for `components/cinematic`.

Two things cap it. **Severity ratings are judgement**, not measurement — the
inherited queue's High/Medium/Low column reflects my weighting of blast radius
and reversibility against no agreed rubric, and a different engineer could
reasonably reorder it. And **coverage was read from configuration rather than
from a run** (KC-198): the gate's *shape* is established, but the actual
achieved percentages, and therefore how much slack the aggregate threshold is
absorbing, are unknown.

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
