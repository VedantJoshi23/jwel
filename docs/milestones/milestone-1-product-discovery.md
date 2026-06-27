# Milestone 1 — Product Discovery

## Architecture Document
No architecture changes this milestone (product-only). See
[`docs/architecture/architecture.md`](../architecture/architecture.md) from Milestone 0,
still current.

## Tasks Completed
- [x] Competitor analysis: Tanishq, BlueStone, CaratLane (feature comparison table,
      sourced from live site/app research)
- [x] 5 user personas (Wedding Shopper, Gift Purchaser, Luxury/Self-Buyer, Returning
      Customer, Admin/Catalog Manager)
- [x] 5 end-to-end user journeys mapped to personas
- [x] Functional Requirements (FR-1..FR-23, customer + admin)
- [x] Non-Functional Requirements (NFR-1..NFR-10)
- [x] MVP scope defined and justified against competitor parity + one AI differentiator
- [x] Future scope defined
- [x] Revenue model (5 streams, primary + future)
- [x] Customer acquisition strategy (6 channels)
- [x] `PRODUCT.md` created at repo root

## Tasks Remaining
- [ ] UX/UI Designer milestone: translate personas/journeys into wireframe deltas
      against the existing GLINT wireframe (e.g., gift-finder flow, comparison UI,
      try-on-prep capture flow have no wireframe yet)
- [ ] Solution Architect milestone: gold-rate pricing data source decision (flagged
      as Open Question), returns/reverse-logistics decision
- [ ] Validate personas/journeys with real user research (currently desk research +
      competitor analysis only — no primary user interviews conducted)

## Updated Roadmap
Roadmap unchanged from Milestone 0, with Milestone 1 (Product Discovery) now marked
complete. See [`docs/milestones/milestone-0-scaffold.md`](milestone-0-scaffold.md)
for the full numbered roadmap. Next: **Milestone 2 — Design System** (or a UX
milestone covering the net-new flows identified in Tasks Remaining, if the client
wants design discovery before component build).

## Risks and Mitigations
| Risk | Mitigation |
|---|---|
| Personas/journeys are desk-research-based, not validated with real users | Flag explicitly as an open item; recommend lightweight validation (5-10 user interviews) before heavy investment in Gift Recommendation Engine / Try-On Prep, since these are the highest-novelty, least-precedented features |
| MVP scope could be perceived as "catching up" to competitors rather than leading | AI Product Recommendation is deliberately included in MVP (not deferred) to ship one visible differentiator alongside parity features |
| Gold-rate-linked pricing has no confirmed data source yet | Logged as Open Question; must be resolved before Backend Domain milestone (pricing engine depends on it) |
| Physical "Try at Home" (BlueStone/CaratLane strength) is explicitly out of scope | Mitigated via Virtual Try-On Prep + accurate sizing tools + frictionless digital returns instead of building physical trial logistics |
