---
id: ADR-0007
title: Documentation authority and repository layout
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
  - DISC-001
related_decisions:
  - ADR-0006
tags:
  - documentation
  - governance
  - repo-structure
risk: Low
complexity: Low
---

# ADR-0007 — Documentation authority and repository layout

## Context

`DISC-001` found documentation stratified across three layers that accreted in
sequence — seven root-level subject documents (~3,500 lines), `docs/`
(architecture, design, milestones M0–M14), and `knowledge/` (`DOM-`, `FEAT-`,
`STD-`, `ADR-`) — with no stated rule for which layer a document belongs in.
Adopting Oriveda adds a fourth layer that *does* have an explicit rule, which
makes the ambiguity in the other three more visible rather than less.

Without a rule, the failure mode is predictable: two documents describing the
same thing, disagreeing, with no way to tell which one binds.

## Decision

**Oriveda documents under `knowledge/` are authoritative. Everything else is
advisory.**

The owner's framing, adopted here: the pre-Oriveda corpus is a *judicial body
issuing advisories*; Oriveda is the *administrative body* that acts on them,
adapting them into what actually governs. An advisory carries weight — it is
the product of real work and real context — but it does not bind on its own,
and it does not become binding by being older, longer, or more detailed.

### The four layers

| Layer | Contents | Authority |
| --- | --- | --- |
| `.oriveda-framework/` | The Oriveda framework itself (`OV-*`), a submodule | Governs *process*; never contains project content |
| `knowledge/` | This project's `DISC-`, Constitution, `DOM-`, `FEAT-`, `STD-`, `ADR-` | **Authoritative.** Binds work |
| `docs/` | `architecture/`, `design/`, `milestones/` | Advisory |
| Root `*.md` | `PRODUCT.md`, `ARCHITECTURE.md`, `BACKEND.md`, `DATABASE.md`, `DESIGN.md`, `FRONTEND.md`, `SECURITY.md` | Advisory |

### Consequences of the rule

1. **On conflict, the `knowledge/` document wins** — with no reconciliation
   ceremony required. The advisory is not wrong for having been superseded; it
   simply does not bind.
2. **An advisory is evidence, not authority.** During Discovery the
   pre-Oriveda corpus is processed as `EVD-005` and its content enters the
   record as knowledge claims with confidence tiers — never as settled fact
   because a document asserted it.
3. **New durable specifications go in `knowledge/`**, authored through the
   `PRM-*` prompt that owns them. New advisories may still be written in
   `docs/` — working notes, milestone plans, design explorations — and nothing
   here discourages that.
4. **Advisories are not to be retro-edited to match** a `knowledge/` document.
   They are a record of what was thought at the time; rewriting them destroys
   the evidence trail that made Discovery possible.
5. **No content is copied between layers.** A `knowledge/` document cites an
   advisory by path; it does not restate it. Same "point, don't copy"
   discipline `OV-008` applies to prompts and `CLAUDE.md` applies to itself.

### What this does not decide

Whether any specific pre-Oriveda document should eventually be superseded by a
`knowledge/` equivalent. That is decided per document, as the milestone that
owns the topic runs — not in advance here.

## Alternatives Considered

- **Migrate the pre-Oriveda corpus into `knowledge/` wholesale.** Rejected —
  3,500 lines of root docs plus 15 milestone documents were written under
  different assumptions and against a moving codebase. Promoting them
  unexamined would import unverified claims as authority, which is precisely
  what `OV-000`'s confidence tiering exists to prevent.
- **Delete the pre-Oriveda corpus once equivalents exist.** Rejected — it is
  the primary evidence base for Discovery, and `EVD-005` is not yet fully
  processed. Deleting evidence to tidy a repository is the failure mode
  Oriveda's Principle 1 ("knowledge outlives implementation") exists to stop.
- **Treat all four layers as equally authoritative, resolving conflicts case
  by case.** Rejected — this is the current state, and it is what produced the
  ambiguity this ADR resolves.

## Trade-offs

Contributors must know which layer they are reading before trusting it, and a
root-level document with an authoritative *tone* now carries only advisory
*weight* — a mismatch a newcomer could miss. Accepted because the alternative
(migrating or deleting) costs far more and destroys evidence. `CLAUDE.md`
points at this ADR so an agent resolves the question before acting.

## Validation

- Every document under `knowledge/` is authoritative or explicitly marked
  `status: Proposal` / `Discussion` / `Revision`.
- No `knowledge/` document restates the body of an advisory; it cites the path.
- No advisory is edited to agree with a `knowledge/` document after the fact.

## Cross References

- `DISC-001` raised the ambiguity (Weaknesses; Question 6) and recommended
  exactly one rule be stated.
- `ADR-0006` (hybrid admin strategy) is the model for a pre-Oriveda decision
  that remains sound and is cited rather than rewritten.
- `KC-054` records the owner's stance that changes to specification documents
  proceed by explicit navigation, never silently — which this ADR implements
  for the layer question specifically.
