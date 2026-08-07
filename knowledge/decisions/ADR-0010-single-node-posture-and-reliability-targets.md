---
id: ADR-0010
title: Single-node deployment posture and revised reliability targets
version: 0.1.0
status: Accepted
owner: Architecture
reviewers:
  - Vedant
created: 2026-08-06
updated: 2026-08-06
milestone: M1
category: Decisions
priority: High
depends_on: []
required_by: []
related_documents:
  - DISC-007
  - PRODUCT.md
related_decisions:
  - ADR-0002
  - ADR-0007
  - ADR-0008
tags:
  - architecture
  - deployment
  - nfr
  - reliability
risk: Medium
complexity: Medium
---

# ADR-0010 — Single-node deployment posture and revised reliability targets

## Context

`PRODUCT.md` §6 declares ten NFRs, of which 1–8 are stated as non-optional for
MVP. `DISC-007` measured all ten against the built system and found two that
describe a different architecture than the one that exists:

- **NFR-3 Scalability** — *"Horizontally scalable API (NestJS on ECS); cache hot
  catalog/category data in Redis."* The system is a single NestJS process in
  Docker Compose on one VM. There is no ECS, no Redis dependency in either app,
  and no horizontal scaling (KC-074).
- **NFR-2 Availability** — *"99.9% uptime target for storefront and checkout
  path."* That permits roughly 43 minutes of downtime a month. The deployment
  is a single VM with one Postgres container and one API container, no
  replication and no failover, where deploys restart containers (KC-173). It
  may achieve 99.9% in a quiet month; **no mechanism makes it true.**

`DISC-007` also found the real constraint on horizontal scaling, which is not
infrastructure at all: the event bus is explicitly single-process and
fire-and-forget, with no persistence, retry or dead-letter path (KC-165).
Running a second API instance would not be blocked by the absence of ECS — it
would be blocked by the bus.

This is the fourth time Discovery has found the implementation making a better
decision than its specification: gold-rate pricing (KC-071), guest checkout
(KC-125), deployment topology (KC-074), and now reliability targets.

## Decision

**The single-node modular-monolith topology is the intended architecture, and
NFR-2 and NFR-3 are restated to describe it.** The system is not changed to
meet the old targets (KC-174).

### NFR-2 (revised) — Availability

> The storefront and checkout path target **best-effort availability on a
> single node**, with planned downtime acceptable during deploys. No numeric
> uptime percentage is claimed, because no mechanism in the current topology
> can deliver one. Recovery relies on the documented backup and restore
> procedure (`deploy/RUNBOOK.md`) rather than on redundancy.

### NFR-3 (revised) — Scalability

> The API is a **single-process modular monolith** deployed on one host.
> Vertical scaling and the existing Elasticsearch and Postgres tuning paths are
> the intended responses to load. Horizontal scaling is **explicitly out of
> scope** until traffic justifies it, and is understood to require replacing
> the in-process event bus first (KC-165) — not merely adding instances.

### Event-bus durability: deferred with a trigger

Durability (an outbox table, or retry with a dead-letter path) is **not built
now**. It will be built **if and when WhatsApp notifications require it**
(KC-175).

Until then, the preferred mitigation for at-most-once delivery is **making
event effects re-derivable** rather than making the bus durable — the
reconciliation pattern `ADR-0008` establishes for rating aggregates.

**Trigger conditions** — any one is sufficient:

1. WhatsApp/SMS notifications go live and become a primary customer channel
   (`ADR-0003`, KC-102).
2. A second API instance is required for any reason.
3. Evidence of actual event loss in production.

## Consequences

1. **`PRODUCT.md`'s NFR-2 and NFR-3 are superseded.** Per `ADR-0007` the PRD is
   advisory and its body is **not** rewritten; this ADR is where the binding
   version lives.
2. **99.9% must stop being quoted** — to the client, in the runbook, or in any
   customer-facing commitment. Claiming an availability figure no mechanism
   supports is the same class of problem as the storefront promises in
   `DISC-003`.
3. **Horizontal scaling has a known first step**, and it is the event bus. That
   is now recorded so it is not discovered when someone tries to add a second
   instance under load.
4. **Deferral is conditional, not open-ended.** Three named triggers, so this
   does not become an item that silently never happens.
5. **Backup and restore carry the reliability burden** that redundancy would
   otherwise carry, which raises the importance of `deploy/RUNBOOK.md`'s
   restore procedure actually being exercised. **Exercised 2026-08-07** and
   recorded in `RUNBOOK` §11b — it found the dump was not self-sufficient
   (missing role definitions) and that defect is fixed. This ADR's central
   assumption is now evidenced rather than assumed.

## Alternatives Considered

- **Change the system to meet the original NFRs** — move to ECS, add Redis,
  run multiple instances. Rejected: substantial cost and operational
  complexity for a prelaunch store with no traffic, and it would require
  replacing the event bus first. Scaling decisions should follow traffic, not
  precede it.
- **Leave the NFRs unchanged and treat them as aspirational.** Rejected — this
  is exactly what produced the current state, where a requirement declared
  "non-optional for MVP" is quietly unmet and still reads as authoritative.
- **Build event-bus durability now.** Rejected as premature. At current volume
  a lost event is one customer's email; the reconciliation pattern covers the
  correctness-critical cases; and durability is the heavier answer that should
  follow evidence rather than anticipate it.
- **Adopt a lower numeric availability target (e.g. 99%).** Rejected — it would
  be equally unbacked. A target with no mechanism behind it is a guess
  regardless of the number chosen.

## Trade-offs

Dropping a numeric availability target removes a measurable commitment, which
is uncomfortable for a system taking real payments. Accepted because a
measurable commitment nothing can deliver is worse than an honest statement of
posture — and because the alternative, redundancy, is not proportionate to a
prelaunch store's traffic. This should be revisited when real order volume
exists.

## Validation

- No document, runbook or client-facing material quotes a 99.9% availability
  figure.
- Any proposal to run a second API instance references KC-165 and addresses the
  event bus before infrastructure.
- The durability triggers above are checked when WhatsApp notifications land.

## Cross References

- `DISC-007` — the NFR scorecard, KC-163–173, KC-174, KC-175.
- `ADR-0008` — the reconciliation pattern that substitutes for durability.
- `ADR-0003` — WhatsApp/SMS provider selection; trigger 1 fires with it.
- `ADR-0007` — why `PRODUCT.md` is not edited to match this.
- `deploy/RUNBOOK.md` — the restore procedure this decision leans on.
