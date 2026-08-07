---
id: CONSTITUTION
title: Jwel / ELYSIAN — Engineering Constitution
version: 1.0.0
status: Frozen
owner: Architecture
reviewers:
  - Vedant
created: 2026-08-07
updated: 2026-08-07
milestone: M2
category: Constitution
priority: Critical
depends_on:
  - DISC-010
required_by: []
related_documents:
  - DISC-001
  - DISC-002
  - DISC-005
  - DISC-006
  - DISC-007
  - DISC-008
  - DISC-009
  - DISC-010
related_decisions:
  - ADR-0007
  - ADR-0008
  - ADR-0009
  - ADR-0010
tags:
  - constitution
risk: High
complexity: Medium
---

# Jwel / ELYSIAN — Engineering Constitution

Authored under `PRM-CONSTITUTION` / `OV-002`, from M1 Discovery's
`recommendations` synthesis (`DISC-010`) and three owner choices recorded in
§2–§4.

**Frozen 2026-08-07** by owner approval. Amending this document now requires an
ADR *and* an explicit remediation statement (§6) — a higher bar than any other
specification in this project. Every later milestone (Architecture, Standards,
Domains, Features, Implementation) is checked against it.

---

## 1. Engineering Philosophy

This project is a **commercial jewellery storefront and a portfolio artifact at
the same time** (KC-046). Both audiences are real: a client who needs it to
sell, and a reader assessing engineering judgement. Where those pull apart, the
client wins on *behaviour* and the reader wins on *legibility* — the system
must work, and it must be possible to understand why it works.

That dual purpose explains practices that would look disproportionate for a
prelaunch store with no traffic: 90% coverage gates, provisioned dashboards,
audit logging, ten ADRs before launch. They are not over-engineering. They are
the second audience being served deliberately, and they should be preserved as
such rather than trimmed as excess.

Discovery found the project's defining habit is **recording why a decision was
made, next to where it takes effect** — including correcting a wrong hypothesis
in place rather than deleting it (KC-067). Roughly a third of Discovery's
fact-tier claims came from reading such a comment. Nobody mandated the practice;
Law 2 exists because habits do not survive growth.

Discovery also found the project's defining weakness: **six independent layers
where a surface asserted a capability the system did not have** (`DISC-010` §3)
— storefront copy, NFRs, build commands, coverage gates, domain specs, API
surfaces. Nothing compared a claim against its implementation, so claims
drifted freely. Law 1 exists because that pattern produced more findings than
any other single cause.

**Good, here, means: the system does what it says, and says why it does it.**

---

## 2. Rigor Level — Enterprise-grade

*Owner choice, 2026-08-07.*

Chosen because Discovery found the project **already operating at this level**
— 10 ADRs, 90% coverage gates enforced in CI, provisioned Grafana with alert
rules, an audit log, versioned runbooks. Selecting a lower tier would have
licensed dropping practices `DISC-010` explicitly recommended keeping.

**Included:**

- An ADR for any decision that is contested, expensive to reverse, or changes a
  boundary. Not for routine implementation choices.
- Automated test coverage gates enforced in CI, on both apps.
- Observability provisioned in version control, not configured by hand.
- Audit logging for administrative mutations.
- Runbooks for operational procedures, kept current with the system.
- Deferrals carry **named trigger conditions**, not open-ended intent
  (`ADR-0004`, `ADR-0010` set the pattern).

**Explicitly excluded** — these belong to FAANG-level discipline and are not
adopted:

- RFC process preceding significant work.
- Formal threat modelling as a gate.
- Mandatory design review before implementation.

The exclusions are deliberate: they assume reviewers this project does not
have, and would add ceremony without adding safety for a solo developer working
with an AI collaborator.

---

## 3. AI Collaboration Contract — Principal Engineer

*Owner choice, 2026-08-07.*

The agent operates as a **technical partner**, not an executor. This obligates
it to:

1. **Challenge weak requests** rather than implement them silently — including
   when the evidence contradicts a decision the owner has already made.
2. **Correct in both directions.** Discovery's two most valuable moments were
   corrections: KC-082, where the agent's alarm about a missing seller entity
   was wrong and the owner corrected it; and KC-188, where the agent's reading
   of an owner instruction was wrong and flagged at 85% confidence before it
   propagated. A partner that only defers, or only asserts, would have produced
   neither.
3. **Recommend, not survey.** When asked how to approach a problem, give a
   position with reasoning and trade-offs — not a menu.
4. **State confidence honestly**, and flag ambiguity rather than resolving it
   silently. A claim recorded below full confidence with the ambiguity named is
   worth more than a confident guess.
5. **Preserve boundaries the owner has set** — scope, system boundaries
   (§4), and this Constitution's Laws — and raise a conflict rather than
   quietly working around it.
6. **Report faithfully.** Say what was done, what was skipped, and what
   remains uncertain.

---

## 4. Architecture Ambition — Modular Monolith

*Owner choice, 2026-08-07.*

One NestJS process containing bounded-context modules, one Next.js app, one
database, deployed on a single node (`ADR-0010`). `DISC-006` measured the
context boundaries three independent ways — imports, events, table access — and
found them real, not merely a folder layout.

**Not** Hybrid: extraction-ready event contracts would require durable,
versioned events, and `ADR-0010` deliberately deferred event-bus durability
behind named triggers. Committing to extraction readiness while the bus is
in-process and at-most-once (KC-165) would be a claim the system does not
support — a Law 1 violation in the Constitution itself.

Horizontal scaling is out of scope until traffic justifies it, and **the event
bus is its first blocker**, not infrastructure (KC-165).

### The system boundary

The business is a commission marketplace: contracted jewellers sell through the
platform. **The software deliberately does not model this** (KC-087–089). The
abstraction is:

> client + contracted shops = **one client**, who owns the inventory

Supplier relationships, inter-party settlement, commission calculation and
multi-vendor fulfilment lie **outside every bounded context**, by decision, not
omission. A future contributor finding a jewellery marketplace with no seller
entity should read this section before "fixing" it — Discovery made exactly
that error (KC-082) and it took an owner correction to undo.

---

## 5. Laws

Non-negotiable. Each traces to its source, and each meets `OV-002`'s promotion
bar: **violating it silently for six months would require non-trivial rework to
fix.** Practices that are merely good, but survivable if occasionally skipped,
belong in Standards (M4) — they are listed in §5.1 rather than made Law.

### Law 1 — A surface may not assert a capability the system does not have

Any customer-facing claim, declared requirement, documented command, quality
gate or specification must correspond to something the system actually does. If
the capability is not built, the surface must say so or not make the claim.

*Source:* `DISC-010` §3 (six-layer pattern); `DISC-008` promises table;
KC-061, KC-062, KC-099, KC-171, KC-179, KC-198.
*Why non-negotiable:* this single pattern produced more Discovery findings than
any other cause, across six unrelated layers. Left unchecked it re-accumulates
invisibly — no test fails when copy over-promises — and remediation means
auditing every surface at once.
*In practice:* `deploy/RUNBOOK.md` step 0 gates this before launch; the same
check applies to any new claim thereafter.

### Law 2 — Knowledge lives beside the code, and outlives it

Rationale is recorded where the decision takes effect. When a decision is
superseded, the record is **annotated, not deleted** — including when the
original reasoning was wrong.

*Source:* KC-067, KC-086, KC-098, KC-114, KC-132, KC-199; `ADR-0007`;
`OV-000`'s superseded-claim rule.
*Why non-negotiable:* Discovery was tractable only because this habit already
existed. Losing it makes future investigation cost multiples of what this one
cost, and the loss is undetectable until someone needs the answer. Four
Discovery claims were superseded; all four remain readable with their
corrections, which is what made the errors instructive rather than invisible.

### Law 3 — Commitments change by explicit navigation, never silently

A recorded commitment — scope, decision, deferral — is renegotiated openly and
the change is written down. Deferrals carry named trigger conditions. Nothing
is dropped by going quiet.

*Source:* KC-048, KC-054 (owner's own stated principle); exercised in
`ADR-0004`, `ADR-0009`, `ADR-0010`.
*Why non-negotiable:* silent drops are indistinguishable from forgotten work
six months later, and the project's history contains the evidence — two of
three pre-Oriveda `DOM-` specs described capabilities that silently never
arrived (KC-162).

### Law 4 — An invariant belongs at the lowest layer that can enforce it

Where a rule can be expressed as a database constraint, it is. Where it can be
expressed in a query's `WHERE` clause rather than a read-then-write, it is.
Application-layer enforcement is the fallback, and where it is the only option
the limitation is documented.

*Source:* KC-134 (five CHECK constraints), KC-143 (documented app-only
invariants), KC-183 (conditional-`UPDATE` reservation).
*Why non-negotiable:* an invariant enforced at the wrong layer fails silently
and corrupts data. Discovery of that six months later means a backfill, a
migration, and reconstructing which rows are wrong — the most expensive class
of remediation this project could face.

### Law 5 — Context boundaries are crossed by command in, event out

A bounded context does not write another context's tables, and does not emit
another context's events. Cross-context change is requested by a synchronous
command to the owning context, which performs the write and emits its own
event.

*Source:* `ADR-0008`; KC-151 (the Orders ↔ Payments seam), KC-152 (the one
violation found).
*Why non-negotiable:* the single violation Discovery found — Reviews writing
`Product.avgRating` — produced a correctness bug in a different investigation
(KC-142), because an aggregate with two owners has no guarantor. Boundary
erosion compounds, and unpicking tangled contexts is architectural rework.

### Law 6 — A recovery procedure that has not been exercised does not count as recovery

Where a decision accepts risk on the basis that a recovery path exists, that
path must have been executed and the result recorded. Untested backups are not
backups.

*Source:* KC-205; `ADR-0010`, which accepted single-node topology explicitly
because backup and restore covers it.
*Why non-negotiable:* this is the only finding in Discovery whose failure mode
is not rework but business loss. Product imagery lives in one Docker volume
moved by rsync, and for a jewellery store the imagery *is* the product. The
reasoning chain — no redundancy, accepted because backups cover it; backups
never restored, so sufficiency unknown — is exactly the shape that ends
businesses.

### 5.1 Deliberately not Laws

These passed Discovery's Keep list but fail `OV-002`'s promotion bar. They
belong in Standards at M4, and are listed here so their omission reads as a
decision rather than an oversight:

- The uniform `module/controller/service/dto/spec` shape (KC-064) → `STD-API`.
- Co-located tests and coverage thresholds (KC-198, KC-204) → `STD-TESTING`,
  which should also carry e2e coverage of the payment path (KC-202).
- Snapshot-at-historical-boundaries and append-only ledgers (KC-132, KC-133)
  → `STD-DATABASE`, alongside the schema conventions in `DISC-005`.
- Ports and adapters confined to vendor boundaries (KC-155) → `STD-API`.
- The layered security posture and defence-in-depth on exposure (KC-166–168)
  → `STD-SECURITY`.
- Graceful degradation, e.g. Elasticsearch → Postgres → `STD-API`.

Each is valuable and each is survivable if occasionally skipped. That is the
distinction.

---

## 6. Amendment Process

Ordinary specifications in this project move Proposal → Draft → Review →
Approved → Frozen, and revise with a version bump.

**This document is different.** Amending a Frozen Constitution requires both:

1. **An ADR** justifying the change — what changed in the world, why the
   existing Law no longer serves, and what replaces it.
2. **An explicit remediation statement** — what existing work becomes
   non-compliant, and how it will be brought into compliance or explicitly
   excepted.

Neither is optional. A Law that can be revised casually is not functioning as a
Law.

**Adding a Law** follows the same bar as authoring one: it must trace to a
Discovery finding or an owner choice, and it must pass the six-month test.
`OV-002` permits a finding from any individual investigation to become a Law,
not only items surfaced in the `recommendations` rollup.

**A conflict between a Law and a task** is raised, not worked around. Per Law 3
the resolution is an amendment or a recorded exception — never a quiet
violation.

---

## Traceability

Every Law's source, for `OV-002`'s no-orphan-Laws requirement:

| Law | Source |
| --- | --- |
| 1 | `DISC-010` §3; `DISC-008`; KC-061, KC-062, KC-099, KC-171, KC-179, KC-198 |
| 2 | KC-067, KC-086, KC-098, KC-114, KC-132, KC-199; `ADR-0007` |
| 3 | KC-048, KC-054 (owner); `ADR-0004`, `ADR-0009`, `ADR-0010` |
| 4 | KC-134, KC-143, KC-183 |
| 5 | `ADR-0008`; KC-151, KC-152, KC-142 |
| 6 | KC-205; `ADR-0010` |
| §2 Rigor | Owner choice, 2026-08-07 |
| §3 AI mode | Owner choice, 2026-08-07 |
| §4 Architecture | Owner choice, 2026-08-07; `ADR-0010`, `DISC-006` |
| §4 Boundary | KC-087–089 |
