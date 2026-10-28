---
id: ADR-0033
title: Adopt Oriveda 073100c — Progressive Rigor, the Divergence Log, the Manifest and the Engine
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
  - ADR-0007
required_by: []
related_documents:
  - ARCH-001
related_domains: []
related_features: []
related_decisions:
  - ADR-0034
tags:
  - decision
  - oriveda
  - governance
risk: High
complexity: Medium
---

# ADR-0033 — Adopt Oriveda 073100c

*Decided by the Principal Engineer under authority delegated by the owner (Vedant) on 2026-10-28. Vedant is listed as reviewer on that basis; he did not review this text himself.*

## Context

The `.oriveda-framework` submodule moved from `32d64a5` to `073100c`. That
range adds Oriveda's progressive-rigor ADR (rigor tiers, the authority rule by
spec state, the divergence log, the release checkpoint), its project-prefix and
target-validation ADR (`scripts/validate.py --root`, which needs
`knowledge/manifest.yaml`), and engine v0.1.0 (`oriveda check boundaries`).

The engine's first run against jwel was useful straight away. It found a
Frozen-spec violation (Identity → Recommendation), shared-service policy gaps,
and Shipping undeclared in `ARCH-001`. Those are decided in their own ADRs,
which follow this one.

## Decision

**Adopt `073100c`.** From this commit on:

1. **The authority rule and the divergence log bind.** The log is
   `knowledge/decisions/DIVERGENCE-LOG.md`. A spec with an `open` entry
   cannot be Frozen.
2. **Rigor tiers bind, from adoption forward.** Shipping Phases 0–1 shipped
   before this rule bound jwel and are not retro-flagged. What it requires
   now: `DOM-SHIPPING` (`risk: High`) is Frozen before Phase 2 code and before
   any production release that ships Shipping behaviour.
3. **`knowledge/manifest.yaml` lists every spec.** Edit the entry in the same
   change that edits a spec's frontmatter.
4. **The validator is run, but it is not a gate yet.** Its residual errors are
   framework/project vocabulary clashes, listed below. jwel fixed every defect
   that was its own. It does not rename Frozen documents or change the
   Constitution's lifecycle words to satisfy a tool.
5. **`oriveda check boundaries` is evidence for dependency direction only.**
   Law 5's write and emit vectors go through shared infrastructure, which an
   import graph cannot attribute.
   *Addendum 2026-10-28:* at adoption no `DOM-*` spec carried an
   `oriveda-boundary` block, so the engine ran only in a sandbox. Blocks are
   now in every context's §7 and the engine runs in CI (`ADR-0034`).

### Frontmatter normalisation, applied with this ADR

Metadata only. No body changes and no version bumps, except as noted.

- 18 titles containing `: ` were quoted. They were invalid YAML, so every
  YAML tool, not only this validator, read those specs as having no
  frontmatter.
- A broken flow sequence in `ADR-0012` was fixed.
- Absent template fields (`related_domains`, `related_features`,
  `related_documents`, `related_decisions`) were added as `[]`.
- `risk`/`complexity` were set where they were missing:
  - `FEAT-PRODUCT-QA`: Medium / Medium.
  - `FEAT-ADMIN-REVIEW-MODERATION`: Medium / Low.
  - `FEAT-PENDING-REVIEW-VISIBILITY`: Low / Low.
- `reviewers` on `DOM-NOTIFICATION` and `STD-OBSERVABILITY` is **left empty**.
  Both were Frozen with `reviewers: []`, and nothing records a review. The
  normalisation commit had back-filled `Vedant`; that was reverted on
  2026-10-28 because it rewrote who approved a Frozen spec (Law 3).
- `DOM-PRODUCT-QA` and `FEAT-PRODUCT-QA` went from 0.1.0 to 1.0.0. They were
  frozen at 0.1.0 in `298a8ef`, against the 1.0.0-at-freeze convention every
  other Frozen spec follows. There is no content change.
- `CONSTITUTION.md` is untouched. Amending it needs an ADR and a remediation
  statement (Constitution §6), and missing empty list fields don't justify that.

### Residual validator errors (accepted, reported upstream)

Run 2026-10-28: 98 specs checked, **104 errors, 0 warnings**, every one in a class
below. Before normalisation there were 356.

| Class | Count | Why jwel keeps it |
| --- | --- | --- |
| Status `Review` | 24 | jwel's lifecycle (Constitution §6) names the stage `Review`. Oriveda's is `Architecture Review`. Same stage, different word. Renaming would edit the Constitution's text. |
| Status `Accepted` on ADRs | 26 | jwel's ADR convention since `ADR-0001`. Oriveda's own ADRs use `Frozen`. |
| `CONSTITUTION` referenced but "does not exist" | 32 | The validator discovers files by filename prefix. `CONSTITUTION.md` matches no prefix, so the file is never scanned. |
| id pattern mismatch (`ARCH-001`, `DISC-001`…`010`, `STD-000`, `FEAT-PAYMENT-E2E`) | 13 | The taxonomy patterns `[A-Z-]+` reject digits. A project's taxonomy cannot override a framework entry. |
| `related_documents` naming advisory root docs (`PRODUCT.md`, `DESIGN`, …) | 9 | These are deliberate pointers to `ADR-0007`'s advisory layer, which has no ids. |
| Frozen with empty `reviewers` (`DOM-NOTIFICATION`, `STD-OBSERVABILITY`) | 2 | Frozen before reviewers were recorded; not back-filled. Inventing a reviewer would rewrite a decision record. *Class added 2026-10-28.* |

## Consequences

- Every spec now parses as YAML. The manifest gives a single list of spec,
  status and version.
- The validator's output is noisy until upstream resolves the five classes
  above. Until then, a *new* error class, or a count rising within a class,
  is the signal to look at.

## Revisit Criteria

- Upstream accepts lifecycle aliases, manifest-driven discovery, or digit-
  tolerant patterns → re-run and drop the matching row. When the table is
  empty, the validator becomes a CI gate.
