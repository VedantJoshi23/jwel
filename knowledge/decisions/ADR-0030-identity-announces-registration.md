---
id: ADR-0030
title: Identity Announces Registration; Recommendation Claims Guest Views by Reacting
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
  - DOM-IDENTITY
  - DOM-RECOMMENDATION
required_by:
  - FEAT-GUEST-VIEW-CLAIM
related_documents:
  - FEAT-GUEST-VIEW-CLAIM
related_decisions:
  - ADR-0008
related_domains: []
related_features: []
tags:
  - decision
  - identity
  - recommendation
  - boundaries
risk: High
complexity: Low
---

# ADR-0030 — Identity Announces Registration; Recommendation Reacts

*Decided by the Principal Engineer under authority delegated by the owner (Vedant) on 2026-10-28. Vedant is listed as reviewer on that basis; he did not review this text himself.*

## Context

`FEAT-GUEST-VIEW-CLAIM` (2026-08-09, status Review) built
`DOM-RECOMMENDATION` Invariant 9 by having `AuthService` call
`RecommendationsService.claimGuestViews` — "Identity → Recommendation, by
command". The feature spec declared that dependency; **`DOM-IDENTITY` was never
amended**. Its Frozen §7 allows audit log and metrics only — *"Identity is the
system's most depended-upon context and must remain its least dependent"* — and
its §5 says a reaction to user creation *"would be a new event and a new
decision"*. `DOM-IDENTITY` v1.1.0 (2026-08-14) was even revised after the
feature shipped and still asserts *"Law 5 — no cross-context access at all"*.

Law 5 itself was never broken: a command to the owning context is the
sanctioned shape. What was broken is a Frozen spec, silently — Law 3. Found by
the Oriveda boundary review (`oriveda check boundaries`, 2026-10-28).

Two Frozen specs now disagree: `DOM-RECOMMENDATION` Invariant 9 says
*"Identity commands Recommendation"*, `DOM-IDENTITY` §7 forbids it.

## Decision

**Invert the dependency. Identity publishes `user.registered`
(`{ userId, anonymousId? }`); Recommendation subscribes and claims.**

1. Identity emits on every path that creates a `users` row — password
   registration (with the client's `anonymousId` when sent) and first-time
   OAuth sign-up (without one). The event's name is then true wherever it is
   emitted.
2. Recommendation's listener claims only when `anonymousId` is present. The
   24-hour bound and the XOR write are unchanged.
3. `AuthModule` no longer imports `RecommendationsModule`. Identity keeps
   §7 exactly as Frozen.

**Why the bus is acceptable here when `ADR-0008` refused it for ratings.**
`ARCH-001` §3.1: correctness-critical work does not go on the at-most-once bus.
This is not correctness-critical — `FEAT-GUEST-VIEW-CLAIM` §4 already decided a
failed claim is caught, logged and absorbed. A lost event costs exactly what a
failed command already cost. The bus also never propagates a handler failure
to the emitter, which is §4's guarantee for free.

## Consequences

- Identity's module no longer transitively loads Recommendation → Settings →
  Storage. The auth path boots and fails independently of them.
- The claim becomes asynchronous to the HTTP response. The handler starts
  synchronously inside `emit` (Node `EventEmitter`), so the write is normally
  committed before the client's next request; a request racing it would see
  pre-claim recommendations once. Accepted — personalisation, not correctness.
- `user.registered` is Identity's first event. A future welcome message
  (`DOM-IDENTITY` §5's own example) or a login-time claim (`FEAT-GUEST-VIEW-CLAIM`
  §8) subscribes to it rather than adding an outbound dependency to Identity.
- The payload is the one place a guest id and a user id travel together before
  Recommendation consumes them. It must not be logged (`DOM-RECOMMENDATION`
  Invariant 3); `events.ts` says so beside the type.

## Required Updates (applied 2026-10-28)

Frozen specs revise through their lifecycle with a version bump
(Oriveda `ADR-0005` rule 1). The Constitution-grade "ADR + remediation" bar does
not apply to a `DOM-` spec; this ADR is written because `DOM-IDENTITY` §5 itself
calls a new Identity event "a new decision".

- **`DOM-IDENTITY` → v1.2.0.** §5 becomes:
  > **Publishes** — `user.registered` (`{ userId, anonymousId? }`), once a
  > `users` row is created, by password registration or first-time OAuth
  > sign-up (`ADR-0030`). **Consumes** — none.
  >
  > The event exists so other contexts can react to a new account without
  > Identity depending on them (§7).

  §7 unchanged. Constitution-compliance line: "Law 5 — no cross-context access;
  publishes one event of its own."
- **`DOM-RECOMMENDATION` → v1.3.0.** Invariant 9: replace *"Identity commands
  Recommendation"* with *"Recommendation claims on Identity's `user.registered`
  (`ADR-0030`)"*. §5 Consumes gains `user.registered`, from Identity.
- **`ARCH-001` → v1.5.0, Amendment A5** (shared with `ADR-0031` and
  `ADR-0032`). §3 table gains `user.registered | Identity | Recommendation`.

## Remediation

Code changed in the same branch, after the spec revisions above:
`common/event-bus/events.ts`, `modules/auth/auth.{service,module}.ts`,
`modules/recommendations/recommendations.service.ts`, and their specs.
`FEAT-GUEST-VIEW-CLAIM` revised to v0.2.0 (still Review). After deploy, the
feature's §7 live table is re-run.

## Alternatives Considered

- **Amend `DOM-IDENTITY` §7 to allow Recommendation (command).** Cheaper — one
  Frozen line. Rejected: it relaxes the one dependency rule `DOM-IDENTITY`
  states a reason for, to carry a best-effort side effect. Every future
  "on sign-up, also…" would arrive as another outbound dependency.
- **Recommendation claims lazily on the first authenticated request carrying
  an `anonymousId`.** No event, no dependency. Rejected: it widens the claim
  beyond registration, which `FEAT-GUEST-VIEW-CLAIM` §8 deliberately refused.

## Revisit Criteria

- The bus becomes durable (`ADR-0010` triggers) — no change needed, but the
  race in Consequences disappears.
- A consumer of `user.registered` turns out to be correctness-critical — it
  must not rely on this event; it gets a command and a new decision.
