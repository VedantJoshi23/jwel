# Milestone 10 — Admin Portal

## Architecture Document
ARCHITECTURE.md's CMS and Analytics bounded-context rows (§3) and §10
("Status & Open Items Carried Forward") now note what's actually
implemented versus what FR-23/FR-21 originally specified in full. Also
documents a deliberate deviation from §8's original folder sketch: admin
routes landed at `/admin/products`, `/admin/orders`, etc. (a real `admin/`
path segment), not `(admin)/products/...` as originally sketched — the
original sketch's URLs would have collided with the storefront's own
`/products` route.

## Tasks Completed
- [x] `CmsService`/`Banner` model — homepage banners with an optional
      scheduling window, public active-banner endpoint, full admin CRUD
- [x] `AnalyticsService` — live dashboard summary (revenue, AOV,
      orders-by-status, top products by revenue, low-stock count, pending
      review count, new customers), windowed by a configurable day range
- [x] Bulk CSV import for Products (`POST /admin/products/bulk-import`) —
      hand-rolled CSV parser, per-row validation, reuses
      `ProductsService.adminCreate`, per-row success/failure reporting
- [x] Fixed `OrdersService.adminFindAll` — previously ignored its own
      pagination params and returned no customer info; found by building
      the admin Orders page against it, not by code review
- [x] Added `GET /admin/products` — no admin product-list endpoint existed
      at all before this; admins had no way to see draft products as a list
- [x] Frontend Admin Portal at `/admin/*` — Reports/Analytics dashboard,
      Products (list + status transitions + bulk import UI), Inventory
      (low-stock + adjust), Orders (list + status transitions + customer
      info), Customers (list + suspend), Coupons (list + create form +
      deactivate), CMS (banner list + create form + delete)
- [x] `AdminGuard` (RBAC at the UX layer) + `OptionalJwtAuthGuard`-adjacent
      pattern reused correctly — every admin page redirects non-ADMIN/STAFF
      users client-side, while every actual admin API call is still
      enforced server-side by the pre-existing `RolesGuard`
- [x] Found and fixed a pre-existing, unrelated Milestone 6 TypeScript error
      in `lib/api/products.ts` (`tsc --noEmit` had apparently never been run
      against this file since it was written)
- [x] Hit the same recurring Prisma migration-generator bug against
      `products.search_vector` as Milestones 8 and 9 — fixed with the
      now-established pattern (strip the spurious statement, verify the
      generated column survives, reapply)
- [x] Validated every new/changed backend endpoint directly against the
      real running stack with `curl` (dashboard numbers, banner CRUD, bulk
      import including deliberately-broken rows, the fixed orders/products
      list endpoints)
- [x] Confirmed all 7 admin pages compile and render (`200`, real Next.js
      dev-server module counts in the log) and that the RBAC guard's
      no-token case doesn't leak any admin markup/data in server-rendered HTML

## Tasks Remaining — and one explicitly unverified claim
- [ ] **Interactive, logged-in browser testing was not performed this
      session** — the Chrome browser-automation tool never connected.
      Backend correctness, type-safety, and SSR-level RBAC were all verified
      directly; whether the React forms (coupon create, banner create,
      bulk-import file picker) actually work end-to-end through real browser
      `fetch`/`FormData` was not observed. Named explicitly rather than
      assumed — see FRONTEND.md §7.5 for the exact boundary of what was and
      wasn't checked.
- [ ] No product create/edit form in the Admin Portal beyond status
      transitions and bulk CSV import
- [ ] No audit log of admin actions
- [ ] Inventory table shows variant ids, not product names (the low-stock
      endpoint doesn't join product data)
- [ ] Materialized views / PostHog forwarding for Analytics (DATABASE.md
      §7.3's recommended path) — still a live-query-only dashboard
- [ ] CMS still doesn't cover category landing content or lookbook/editorial
      pages (FR-23's full scope)
- [ ] Bulk import is Products-only, single-variant-per-row

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
10. Milestone 9 — Recommendation Engine ✅
11. **Milestone 10 — Admin Portal ✅ (this milestone)**
12. Milestone 11 — Interactive browser validation of the Admin Portal (the
    one thing this milestone could not verify) + Search/Recommendation
    storefront UI wiring (still outstanding from Milestones 8–9)
13. Milestone 12 — Test suite (the largest standing gap across every
    milestone since 7 — every milestone has found real bugs only by
    actually running the code, never by static review alone)
14. Milestone 13 — Gift Recommendation Engine, real Collections API,
      product create/edit admin form
15. Milestone 14 — Payments hardening, Redis caching, materialized views
16. Milestone 15 — Observability & Hardening, Auth.js bridge
17. Milestone 16 — Deployment

## Risks and Mitigations
| Risk | Mitigation |
|---|---|
| Claiming the Admin Portal "works" without ever loading it in a browser | Explicitly did not claim that — FRONTEND.md §7.5 and this doc both state the exact boundary of what was verified (backend, types, SSR-level RBAC, compile) versus what wasn't (interactive client-side behavior) |
| RBAC implemented only at the frontend, giving a false sense of security | Frontend guard documented explicitly as UX-only; the real enforcement (`RolesGuard`) already existed since Milestone 5 and every new endpoint reuses it unchanged |
| Building a new permission system nobody asked for, just because "enterprise RBAC" sounds bigger than what exists | Deliberately didn't — 3 roles, applied consistently, is what the brief's actual surfaces needed; documented as a scope decision (BACKEND.md §10.5), not silently undersold |
| The Orders/Products list-endpoint fixes being silently riskier than they look (e.g. breaking an existing frontend caller) | Checked: nothing in the existing storefront frontend called `adminFindAll`/used an admin products list before this milestone — these were genuinely new consumption, not a change to an established contract |
| Bulk import silently corrupting the catalog on a malformed CSV | Each row is independently validated and wrapped in its own try/catch; a bad row fails that row only and is reported, never partially applied (Prisma's own create is atomic per call) |
