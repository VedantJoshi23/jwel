# Milestone 9 — Recommendation Engine

## Architecture Document
ARCHITECTURE.md's `Status` line and §10 ("Status & Open Items Carried
Forward") were updated to reflect that Search (Milestone 8) and a rule-based
slice of Recommendation/AI (this milestone) are now actually implemented —
ARCHITECTURE.md had never been updated for Milestone 8 despite that
milestone's own tracker claiming it was; fixed both gaps together here. The
Recommendation/AI bounded-context row (§3) now notes exactly what's
implemented (FR-14/FR-15, rule-based) versus what remains design-only (FR-13
gift engine, FR-16 try-on prep). No changes to the bounded-context map or
domain model itself — this milestone's scope fits inside what Milestone 2
already designed.

## Tasks Completed
- [x] Prisma schema: `ProductView` (append-only view log, user or
      anonymous-id keyed) and `ProductCoOccurrence` (precomputed unordered
      product-pair counts) — migrated against a real local PostgreSQL
      instance
- [x] `RecommendationsService`: Frequently Bought Together (co-occurrence
      lookup + same-category fallback), Recently Viewed (recency
      de-duplication, identity-agnostic), Trending (14-day sales window with
      an in-memory TTL cache + bestseller fallback), Personalized
      (co-occurrence expansion from the user's own purchases blended with
      category affinity, cold-starting new users to Trending)
- [x] `RecommendationsController`: 4 public/guest-aware endpoints + 1
      authenticated endpoint + 1 admin backfill endpoint
- [x] `OptionalJwtAuthGuard` — new shared guard closing a real gap the
      existing `@Public()`/`JwtAuthGuard` pair couldn't express (an endpoint
      that's open to guests but resolves identity from a JWT when one is
      present, never trusting a client-supplied user id)
- [x] Wired `order.confirmed` (already emitted by `PaymentsService` since
      Milestone 7) to incrementally maintain `ProductCoOccurrence` — no new
      domain event needed, reused what already existed
- [x] `POST /admin/recommendations/backfill-co-occurrence` — added mid-
      milestone after validation surfaced that co-occurrence otherwise never
      backfills from order history that predates this feature
- [x] Fixed a real (pre-existing, not introduced here) Prisma
      migration-generator bug against the hand-authored `search_vector`
      generated column, the same class of issue DATABASE.md §8.3 already
      flags
- [x] Validated all four surfaces against real local order/view data,
      including both directions of a real co-occurrence pair, the
      already-purchased exclusion logic, cold-start fallback for a brand-new
      user, and the no-identity-at-all graceful-empty-list path

## Tasks Remaining
- [ ] Automatic co-occurrence backfill on deploy, or at minimum a
      documented runbook step — today it's a manual admin call
- [ ] Real ML (collaborative filtering / embeddings) once there's enough
      order volume to justify it over rule-based co-occurrence — explicitly
      out of scope for the reasons in BACKEND.md §9.1
- [ ] Rate-limiting on `POST /products/:id/views` — not exploited by
      anything today, but a real gap once views feed any future signal
      beyond Recently Viewed
- [ ] "Similar items" as a distinct content-similarity surface (by metal/
      price/style) — FBT and category affinity currently cover this need
      indirectly
- [ ] Gift Recommendation Engine (FR-13) and Try-On Preparation (FR-16) —
      named in PRODUCT.md as explicitly out of MVP scope, still untouched
- [ ] Wire the frontend to these new endpoints — same standing gap pattern
      as Milestone 8's Search endpoints; no frontend page calls any
      recommendation endpoint yet

## Updated Roadmap
1. Milestone 0 — Scaffold ✅
2. Milestone 1 — Product Discovery ✅
3. Milestone 2 — System Architecture ✅
4. Milestone 3 — UX/UI Design ✅
5. Milestone 4 — Database Engineering ✅
6. Milestone 5 — Backend Development ✅
7. Milestone 6 — Frontend Development ✅
8. Milestone 7 — Validation + Backend Completion ✅
9. Milestone 8 — Search System ✅
10. **Milestone 9 — Recommendation Engine ✅ (this milestone)**
11. Milestone 10 — Frontend Validation + Search/Recommendation UI wiring
    (still outstanding from Milestone 8, now doubled: Search rails AND
    recommendation rails — FBT on PDP, Recently Viewed + Trending on
    homepage, Personalized on a logged-in dashboard)
12. Milestone 11 — Admin Panel + Admin Dashboard frontend
13. Milestone 12 — Test suite (the largest standing gap — every milestone
    since 7 has found real bugs only by actually running the code, never by
    static review alone)
14. Milestone 13 — Gift Recommendation Engine, real Collections API
15. Milestone 14 — Payments hardening, Redis caching
16. Milestone 15 — Observability & Hardening, Auth.js bridge
17. Milestone 16 — Deployment

## Risks and Mitigations
| Risk | Mitigation |
|---|---|
| Co-occurrence silently produces nothing useful if the catalog/order data is too thin (single-item orders only) | Discovered directly during validation, not assumed — the existing seed data had zero multi-item orders, so a real one was added to prove the logic, and the gap is named explicitly (BACKEND.md §9.5/§9.6) rather than left implicit |
| `OptionalJwtAuthGuard`'s privacy boundary — a guest's `anonymousId` is client-supplied and easy to guess/share, unlike a real userId | Acceptable for Recently Viewed (low-sensitivity browsing history, not account data); explicitly never used to bypass the real JWT-based identity for any endpoint that needs it (Personalized stays JWT-only) |
| Building real ML before there's a reason to | Deliberately not attempted — BACKEND.md §9.1 documents why rule-based is the right MVP call, and what would justify revisiting it (more order volume, a measured reason to believe a learned model beats co-occurrence) |
| ARCHITECTURE.md drifting from what's actually implemented (it had already drifted once, undetected, after Milestone 8) | Fixed both the new Milestone 9 gap and the pre-existing Milestone 8 one in the same pass, rather than letting the pattern repeat |
