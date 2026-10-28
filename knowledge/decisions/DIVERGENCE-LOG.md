---
id: DIVERGENCE-LOG
title: "Jwel / ELYSIAN — Divergence Log"
version: 0.2.0
status: Draft
owner: Architecture
reviewers: []
created: 2026-10-28
updated: 2026-10-28
milestone: M8
category: Decision
priority: High
depends_on: []
required_by: []
related_documents:
  - DOM-SHIPPING
  - FEAT-SHIPPING
related_domains:
  - DOM-SHIPPING
related_features:
  - FEAT-SHIPPING
related_decisions:
  - ADR-0031
  - ADR-0032
  - ADR-0033
  - ADR-0035
tags:
  - divergence
risk: Medium
complexity: Low
---

# Divergence Log

Shape and rules: Oriveda `templates/divergence-log-template.md` and Oriveda
`ADR-0005` rule 4 and `ADR-0007` rules 2 and 5. Not restated here. Binding
since jwel adopted Oriveda `073100c` (`ADR-0033`). Due column and adoption
entries since `8ed8df1` (`ADR-0035`).

Two kinds of row live here:
- **ordinary divergences** against a non-Frozen spec, with Due empty;
- **adoption entries**, found in an upgrade's `adoption` change, which carry a
  Due date and may name a Frozen spec.

Any other disagreement with a Frozen spec is a violation. Fix the code or
revise the spec; never log it here.

## Entries

| ID | Spec § | Spec says | Code does | Found in | Status | Due | Resolved |
| --- | --- | --- | --- | --- | --- | --- | --- |
| DIV-001 | `DOM-SHIPPING` §7 | Allowed: Order, Inventory | `shipping.module.ts` imports `AuditLogModule` | `e96ef84`; Oriveda review 2026-10-28 | spec-updated | | 2026-10-28 |
| DIV-002 | `DOM-SHIPPING` §7 | Allowed: Order, Inventory | `static-zone-shipping.provider.ts` reads `SettingsService` | `e96ef84`; Oriveda review 2026-10-28 | spec-updated | | 2026-10-28 |
| DIV-003 | `DOM-SHIPPING` §5 | Publishes `ShipmentPickedUp`, `ShipmentInTransit`, … (`ARCHITECTURE.md` naming) | `events.ts` names them `shipment.picked_up`, `shipment.in_transit`, … (the bus's `context.verb` convention) | `eae42cc`; PE review 2026-10-28 | spec-updated | | 2026-10-28 |
| DIV-004 | `DOM-SHIPPING` (whole spec; `risk: High`) | Oriveda `ADR-0005` rules 2 and 5: a High-tier spec is Frozen before any slice touching it is built, and before a release ships its behaviour | Spec is Draft 0.4.0 while Phases 0–1 (serviceability, shipment tables, webhook, `shipment.*` events) are live in production (`cbbc76d`) | adoption — Oriveda `8ed8df1` | open | 2026-12-15 | |
| DIV-005 | `FEAT-SHIPPING` (whole spec; `risk: High`) | Same rules as DIV-004 | Spec is Proposal 0.2.0 while its Phase 0–1 acceptance criteria are live in production | adoption — Oriveda `8ed8df1` | open | 2026-12-15 | |

### Notes

**DIV-001, DIV-002.** Both are shared services (`ARCH-001` §1.2). Resolved
`spec-updated` by `ADR-0031` and `ARCH-001` A5, not by editing `DOM-SHIPPING`:
a §7 lists context-to-context dependencies only, and every context may use a
shared service.

**DIV-003.** The code was right: every other event on the bus uses
`context.verb`. Resolved by `DOM-SHIPPING` v0.3.0 §5.

**DIV-004, DIV-005 — adoption entries (`ADR-0035`).** Neither breach was a
defect when it happened: Phases 0–1 shipped before jwel adopted the tier rule.
Oriveda `ADR-0007` rule 2 makes them adoption entries from the upgrade commit.

*Why 2026-12-15.* About seven weeks: long enough for the client's pickup
location, package dimensions and wallet funding to arrive and Phase 2's spec to
be settled, and short enough to bite. The date does **not** depend on the
client. If the inputs haven't arrived by then, the closing move is still
available: freeze `DOM-SHIPPING` and `FEAT-SHIPPING` at the scope that is
built (Phases 0–1, proved by the live code), with the Phase 2 invariants
moved to explicit open questions. That is real spec work, which is why it is
dated rather than done in this change.

*Extending.* Moving the date is allowed once, as a visible edit to this row,
with the reason written here. A second move is the "grandfathering became
deferral" signal Oriveda `ADR-0007` names in its revisit criteria, and goes to
the owner instead.
