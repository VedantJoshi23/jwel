# Milestone 6 — Frontend Development

## Architecture Document
No changes to `ARCHITECTURE.md`. See [`FRONTEND.md`](../../FRONTEND.md) for the
two named deviations from the original tech-stack assumptions: a client-side
token store instead of Auth.js (matching BACKEND.md's already-stated gap), and
no server-side Cart API to integrate against (also matching BACKEND.md).

## Tasks Completed
- [x] Next.js 15 App Router app scaffolded at [`apps/web`](../../apps/web) —
      `package.json`, `tsconfig.json`, `next.config.mjs`, `tailwind.config.ts`
      mapped 1:1 to DESIGN.md §2 tokens
- [x] All 7 required pages implemented: Homepage, Search, Collections, Product
      Details, Cart, Checkout, Profile — plus Login/Register, flagged as
      necessary additions
- [x] SSR on Homepage/Search/Collections/Product Details via Server Component
      `fetch()` calls direct to the NestJS API
- [x] SEO: `generateMetadata` on Collections/PDP, JSON-LD structured data on
      PDP, `app/sitemap.ts` (dynamic from API), `app/robots.ts`
- [x] Accessibility: skip-link, semantic landmarks, focus-visible rings,
      aria-live regions, aria-labelled icon buttons, 44px touch targets,
      radiogroup semantics on variant selector
- [x] Responsive: mobile-first Tailwind grids throughout (DESIGN.md §6
      breakpoints)
- [x] TypeScript throughout, Tailwind CSS, hand-built Shadcn-style component
      primitives on Radix, TanStack React Query for client-side data
      (search refine, profile orders/addresses), Zustand for cart/auth state
- [x] Full integration against the actual Milestone 5 API contracts (DTOs
      mirrored in `lib/api/types.ts`, checkout submits the exact `CreateOrderDto`
      shape the backend expects)

## Tasks Remaining
- [ ] Run `pnpm install` + `pnpm dev` and manually verify every page in a
      browser against a live `apps/api` — **this code has never been executed**
- [ ] Stripe Elements card-collection UI on Checkout (currently creates the
      order + payment intent but doesn't render Stripe's card form)
- [ ] Mobile nav drawer (header nav currently just hides below `md` with no
      replacement)
- [ ] Review submission form on PDP (display-only currently; backend endpoint
      already supports submission)
- [ ] Wishlist, Order Tracking, Admin Dashboard pages — not in this milestone's
      page list, DESIGN.md already spec'd them for a future pass
- [ ] Real product imagery once a storage-to-public-URL resolution path exists
      (backend or frontend side)
- [ ] Wire `packages/types` instead of hand-duplicated types in
      `lib/api/types.ts`
- [ ] Bridge to a real Auth.js integration (httpOnly session) instead of the
      interim client-side token store
- [ ] Playwright/Vitest test setup (referenced in tech stack, not present yet)
- [ ] Build a real Collections API on the backend so `/collections/[slug]`
      stops being a Category-filter alias

## Updated Roadmap
1. Milestone 0 — Scaffold ✅
2. Milestone 1 — Product Discovery ✅
3. Milestone 2 — System Architecture ✅
4. Milestone 3 — UX/UI Design ✅
5. Milestone 4 — Database Engineering ✅
6. Milestone 5 — Backend Development ✅
7. **Milestone 6 — Frontend Development ✅ (this milestone)**
8. Milestone 7 — Integration verification (run both apps together end-to-end
   for the first time; this is the first milestone where that becomes possible)
9. Milestone 8 — Customer Features completion (Wishlist, Order Tracking, Cart
   module on the backend, review submission UI, Returns)
10. Milestone 9 — Admin Panel + Admin Dashboard frontend
11. Milestone 10 — Advanced/AI (Recommendation, Gift Engine, real Collections API)
12. Milestone 11 — Payments hardening (Stripe Elements, Razorpay activation
    decision)
13. Milestone 12 — Observability & Hardening (Redis, event bus, Auth.js
    bridge, test suites, real OWASP/WCAG/perf audits in a browser)
14. Milestone 13 — Deployment

## Risks and Mitigations
| Risk | Mitigation |
|---|---|
| Neither this milestone's code nor Milestone 5's has ever actually run — integration bugs are likely on first real run | Explicitly flagged as the top remaining task across both BACKEND.md and FRONTEND.md; Milestone 7 is proposed specifically as an integration-verification pass rather than assuming Milestone 6 "ships" as-is |
| localStorage-based auth token is more XSS-exposed than the Auth.js session model the architecture specified | Named explicitly in FRONTEND.md §3.1 as a real security gap, not presented as equivalent; CSP headers (SECURITY.md §6) partially mitigate but don't close this gap |
| "Collections" page silently could be mistaken for the real curated-collection feature | Documented prominently in FRONTEND.md §4 and inline code comments — it is a Category filter, not the `Collection` Prisma model, until a real backend endpoint exists |
| Checkout creates a real order + payment intent without collecting card details, which could look like "payment is wired up" if read superficially | Inline UI copy on the checkout page itself tells the user this directly, plus FRONTEND.md §4 names it as incomplete rather than implying Stripe integration is finished |
| No automated or manual browser verification yet | Tracked as the single most important remaining task before this is presented as done to any real user |
