---
id: STD-CICD
title: Jwel / ELYSIAN — Standard: CI/CD
version: 1.0.0
status: Frozen
owner: Architecture
reviewers:
  - Vedant
created: 2026-08-07
updated: 2026-08-07
milestone: M4
category: Standards
priority: High
depends_on:
  - CONSTITUTION
  - STD-000
required_by: []
related_decisions:
  - ADR-0017
tags:
  - standards
  - cicd
risk: Medium
complexity: Medium
---

# STD-CICD

## Scope

What continuous integration must verify, and how deployment proceeds.

**Not covered:** coverage thresholds (`STD-TESTING`), runtime monitoring
(`STD-OBSERVABILITY`).

## Rules

1. **CI runs on every pull request**, and blocks merge on failure.
   *Rationale:* existing behaviour; four jobs, all green on the most recent run
   (KC-059).

2. **CI verifies, at minimum:** backend unit + integration tests against a real
   Postgres, frontend unit tests, typecheck of both apps, end-to-end tests
   against a real stack, **and lint**.
   *Rationale:* the first four exist. **Lint runs nowhere** (KC-062, KC-206)
   despite both apps defining it — this rule is what closes that.

3. **A declared command does something.** A script or task that silently no-ops
   is removed or implemented. **This is Constitution Law 1 applied to tooling.**
   *Rationale:* KC-061 — `turbo run typecheck` executes nothing, because
   neither app defines the script. A developer running the documented command
   gets passing silence instead of a check.

4. **One package manager, one lockfile.**
   *Rationale:* KC-063 — `package-lock.json` and `pnpm-lock.yaml` are both
   committed while `package.json` declares pnpm and CI installs with npm. The
   tree CI validates is not necessarily the one a `pnpm install` produces.

5. **CI failures are diagnosable from artifacts.** Playwright reports, traces
   and the API log upload on failure.
   *Rationale:* existing behaviour, and the workflow records why: an earlier
   run failed and produced no artifact at all.

6. **Deployment is reproducible from the repository** — compose files, edge
   config and runbooks in `deploy/`, never ad hoc host changes.
   *Rationale:* `ADR-0017`, KC-164.

7. **Going live runs `RUNBOOK` "Going live" from step 0.** Step 0 is the
   content review — no customer-facing claim ships that the system cannot
   honour.
   *Rationale:* Constitution Law 1. Ten such claims are currently outstanding.

## Examples

**Compliant** — the task exists in both workspaces, so `turbo run typecheck`
does something:

```jsonc
// apps/api/package.json and apps/web/package.json
"scripts": { "typecheck": "tsc --noEmit" }
```

**Non-compliant** — declared centrally, implemented nowhere:

```jsonc
// turbo.json declares the task; no app defines the script
"tasks": { "typecheck": {} }     // "No tasks were executed as part of this run."
```

## Exceptions

CI may use a different package manager from the one `package.json` declares
**only while that choice is documented in the workflow** — as it currently is,
with the reason stated. Rule 4 removes the need for this exception once
resolved.

## Enforcement

- Rules 1, 2, 5: **CI configuration** itself.
- Rule 3: human review, and cheaply testable — run each declared command and
  confirm it does something.
- Rule 4: repository review.
- Rules 6, 7: **checklist** — `deploy/GO-LIVE.md` and `deploy/RUNBOOK.md` §13.
