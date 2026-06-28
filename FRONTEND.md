# Jwel — Frontend Implementation

**Milestone 6 — Frontend Development · Admin Portal added Milestone 10 · Test suite added Milestone 11**
**Role:** Frontend Lead Engineer (Milestone 6) / Enterprise Admin Platform Engineer (Milestone 10) / QA Lead (Milestone 11)
**Input:** [`DESIGN.md`](DESIGN.md), consuming [`apps/api`](apps/api) (Milestone 5)
**Location:** [`apps/web`](apps/web) (Next.js 15, App Router)
**Status:** Implemented and run against a real live backend/database starting
Milestone 7 (this line was stale until Milestone 10 — see BACKEND.md for the
pattern of documentation drifting from what's actually been validated). See
§7 for the Admin Portal added in Milestone 10, §8 for the test suite added in
Milestone 11.

---

## 1. Scope Delivered

| Page | Route | Rendering |
|---|---|---|
| Homepage | `/` | SSR (Server Component, direct API fetch) |
| Search | `/search` | SSR initial render + client-side refine (React Query) |
| Collections (PLP) | `/collections/[slug]` | SSR, filters via GET form, pagination via links |
| Product Details | `/product/[slug]` | SSR + `generateMetadata` + JSON-LD structured data |
| Cart | `/cart` | Client-rendered (see §3) |
| Checkout | `/checkout` | Client-rendered (see §3) |
| Profile | `/profile` | Client-rendered, auth-gated (see §3) |

Plus two pages not in the milestone's literal list but required for Profile/
Checkout to function at all: `/login` and `/register`. Flagged the same way
Cart/ProductVariant were flagged as necessary additions in Milestone 5 — not
silently expanded scope.

Stack: **TypeScript, Tailwind CSS (tokens lifted directly from DESIGN.md §2),
hand-built Shadcn-style primitives on Radix (Button/Input/Badge/Card/Tabs/
Checkbox/Skeleton/Separator), TanStack React Query, Zustand** for client state
(cart + auth — see §3).

---

## 2. SSR / SEO / Accessibility / Responsive — How Each Requirement Was Met

- **SSR**: Homepage, Search (initial), Collections, and Product Details are
  React Server Components that `fetch()` the NestJS API directly at request
  time — real server rendering, not client-side data fetching wrapped in a
  loading spinner. Each degrades gracefully (empty section, not a crash) if
  the API is unreachable, since this code has not yet been run against a live
  backend (see §5).
- **SEO**: `generateMetadata` on Collections and Product Details pages
  (title/description/OG tags from real product data); JSON-LD `Product`/
  `AggregateOffer`/`AggregateRating` structured data on the PDP (NFR-7);
  `app/sitemap.ts` enumerates published products dynamically from the API;
  `app/robots.ts` disallows the non-canonical cart/checkout/profile/search
  routes from indexing.
- **Accessibility (WCAG 2.1 AA target, per DESIGN.md §7)**: skip-to-content
  link, semantic landmarks (`header`/`nav`/`main`/`footer`), a visible
  `:focus-visible` ring on every interactive element (never color-only state),
  `role="radiogroup"`/`aria-checked` on the variant selector, `aria-live`
  regions on cart-confirmation and search-loading states, `aria-label` on every
  icon-only button, 44px minimum touch targets on steppers/toggles. No real
  product photography exists yet (placeholder blocks, same as the GLINT
  wireframe), so every placeholder carries a descriptive `aria-label` instead
  of decorative alt text.
- **Responsive**: Tailwind mobile-first throughout — grids collapse from
  4/3-column to 2-column below `lg`, the Collections filter sidebar stacks
  above the grid on narrow viewports (CSS grid reflow, not a separate mobile
  component), header nav links hide below `md` (a mobile nav drawer is not yet
  built — see §4).

---

## 3. Structural Decision: SSR Where It's Free, Client Where State Demands It

Cart, Checkout, and Profile are `'use client'` pages, trading SSR for direct
access to client-only state:

- **Cart** has no backend persistence to render server-side — BACKEND.md §4
  already names "no Cart module" as a deferred gap. The bag lives in
  `localStorage` via a Zustand store (`lib/cart-store.ts`), so there is nothing
  for the server to fetch.
- **Checkout** needs that same client-held cart plus the client-held auth
  token to call `POST /orders`.
- **Profile** needs the client-held auth token to call `/me`, `/orders`,
  `/me/addresses`.

This is consistent with, not a deviation from, the backend's actual contract:
`CreateOrderDto` already accepts a flat `items[]` array (BACKEND.md §4 notes
the backend never built a server-side Cart API), so the frontend's local cart
is the correct shape to submit directly at checkout — no client-side
reinvention of a cart API the backend doesn't have.

## 3.1 Auth: Interim Token Store, Not Auth.js

ARCHITECTURE.md's tech stack names Auth.js for the frontend. BACKEND.md §4
already flagged that the NestJS backend issues its own JWT rather than
validating an Auth.js session. This milestone's frontend matches that reality
rather than building against an integration that doesn't exist yet:
`lib/auth-store.ts` holds the access token client-side (Zustand + `localStorage`),
sent as a Bearer header on every authenticated call. This is **not** equivalent
to Auth.js's httpOnly-cookie session model from a security standpoint — a
token sitting in `localStorage` is more exposed to XSS than an httpOnly cookie
would be. Named explicitly here, not glossed over: bridging to a real Auth.js
integration is open work for a future milestone, not a stylistic choice.

---

## 4. Explicitly Deferred / Simplified (Not Implemented This Milestone)

- **No Stripe Elements card-collection UI.** Checkout calls `POST /orders`,
  which creates the order and a Stripe `clientSecret` server-side (per
  BACKEND.md), but the frontend does not render Stripe's card-entry widget or
  call `confirmCardPayment` — the checkout form says so explicitly to the user
  rather than silently pretending payment is complete. The confirmation page
  shows the order as placed, not as paid.
- **No Wishlist, Order Tracking, or Admin Dashboard pages.** Not in this
  milestone's 7-page list (Homepage, Search, Collections, Product Details,
  Cart, Checkout, Profile) — DESIGN.md spec'd these but they're not built here.
- **"Collections" maps to Category, not the `Collection` Prisma model.**
  `apps/api` has no Collections endpoint (out of Milestone 5's 8-module
  scope), so `/collections/[slug]` actually filters products by **category**
  slug. Renaming the route would be premature until a real Collections API
  exists — flagged here so it isn't mistaken for the curated-collection
  feature PRODUCT.md describes.
- **No review submission UI.** The backend's `POST /reviews` endpoint exists
  and works; the PDP only *displays* approved reviews, with no "write a
  review" form yet.
- **No mobile nav drawer.** Header nav links are hidden below `md` with no
  replacement hamburger menu — a real gap against DESIGN.md §6's responsive
  spec, not a silent omission.
- **No real product imagery.** Every image slot is a labeled placeholder
  block, matching the GLINT wireframe's convention, because `ProductMedia.
  storageRef` has no public URL resolution implemented anywhere yet (frontend
  or backend).
- **`packages/types` still unused.** Frontend API types in `lib/api/types.ts`
  are hand-duplicated from the backend's actual response shapes rather than
  imported from a shared package — same gap BACKEND.md §5 already named from
  the other side.
- **No automated tests** (Playwright/Vitest referenced in the tech stack are
  not set up in `apps/web` yet).

---

## 5. Not Yet Done (Operational)

- **This code has never been run against the live backend.** No `pnpm install`
  has been executed, no dev server has been started, and no page has been
  visually verified in a browser. Every data-fetching path has a fallback for
  "API unreachable" (empty state, not a crash), but that fallback path is the
  only one that has effectively been exercised so far.
- Before claiming this is "working," it needs: `pnpm install` in `apps/web`,
  a running `apps/api` with a migrated database and seeded products, then a
  manual walk of Homepage → Collections → PDP → add to bag → Checkout →
  Confirmation, plus Login/Register/Profile, in an actual browser.

---

## 6. How to Run (once both apps' dependencies are installed)

```bash
cd apps/web
cp .env.example .env.local   # NEXT_PUBLIC_API_URL should point at a running apps/api
npm install                  # root package.json declares pnpm, but every install this
                              # project has actually run has used npm — see BACKEND.md
npm run dev                   # http://localhost:3000 — Admin Portal at /admin

# Tests (see §8):
npm run test:cov              # Vitest unit/component tests with the 90% coverage gate
npx playwright install chromium  # once
npm run test:e2e              # Playwright — needs apps/api + Postgres already running
```

---

## 7. Milestone 10 — Admin Portal

### 7.1 Routing: a real `/admin` prefix, not the original sketch
ARCHITECTURE.md §8's folder sketch put admin routes at `app/(admin)/products/...`,
`app/(admin)/orders/...`, etc. — but those URLs (`/products`, `/orders`)
**collide** with the storefront's own public routes. Built instead as
`app/(admin)/admin/products/...` etc. — the `(admin)` segment is a non-routing
Next.js route group (purely organizational), and the real URL prefix is the
`admin/` folder inside it. A deliberate, necessary deviation from the original
sketch, not an oversight.

### 7.2 RBAC: a UX gate, not the security boundary
`components/admin/admin-guard.tsx` checks `useAuthStore`'s `user.role` against
`['ADMIN', 'STAFF']` client-side and redirects otherwise — but this is
explicitly **not** what actually protects admin data. Every admin API call
still goes through the backend's `RolesGuard` (`@Roles(Role.ADMIN, Role.STAFF)`
on every admin controller method, already built since Milestone 5). The
frontend guard's only job is to not flash admin UI/data at a CUSTOMER before
the (real) 403 comes back — confirmed directly: the server-rendered HTML for
an unauthenticated `GET /admin` request contains only the "Checking access…"
fallback, never the dashboard shell or any fetched data.

### 7.3 Modules delivered
| Module | Route | Backed by |
|---|---|---|
| Reports / Analytics Dashboard | `/admin` | New `AnalyticsService` (BACKEND.md §10.2) — revenue, order-status breakdown, top products, low-stock count, pending reviews, new customers, with a date-window selector |
| Products | `/admin/products` | New `GET /admin/products` list endpoint (didn't exist before — admins previously had no way to list drafts) + status transitions + bulk CSV import |
| Inventory | `/admin/inventory` | Existing `GET /admin/inventory/low-stock` + adjust-stock endpoint (Milestone 5) |
| Orders | `/admin/orders` | Existing `GET/PATCH /admin/orders` — **fixed** to actually paginate and include customer info (BACKEND.md §10.2; it previously ignored its own pagination params and had no way to show who placed an order) |
| Customers | `/admin/customers` | Existing `GET /admin/users` + suspend (Milestone 5) |
| Coupons | `/admin/coupons` | Existing coupon CRUD (Milestone 5), plus a create-campaign form |
| CMS | `/admin/cms` | New `CmsService`/`Banner` model (BACKEND.md §10.1) — homepage banners only, not FR-23's full scope |

### 7.4 Bulk Import UX
A single CSV file input on the Products page hits
`POST /admin/products/bulk-import` (multipart) and renders a per-row result:
total/succeeded/failed counts plus a row-numbered error list (e.g. "Row 3:
Category with slug "x" not found") — mirrors exactly what the backend
service returns, no client-side reinterpretation of failures.

### 7.5 What's NOT verified — said plainly
The Chrome browser-automation tool was unavailable in this session (the
extension never connected), so the **interactive, logged-in** behavior of
every admin page — actually clicking "Publish," submitting the coupon form,
seeing the dashboard populate after login — was **not observed directly in
a browser**. What was verified instead, directly:
- Every new/changed backend endpoint, via `curl` against the real running
  API and database (analytics numbers, CMS banner CRUD, bulk import
  including a real multi-row CSV with two deliberately-broken rows, the
  fixed `/admin/orders` and new `/admin/products` list endpoints).
- `tsc --noEmit` across the whole frontend — zero errors from any new admin
  file (and a pre-existing, unrelated Milestone 6 type error in
  `lib/api/products.ts` was found and fixed in the process).
- All 7 admin routes return `200` and compile under `next dev`'s real
  module graph (793-826 modules each, in the actual server log, not assumed).
- The RBAC gate's no-token case specifically, via the raw server-rendered
  HTML (confirms no data/markup leak, not just "the redirect probably works").

What's genuinely unverified: whether the client-side `fetch` calls inside
each page actually populate the tables correctly once a real ADMIN token is
in `localStorage`, and whether the forms (coupon create, banner create)
submit correctly through the browser's `FormData`/`fetch` machinery. The
wrapper functions calling those endpoints were exercised directly via curl
with identical payloads and worked — but that is not the same claim as "the
React form works," and this section says so rather than implying otherwise.

### 7.6 What's NOT done
- Drag-and-drop banner image upload — `imageRef` is a plain text field; an
  admin must already have an uploaded asset's storage path (Storage module
  port exists per ARCHITECTURE.md but isn't wired into this CMS UI).
- No product create/edit form beyond status transitions and bulk CSV import
  — creating a single product with custom fields still requires the API
  directly (Swagger UI) or a CSV with one row.
- No audit log of admin actions (who changed what, when) — `Role`-based
  access is enforced, but there's no activity trail beyond what Postgres
  itself implicitly retains (e.g. `updatedAt`).
- Inventory table shows variant ids, not product/variant names — the
  `low-stock` endpoint doesn't join to product data; cross-referencing with
  the Products page is the workaround for now.

---

## 8. Milestone 11 — Test Suite

### 8.1 §7.5's gap, actually closed this time
Milestone 10 (§7.5) explicitly flagged that no interactive browser testing
had been done — the Chrome automation tool wasn't available that session,
so RBAC and the admin pages were verified at the backend/SSR-HTML level
only, not by actually clicking through a real browser. This milestone closes
that gap for real: Playwright drives an actual Chromium browser against the
actual `next dev` server against the actual NestJS API against the actual
Postgres database for every E2E spec below. Component-level interaction
(forms, the cart, the variant selector) is covered by Vitest + React Testing
Library instead, which is real DOM rendering and real event dispatch, just
not a full browser process.

### 8.2 Two tiers, two different jobs
- **Unit/component tests** (Vitest + `@testing-library/react`, `*.test.ts(x)`
  next to the file they test) — pure functions (`formatMinorUnits`, `cn`,
  cart math), Zustand stores exercised directly (no mocking — `useCartStore`
  is the real store, reset between tests), every API client wrapper function
  (asserting the right URL/method/body/headers against a stubbed `fetch`,
  the same pattern for all 16 `lib/api/*.ts` files), and every component that
  isn't a thin Server Component passthrough — including Radix-based
  primitives (`Tabs`, `Checkbox`) and the admin RBAC guard (mocking
  `next/navigation`'s `useRouter`, asserting the actual redirect target).
- **E2E tests** (Playwright, `e2e/*.spec.ts`) — three spec files:
  storefront browsing (homepage, search, PDP, a real nonexistent-slug 404,
  add-to-cart updating the header badge and cart page), authentication
  (register, duplicate-email rejection, wrong-password rejection, a full
  register-then-logout-then-login-again round trip proving the account is
  real in Postgres, not just in page memory), and admin RBAC (unauthenticated
  and CUSTOMER-role redirects away from `/admin` and a sub-route).

### 8.3 Coverage: 90% target, met on real numbers
```
162 tests, 39 files — 99.95% stmts / 99.08% branches / 98.83% funcs / 99.95% lines
```
Enforced via `vitest.config.mts`'s `coverage.thresholds` — `npm run test:cov`
fails below 90% on any metric, same enforcement mechanism as the backend.

### 8.4 Real bugs/gaps found by writing these tests, not assumed away
- **Vitest's default test-file glob picked up Playwright's `e2e/*.spec.ts`
  files** and failed to parse them (`test.describe()` from the wrong test
  runner's globals) — caught immediately the first time `vitest run
  --coverage` was run after the E2E specs existed. Fixed with an explicit
  `exclude: ['**/e2e/**']` in `vitest.config.mts`, not a per-file workaround.
- **Radix UI's `Tabs` trigger activates on `pointerdown`, not `click`** — a
  plain `fireEvent.click` in the first attempt at the tabs test never
  switched the active tab (the DOM dump in the failure showed `data-state`
  never changed). Fixed by introducing `@testing-library/user-event`, which
  simulates the full real pointer-event sequence a browser actually
  dispatches — the *right* fix (matching real interaction semantics), not
  papering over a real-feeling but synthetic interaction gap with
  `fireEvent.pointerDown` + `fireEvent.click` (tried first, still didn't
  work, because Radix's internal sequencing expects more than just those
  two events in the right order).
- **`vitest.config.ts` failed outright** (`ESM file cannot be loaded by
  require`) the first time it tried to load `vite-tsconfig-paths` — `apps/
  web`'s `package.json` has no `"type": "module"`, so Node's CommonJS
  resolution couldn't load an ESM-only dependency. Fixed by renaming the
  config to `vitest.config.mts`, the documented standard fix, rather than
  adding `"type": "module"` to the whole package (which would have had
  wider, unreviewed blast radius on Next.js's own build).

### 8.5 What's NOT done
- **No E2E coverage of the admin CRUD flows themselves** — only RBAC
  (who can/can't reach `/admin`) is E2E-tested; actually creating a coupon,
  publishing a product, or importing a CSV through the real admin UI in a
  real browser has not been exercised end-to-end. Named explicitly, not
  silently implied by the RBAC tests passing.
- **No checkout E2E test** — Stripe's placeholder key (a standing gap since
  Milestone 7) makes a real checkout-to-payment-intent round trip
  unexercisable without live credentials; add-to-cart and the cart page are
  E2E-tested, the payment step is not.
- **No visual regression testing** — component tests assert DOM structure/
  text/attributes, not pixel output.
- **CI hasn't run Playwright against a from-scratch CI database** — see
  BACKEND.md §11.4's matching note; today's E2E suite has only been proven
  against local dev data.
