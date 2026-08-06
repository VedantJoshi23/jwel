# Project Bootstrap — Oriveda-Governed

This project follows **Oriveda**, the engineering framework vendored as a git
submodule at [.oriveda-framework/](.oriveda-framework/)
(https://github.com/VedantJoshi23/Oriveda).

**This file is a pointer, not a copy.** It exists to tell an agent *where* the
rules live, never to restate them. If it starts accumulating restated Laws,
Standards, domain invariants, or protocol steps, that is a mistake to fix by
deleting them and leaving a reference — not a convenience to keep. A restated
rule that drifts from its source is worse than no restatement at all.

## Before any action

1. Identify which `PRM-*` prompt covers the task at hand. The full catalog is
   in
   [.oriveda-framework/knowledge/prompts/OV-008-prompt-library-protocol.md](.oriveda-framework/knowledge/prompts/OV-008-prompt-library-protocol.md).
2. Load **only** the Frozen specs that prompt's Context section points to —
   nothing more, and never a summary of them written down elsewhere.
3. Do the work under that prompt's Constraints and Definition of Done.

`PRM-DISCOVERY` is the bootstrapping case: it points directly at Oriveda's own
[OV-000](.oriveda-framework/knowledge/discovery/OV-000-knowledge-acquisition.md)
and
[OV-001](.oriveda-framework/knowledge/discovery/OV-001-discovery-protocol.md),
because this project has no Frozen specs of its own to chain from yet.

## This project's own knowledge base

[knowledge/](knowledge/) holds **this project's** artifacts — not Oriveda's.
They use this project's own `DOM-` / `FEAT-` / `STD-` / `ADR-` naming; the
`OV-` numbering belongs to the framework submodule alone.

| Directory | Holds |
| --- | --- |
| [knowledge/discovery/](knowledge/discovery/) | Discovery investigations + the evidence log under `evidence/` |
| [knowledge/constitution/](knowledge/constitution/) | This project's Constitution (Laws) |
| [knowledge/architecture/](knowledge/architecture/) | System architecture + bounded-context map |
| [knowledge/standards/](knowledge/standards/) | `STD-*` |
| [knowledge/domains/](knowledge/domains/) | `DOM-*` |
| [knowledge/features/](knowledge/features/) | `FEAT-*` |
| [knowledge/decisions/](knowledge/decisions/) | `ADR-*` |

Each directory fills as its milestone produces the artifact. Empty is a
correct state for anything not yet reached.

## Constitution

**Status: not yet authored.** [knowledge/constitution/](knowledge/constitution/)
is empty — this project has not run `PRM-CONSTITUTION` yet, so there are no
Laws to bind work against.

Once a Constitution is Frozen there, this section must be updated to point at
it, and to state: **its Laws must never be silently violated.** If a task
appears to require breaking a Law, stop and raise it — an explicit amendment
or a recorded exception is the only acceptable path, never a quiet one.

## Which documents bind

[knowledge/](knowledge/) is authoritative; the root-level `*.md` files and
[docs/](docs/) are advisory. On conflict, `knowledge/` wins.

The full rule, its rationale and its consequences are in
[ADR-0007](knowledge/decisions/ADR-0007-documentation-authority-and-layout.md).
Read it rather than assuming — it is not restated here.
