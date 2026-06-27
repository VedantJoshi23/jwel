# Jwel

Luxury jewellery e-commerce platform (India). A monorepo containing the
storefront + admin portal frontend (`apps/web`) and the backend API
(`apps/api`), backed by PostgreSQL, Elasticsearch, and a rule-based
recommendation engine.

## Status

**Phase 1 (MVP development) is complete — Milestones 0 through 10.** The
platform has been run end-to-end against a real local PostgreSQL +
Elasticsearch stack, with real seeded catalog/order data driving search,
recommendations, and the admin dashboard. **Phase 2 (testing + DevOps) is
next.**

| Milestone | Scope | Doc |
|---|---|---|
| 0 | Monorepo scaffold | [`docs/milestones/milestone-0-scaffold.md`](docs/milestones/milestone-0-scaffold.md) |
| 1 | Product discovery / requirements | [`PRODUCT.md`](PRODUCT.md) |
| 2 | System architecture (design) | [`ARCHITECTURE.md`](ARCHITECTURE.md) |
| 3 | UX/UI design | [`DESIGN.md`](DESIGN.md) |
| 4 | Database engineering | [`DATABASE.md`](DATABASE.md) |
| 5 | Backend development | [`BACKEND.md`](BACKEND.md) |
| 6 | Frontend development | [`FRONTEND.md`](FRONTEND.md) |
| 7 | Validation + backend completion (Cart, Wishlist, Returns, Notifications, event bus) | [`docs/milestones/milestone-7-validation-and-backend-completion.md`](docs/milestones/milestone-7-validation-and-backend-completion.md) |
| 8 | Search (Elasticsearch) | [`BACKEND.md`](BACKEND.md) §8 |
| 9 | Recommendation engine (rule-based: FBT, recently viewed, trending, personalized) | [`BACKEND.md`](BACKEND.md) §9 |
| 10 | Admin Portal (CMS, Analytics, bulk import, RBAC) | [`BACKEND.md`](BACKEND.md) §10, [`FRONTEND.md`](FRONTEND.md) §7 |

`docs/milestones/` has the full per-milestone breakdown of what was built,
what was validated against a real running stack (not just written), and
what's explicitly deferred.

**Known gap going into Phase 2**: most milestones were validated against
the real backend/database/search index via direct API calls, but
interactive browser testing of the frontend (storefront and admin portal)
has been limited — see `FRONTEND.md` §7.5 for exactly what was and wasn't
verified. That gap is squarely Phase 2's job to close.

## Stack

- **Frontend** (`apps/web`): Next.js 15 (App Router), Tailwind, Zustand,
  React Query
- **Backend** (`apps/api`): NestJS, Prisma, PostgreSQL
- **Search**: Elasticsearch (with a documented Postgres fallback if it's down)
- **Payments**: Stripe (live), Razorpay (stub)
- **Email**: Resend

## Repository layout

```
apps/
  api/     NestJS backend — see BACKEND.md
  web/     Next.js frontend (storefront + /admin portal) — see FRONTEND.md
packages/  Shared types/UI/config — scaffolded, not yet wired into apps (BACKEND.md §5)
docs/
  milestones/   One progress report per milestone
  design/       Wireframe source
ARCHITECTURE.md  System design, bounded contexts, domain model
DATABASE.md      Schema design + Prisma implementation notes
PRODUCT.md       Requirements, personas, journeys, FR list
DESIGN.md        UX/UI design system
SECURITY.md      Security architecture
```

## Running locally

Requires PostgreSQL 16 and (optionally) Elasticsearch running locally.

```bash
# 1. Postgres
brew install postgresql@16 && brew services start postgresql@16
createdb jwel

# 2. Elasticsearch (optional — the API degrades to a Postgres fallback if
#    this isn't running; see BACKEND.md §8.4)
brew install elastic/tap/elasticsearch-full
ES_JAVA_HOME=$(/usr/libexec/java_home -v 17) /opt/homebrew/opt/elasticsearch-full/bin/elasticsearch &

# 3. Backend
cd apps/api
cp .env.example .env        # set DATABASE_URL; other keys can stay placeholders
npm install
npx prisma generate --schema=src/prisma/schema.prisma
npx prisma migrate deploy --schema=src/prisma/schema.prisma
npx nest start               # http://localhost:4000 — Swagger UI at /docs

# 4. Frontend
cd apps/web
cp .env.example .env.local  # NEXT_PUBLIC_API_URL should point at the running API
npm install
npm run dev                  # http://localhost:3000 — Admin Portal at /admin
```

See `BACKEND.md` §11 and `FRONTEND.md` §6 for the full run instructions,
including the environment-specific fixes Elasticsearch needed locally
(Java, X-Pack ML, disk watermark — `BACKEND.md` §8.6).

## Next: Phase 2 — Testing & DevOps

- Automated test suite (unit + integration + e2e) — the largest standing
  gap; every milestone since 7 has found real bugs only by actually
  running the code, never by static review alone
- Interactive browser/E2E validation of the storefront and admin portal
- CI/CD pipeline
- Deployment, observability, and hardening
