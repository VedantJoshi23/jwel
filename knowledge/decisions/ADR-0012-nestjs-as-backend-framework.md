---
id: ADR-0012
title: NestJS as the backend framework
version: 0.1.0
status: Accepted
owner: Architecture
reviewers:
  - Vedant
created: 2026-08-07
updated: 2026-08-07
milestone: M3
category: Decisions
priority: High
depends_on: []
required_by: []
related_documents:
  - ARCH-001
related_decisions: [
  - ADR-0011]
tags:
  - technology
  - backend
risk: Low
complexity: Medium
---

# ADR-0012 — NestJS as the backend framework

> **Retroactively recorded.** This decision was taken during the project's
> pre-Oriveda milestones and never written down. Authored 2026-08-07 under
> `PRM-ARCHITECTURE` / `OV-004`, at the owner's instruction, to close the gap
> Constitution **Law 2** exists to prevent — the project's largest technical
> choices had no recorded reasoning.
>
> **The reasoning below is reconstructed from evidence**, not a contemporaneous
> record. Where the original deliberation is unknown, this document says so
> rather than inventing it.

## Context

The API needed a Node.js framework capable of expressing **bounded contexts as
first-class structural units**, because the Constitution's Architecture
Ambition is a Modular Monolith (§4) and `ARCH-001` §1 defines fourteen contexts
that must remain separable.

`ARCHITECTURE.md` records the contemporaneous reasoning — the one part of this
decision that *was* written down:

> "NestJS's module system maps directly onto DDD bounded contexts, making this
> extraction path low-cost when/if traffic demands it."

## Options Considered

- **NestJS** — opinionated module system, first-class DI, guards/interceptors/
  filters as framework concepts, TypeScript-native. Heavier than the
  alternatives and imposes structure whether or not you want it.
- **Express** — minimal, ubiquitous, no opinion. Every boundary convention
  would have to be invented and enforced by review rather than by the
  framework. For a 22-module monolith maintained largely by one developer, that
  is the failure mode `DISC-006` would have found.
- **Fastify** — faster, lighter, good TypeScript support, but the same
  structural gap as Express: no module system to map contexts onto.

## Decision

**NestJS.** Its module system is the mechanism by which context boundaries are
enforced structurally rather than by convention.

## Consequences

1. **Validated by measurement.** `DISC-006` measured coupling three independent
   ways and found the module boundaries are *real* — 10 of 22 modules import
   nothing from a sibling, 8 own exactly one aggregate cleanly (KC-149,
   KC-153). The structural claim held.
2. **The uniform module shape** (`module`/`controller`/`service`/`dto`/`spec`,
   17 of 22 exact — KC-064) is a direct consequence, and `DISC-001` rated it the
   codebase's most valuable structural property.
3. **Cross-cutting concerns land in framework-native places** — guards,
   interceptors, filters, middleware (KC-166) — rather than in bespoke
   wrappers.
4. **Cost paid**: `strictPropertyInitialization` is disabled to accommodate DI
   (KC-196), and the framework's weight is unjustifiable for a small service.
   Neither matters at this size.
5. **The in-process event bus** (`common/event-bus/`) is a project addition, not
   a NestJS feature, and carries its own constraint (`ARCH-001` §3.1).

## Revisit Criteria

- A context genuinely needs extraction into its own deployable — at which point
  the module boundary is the seam, and this decision is what made that cheap.
- NestJS 10 → 11 is currently one major behind (KC-200); an upgrade is
  maintenance, not a revisit of this decision.

## Cross References

- `ARCH-001` §1, §4 — the boundaries and folder structure this enables.
- `DISC-006` KC-149, KC-153 — the measurement that validated the choice.
- `ARCHITECTURE.md` §1 — the only contemporaneous record of the reasoning.
