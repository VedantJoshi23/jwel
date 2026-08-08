---
id: FEAT-CLAIMS-GATE
title: 'Jwel / ELYSIAN — Feature: The Storefront Claims Gate'
version: 0.1.0
status: Review
owner: Architecture
reviewers:
  - Vedant
created: 2026-08-08
updated: 2026-08-08
milestone: M6
category: Features
priority: Critical
depends_on:
  - CONSTITUTION
  - DISC-008
required_by: []
related_documents:
  - DISC-003
  - DISC-010
  - STD-SEO
  - STD-CICD
related_domains:
  - DOM-CONTENT
related_decisions: []
tags:
  - feature
  - content
  - law-1
risk: High
complexity: Low
---

# FEAT-CLAIMS-GATE

## 1. Overview

Constitution **Law 1**: *a surface may not assert a capability the system does
not have.* `DISC-008` found ten violations of it in customer-facing copy and
recorded them in `deploy/RUNBOOK.md` step 0, which gates going live.

**The gate was a prose table, and it had already rotted.** It listed
"Customisation available" twice, was dated 2026-08-06, and still described the
return window as unenforced after `FEAT-SETTINGS-STORE` had built and enforced
it. Nobody noticed, because nothing was checking.

That is the failure Law 1 is about, reappearing one level up: a document
asserting a state of the world it could not verify.

This feature makes the gate executable.

## 2. Owning Domain

**Owning domain: `DOM-CONTENT`** — storefront copy is its subject, even though
`ARCH-001` §1.1 scopes the *module* to banners and scheduling. The claims here
live in `brand.ts` and page files rather than the database, which is precisely
why they escaped review: no module owns a `.tsx` string.

**No dependencies.** The registry reads source files at test time. It calls
nothing and is called by nothing at runtime — it must not become a lookup the
storefront consults, which would make unbacked copy a supported feature rather
than a defect being tracked out of existence.

## 3. Acceptance Criteria

1. Every known claim is recorded once, with **where it appears, what the system
   actually does, and what would fix it**.
2. The registry cannot drift from the copy **in either direction**:
   - a claim marked outstanding whose text has gone → the copy was fixed and
     the registry was not;
   - a claim marked resolved whose text returns → a regression.
3. A single command reports the outstanding claims.
4. The same command, with `--strict`, **exits non-zero** while any remain, so
   it can gate the change that removes the demo banner.
5. Claims that cannot be fixed by building anything are marked as such.
6. `RUNBOOK` step 0 runs the command instead of restating the table.

### Why both directions matter

The obvious check is "has this false claim been removed yet". The reverse is
the one that keeps the registry alive: when someone corrects copy without
touching the registry, the test fails and asks them to mark it resolved. A
registry that only ever grows is a registry nobody trusts.

## 4. API Surface

**None.** `pnpm claims:audit [--strict]`. Not an endpoint, and deliberately not
readable at runtime — see §2.

## 5. Events / 6. Data Changes

**None, and none.**

## 7. Edge Cases & Validations

1. **A claim appearing in several files.** Recorded once with every location;
   present in *any* of them counts as present.
2. **A pattern too loose to prove anything.** Patterns are distinctive
   fragments of the real sentence, not keywords. `/returns/` would match half
   the site and pass forever.
3. **An empty registry.** Would make every other test vacuously pass, so a
   test asserts it is populated.
4. **A claim no build can fix.** COD is ruled out; tarnish resistance is a
   product claim only the client can stand behind. Recorded with deletion or
   sign-off as the resolution, so they are never mistaken for backlog.
5. **A claim whose copy is coupled to a runtime setting.** The return window is
   now backed, but the page says "10 days" as static text while
   `returns.window_days` is editable. An admin changing the setting makes the
   copy wrong again. Recorded on the claim itself — the alternative, rendering
   the number from the setting, is the real fix and is not built.
6. **Renaming a source file.** The test asserts every path in the registry
   exists, so a move breaks loudly rather than silently disabling a check.

## 8. Non-Functional Considerations

| Standard | Bearing |
| --- | --- |
| **`STD-SEO`** | Rule 7 names `RUNBOOK` step 0 as the content review gate. This is that gate, now enforceable. |
| **`STD-CICD`** | Rule 7 requires going live to run the checklist from step 0. The sync test runs in CI on every push; `--strict` is the deliberate launch step. |
| **`STD-TESTING`** | The registry is data and the checks are structural — the same shape as `architecture.spec.ts`, for the same reason: the next violation will be new copy, and only reading the source catches it. |

**Law 1 check.** This feature *is* Law 1's enforcement mechanism for the
storefront, in the same way `architecture.spec.ts` is Law 5's for the modules.

## 9. Definition of Done

- [x] Registry of 12 claims with reality and resolution for each.
- [x] Bidirectional sync test against the real source files (18 tests).
- [x] `pnpm claims:audit`, and `--strict` exiting 1 while any remain
      (verified: exit 1, 11 outstanding).
- [x] One claim actually resolved: the return window, corrected 7 → 10 days
      and now backed by an enforced rule.
- [x] `RUNBOOK` step 0 runs the command; the stale table is gone.
- [x] `RUNBOOK` step 0b records the Metabase revenue-definition revisit.

## 10. State at the time of writing

**12 tracked · 1 resolved · 11 outstanding.**

The one resolved is the return window. The other eleven are not this feature's
to fix — most need a client decision (what *is* the free-shipping threshold?),
two are blocked on unbuilt features (shipping, WhatsApp), one needs a
storefront UI (self-serve returns), and two can only be deleted or signed off.

**That distribution is the finding.** It is not a backlog of engineering work;
it is a list of promises nobody has decided to keep or withdraw. The gate's
value is that going live now requires someone to make each of those decisions
explicitly, rather than shipping them by default.
