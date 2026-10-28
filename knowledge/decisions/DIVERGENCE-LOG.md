---
id: DIVERGENCE-LOG
title: "Jwel / ELYSIAN — Divergence Log"
version: 0.1.0
status: Draft
owner: Architecture
reviewers:
  - Vedant
created: 2026-10-28
updated: 2026-10-28
milestone: M8
category: Decision
priority: High
depends_on: []
required_by: []
related_documents:
  - DOM-SHIPPING
related_domains:
  - DOM-SHIPPING
related_features:
  - FEAT-SHIPPING
related_decisions:
  - ADR-0031
  - ADR-0032
  - ADR-0033
tags:
  - divergence
risk: Medium
complexity: Low
---

# Divergence Log

Shape and rules: Oriveda `templates/divergence-log-template.md` and Oriveda
`ADR-0005` rule 4. Not restated here. Binding since jwel adopted Oriveda
`073100c` (`ADR-0033`).

A disagreement with a **Frozen** spec does not belong here. Those are fixed or
the spec is revised: see `ADR-0030`, `ADR-0032`.

## Entries

| ID | Spec § | Spec says | Code does | Found in | Status | Resolved |
| --- | --- | --- | --- | --- | --- | --- |
| DIV-001 | `DOM-SHIPPING` §7 | Allowed: Order, Inventory | `shipping.module.ts` imports `AuditLogModule` | `e96ef84`; Oriveda review 2026-10-28 | spec-updated | 2026-10-28 |
| DIV-002 | `DOM-SHIPPING` §7 | Allowed: Order, Inventory | `static-zone-shipping.provider.ts` reads `SettingsService` | `e96ef84`; Oriveda review 2026-10-28 | spec-updated | 2026-10-28 |
| DIV-003 | `DOM-SHIPPING` §5 | Publishes `ShipmentPickedUp`, `ShipmentInTransit`, … (`ARCHITECTURE.md` naming) | `events.ts` names them `shipment.picked_up`, `shipment.in_transit`, … (the bus's `context.verb` convention) | `eae42cc`; PE review 2026-10-28 | spec-updated | 2026-10-28 |

### Notes

**DIV-001, DIV-002.** Both are shared services (`ARCH-001` §1.2). Resolved
`spec-updated` by `ADR-0031` and `ARCH-001` A5, not by editing `DOM-SHIPPING`:
a §7 lists context-to-context dependencies only, and every context may use a
shared service.

**DIV-003.** The code was right: every other event on the bus uses
`context.verb`. Resolved by `DOM-SHIPPING` v0.3.0 §5.
