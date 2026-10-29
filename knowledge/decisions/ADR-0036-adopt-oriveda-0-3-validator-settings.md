---
id: ADR-0036
title: Adopt Oriveda v0.3.0 (fb521e4) — jwel's Validator Settings
version: 0.1.0
status: Accepted
owner: Architecture
reviewers:
  - Vedant
created: 2026-10-29
updated: 2026-10-29
milestone: M8
category: Decisions
priority: Medium
depends_on:
  - CONSTITUTION
  - ADR-0007
  - ADR-0035
required_by: []
related_documents:
  - DIVERGENCE-LOG
related_domains: []
related_features: []
related_decisions:
  - ADR-0002
  - ADR-0005
  - ADR-0006
  - ADR-0007
  - ADR-0035
tags:
  - decision
  - oriveda
  - governance
risk: Low
complexity: Low
---

# ADR-0036 — Adopt Oriveda v0.3.0 (fb521e4)

*Decided by the owner (Vedant) on 2026-10-29, who asked for this upgrade and for this record; drafted by Claude. Vedant is listed as reviewer on that basis; he did not review this text himself.*

## Context

On v0.2.0, `scripts/validate.py --root .` reported 97 errors against jwel. None
was a spec defect:

- **55**: jwel's own lifecycle words, `Review` and `Accepted`, are not among
  Oriveda's stages;
- **33**: references to `CONSTITUTION` did not resolve;
- **9**: `related_documents` links to root-level `*.md` files, which are
  advisory under `ADR-0007`.

Oriveda v0.3.0 (Oriveda `ADR-0004` v0.2.0) adds an optional `validator:` section
to a project's `knowledge/manifest.yaml`. The framework supplies the mechanism
and the project supplies the values. It places no obligations on consuming
projects. The boundary engine stays at 0.2.0 and does not read the section.

## Decision

1. **The submodule moves to `fb521e4` (v0.3.0).** The manifest's `framework:`
   entry, which still read 0.1.0 / `073100c`, now records it.
2. **jwel states its own lifecycle words, from its own definitions:**
   - `Review` → `Architecture Review`. `CONSTITUTION` §6 orders jwel's lifecycle
     Proposal → Draft → Review → Approved → Frozen, and `Review` holds the
     same place as Oriveda's `Architecture Review`.
   - `Accepted` → `Frozen`. An Accepted ADR binds and changes only by addendum
     or supersession (`ADR-0007`, Law 3), as a Frozen spec does.

   No status word changes in any spec. Domain Specifications keep Oriveda's
   own words, because the engine does not read the aliases yet.
3. **The Constitution's path is stated** (`knowledge/constitution/CONSTITUTION.md`).
4. **Root-level `*.md` and `docs/**` are listed as advisory.** This is
   `ADR-0007` stated in a form the validator can read. A link to one of them is
   info. A Frozen spec that `depends_on` one would still be an error.
5. **Honest history for what the alias exposed.** Mapping `Accepted` onto
   `Frozen` brings Frozen's obligations. `ADR-0002`, `ADR-0005` and `ADR-0006`
   were Accepted with empty `reviewers`. Each takes a non-semantic patch
   (1.0.1) adding `reviewers_unrecorded: true`. No names are back-filled.

## Consequences

- The validator reports 0 errors and 0 warnings on 104 specs, with 17 info
  findings that name each alias, the Constitution and every advisory link.
- `oriveda check boundaries --strict`, as CI runs it, is unchanged: 0
  violations, 0 divergences, 0 warnings.
- A new status word in jwel now needs an alias here, or the validator rejects
  it. That is intended: the vocabulary is written down in one place.
- CI does not run the validator yet. Adding it is a separate decision.
- **Still open upstream**, from jwel's first field report: store and message
  ownership in the boundary block, a one-to-one check between contexts and
  specs, dependency modes, and the engine reading `lifecycle_aliases`.
  `common/architecture.spec.ts` keeps covering Law 5 until the first lands.
