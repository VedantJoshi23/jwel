# Milestone 4 — Database Engineering

## Architecture Document
No architectural changes to module boundaries. [`ARCHITECTURE.md`](../../ARCHITECTURE.md)
remains current. [`DATABASE.md`](../../DATABASE.md) is updated in place (§6–9 added)
rather than superseded, since the Milestone 2 design is now implemented, not replaced.

## Tasks Completed
- [x] Prisma schema written at
      [`apps/api/src/prisma/schema.prisma`](../../apps/api/src/prisma/schema.prisma)
      covering all 13 required entities (Users, Products, Categories, Collections,
      Orders, OrderItems, Coupons, Reviews, Wishlist, Inventory, Payments,
      Addresses, Returns) plus load-bearing supporting entities (Cart/CartItem,
      ProductVariant, ProductMedia, status-history tables) flagged explicitly as
      additions beyond the literal list
- [x] All relationships modeled (1:1, 1:many, many:many via explicit join table
      for Collection↔Product)
- [x] Indexes designed for three stated optimization targets:
      - High read load: denormalized rating aggregates, composite indexes matching
        actual query shapes, Redis-in-front-of-Postgres caching referenced
      - Search: pg_trgm GIN index + planned generated tsvector column as
        admin/fallback search, with Elasticsearch confirmed as the real
        customer-facing search path
      - Reporting: BRIN indexes on time-ordered append-only tables, append-only
        ledger pattern, read-replica targeting, materialized view recommendation
- [x] Constraints documented where Prisma's DSL can't express them (CHECK
      constraints for rating range, stock non-negativity, positive quantity,
      coupon date-range validity) — captured as a hand-authored raw-SQL migration
      step, not silently dropped
- [x] Migration strategy: tooling/workflow, environment promotion, initial
      migration sequence, zero-downtime change rules, seeding strategy, rollback
      strategy — DATABASE.md §8
- [x] Resolved two items left open since Milestone 2: order-time address snapshot
      mechanism (JSON column, not live FK) and where Collections fits in the model
      (many-to-many join table, distinct from Category)

## Tasks Remaining
- [ ] Actually run `prisma migrate dev --name init` against a real Postgres
      instance (requires `apps/api` to exist as a runnable NestJS app — deferred
      to the Backend Domain milestone, since this milestone was schema-only per
      the requested deliverables)
- [ ] Hand-author the raw-SQL follow-up migration (CHECK constraints, generated
      `search_vector` column + trigger, GIN index) — sequence specified in
      DATABASE.md §8.3, not yet executed as an actual `.sql` migration file
- [ ] Materialized view definitions (`mv_daily_sales`, `mv_product_performance`)
      — recommended, intentionally deferred until real Admin Analytics query
      patterns exist (Milestone 6)
- [ ] `apps/api/src/prisma/seed.ts` — strategy specified (DATABASE.md §8.5), not
      yet implemented
- [ ] Gold-rate provider integration — still blocks finalizing Pricing module
      behavior, does not block this schema

## Updated Roadmap
1. Milestone 0 — Scaffold ✅
2. Milestone 1 — Product Discovery ✅
3. Milestone 2 — System Architecture ✅
4. Milestone 3 — UX/UI Design ✅
5. **Milestone 4 — Database Engineering ✅ (this milestone)**
6. Milestone 5 — Backend Domain (NestJS modules per ARCHITECTURE.md §3/§8, wired
   to this Prisma schema; first real `prisma migrate dev` run)
7. Milestone 6 — Storefront Core + Admin Panel (UI build against DESIGN.md specs;
   Admin Analytics queries inform the deferred materialized views)
8. Milestone 7 — Customer Features
9. Milestone 8 — Advanced/AI
10. Milestone 9 — Payments
11. Milestone 10 — Observability & Hardening
12. Milestone 11 — Deployment

## Risks and Mitigations
| Risk | Mitigation |
|---|---|
| Schema has never been applied to a real database — syntax/constraint errors could surface late | Flagged explicitly as a remaining task; first real migration run is scheduled for the Backend Domain milestone before any application code depends on it |
| CHECK constraints and generated tsvector column live outside `schema.prisma` (Prisma DSL limitation) | Documented precisely as raw SQL in DATABASE.md §7.4/§8.3 so they aren't lost between milestones or silently skipped at implementation time |
| Collections entity added without prior ERD precedent could clash with Category in practice (overlapping taxonomy) | Explicitly distinguished in DATABASE.md §6: Category = structural taxonomy, Collection = curated cross-cutting grouping (many-to-many) — documented now to prevent confusion when Admin CMS (FR-23) is built |
| Adding Cart/ProductVariant beyond the literal milestone entity list could be seen as scope creep | Called out explicitly in both the schema file header and DATABASE.md §6 as load-bearing necessities already specified in PRODUCT.md/ARCHITECTURE.md, not unrequested extras |
| Materialized views deferred — Admin Analytics Dashboard could launch slow if built before views exist | Deliberate sequencing: views designed against real query patterns at Milestone 6 rather than guessed now, avoiding a rebuild |
