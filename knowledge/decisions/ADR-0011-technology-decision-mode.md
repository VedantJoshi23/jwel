---
id: ADR-0011
title: Technology decisions are made in Hybrid mode
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
related_decisions: []
tags:
  - governance
  - technology
risk: Low
complexity: Low
---

# ADR-0011 — Technology decisions are made in Hybrid mode

## Context

`OV-004` requires the target project's owner to answer one question before any
technology is chosen: **how much autonomy does the agent have over the stack?**
It is the fourth owner-choice question, alongside the Constitution's three, and
for the same reason — it is not inferable from evidence.

This project is brownfield: NestJS, Next.js, PostgreSQL, Prisma, Elasticsearch
and self-hosted Docker Compose were all chosen before Oriveda adoption. The
question therefore governs **future** choices, and the replacement or addition
of any layer.

## Decision

**Hybrid.** For each layer needing a technology decision, the agent compares
2–3 production-grade options with real trade-offs, recommends one, and **waits
for owner approval** before proceeding.

*Owner choice, 2026-08-07.*

**Constraint preferences**, per `OV-004`'s default set and adopted here: prefer
free/open-source, well-maintained, industry-standard technologies with active
communities; avoid vendor lock-in where practical; prefer self-hostable options
where mature. The existing stack already reflects all three.

## Consequences

1. **No technology enters the stack without a recorded comparison.** This is
   the mechanism that keeps `ADR-0012`–`ADR-0017` from being the last technology
   ADRs this project writes.
2. **It composes with the Constitution.** Enterprise-grade rigor (§2) already
   requires an ADR for contested or expensive-to-reverse decisions; the
   Principal Engineer contract (§3) already requires recommending rather than
   surveying. Hybrid is those two applied to technology selection.
3. **Approval is a gate, not a formality.** "Recommends one and waits" means
   work does not begin against an unapproved choice.
4. **Swapping a layer reopens its ADR** rather than being done silently — a
   Law 3 obligation.

## Alternatives Considered

- **Full autonomy** — agent chooses and justifies after the fact. Rejected:
  weaker fit with Enterprise-grade rigor, which expects contested decisions
  recorded before they harden into the codebase.
- **Partial autonomy** — owner names some layers, agent picks the rest.
  Rejected as under-specified: it requires knowing in advance which layers the
  owner cares about, which is itself the question.
- **Fixed stack** — owner supplies everything. Rejected: effectively freezes
  the status quo and gives the agent no way to surface a better option.

## Revisit Criteria

- The owner wants less friction on routine choices (e.g. a lint plugin does not
  warrant a comparison) — the fix is to scope Hybrid to *significant* layers
  rather than to abandon it.
- A layer must be chosen under time pressure with no room for approval.

## Cross References

- `OV-004` §1 — the stack-freedom question and its four options.
- `CONSTITUTION` §2 (rigor), §3 (AI collaboration contract).
- `ADR-0012`–`ADR-0017` — the six retroactive stack decisions this mode governs
  from here.
