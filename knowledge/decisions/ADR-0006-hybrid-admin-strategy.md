---
id: ADR-0006
title: Hybrid Admin — Custom for Workflows, Third-Party for CRUD, BI and CMS
version: 1.0.0
status: Accepted
owner: Architecture
reviewers: []
created: 2026-07-27
updated: 2026-07-29
milestone: M14
category: Decision
priority: High
depends_on:
  - ADR-0002
required_by: []
tags:
  - admin
  - decision
  - tooling
risk: Medium
complexity: Medium
---

# ADR-0006 — Hybrid Admin: Custom for Workflows, Third-Party for CRUD, BI and CMS

## Context

The client asked whether the hand-built Admin Portal could be replaced with
free third-party admin infrastructure.

What exists today is not a toy: 8 Next.js pages (dashboard, orders, products
with photo management, inventory, coupons, customers, categories, CMS) over 11
role-guarded API modules, sharing auth and RBAC with the storefront, and
covered by the Milestone 11 test suite. More custom admin surface is already
specified but unbuilt — a Risk review queue (`DOM-RISK`) and a Shipment/NDR
queue (`DOM-SHIPPING`).

Those two planned queues are what make this decision non-obvious. They are not
field editors: a human makes a judgement and side effects fire — inventory
commits, Shiprocket cancellations, refund holds. Reimplementing that inside a
third-party tool's plugin system means reimplementing the safety properties
around it too.

The useful distinction is therefore **not** "build vs. buy" but **workflow vs.
CRUD**:

- **Workflow** — a human decision triggers side effects across modules, with
  ordering, permission and compensation rules that live in the domain.
- **CRUD** — create/read/update/delete over one table's fields, where the only
  real requirements are validation and an audit trail.

CRUD is roughly 80% of admin *screens* and a small fraction of admin *risk*.
That asymmetry is the whole argument.

## Options Considered

- **Wholesale replacement with a low-code builder** (Retool, Appsmith, ToolJet,
  Budibase). Rejected as a replacement. Every business workflow — order
  fulfilment → Shiprocket, NDR decisions, risk review, COD gating — would be
  rebuilt inside a plugin system, discarding working, tested code and its RBAC
  integration. Retool is the most polished but is priced per user; Appsmith is
  the credible open-source equivalent. Either remains a reasonable choice for a
  *separate* internal ops tool (support staff looking up orders), which is a
  different product from the storefront's admin.
- **Headless CMS as the admin layer** (Directus, Strapi, Payload, Appwrite).
  Rejected for commerce data: these want to own the schema, and `DATABASE.md`'s
  is hand-designed with constraints and generated columns they would not
  reproduce. Appwrite is rejected outright as redundant — it is a
  backend-as-a-service, and this project already has auth, storage and a real
  NestJS API.
- **Auto-admin libraries** (AdminJS, React Admin, Refine, Forest Admin).
  AdminJS looked the most *additive* on paper — official NestJS and Prisma
  adapters, mounts as a route on the existing API, no schema migration — but
  a real `npm install` in M14 showed the cost of that convenience: it pulls
  ~400 packages into `apps/api` itself, with 62 `npm audit` findings (1
  critical) in its own bundling toolchain, sitting inside the same process
  that handles Razorpay payments. Rejected on that basis, not on functionality.
  React Admin and Refine were re-evaluated on the same axis and land much
  better: 2-3 high findings, 0 critical, and both run entirely in `apps/web`
  — a data-provider layer over the existing REST API, no backend footprint at
  all. The "writing React again" objection undersold them: both auto-generate
  list/create/edit screens from an API description rather than hand-building
  each page, which is most of AdminJS's actual value. Forest Admin remains
  rejected — paid hosted product that wants direct production database
  access, a data-boundary conversation this project has no reason to open.
- **BI tools** (Metabase, Superset, Redash, Grafana). These are not admin
  panels at all; they answer a different question, and the current Analytics
  dashboard is hardcoded, so non-engineers cannot ask new ones. Metabase has
  the most approachable query builder and a free self-hosted tier. Superset is
  more powerful and meaningfully harder to operate. Redash is comparable to
  Metabase with a less active upstream.

## Decision

**A hybrid split, governed by the workflow/CRUD criterion above.**

- **Custom Next.js admin keeps everything with business logic and side
  effects** — orders, returns, and the planned Risk (`DOM-RISK`) and
  Shipment/NDR (`DOM-SHIPPING`) queues. This is the 20% that is genuinely hard.

  **Returns is scoped here but has no admin UI yet** — discovered during
  Milestone 12's live refund validation. The backend is complete and correct
  (`GET /admin/returns`, `PATCH /admin/returns/:id/status`, and the
  money-before-bookkeeping-before-restock ordering in
  `ReturnsService.adminUpdateStatus`), but nothing in `apps/web` calls it; the
  admin sidebar goes straight from Coupons to CMS. Every return since has been
  processed via raw `fetch()` calls against the API. This is real workflow
  surface per this ADR's own criterion — a human decision that triggers a
  refund and a restock — so it belongs in the custom admin, not AdminJS.
  **Build it in this milestone**, alongside the orders UI it should have
  shipped next to.
- **Categories, coupons, and banners CRUD is already built** — as custom
  Next.js pages (`app/(admin)/admin/{categories,coupons,cms}/page.tsx`),
  present since before this ADR was written (coupons/banners since the
  initial MVP commit, categories added shortly after). This ADR's original
  text proposed moving them to AdminJS as though they were an unbuilt gap —
  its own Context section (above) already listed these as existing pages,
  and that contradiction went unnoticed until M14 (2026-07-29). **Corrected:
  they stay as they are.** No tool migration; nothing to build here.
- **A CRUD-screen framework for *future* lookups/entities is deliberately
  undecided.** AdminJS was evaluated in M14 and rejected: mounting it adds
  ~400 packages directly into the payment-processing API process, with 62
  `npm audit` findings (1 critical, 14 high) in its bundling toolchain. Two
  frontend-only alternatives (react-admin, Refine) were evaluated as
  lower-risk substitutes — both add 2-3 high findings, none critical, and
  neither touches `apps/api`'s dependency tree since they'd run entirely in
  `apps/web` — and react-admin was the client's preference between them. But
  a search of the roadmap at M14 found no concrete unbuilt CRUD-shaped
  resource to point it at: every named gap (Risk queue, Shipment/NDR queue,
  Returns UI) is workflow-shaped by this ADR's own criterion, not CRUD.
  Standing up react-admin against no real target would be speculative
  infrastructure. **Decision deferred**: pick a framework (react-admin is
  the leading candidate) when an actual new CRUD entity is named in a
  roadmap doc, not before.
- **Metabase for business reporting**, against a dedicated **read-only**
  database user.
- **Directus or Payload for the CMS module only** (banners, homepage content) —
  the one part of this app that is pure content management with no commerce
  logic. This also covers FR-23's unbuilt scope (category landing content,
  lookbook/editorial). Which of the two is a spike in M14, not decided here.

**Grafana stays infrastructure-only.** `ADR-0002` chose it for system metrics;
pointing it at business data would mix "is the service healthy" with "which
SKUs sold best last month". Metabase answers the second. Keeping that line
sharp is part of this decision, not an aside.

## Consequences

- Two admin surfaces will exist once a future CRUD framework is actually
  adopted, and "which tool owns this screen?" will be a real question at PR
  time then. The workflow/CRUD criterion above is the tiebreaker; when a CRUD
  screen grows a side effect, it moves to the custom admin. Today there is
  only one admin surface (the custom Next.js app) — the CRUD split is
  aspirational until a framework is chosen per the deferred decision above.
- Whichever CRUD framework is eventually chosen must sit behind the same
  `RolesGuard` posture as everything else, and — per the AdminJS lesson above
  — its dependency footprint should be checked *before* being trusted, not
  after. A framework with its own parallel auth would be a straightforward
  privilege-escalation path.
- Metabase's read-only user is a hard requirement, not a preference — a BI tool
  with write access to the orders table is a data-loss incident waiting for a
  bad query.
- This **supersedes** Milestone 10's "materialized views / PostHog forwarding
  for Analytics" follow-up as the priority path: a BI tool answers ad-hoc
  business questions better than more hardcoded dashboard endpoints. The
  materialized-view work returns only if Metabase's query performance against
  the live schema proves inadequate.
- The admin audit log (M14, PR #21) shipped ahead of any second admin tool,
  closing the gap this ADR originally flagged — it covers the custom-admin
  workflow surface (orders, returns, inventory, user suspension) already. A
  future CRUD framework's own mutations will need their own hook into the
  same `AuditLog` table/service when that framework is actually adopted.
- Self-hosting Metabase and possibly Directus adds services to a VM already
  running Postgres, Elasticsearch and two app containers — check `RUNBOOK.md`
  §1's spec before assuming there is headroom. `ADR-0002`'s Prometheus/Grafana
  stack has the same pending claim on that budget.

## Revisit Criteria

Revisit if the CRUD/workflow boundary stops predicting well — specifically, if
a future CRUD screen repeatedly acquires side effects and gets migrated back,
that is evidence the split was drawn in the wrong place, not that the
migration was unlucky. Revisit the Metabase choice only against a concrete
reporting need it cannot serve. Revisit the deferred CRUD-framework decision
as soon as a concrete new entity needing simple admin CRUD is named in a
roadmap doc — react-admin is the leading candidate then, but re-check its
dependency audit at that time rather than trusting this one.
