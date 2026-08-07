---
id: STD-CODE
title: Jwel / ELYSIAN — Standard: Code
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
  - ADR-0012
tags:
  - standards
  - code
risk: Low
complexity: Low
---

# STD-CODE

## Scope

Language-level and file-level conventions across `apps/api` and `apps/web`.

**Not covered:** HTTP surface design (`STD-API`), schema conventions
(`STD-DATABASE`), test placement (`STD-TESTING`).

## Rules

1. **TypeScript `strict` stays on, in both apps.**
   *Rationale:* Discovery found strict mode enabled with only 4 suppressions and
   11 non-test `any`s across ~10k lines (KC-196, KC-197). That is a low number
   worth protecting; it degrades one exception at a time.

2. **A type suppression (`@ts-ignore`, `@ts-expect-error`, `eslint-disable`)
   carries a comment saying why.** Prefer `@ts-expect-error`, which fails when
   the underlying problem is fixed.
   *Rationale:* Law 2. A suppression without a reason is unremovable, because
   nobody can tell whether it is still needed.

3. **One module per bounded context** (`ARCH-001` §1), with the shape
   `<name>.module.ts` / `<name>.controller.ts` / `<name>.service.ts` / `dto/`.
   *Rationale:* 17 of 22 modules conform exactly (KC-064); `DISC-001` rated this
   the codebase's most valuable structural property.

4. **Deviations from the module shape must be structural, not incidental.**
   Absent controller = not an HTTP surface. Absent DTO = no request body. Extra
   `ports/`+`providers/` = a vendor boundary.
   *Rationale:* All five existing deviations have such a reason (KC-064). A
   deviation with no reason is drift.

5. **`common/` holds cross-cutting concerns only** — never business logic.
   *Rationale:* it is what stops guards, filters and DTO helpers duplicating
   across 22 modules. Business logic there has no owning context, violating
   `ARCH-001` §1.

6. **Web components are organised by feature, not by type.**
   *Rationale:* matches the existing `admin`/`cart`/`product`/`layout` layout;
   type-based grouping scatters a feature across four directories.

7. **Dead code is deleted, not excluded from tooling.**
   *Rationale:* the sharpest finding in `DISC-009` — 145 lines survived because
   a coverage exclusion hid that nothing imported them (KC-199, KC-203).

## Examples

**Compliant** — a suppression that explains itself and self-destructs:

```ts
// Prisma cannot type `Unsupported("tsvector")`; the raw query returns ids only.
// @ts-expect-error - remove when Prisma supports tsvector natively
const ids = await this.prisma.$queryRaw<{ id: string }[]>(...);
```

**Non-compliant** — no reason, and silently permanent:

```ts
// @ts-ignore
const ids = await this.prisma.$queryRaw(...);
```

## Exceptions

Deviation is permitted where a framework requires it — for example
`strictPropertyInitialization: false` in the API, which NestJS dependency
injection makes necessary. Such an exception is recorded in the config file
that sets it, per Law 2.

## Enforcement

- `tsc --noEmit` in CI covers rules 1–2 partially (both apps, already running).
- **Lint is not currently run anywhere** (KC-062, KC-206). `STD-CICD` requires
  adding it; until then rules 2, 5 and 6 are **human review only**.
- Rules 3, 4 and 7 are human review only. No automation proposed — the
  judgement is structural.
