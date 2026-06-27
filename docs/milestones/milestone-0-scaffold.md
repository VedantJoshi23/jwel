# Milestone 0 — Repository Scaffold

## Tasks Completed

- [x] Created mega-repo root at `~/Documents/Jwel`
- [x] Defined monorepo structure: `apps/{web,api}`, `packages/{ui,types,config,utils}`, `infra/{docker,github-actions,aws,monitoring}`, `docs/{architecture,milestones,design}`, `scripts/`
- [x] Root `package.json` with pnpm workspaces + Turborepo task graph
- [x] `pnpm-workspace.yaml`, `turbo.json`, root `.gitignore`
- [x] Copied approved GLINT wireframe into `docs/design/glint-wireframe.html` as design source of truth
- [x] Architecture document (`docs/architecture/architecture.md`) capturing layout, principles, stack, and componentization plan derived from the wireframe

## Tasks Remaining (deferred to future milestones)

- [ ] Scaffold `apps/web` (Next.js 15 + React 19 + TS + Tailwind + Shadcn + Framer Motion)
- [ ] Scaffold `apps/api` (NestJS + TS, Clean Architecture layers)
- [ ] Prisma schema + PostgreSQL connection, initial domain entities
- [ ] Redis cache module, Elasticsearch client module
- [ ] Auth.js integration (customer + admin roles)
- [ ] `packages/ui` design system: extract reusable components from wireframe (header, footer, product card, filter accordion, bestseller card, cart row, checkout row)
- [ ] `packages/types` shared DTO contracts
- [ ] Storage abstraction (`StorageProvider` port + S3 adapter)
- [ ] Payment provider interfaces (Stripe live, Razorpay stub)
- [ ] Docker Compose for local dev (Postgres, Redis, ES, API, Web)
- [ ] GitHub Actions CI (lint/test/build)
- [ ] Swagger setup for API docs
- [ ] Testing scaffolds (Vitest, Jest, Playwright)

## Updated Roadmap

1. **Milestone 0 — Scaffold** ✅ (this milestone)
2. **Milestone 1 — Foundations**: app scaffolds, DB schema, auth, storage abstraction, CI baseline
3. **Milestone 2 — Design System**: `packages/ui` component library reflecting GLINT wireframe, fully prop-driven/reusable
4. **Milestone 3 — Storefront Core**: home, shop/category grid, product detail, cart, checkout (UI wired to mock/local API)
5. **Milestone 4 — Backend Domain**: product, inventory, order, user, coupon domains (NestJS, Clean Architecture, Prisma)
6. **Milestone 5 — Customer Features**: auth, wishlist, search/filters, reviews, order tracking, returns
7. **Milestone 6 — Admin Panel**: product/inventory/order/user management, analytics dashboard, CMS, discounts
8. **Milestone 7 — Advanced/AI**: recommendations, personalized collections, try-on prep, comparison, gift engine
9. **Milestone 8 — Payments**: Stripe live integration; Razorpay remains stub
10. **Milestone 9 — Observability & Hardening**: Grafana/Prometheus, security review (OWASP), accessibility (WCAG) audit, performance pass, SEO pass
11. **Milestone 10 — Deployment**: Docker, GitHub Actions, AWS ECS rollout

## Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Client revisions to UI could force rewrites | All wireframe-derived UI built as prop-driven, reusable `packages/ui` components from Milestone 2 onward |
| Cloud storage lock-in (S3) | Storage access goes through a `StorageProvider` port; S3 is just one adapter — standalone/filesystem adapter can be added without touching domain/app code |
| Razorpay added prematurely | Kept as a dummy/stub behind a `PaymentProvider` interface; no live wiring until explicitly requested |
| Scope creep across milestones | Strict milestone gating — no feature code written until the corresponding milestone is requested |
| Type drift between frontend/backend | Single shared `packages/types` package as the only source of DTO/domain-type truth |
