# Jwel — Architecture Document (Milestone 0: Scaffold)

## 1. System Overview

Jwel is a luxury jewellery e-commerce platform serving the Indian market, built as a
monorepo with a decoupled frontend (Next.js) and backend (NestJS), following Clean
Architecture and Domain-Driven Design principles.

## 2. Monorepo Layout

```
Jwel/
├── apps/
│   ├── web/              # Next.js 15 + React 19 storefront & admin UI
│   └── api/               # NestJS backend (REST/GraphQL, domain logic)
├── packages/
│   ├── ui/                 # Shared Shadcn/Tailwind component library (storefront + admin)
│   ├── types/             # Shared TypeScript contracts (DTOs, domain types) between web & api
│   ├── config/            # Shared eslint/tsconfig/tailwind config presets
│   └── utils/              # Pure shared utilities (formatting, validation schemas, etc.)
├── infra/
│   ├── docker/             # Dockerfiles, docker-compose for local dev (Postgres, Redis, ES)
│   ├── github-actions/    # CI/CD workflow definitions
│   ├── aws/                # ECS task defs, S3 bucket policies, IaC
│   └── monitoring/         # Grafana dashboards, Prometheus scrape configs
├── docs/
│   ├── architecture/       # This document + ADRs per milestone
│   ├── milestones/        # Per-milestone task/roadmap/risk reports
│   └── design/             # Wireframes (GLINT reference design) and design tokens
└── scripts/                 # Repo-level automation (db seed, codegen, etc.)
```

## 3. Architectural Principles

- **Clean Architecture / DDD in `apps/api`**: domain layer (entities, value objects,
  domain services) has zero framework dependencies; application layer orchestrates
  use-cases; infrastructure layer implements ports (Prisma repos, S3 adapter, Redis
  cache, Elasticsearch client) behind interfaces defined in the domain layer.
- **Storage abstraction**: All file storage goes through a `StorageProvider` port
  (`packages/types` defines the interface). The initial adapter targets AWS S3; a
  filesystem/standalone adapter can be swapped in without touching domain code —
  satisfies the "easy migration off cloud storage" requirement.
- **Component reusability (frontend)**: `packages/ui` holds atomic, prop-driven
  components (ProductCard, Filter, PriceTag, Banner, FooterColumn, etc.) extracted
  from the GLINT wireframe's repeated structures (header, footer, product grid cell,
  bestseller card). Every visual block in the wireframe that repeats across the 7
  frames becomes exactly one component, configured via props/variants — so client
  revisions are config changes, not rewrites.
- **API contracts**: `packages/types` is the single source of truth for DTOs shared
  between `apps/web` and `apps/api`, preventing drift.
- **Payments**: Stripe is the live integration target; Razorpay is wired as a
  dummy/stub provider behind a common `PaymentProvider` interface — not activated
  this phase.

## 4. Tech Stack (confirmed)

| Layer | Choice |
|---|---|
| Frontend | Next.js 15, React 19, TypeScript, Tailwind CSS, Shadcn UI, Framer Motion |
| Backend | NestJS, TypeScript |
| Database | PostgreSQL via Prisma |
| Cache | Redis |
| Search | Elasticsearch |
| Storage | AWS S3 (behind swappable `StorageProvider` port) |
| Auth | Auth.js |
| Payments | Stripe (live), Razorpay (stub) |
| Email | Resend |
| Analytics | PostHog |
| Infra | Docker, GitHub Actions, AWS ECS |
| Monitoring | Grafana, Prometheus |
| Testing | Playwright, Vitest, Jest |
| Docs | Swagger (API) |

## 5. Design Source

`docs/design/glint-wireframe.html` — the approved low-fi wireframe (7 desktop frames:
homepage ×2 hero variants, shop grid, category, product detail, bag, checkout).
Recurring structural patterns identified for componentization:

- Sticky promo bar, header w/ search, footer (newsletter + help/other columns)
- Product grid cell (image, name, price chip)
- Bestseller / "Shop similar" card (image, price chip, name, subtitle, CTA)
- Filter sidebar accordion item + checkbox group
- Category pill / tab selector
- Cart line item row, checkout summary row

These map directly to `packages/ui` components planned for the Design System milestone.

## 6. Status

This document covers **Milestone 0 — repository scaffold only**. No application code,
schema, or business logic has been implemented. Awaiting Milestone 1 instructions.
