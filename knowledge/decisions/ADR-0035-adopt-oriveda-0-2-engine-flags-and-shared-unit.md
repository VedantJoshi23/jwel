---
id: ADR-0035
title: Adopt Oriveda v0.2.0 (8ed8df1) — Engine Flags, the Shared Unit, Adoption Entries
version: 0.1.0
status: Accepted
owner: Architecture
reviewers:
  - Vedant
created: 2026-10-28
updated: 2026-10-28
milestone: M8
category: Decisions
priority: High
depends_on:
  - ADR-0031
  - ADR-0033
  - ADR-0034
required_by: []
related_documents:
  - ARCH-001
  - DIVERGENCE-LOG
related_domains:
  - DOM-SHIPPING
  - DOM-NOTIFICATION
related_features:
  - FEAT-SHIPPING
related_decisions:
  - ADR-0031
  - ADR-0033
  - ADR-0034
tags:
  - decision
  - oriveda
  - governance
  - ci
risk: High
complexity: Medium
---

# ADR-0035 — Adopt Oriveda v0.2.0 (8ed8df1)

*Decided by the Principal Engineer under authority delegated by the owner (Vedant) on 2026-10-28. Vedant is listed as reviewer on that basis; he did not review this text himself.*

## Context

Oriveda v0.2.0 answers jwel's field report. It brings:

- engine 0.2.0: coverage reporting; warnings that fail `--strict`;
  `kind: shared`; and the `--exclude`, `--units` and `--type-only` flags;
- Oriveda `ADR-0007`: adoption entries, non-semantic revisions,
  `reviewers_unrecorded`, and a Due column in the divergence log;
- `ADR-0006` v1.1.0: rule 4 now reads "consistent, checkable subset", as
  jwel's `ADR-0034` had read it locally.

The changelog lists the obligations for consuming projects. This ADR is jwel's
answer to each one.

## Decision

1. **CI builds the graph with clustering.** `graphify update .` replaces
   `graphify update . --no-cluster`.
   - Engine 0.2.0 warns when a graph records no build commit, and a warning
     fails `--strict`. `--no-cluster` writes none.
   - Clustering is local and makes no LLM calls; it records
     `built_at_commit`, so the staleness check is now on.
   - `--strict` stays.
2. **The divergence log gains a Due column.** The upgrade change also adds
   two adoption entries:
   - `DIV-004`: `DOM-SHIPPING` is Draft while Phases 0–1 are live;
   - `DIV-005`: `FEAT-SHIPPING` is Proposal while Phases 0–1 are live.

   Both are `risk: High`, so both breach Oriveda `ADR-0005` rules 2 and 5.
   **Due 2026-12-15.** The log's notes give the reasons and the single
   permitted extension. The date can be met without the client, by freezing
   at the built scope.

   **No known Frozen-spec violations need an adoption entry.** The engine
   run is clean, and `common/architecture.spec.ts` (Law 5 writes, emits and
   imports) passes.
3. **Honest history.** `DOM-NOTIFICATION` 1.1.1 and `STD-OBSERVABILITY` 1.0.1
   set `reviewers_unrecorded: true`, as a non-semantic patch.
4. **Shared services become one `kind: shared` block, in `ARCH-001` §1.2.**
   - **Not in `knowledge/domains/`.** A `DOM-` file for shared services would
     assert they are domains, which §1.2 denies. The engine reads any file
     under `--specs` that carries a block, and only `DOM-` ids are expected to
     have one. So CI runs with `--specs knowledge`, and the block lives in
     the document that defines the shared set.
   - **The unit is called `SHARED`, not `DOM-*`.** Its paths are §1.5's
     `shared` modules plus `common/`.
   - **ARCH-001 goes to 1.6.1**, non-semantic. The block restates §1.2's
     existing rule.
   - **This revises `ADR-0034` rule 4** ("deliberately unowned, no
     pseudo-domain"). That rule chose the only option engine 0.1.0 offered.
     `kind: shared` states the rule directly. It is not a pseudo-domain:
     the engine treats it as a unit with no dependency lists.
   - **Accepted duplication.** The engine now also enforces "shared depends
     on no context", which `architecture.spec.ts` already enforces.
     Duplication across two independent tools costs one path list, and the
     sync test keeps that list equal to §1.5.
5. **`--units 'apps/api/src/modules/*'`.** Every module directory now belongs
   to a block, so the engine names any new, unowned module. That closes
   `ADR-0034` rule 6's blind spot inside the engine as well.
6. **`--exclude` takes exactly the files `ADR-0031` already keeps out of
   boundary checks, and nothing else:**
   - entrypoints (rule 3): `apps/api/src/app.module.ts`,
     `apps/api/src/main.ts`, `apps/api/src/prisma/seed*.ts`,
     `apps/api/src/prisma/normalise-*.ts`, `apps/api/scripts/**`;
   - tests (rule 4): `**/*.spec.ts`, `apps/api/test/**`;
   - not jwel's architecture: `.oriveda-framework/**` (upstream's code) and
     `apps/web/**`. The storefront has no bounded-context model in
     `ARCH-001`; `ARCH-001` §4 organises it by feature.

   **Five platform files stay unowned and are reported, not hidden:**
   `prisma/prisma.{module,service}.ts`, `config/env.validation.ts`,
   `instrument.ts` and `prisma/size-options.data.ts`. They are neither
   contexts nor in §1.2's shared list. Classifying them would be a semantic
   change to §1.2, and nothing needs it yet.
7. **`--type-only count`**, stated explicitly in CI. A type-only import still
   couples one context to another's model, and §7 makes no type/value
   distinction. Both settings exit 0 today, so this is policy, not a
   workaround.
8. **The ADR-0033 validator classes, after the upgrade.**
   - The id-pattern class is gone: upstream patterns accept digits.
   - The `reviewers` class is gone (decision 3).
   - **The remaining three classes are upstream-pending, not jwel choices:**
     - lifecycle aliases (`Review`, `Accepted`);
     - discovery of `CONSTITUTION.md`;
     - advisory reference paths.

     All three are on v0.2.0's "Not yet addressed" list. jwel will not rename
     anything to clear them.
9. **ADR-0034's minor bumps stand.** Oriveda `ADR-0007` rule 3 would class
   adding a consistent block as non-semantic (a patch). ADR-0034 predates the
   rule and bumped minors. Version numbers only ever go up, so nothing is
   rewritten; blocks added from now on take a patch bump.

## Consequences

- CI: `--strict` with 0 warnings, and the Coverage block printed in every
  run's log.
- `DIV-004`/`DIV-005` become validator errors on 2026-12-16 if still open.
  This is the intended pressure.
- A new module directory is caught three ways: `architecture.spec.ts`, the
  sync test, and the engine's unit report.

## Revisit Criteria

- Upstream ships lifecycle aliases, manifest discovery or advisory paths →
  drop the matching residual class.
- Upstream ships store/message ownership in the block → move Law 5 writes and
  emits from `architecture.spec.ts` into the blocks.
- One of the five unowned platform files gains a context import → classify it.
