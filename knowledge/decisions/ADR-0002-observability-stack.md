---
id: ADR-0002
title: Sentry + Prometheus/Grafana as the Observability Stack
version: 1.0.0
status: Proposal
owner: Architecture
reviewers: []
created: 2026-07-09
updated: 2026-07-09
milestone: M3
category: Decision
priority: Critical
depends_on: []
required_by:
  - STD-OBSERVABILITY
tags:
  - observability
  - decision
risk: High
complexity: Medium
---

# ADR-0002 — Sentry + Prometheus/Grafana as the Observability Stack

## Context

`PRODUCT.md`'s NFR-8 already names Prometheus/Grafana for metrics, and
`ARCHITECTURE.md`'s deployment diagram already sketches a
`Prometheus → Grafana` path from the API — but nothing was ever built:
zero metrics are emitted, zero dashboards exist, and there is no error
tracker at all (an unhandled exception in production today is visible
only if someone happens to read raw logs). A live storefront handling
real payments has no visibility into failure rate, latency, or the
actual stack trace behind a 500 — this is the single largest gap between
"code that works in a demo" and "code that's safe to operate."

## Options Considered

- **Sentry (errors/traces) + Prometheus/Grafana (metrics/dashboards),
  self-hosted or managed.** Matches what NFR-8 and the architecture
  diagram already committed to for metrics; adds the error-tracking half
  neither of those ever named. Two systems to run (or two managed
  subscriptions), but each does one job well and neither is a
  reach — both are the default choice for a NestJS + Next.js stack.
- **A single all-in-one APM (Datadog, New Relic).** Rejected for now —
  real capability (traces, metrics, errors, logs in one place), but a
  meaningfully higher ongoing cost than Sentry + self-hosted
  Prometheus/Grafana at this stage, and would contradict NFR-8's own
  named tool choice without a concrete reason to override it.
- **Logs only (structured logging, no metrics/error tracker).** Rejected
  — `LoggingInterceptor`/`CorrelationIdMiddleware` already exist and
  structured logs are necessary but not sufficient: nobody is paged by a
  log line nobody is tailing, and there is no aggregate view of
  error-rate or latency trend without a metrics system.

## Decision

Sentry for exception/error tracking (both `apps/api` and `apps/web`),
Prometheus + Grafana for metrics and dashboards, exactly as NFR-8 already
named. `correlation_id` (already emitted by `CorrelationIdMiddleware`)
is attached to every Sentry event and log line so a single request can be
traced across logs, metrics, and error reports.

## Consequences

- Two systems to operate instead of one all-in-one APM — accepted in
  exchange for lower cost and no change to a tool choice `PRODUCT.md`
  already committed to.
- Sentry needs a DSN and release/environment tagging wired into both
  `apps/api`'s bootstrap and `apps/web`'s Next.js config; Prometheus needs
  a `/metrics` endpoint exposed and scraped.
- Alert thresholds (auth failure-rate spikes, checkout error-rate spikes
  — already named in `SECURITY.md` §A09) become actually enforceable
  once Prometheus alerting rules exist; today that line in `SECURITY.md`
  describes a capability that doesn't exist yet.
- Dashboard review becomes a real recurring operational task, not a
  one-time setup — `STD-OBSERVABILITY` names the cadence.

## Revisit Criteria

Revisit toward a unified APM (Datadog/New Relic/Grafana Cloud) if
operating two separate systems proves to be the actual bottleneck once
real on-call load exists — not before; designing for that consolidation
now, with zero operational data, would be exactly the kind of premature
architecture Oriveda's own principles warn against.
