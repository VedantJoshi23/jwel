---
id: ADR-0034
title: Boundary Blocks Are the Checkable Subset of §7; the Engine Runs in CI
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
  - ARCH-001
  - ADR-0031
  - ADR-0033
required_by: []
related_documents:
  - ARCH-001
related_domains:
  - DOM-IDENTITY
  - DOM-CATALOG
  - DOM-SEARCH
  - DOM-SHOPPING
  - DOM-PRICING
  - DOM-ORDERING
  - DOM-PAYMENTS
  - DOM-INVENTORY
  - DOM-RETURNS
  - DOM-REVIEWS
  - DOM-PRODUCT-QA
  - DOM-RECOMMENDATION
  - DOM-CONTENT
  - DOM-NOTIFICATION
  - DOM-REPORTING
  - DOM-SHIPPING
  - DOM-RISK
related_features: []
related_decisions:
  - ADR-0030
  - ADR-0031
  - ADR-0032
  - ADR-0033
tags:
  - decision
  - architecture
  - boundaries
  - ci
risk: High
complexity: Medium
---

# ADR-0034 — Boundary Blocks Are the Checkable Subset of §7; the Engine Runs in CI

*Decided by the Principal Engineer under authority delegated by the owner (Vedant) on 2026-10-28. Vedant is listed as reviewer on that basis; he did not review this text himself. The owner decided that blocks are added and the engine runs in CI; this ADR records how.*

## Context

The owner decided to put an `oriveda-boundary` block in every `DOM-*` §7 and to
run `oriveda check boundaries` in CI.

Oriveda `ADR-0006` rule 4 says the block and the prose must not disagree, or the
spec "is internally inconsistent and cannot be Frozen". jwel's §7 prose says
more than a block can express:

- **read versus command:** "Pricing & Promotion (command/read)", "Identity
  (read)";
- **table-write prohibitions:** "writing `inventory_items`, `coupons`…".

Read as *equivalence*, rule 4 would forbid freezing any jwel spec with a block.
The jwel field report sent upstream raises exactly this as #13, and its option
(b) is the reading adopted here.

## Decision

1. **The block is the checkable subset of §7, not its equal.** It must be
   *consistent with* the prose, in both directions:
   - it never allows a context the prose forbids in every mode;
   - it never forbids a context the prose allows in any mode.

   The prose stays authoritative for everything the block cannot express:
   read versus command, write prohibitions and emission rules.
2. **How a block is derived from its §7.**
   - `allowed_dependencies` lists every context the prose allows in *any*
     mode.
   - `forbidden_dependencies` lists every context the Forbidden prose names
     explicitly, if no mode allows it.
   - A context allowed in one mode and forbidden in another goes in `allowed`
     only. Example: Inventory may read Catalog but may not write its tables.
     The engine then permits the import, and the mode restriction remains the
     prose's.
   - Contexts the prose names in neither list are omitted. The engine still
     reports any import of them, because the allowed list is closed.
3. **Event consumption is not a §7 dependency.** jwel records it in §5
   (*Consumes*), and it creates no import edge: payload types live in
   `common/event-bus`. A consumer's block therefore does not list the
   producer. Example: Recommendation consumes Identity's `user.registered`.
4. **Shared services and entrypoints are deliberately unowned.** No block, and
   no pseudo-domain, covers:
   - `audit-log`, `metrics`, `storage`, `uploads`, `settings`, `health`;
   - `common/`, `prisma/`, `app.module.ts`, `main.ts`;
   - the operational scripts.

   The engine skips edges into or out of unowned files. That is the same thing
   as `ADR-0031` rule 1 (shared services implicitly allowed) and rule 3
   (entrypoints belong to no context). `ARCH-001` §1.2 says these are not
   domains, and a pseudo-domain spec would claim otherwise.
   - **Spec files need no special handling.** `common/validation/address.spec.ts`
     drops out on its own because `common/` is unowned.
5. **Paths come from `ARCH-001` §1.5** (Amendment A6), the single module map.
   `common/architecture.spec.ts`'s map must equal it, and so must the union of
   all block `paths`. The test reads all three and fails on drift.
6. **Known blind spot, and its cover.** A new module directory outside every
   block's `paths` is invisible to the engine. It is unowned, so it is
   unchecked. `common/architecture.spec.ts` covers this: "assigns every module
   directory to a context or shared" fails on any unmapped directory, and the
   three-way sync test then requires a block path for it.
7. **Law 5 evidence stays with `common/architecture.spec.ts`** (`ADR-0031`
   rule 5). The engine checks dependency direction; it cannot see a table
   write through `PrismaService` or an emit through `EventBusService`.
8. **`DOM-RISK` gets no block.** It is not a context in `ARCH-001` §1.1,
   fraud scoring was closed as not-required (KC-110), and it has no code. A
   block would declare to the engine a boundary the architecture does not
   have. A path that matches no file would pass every run, so it would be a
   claim nobody ever checks. If Risk is ever
   declared a context, its block arrives with that amendment.
9. **CI runs the engine with `--strict`** on every push to `main` and every
   PR. It checks out with submodules, builds a fresh Graphify graph in
   code-only mode, and runs the check. A `Frozen` spec's violation already
   fails without `--strict`. `--strict` also fails on divergences against
   `DOM-SHIPPING` (Draft), which is right: an unlogged divergence is a defect
   (Oriveda `ADR-0005` rule 4).
   - **Staleness check off:** with `--no-cluster`, Graphify writes no
     `built_at_commit` (upstream item #2), so the engine's staleness check
     reports "unknown". That is acceptable here because CI builds the graph
     from the checked-out commit in the same job.
   - **No committed graphs:** `graphify-out/` is gitignored.

## Consequences

- Fifteen Frozen `DOM-*` specs take a minor version bump and stay Frozen.
  `DOM-SHIPPING` moves to 0.4.0 and stays Draft.
- With the merged code at `cbbc76d` plus this change: 0 violations, 0
  divergences.
- Any new import between contexts that §7 does not allow now fails CI, even
  before review.
- The read/command distinction is still enforced only by review and the prose.
  If upstream adopts the field report's option (a) (a dependency *mode* in the
  block), jwel's blocks gain modes then.

## Revisit Criteria

- Upstream amends `ADR-0006` rule 4 to the "consistent with" reading → cite
  it here and drop the local interpretation.
- Upstream adds dependency modes or store/message ownership to the block →
  extend the blocks and retire the matching prose-only rules.
- Graphify writes `built_at_commit` without clustering → nothing to change in
  CI, but the "unknown" staleness line disappears.
