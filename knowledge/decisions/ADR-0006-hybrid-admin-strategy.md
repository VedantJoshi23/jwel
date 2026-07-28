---
id: ADR-0006
title: Hybrid Admin — Custom for Workflows, Third-Party for CRUD, BI and CMS
version: 1.0.0
status: Accepted
owner: Architecture
reviewers: []
created: 2026-07-27
updated: 2026-07-27
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
  AdminJS is the only one that is genuinely *additive*: official NestJS and
  Prisma adapters, mounts as a route on the existing API, no schema migration.
  React Admin and Refine both mean writing React again — at which point the
  work approximates what already exists by hand. Forest Admin is a paid hosted
  product that wants access to the production database, which is a
  data-boundary conversation this project has no reason to open.
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
- **AdminJS takes the CRUD screens** — categories, coupons, banners, simple
  lookups. Mounted on the existing API via the NestJS + Prisma adapters.
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

- Two admin surfaces exist, and "which tool owns this screen?" becomes a real
  question at PR time. The workflow/CRUD criterion above is the tiebreaker;
  when a CRUD screen grows a side effect, it moves to the custom admin.
- AdminJS mounts on the API and must sit behind the same `RolesGuard` posture
  as everything else. An admin tool with its own parallel auth would be a
  straightforward privilege-escalation path, and is the main risk this
  introduces.
- Metabase's read-only user is a hard requirement, not a preference — a BI tool
  with write access to the orders table is a data-loss incident waiting for a
  bad query.
- This **supersedes** Milestone 10's "materialized views / PostHog forwarding
  for Analytics" follow-up as the priority path: a BI tool answers ad-hoc
  business questions better than more hardcoded dashboard endpoints. The
  materialized-view work returns only if Metabase's query performance against
  the live schema proves inadequate.
- No admin audit log exists yet, and adding a second tool that mutates data
  makes that gap worse rather than better. It should land with AdminJS, not
  after.
- Self-hosting Metabase and possibly Directus adds services to a VM already
  running Postgres, Elasticsearch and two app containers — check `RUNBOOK.md`
  §1's spec before assuming there is headroom. `ADR-0002`'s Prometheus/Grafana
  stack has the same pending claim on that budget.

## Revisit Criteria

Revisit if the CRUD/workflow boundary stops predicting well — specifically, if
AdminJS screens repeatedly acquire side effects and get migrated back, that is
evidence the split was drawn in the wrong place, not that the migrations were
unlucky. Revisit the Metabase choice only against a concrete reporting need it
cannot serve.
