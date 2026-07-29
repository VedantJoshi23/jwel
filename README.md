# Jwel

Luxury jewellery e-commerce platform (India). A monorepo containing the
storefront + admin portal frontend (`apps/web`) and the backend API
(`apps/api`), backed by PostgreSQL, Elasticsearch, and a rule-based
recommendation engine.

## Status

**Phase 1 (MVP development) is complete — Milestones 0 through 10.** The
platform has been run end-to-end against a real local PostgreSQL +
Elasticsearch stack, with real seeded catalog/order data driving search,
recommendations, and the admin dashboard.

**Phase 2 (testing + DevOps) is under way.** Milestone 11 built the test suite
(backend Jest unit + integration, frontend Vitest, Playwright E2E) and the CI
workflow; `deploy/` carries a full self-hosted Docker/nginx deployment and
runbook. Milestone 12 is complete — CI proven on Actions, and Razorpay
implemented and validated against real test-mode credentials on the live
deployment (payments, refunds, and webhooks all confirmed working end to end)
— see
[`docs/milestones/milestone-12-ci-and-payments.md`](docs/milestones/milestone-12-ci-and-payments.md).
Only live credentials and the RUNBOOK §13 go-live sequence remain before it
can take real money.

Three client decisions now shape the roadmap:

- **Razorpay is the sole payment provider; Stripe is dropped**
  ([ADR-0005](knowledge/decisions/ADR-0005-razorpay-as-sole-payment-provider.md))
- **Admin is a hybrid** — custom for workflows; categories/coupons/banners
  CRUD is already covered by the existing custom admin (no third-party tool
  needed there); a CRUD framework for *future* entities is deliberately
  undecided (AdminJS was evaluated and rejected on dependency-security
  grounds); Metabase for reporting; a headless CMS for content
  ([ADR-0006](knowledge/decisions/ADR-0006-hybrid-admin-strategy.md))
- **CI now runs on GitHub Actions**, so the Milestone 11 workflow is finally
  being proven on a real runner rather than only locally

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
| 11 | Testing (Jest unit + integration, Vitest, Playwright E2E, CI workflow) | [`docs/milestones/milestone-11-testing.md`](docs/milestones/milestone-11-testing.md) |
| 12 | CI proven on a real Actions runner; Razorpay swap | [`docs/milestones/milestone-12-ci-and-payments.md`](docs/milestones/milestone-12-ci-and-payments.md) |

`docs/milestones/` has the full per-milestone breakdown of what was built,
what was validated against a real running stack (not just written), and
what's explicitly deferred.

**Standing gap**: Milestones 0–10 were validated against the real
backend/database/search index via direct API calls, but interactive browser
testing of the frontend was limited — see `FRONTEND.md` §7.5 for exactly what
was and wasn't verified. Milestone 11's Playwright suite closed part of this
(storefront browsing, auth, admin RBAC, all running in CI against a real
stack); admin CRUD flows and checkout are still not covered end to end.

## Stack

- **Frontend** (`apps/web`): Next.js 15 (App Router), Tailwind, Zustand,
  React Query
- **Backend** (`apps/api`): NestJS, Prisma, PostgreSQL
- **Search**: Elasticsearch (with a documented Postgres fallback if it's down)
- **Payments**: Razorpay (sole provider, behind `PaymentProviderPort` — ADR-0005)
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

## What's next

Full detail and the reasoning behind the ordering is in
[`docs/milestones/milestone-12-ci-and-payments.md`](docs/milestones/milestone-12-ci-and-payments.md).

1. **Milestone 12 — Razorpay ✅.** Implemented per ADR-0005 and validated
   against real test-mode credentials on the live deployment: order creation,
   checkout, payment success/failure, webhook signature verification, the
   webhook/verify idempotency race, and refunds have all run against real
   Razorpay. Only remaining: **live** credentials from the client, then the
   RUNBOOK §13 go-live sequence.
2. **Milestone 13 — Observability**, mostly done, per
   [ADR-0002](knowledge/decisions/ADR-0002-observability-stack.md): Sentry,
   Prometheus `/metrics`, and a self-hosted Grafana are all live on the
   production VM. Only remaining: wiring an alert notification channel
   (email/Slack), deferred pending a client-provided email address.
3. **Milestone 14 — Hybrid admin**, in progress, per
   [ADR-0006](knowledge/decisions/ADR-0006-hybrid-admin-strategy.md): the
   admin audit log and the admin **Returns UI** (the backend existed but no
   page ever called it, found during live refund validation) are both done
   and live. Categories/coupons/banners CRUD was already covered by the
   existing custom admin — ADR-0006 originally described it as an AdminJS gap
   that didn't actually exist; corrected. Remaining: Metabase on a read-only
   user for reporting, and a headless CMS spike (Directus vs. Payload) for
   content. A CRUD framework for *future* admin entities is deliberately
   undecided — AdminJS was evaluated and rejected on dependency-security
   grounds (see ADR-0006) — until a concrete need appears.
4. **Milestone 15 — Deployment / go-live.** `deploy/` is written and
   reasoned-through but has never been executed end to end.
5. **Milestone 16+** — Shipping, WhatsApp/SMS, Fraud/Risk (all specified in
   `knowledge/`, none implemented).

Still open across the board: the frontend is not wired to the Search (M8) or
Recommendations (M9) endpoints; Auth.js bridge; Redis caching; Elasticsearch
index aliasing.
