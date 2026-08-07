---
id: ADR-0013
title: Next.js App Router as the frontend framework
version: 0.1.0
status: Accepted
owner: Architecture
reviewers:
  - Vedant
created: 2026-08-07
updated: 2026-08-07
milestone: M3
category: Decisions
priority: High
depends_on: []
required_by: []
related_documents:
  - ARCH-001
related_decisions:
  - ADR-0011
  - ADR-0006
tags:
  - technology
  - frontend
risk: Low
complexity: Medium
---

# ADR-0013 — Next.js App Router as the frontend framework

> **Retroactively recorded.** Taken pre-Oriveda and never written down.
> Authored 2026-08-07 under `OV-004` to close the gap Constitution **Law 2**
> exists to prevent. **The reasoning below is reconstructed from evidence**, not
> a contemporaneous record; where the original deliberation is unknown this
> document says so rather than inventing it.

## Context

The storefront needed server-side rendering for SEO — `PRODUCT.md` NFR-7 calls
for server-rendered category and product pages with structured data, competing
against established organic footprints. It also needed to host the admin portal
in the same deployment, per `ADR-0006`'s hybrid admin strategy.

## Options Considered

- **Next.js (App Router)** — SSR/ISR by default, file-system routing with route
  groups, React Server Components, mature SEO primitives (`sitemap.ts`,
  `robots.ts`, metadata API). Framework-level opinions and a fast release train.
- **Remix** — comparable SSR story, arguably a cleaner data-loading model.
  Smaller ecosystem and, at decision time, a less certain trajectory.
- **Vite + React SPA** — simplest and fastest to develop, and **disqualified by
  NFR-7**: a client-rendered storefront concedes the organic-search position the
  business strategy depends on.

## Decision

**Next.js App Router.** SSR was a hard requirement, and route groups gave a
clean way to host storefront and admin in one deployment.

## Consequences

1. **NFR-7 is substantially met** (KC-170) — `robots.ts`, `sitemap.ts` and
   JSON-LD on the product detail page, all framework-native.
2. **Route groups implement `ADR-0006` directly** — `(storefront)` and
   `(admin)` in one app (KC-023). Accepted cost: admin pages inherit storefront
   chrome and ship in the same bundle.
3. **`brand.ts` white-labelling works** because copy flows through one config
   consumed by server components (KC-085).
4. **The build is environment-sensitive**, and this bit hard: `next build` under
   `NODE_ENV=development` fails while prerendering Next's own error pages. The
   CI workflow documents the incident and its fix in place — one of the
   `ci.yml` comments Law 2 exists to preserve.
5. Next 15 / React 19 — the web app is the current half of the stack (KC-200).

## Revisit Criteria

- SEO ceases to be a primary acquisition channel, removing the SSR requirement.
- The admin surface grows enough that bundle separation or a stricter auth
  boundary outweighs `ADR-0006`'s single-deployment simplicity.

## Cross References

- `ADR-0006` — hybrid admin strategy, implemented via route groups.
- `DISC-007` KC-170 — NFR-7 verification.
