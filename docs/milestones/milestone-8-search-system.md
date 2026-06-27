# Milestone 8 — Search System (Elasticsearch)

## Architecture Document
No changes to ARCHITECTURE.md's bounded-context map — Search was already a
named module there. The catalog → search sync diagram in ARCHITECTURE.md
§5.3 is now an actual implementation rather than an aspirational diagram; see
[`BACKEND.md`](../../BACKEND.md) §8.3.

## Tasks Completed
- [x] `jwel_products` Elasticsearch index: `search_as_you_type` on `name`
      (autocomplete + relevance from one field), custom analyzer with an
      inline jewelry synonym set, `fuzziness: AUTO` typo tolerance,
      `function_score` ranking (text relevance × log-dampened popularity ×
      modest in-stock boost), `terms`/`range` aggregations for facets
- [x] `SearchService`: index/delete/bulk-reindex against Postgres as source
      of truth, `search()` and `autocomplete()` query builders
- [x] `SearchController`: public `GET /search`, `GET /search/autocomplete`,
      admin `POST /admin/search/reindex` — with an explicit Postgres fallback
      on both public endpoints if Elasticsearch is unreachable
- [x] Closed the ARCHITECTURE.md §5.3 gap: `ProductsService` now emits
      `product.upserted`/`product.deleted`, `ReviewsService.adminModerate`
      emits `product.upserted` after a rating recompute (a connection not in
      the original diagram, added because ranking depends on `ratingCount`),
      `SearchService` subscribes to both
- [x] Installed and ran a real local Elasticsearch 7.17.4 instance (with
      PostgreSQL also running) and validated all three of the milestone's own
      example queries plus typo tolerance, autocomplete, facets, and synonym
      matching — see BACKEND.md §8.6 for the full table
- [x] Directly observed the Postgres-fallback resilience path working by
      killing Elasticsearch mid-session and re-running the same queries

## Tasks Remaining
- [ ] Inventory-triggered reindexing — `inStock` can go stale between content
      edits; admin reindex is the manual correction path meanwhile
- [ ] Synonym tuning from real query logs — current set is a reasonable
      starting taxonomy, not validated against real user behavior (none
      exists yet)
- [ ] Index aliasing / zero-downtime reindex pattern — `reindexAll` writes
      directly to the live index; fine at current data volume
- [ ] Facets in the Postgres fallback path — currently absent by design, a
      real capability loss in degraded mode, not yet addressed
- [ ] Relevance tuning / A-B testing of ranking weights — current weights are
      reasoned defaults, not data-validated
- [ ] Wire the frontend's `/search` page (Milestone 6) to call these new
      backend endpoints — it currently calls `ProductsService` directly via
      `getProducts`, not the new `/search` endpoint

## Updated Roadmap
1. Milestone 0 — Scaffold ✅
2. Milestone 1 — Product Discovery ✅
3. Milestone 2 — System Architecture ✅
4. Milestone 3 — UX/UI Design ✅
5. Milestone 4 — Database Engineering ✅
6. Milestone 5 — Backend Development ✅
7. Milestone 6 — Frontend Development ✅
8. Milestone 7 — Validation + Backend Completion ✅
9. **Milestone 8 — Search System ✅ (this milestone)**
10. Milestone 9 — Frontend Validation + Search UI wiring (run `apps/web`,
    connect Search/Collections pages to the new `/search` endpoint with
    facet UI, autocomplete dropdown)
11. Milestone 10 — Admin Panel + Admin Dashboard frontend
12. Milestone 11 — Test suite (still the largest standing gap — every
    milestone since 7 has found real bugs only by actually running the code)
13. Milestone 12 — Advanced/AI, real Collections API
14. Milestone 13 — Payments hardening, Redis caching
15. Milestone 14 — Observability & Hardening, Auth.js bridge
16. Milestone 15 — Deployment

## Risks and Mitigations
| Risk | Mitigation |
|---|---|
| Disk filled to zero during the Elasticsearch install, blocking all tool calls | Did not attempt autonomous destructive cleanup while blocked — paused and asked the user how to proceed, then cleared the (safe-by-construction) Homebrew download cache once given explicit direction |
| Elasticsearch's bundled JDK was broken/missing after reinstall | Worked around with an existing system JDK rather than re-attempting a risky redownload, given the prior disk scare |
| `gold chain` query recall includes some lower-relevance matches (bridal necklace, an unrelated earring) via synonym/cross-field expansion | Named explicitly in BACKEND.md §8.6 as a real precision/recall tradeoff worth tuning later, not presented as a clean result |
| Frontend's existing `/search` page (Milestone 6) doesn't call any of these new endpoints yet | Flagged as a remaining task — building the backend search system doesn't automatically make the storefront use it |
| Local-dev-only Elasticsearch settings (`xpack.ml.enabled: false`, disk threshold disabled) could be mistaken for production guidance if not careful | Both settings are commented in `elasticsearch.yml` itself and in BACKEND.md §8.6 as dev-only, never production posture |
