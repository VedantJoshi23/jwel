# Milestone 3 — UX/UI Design

## Architecture Document
No architecture changes this milestone. See [`ARCHITECTURE.md`](../../ARCHITECTURE.md)
(Milestone 2), still current. New deliverable this milestone:
[`DESIGN.md`](../../DESIGN.md).

## Tasks Completed
- [x] Design direction synthesizing Cartier/Tiffany/BlueStone/Apple inspiration
      against the existing GLINT wireframe palette — DESIGN.md §1
- [x] Design tokens: color palette, typography scale, spacing/grid, elevation/
      radius, motion — DESIGN.md §2, Figma-Variable-ready
- [x] Component library spec (26 components, variants, props, mapped to existing
      GLINT wireframe patterns where applicable, flagged "New" where not) —
      DESIGN.md §3
- [x] 4 user flow diagrams (purchase, account, gift, admin fulfillment) — DESIGN.md §4
- [x] Page specs for all 9 required pages: Home, PLP, PDP, Cart, Checkout (updates
      to existing GLINT wireframe), Profile, Wishlist, Order Tracking, Admin
      Dashboard (4 net-new structural specs) — DESIGN.md §5
- [x] Responsive behavior rules — DESIGN.md §6
- [x] WCAG 2.1 AA accessibility specification — DESIGN.md §7
- [x] Figma file organization / handoff spec — DESIGN.md §8

## Tasks Remaining
- [ ] Produce actual `.fig` file or HTML wireframes for the 4 net-new pages
      (Profile, Wishlist, Order Tracking, Admin Dashboard) — currently structural
      specs only, no visual artifact, unlike the existing GLINT wireframe
- [ ] Finalize serif display font choice (Fraunces vs. Playfair Display vs.
      alternative) — flagged as a recommendation, not locked
- [ ] Visual QA pass once wireframes exist: contrast-check the full palette in
      context (token-level contrast was checked, not full-page composition)
- [ ] Reconcile DESIGN.md's component inventory with `packages/ui` folder
      structure from ARCHITECTURE.md §8 once Milestone 4/5 begin implementation

## Updated Roadmap
1. Milestone 0 — Scaffold ✅
2. Milestone 1 — Product Discovery ✅
3. Milestone 2 — System Architecture ✅
4. **Milestone 3 — UX/UI Design ✅ (this milestone)**
5. Milestone 3b (recommended, not yet requested) — net-new page wireframes
   (Profile/Wishlist/Order Tracking/Admin Dashboard) as visual artifacts
6. Milestone 4 — Backend Domain (Prisma schema + NestJS modules)
7. Milestone 5 — Storefront Core (UI build against DESIGN.md specs + GLINT/3b
   wireframes)
8. Milestone 6 — Admin Panel (build against DESIGN.md §5.9 Admin Dashboard spec)
9. Milestone 7 — Customer Features
10. Milestone 8 — Advanced/AI
11. Milestone 9 — Payments
12. Milestone 10 — Observability & Hardening
13. Milestone 11 — Deployment

## Risks and Mitigations
| Risk | Mitigation |
|---|---|
| 4 of 9 required pages have no visual wireframe, only structural spec | Explicitly flagged in DESIGN.md §9 and here; recommend Milestone 3b before Storefront Core implementation begins, so engineers aren't inventing layout from prose alone |
| Design system introduces a serif font not present in original GLINT wireframe | Treated as a deliberate evolution (justified in DESIGN.md §1/§2.2), not a silent change — flagged as not-yet-finalized so client can react before Figma lock-in |
| Component spec (§3) and `packages/ui` folder (ARCHITECTURE.md §8) could drift if built independently | Component naming convention (`Component/Variant/State`) explicitly chosen to map 1:1 to code props, and reconciliation is logged as a Milestone 4/5 task |
| Admin Dashboard intentionally breaks from storefront's spacious luxury feel toward data density | Justified explicitly in DESIGN.md §5.9 as the one legitimate exception (internal tool, not brand-facing) — documented so it isn't mistaken for inconsistency later |
