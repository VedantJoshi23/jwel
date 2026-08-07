---
id: DISC-007
title: Discovery — Technical Architecture
version: 1.0.0
status: Frozen
owner: Architecture
reviewers:
  - Vedant
created: 2026-08-06
updated: 2026-08-06
milestone: M1
category: Discovery
priority: High
depends_on:
  - DISC-005
  - DISC-006
required_by:
  - DISC-008
related_documents:
  - ARCHITECTURE.md
  - SECURITY.md
related_decisions:
  - ADR-0002
  - ADR-0005
  - ADR-0008
  - ADR-0010
tags:
  - discovery
  - investigation
  - technical-architecture
risk: Medium
complexity: High
---

# DISC-007 — Discovery: Technical Architecture

Investigation 7 of 10, per `OV-001`. Evidence and claim ids refer to
`knowledge/discovery/evidence/README.md`.

This investigation owns `OV-001`'s second mandatory NFR check, so it closes the
loop on the ten NFRs `DISC-002` surfaced (KC-073).

## Observed Facts

### The deployed architecture (KC-163, KC-164)

A **modular monolith** — one NestJS process, 22 modules, an in-process event
bus — plus a **Next.js SSR app**. Both are Docker containers on a **single VM**,
sharing one bridge network (`jwel-net`), behind **Caddy** with automatic TLS.

Five compose files, independently startable on the same host:

| File | Services |
| --- | --- |
| `api` | api, web, migrate, create-admin |
| `postgres` | postgres + `pgdata` volume |
| `elasticsearch` | elasticsearch + `esdata` volume |
| `metabase` | metabase |
| `monitoring` | prometheus, grafana + volumes |

Caddy terminates TLS for the API and storefront hosts, sets HSTS, strips
`Server`, and **returns 404 for `/docs`**.

### Cross-cutting layers

- **Security** (KC-166): helmet, CORS allowlist from `CORS_ALLOWED_ORIGINS`,
  global `ValidationPipe`, global `ThrottlerGuard` (120 req / 60 s), plus JWT,
  optional-JWT and roles guards.
- **Defence in depth on Swagger** (KC-167): disabled outside development in
  `main.ts`, *and* 404'd at the edge by Caddy. The same exposure blocked twice,
  independently.
- **Boot-time env validation** (KC-168), including a minimum JWT secret length
  and explicit rejection of a known placeholder value.
- **Observability** (KC-169): correlation-id middleware, logging interceptor,
  metrics interceptor; a Prometheus endpoint reachable **only on the internal
  Docker network**; Grafana with provisioned datasources, dashboard and
  alerting rules; Sentry in both apps.
- **Ports and adapters** in exactly two modules — payments and storage
  (KC-155) — the two places an external vendor sits.

### The event bus is single-process and at-most-once (KC-165)

`event-bus.service.ts` documents itself as decoupling publishers from
subscribers *"within a single process (modular monolith)"*. It is
fire-and-forget: **no persistence, no retry, no dead-letter path.**

### NFR scorecard

`OV-001` requires this investigation to check for NFRs explicitly. All ten from
`PRODUCT.md` §6 (KC-073), measured against the built system:

| NFR | Target | State |
| --- | --- | --- |
| **NFR-1** Performance | P95 < 2.5s on 4G; search < 300ms | **Unverified** — no load test, budget or synthetic check (KC-172) |
| **NFR-2** Availability | 99.9% uptime | **Structurally unmet** — single VM, no redundancy (KC-173) |
| **NFR-3** Scalability | NestJS on ECS; Redis cache | **Contradicted** — single-VM compose, no Redis, no ECS (KC-074) |
| **NFR-4** Security | OWASP, PCI-aligned, rate limiting | **Substantially met** (KC-166–168); no card data stored (`DISC-005`) |
| **NFR-5** Accessibility | WCAG 2.1 AA | **Unverified** — no axe or equivalent anywhere (KC-171) |
| **NFR-6** Mobile-first | All flows | **Not assessed** — carried from `DISC-004` |
| **NFR-7** SEO | SSR, structured data, canonicals | **Substantially met** — `robots.ts`, `sitemap.ts`, JSON-LD on PDP (KC-170) |
| **NFR-8** Observability | Prometheus/Grafana; PostHog | **Partly met** — Prometheus/Grafana yes, PostHog absent, Sentry unnamed but present (KC-075) |
| **NFR-9** Data portability | No vendor lock-in | **Met** — ports/adapters at payments and storage (KC-155) |
| **NFR-10** i18n-readiness | Centralised currency/locale | **Partly evidenced** — money in minor units centrally (`DISC-005`); locale not assessed |

## Interpretation

**The architecture is coherent and appropriate — for a different set of NFRs
than the ones written down.** What exists is a well-built single-node system:
one process, one database, one VM, self-hosted observability, TLS handled
automatically. What `PRODUCT.md` describes is a horizontally-scaled cloud
deployment on ECS with Redis caching. These are not the same system, and the
built one is the better fit for a prelaunch store with no traffic.

The gap is not that the wrong thing was built. It is that **NFR-3 was never
revised when the deployment strategy changed**, so it now reads as an unmet
requirement rather than a superseded one — the same pattern `DISC-002` found
with gold-rate pricing and `DISC-004` found with guest checkout. Three times
now, the implementation made the better decision and the specification was left
describing the abandoned one.

**Security is the strongest non-functional area.** Layered middleware, boot-time
secret validation that rejects a known placeholder, and Swagger blocked twice
over — once in the app, once at the edge (KC-167). That last one is worth
naming: defence in depth applied to a *documentation endpoint* is the kind of
care that usually only appears after an incident. Combined with `DISC-005`'s
finding that no card data is stored and PCI scope is delegated entirely to the
gateway, NFR-4 is the one NFR that is genuinely met rather than approximately
met.

**The event bus's at-most-once delivery is the most consequential architectural
property nobody has written down** (KC-165). It is fire-and-forget in-process:
an event emitted immediately before a crash is simply lost, and its subscriber
never runs. Today that means a confirmed order whose `order.confirmed` handler
dies has **no notification sent and no co-occurrence recorded**, with no
recovery path and no signal that anything was missed.

At current volume this is nearly harmless — the blast radius is one customer's
email. It becomes serious in two specific futures: when WhatsApp notifications
land (a dropped order confirmation is then a support call), and if a second API
instance is ever run (the bus is explicitly single-process, so `NFR-3`'s
horizontal scaling cannot be reached without replacing it). **The event bus is
the actual blocker on NFR-3**, not the absence of Redis or ECS.

**`ADR-0008` interacts with this.** The rating recompute was deliberately kept
synchronous rather than event-driven, and this finding retroactively supports
that: an at-most-once bus is a poor place to put a correctness-critical
recomputation. The reconciliation path `ADR-0008` requires is the right general
answer to at-most-once delivery — make the effect re-derivable rather than
trusting the event.

**Three NFRs are asserted and never measured** (KC-171, KC-172) — performance,
availability and accessibility. Each is declared non-optional for MVP. There is
no load test, no uptime monitor, no accessibility check in CI. This is not the
same as failing them; it is not knowing. Accessibility is the one I would
weight highest: WCAG 2.1 AA is a legal exposure in several markets, it is
cheapest to fix before a design settles, and `axe` in the existing Playwright
suite would take an afternoon.

**NFR-2 deserves an honest restatement.** 99.9% allows ~43 minutes of downtime
a month. A single VM with one Postgres container, no replication and no
failover, where deploys restart containers, cannot structurally offer that
(KC-173). It may well *achieve* it in a quiet month, but there is no mechanism
making it true. Either the target moves or the topology does — and for a
prelaunch store, moving the target is the honest choice.

**Metabase is a small architectural surprise.** It sits in the deployment as a
BI tool alongside a first-party analytics dashboard (FR-21) and Grafana. Three
overlapping ways to look at data, none of them PostHog, which is what the NFR
named.

## Hidden Assumptions

- **Single-VM topology is inferred** from compose files sharing one network and
  `RUNBOOK` references to "the VM". No infrastructure definition was read, and
  no running host was inspected.
- **"Never measured" claims (KC-172) are absence-of-evidence.** Load tests or
  uptime monitoring could exist outside the repository — in a hosting dashboard
  or someone's local tooling.
- **NFR-4 "substantially met" is a configuration reading, not a security
  assessment.** Middleware presence was verified; no penetration testing,
  dependency audit or threat model review was performed here.
- **`ThrottlerGuard` at 120 req/60s is assumed global and effective.** Whether
  per-route overrides exist was not checked.
- **NFR-6 and NFR-10 were not assessed at all** — mobile-first and locale
  centralisation both need runtime inspection this investigation did not do.

## Strengths

- **Topology matches the business's actual scale.** One VM, one process, one
  database is the right architecture for a prelaunch store, and it is executed
  cleanly rather than improvised.
- **Security in depth** (KC-166–168) — layered middleware, validated secrets,
  and the same exposure blocked at two independent layers.
- **Self-hosted observability that is actually provisioned** — dashboards,
  datasources and alert rules in version control, with the metrics endpoint
  bound to the internal network only.
- **Ports and adapters exactly where vendors are** (KC-155), and nowhere else.
- **SEO is genuinely implemented** (KC-170), not merely asserted — sitemap,
  robots and structured data.
- **Compose files are decomposed by concern**, so Elasticsearch or monitoring
  can be run, stopped or moved independently.
- **Search degrades gracefully** to Postgres when Elasticsearch is unreachable,
  and CI proves it (`DISC-001`).

## Weaknesses

- **At-most-once event delivery with no durability** (KC-165) — invisible
  today, and the real blocker on horizontal scaling.
- **NFR-3 describes an abandoned deployment strategy** (KC-074) and still reads
  as authoritative.
- **NFR-2's 99.9% is structurally unachievable** on the current topology
  (KC-173).
- **Three non-optional NFRs are unmeasured** — performance, availability,
  accessibility (KC-171, KC-172).
- **No accessibility verification at all**, against a WCAG 2.1 AA commitment.
- **PostHog is specified and absent**; Sentry is present and unspecified
  (KC-075). Neither is wrong; the record is.
- **Three overlapping analytics surfaces** — first-party dashboard, Grafana,
  Metabase — with no stated division of responsibility.

## Questions

1. ~~Should NFR-2 and NFR-3 be restated, or should the system change?~~ →
   **RESOLVED** (KC-174), recorded as **`ADR-0010`**: restated. The topology is
   the intended architecture; the requirements were stale.
2. ~~Should the event bus gain durability?~~ → **RESOLVED** (KC-175):
   **deferred with a trigger** — built if and when WhatsApp notifications
   require it. Three named trigger conditions in `ADR-0010`, so the deferral
   cannot quietly become permanent. Until then the mitigation is re-derivable
   effects, per `ADR-0008`.
3. ~~Should `axe` be added to the Playwright suite?~~ → **RESOLVED** (KC-176):
   yes. NFR-5's first verification.

**Still open:**

4. Should PostHog be adopted, or NFR-8 restated around Sentry + Prometheus? →
   `recommendations`.
5. What is the intended division between the first-party analytics dashboard,
   Grafana and Metabase? → `recommendations`.
6. Should `Coupon.value`'s type-dependent meaning be split so the database can
   constrain it (`DISC-005` Q5)? → carried; a small correctness win, no
   urgency.
7. Is coupon first-order eligibility better served by an Ordering-exposed query
   (`DISC-006` Q5)? → carried; the alternative may be worse coupling.

## Recommendations

- **Keep** — the single-VM modular-monolith topology. It fits the business, and
  scaling decisions should follow traffic rather than precede it.
- **Keep** — the security posture, and treat `main.ts` + Caddyfile as the
  reference for `STD-SECURITY` when M5 runs.
- **Keep** — self-hosted, version-controlled observability provisioning.
- **Keep** — ports and adapters confined to payments and storage.
- **Done** — NFR-2 and NFR-3 restated in `ADR-0010`, in `knowledge/` rather
  than by rewriting `PRODUCT.md` (`ADR-0007`).
- **Improve** — add `axe` to the existing Playwright suite (KC-176). Cheapest
  unmet-NFR fix available and the only one carrying legal exposure.
- **Improve** — make event effects re-derivable rather than making the bus
  durable, per `ADR-0008`. Durability is deferred behind `ADR-0010`'s triggers.
- **Improve** — stop quoting 99.9% anywhere. `ADR-0010` makes this binding; an
  availability figure no mechanism supports is the same class of problem as the
  storefront promises in `DISC-003`.
- **Improve** — state what Metabase, Grafana and the first-party dashboard are
  each for, or drop one.
- **Remove** — nothing. Every component present is doing a job.

## Architecture Review

- **Does it hold up?** Yes. Configuration claims are direct observation; the
  three absence-of-evidence verdicts are labelled as such rather than asserted
  as proven.
- **Does it contradict another investigation?** No. It **explains** a
  constraint the others assumed away: `DISC-006` mapped the event bus as a real
  integration seam, and this investigation establishes that the seam is
  at-most-once and single-process — which bounds every event-driven design
  decision downstream, including `ADR-0008`'s.
- **Decisions taken.** `ADR-0010` restates NFR-2 and NFR-3 and defers event-bus
  durability behind three named triggers. Recorded rather than deferred to M3,
  because the stale NFRs were actively misleading.
- **Scope discipline.** This investigation measures the architecture. It does
  not implement the accessibility check, restructure the deployment, or resolve
  the three-analytics-surfaces question.

**Frozen 2026-08-06** by owner sign-off. Revision requires the full
Discussion → Review cycle (KC-054).

## Confidence Level

**High (87%).**

Configuration facts are direct observation at 95–100% — compose topology,
middleware stack, Caddy rules, env validation, monitoring provisioning, SEO
surfaces.

Two things cap it. **Three NFR verdicts rest on absence of evidence**
(KC-171–173 at 85–90%): "never measured" cannot be proven from a repository,
since load tests or uptime monitoring could live in a hosting dashboard. And
**two NFRs were not assessed at all** — NFR-6 mobile-first and NFR-10
locale-readiness both need runtime inspection rather than reading.

Per `OV-001` the investigation cannot exceed its weakest load-bearing claim.
KC-173's "structurally cannot meet 99.9%" is an architectural judgement about
an inferred topology, and it is the weakest thing this document leans on.

### Cross-cutting extraction check

- **Non-functional requirements — found and scored.** This investigation owns
  the second half of `OV-001`'s mandatory NFR check. All ten declared NFRs are
  measured against the built system in the scorecard above: two met, three
  partly met, three unverified, one contradicted, one unassessed.
  **One NFR exists outside `PRODUCT.md`'s list** — KC-084's flexible,
  non-domain-bound branding, stated by the owner and partly implemented in
  `brand.ts`. It is met in the storefront UI layer and unverified at the edges
  (domain, email templates, API-side copy).
- **Domain/integration events** — owned by `domain-discovery` (done, KC-150).
  One architectural property is added here: the bus is single-process and
  at-most-once (KC-165), which constrains every event-driven design decision
  downstream.
