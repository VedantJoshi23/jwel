# Milestone 2 — System Architecture

## Architecture Document
See [`ARCHITECTURE.md`](../../ARCHITECTURE.md) (root) — supersedes the Milestone 0
scaffold-level architecture doc as the authoritative system design. Companion docs:
[`DATABASE.md`](../../DATABASE.md), [`SECURITY.md`](../../SECURITY.md).

## Tasks Completed
- [x] System architecture diagram (modular monolith, NestJS modules, data/infra,
      external services, observability) — Mermaid diagram in ARCHITECTURE.md §2
- [x] Service boundaries / bounded-context map for all 17 modules implied by
      PRODUCT.md's functional requirements — ARCHITECTURE.md §3
- [x] Domain model (aggregates + class diagram) — ARCHITECTURE.md §4
- [x] Event flow (checkout, returns, catalog→search sync) + domain events catalog —
      ARCHITECTURE.md §5
- [x] Security architecture summary (detailed in SECURITY.md) — ARCHITECTURE.md §6
- [x] Scalability strategy table — ARCHITECTURE.md §7
- [x] Folder structure (apps/web, apps/api with DDD layering per module) —
      ARCHITECTURE.md §8 — design only, not yet created on disk
- [x] Representative API contracts for core flows (catalog, cart, checkout, orders,
      returns, admin product create, gift-finder) — ARCHITECTURE.md §9
- [x] Full ER diagram + table-by-table design notes — DATABASE.md
- [x] Redis key design and Elasticsearch document shape — DATABASE.md §4-5
- [x] OWASP Top 10 control mapping, AuthN/AuthZ sequence diagram, payment security,
      data protection, infra/network security — SECURITY.md

## Tasks Remaining
- [ ] Resolve gold-rate data source (blocks finalizing Pricing module's
      `GoldRateProvider` port implementation — interface is designed, provider isn't
      chosen)
- [ ] Resolve returns reverse-logistics scope (store-credit-only vs. full reverse
      pickup) — domain model supports both, business decision still open
- [ ] Finalize order-time address snapshot mechanism (live FK vs. JSON snapshot vs.
      copy-table) — DATABASE.md §3 flags this for Milestone 4
- [ ] STAFF sub-role permission matrix — deferred to Milestone 6 (Admin Panel)
- [ ] MFA activation policy decision — deferred, Auth.js hook point reserved
- [ ] India data residency confirmation with legal/compliance before AWS region
      finalization
- [ ] Translate this architecture into actual Prisma schema, NestJS module
      scaffolding, and Next.js route structure (no code written this milestone by
      design)

## Updated Roadmap
1. Milestone 0 — Scaffold ✅
2. Milestone 1 — Product Discovery ✅
3. **Milestone 2 — System Architecture ✅ (this milestone)**
4. Milestone 3 — Design System (`packages/ui` component library from GLINT wireframe)
5. Milestone 4 — Backend Domain (Prisma schema + NestJS modules per ARCHITECTURE.md
   §3/§8, resolving the address-snapshot and gold-rate questions)
6. Milestone 5 — Storefront Core (UI wired to API per ARCHITECTURE.md §9 contracts)
7. Milestone 6 — Admin Panel
8. Milestone 7 — Customer Features (auth, wishlist, search/filters, reviews,
   tracking, returns)
9. Milestone 8 — Advanced/AI (recommendation, gift engine, comparison, try-on prep)
10. Milestone 9 — Payments (Stripe live; Razorpay remains stub per SECURITY.md §4)
11. Milestone 10 — Observability & Hardening (Grafana/Prometheus live, OWASP/WCAG/
    perf/SEO audits against this milestone's design)
12. Milestone 11 — Deployment (Docker/GitHub Actions/AWS ECS rollout)

## Risks and Mitigations
| Risk | Mitigation |
|---|---|
| Modular monolith could become a "big ball of mud" if module boundaries aren't enforced | Bounded-context rule stated explicitly in ARCHITECTURE.md §3: no cross-module repository/entity imports, only application-service interfaces or domain events — to be enforced via lint rules/module boundaries at implementation time |
| Gold-rate and returns-logistics decisions still open, could block Milestone 4 | Both designed with abstraction points (`GoldRateProvider` port, refund-target abstraction) so Milestone 4 can proceed on schema/module scaffolding without these decisions being finalized first |
| PCI compliance scope creep if payment design drifts | SECURITY.md §4 explicitly constrains Jwel to PCI DSS SAQ A by never handling raw card data — must be enforced again at implementation/code-review time |
| Recommendation/AI module scaling unpredictably vs. rest of monolith | Architecture explicitly designed for this module to be the first extraction candidate to a separate service (ARCHITECTURE.md §1, §7) |
| Soft-delete + immutable order snapshots add schema complexity early | Accepted deliberately — retrofitting auditability/historical-accuracy after launch is far costlier than designing for it now |
