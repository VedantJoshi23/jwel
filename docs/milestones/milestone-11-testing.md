# Milestone 11 — Testing

## Architecture Document
No changes to ARCHITECTURE.md's design — this milestone adds a test
infrastructure layer (Jest unit + Jest/Supertest integration for the
backend; Vitest + React Testing Library + Playwright for the frontend) that
verifies the existing design, rather than changing it. BACKEND.md §11 and
FRONTEND.md §8 carry the actual detail; this doc is the milestone summary.

## Tasks Completed
- [x] Backend Jest unit tests: 334 tests across 42 suites covering every
      service (mocked Prisma, no database) and every controller (mocked
      service, asserting delegation) — 98.32% statements / 90.63% branches /
      96.57% functions / 98.70% lines, all above the 90% target, enforced as
      a hard `coverageThreshold` in `package.json`
- [x] Backend Jest+Supertest integration tests: 30 tests across 4 suites,
      a real NestJS app against a real `jwel_test` Postgres database — auth,
      products (admin CRUD + draft/publish/archive lifecycle), coupons
      (validation + redemption), CMS + Analytics (RBAC + scheduling window)
- [x] Frontend Vitest + React Testing Library unit/component tests: 162
      tests across 39 files — 99.95% statements / 99.08% branches / 98.83%
      functions / 99.95% lines, covering every `lib/api/*.ts` wrapper, both
      Zustand stores, every UI primitive and product/cart/admin component
      that isn't a thin Server Component passthrough
- [x] Playwright E2E tests: 12 tests across 3 spec files, a real Chromium
      browser against the real `next dev` server against the real API
      against the real Postgres database — storefront browsing (including a
      real 404 and a real add-to-cart-then-view-cart round trip),
      authentication (register/login/duplicate-email/wrong-password,
      including a logout-then-login-again proving server-side persistence),
      and admin RBAC (unauthenticated and CUSTOMER-role redirects)
- [x] CI pipeline (`.github/workflows/ci.yml`): 4 jobs — backend unit+
      integration (with a real `postgres:16` service container),
      frontend unit, typecheck (both apps), and E2E (builds + boots the API
      from `dist/`, runs Playwright against it)
- [x] Found and fixed 4 real bugs/gaps in the process of writing these
      tests (not by re-reading the code looking for problems):
  - `POST /auth/login` and `POST /coupons/validate` both returned HTTP 201
    instead of 200 (Nest's `@Post` default; neither endpoint creates a
    resource) — `auth.controller.ts` had even already documented 200 in its
    Swagger decorator while actually returning 201
  - `tsconfig.json`'s `"types": ["jest"]` silently excluded
    `@types/multer`'s global augmentation, a real compile error `nest
    start`'s transpile-only mode had been hiding since Milestone 10
  - Vitest's default glob picked up Playwright's `e2e/*.spec.ts` files and
    failed to parse them — fixed with an explicit `exclude`
  - Radix UI's `Tabs` activates on `pointerdown`, not `click` — caught by a
    failing component test, fixed by adopting `@testing-library/user-event`
    rather than hand-rolling a synthetic event sequence

## Tasks Remaining
- [ ] **CI has not yet run on a real GitHub Actions runner** — every command
      in `ci.yml` was run and confirmed working locally during this
      milestone, but the workflow file itself hasn't executed end-to-end on
      Actions yet. That first real run is the actual proof, not this
      write-up (BACKEND.md §11.5 says this explicitly).
- [ ] E2E coverage of admin CRUD flows (creating a coupon, publishing a
      product, running a bulk import) through a real browser — only RBAC
      redirects are E2E-tested for the admin surface so far
- [ ] No checkout E2E test — blocked on the same placeholder Stripe
      credentials gap named since Milestone 7
- [ ] No mutation testing — line/branch coverage numbers prove code ran,
      not that the assertions would catch a real regression
- [ ] No load/performance testing of the inventory race-safety path under
      real concurrent checkout load
- [ ] CI's E2E job runs against a freshly-migrated, unseeded database — no
      seed-data step exists yet, so it hasn't been proven that today's E2E
      specs (written to avoid depending on specific seeded products) would
      actually still pass against that from-scratch database in CI, only
      that they pass locally against dev data that already has products in it

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
11. Milestone 10 — Admin Portal ✅
12. **Milestone 11 — Testing ✅ (this milestone)**
13. Milestone 12 — Prove CI on a real Actions runner; admin CRUD E2E
    coverage; seed-data step for CI's database
14. Milestone 13 — Payments hardening (real Stripe credentials, refund API,
    checkout E2E), Redis caching, materialized views for Analytics
15. Milestone 14 — Observability & Hardening, Auth.js bridge
16. Milestone 15 — Deployment

## Risks and Mitigations
| Risk | Mitigation |
|---|---|
| Claiming "CI is set up" when it's never actually run on Actions | Said so explicitly in both BACKEND.md §11.5 and this doc — the workflow file is reasoned-through and every command verified locally, but that is a different claim from "proven on a real runner," and the gap is named, not glossed over |
| Coverage numbers becoming a vanity metric (tests that execute code without asserting anything meaningful) | Every test asserts a specific behavior (a thrown exception, a specific call argument, a specific computed value) — none are bare smoke tests that just render/call something with no expectation; spot-checked during writing, e.g. the orders/recommendations specs assert exact mock-call arguments, not just "didn't throw" |
| Testing thin controllers inflating the test count without adding real value | Named the tradeoff explicitly (BACKEND.md §11.1) rather than pretending controller tests are high-value — they exist because the 90% target's denominator includes them, and excluding them would have meant an ever-growing manual exclusion list instead |
| Two real bugs (login/coupon-validate status codes) shipped all the way back in Milestone 5, undetected for 6 milestones | This is the same pattern named in BACKEND.md repeatedly across milestones ("every milestone since 7 has found real bugs only by actually running the code") — the fix here is the same as always: keep writing tests that exercise real behavior, not assume earlier manual validation caught everything |
