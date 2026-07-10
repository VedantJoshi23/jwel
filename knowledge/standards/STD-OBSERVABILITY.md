---
id: STD-OBSERVABILITY
title: Jwel — Standard: Observability
version: 0.1.0
status: Proposal
owner: Architecture
reviewers: []
created: 2026-07-09
updated: 2026-07-09
milestone: M4
category: Standards
priority: Critical
depends_on:
  - ADR-0002
required_by: []
related_documents: []
related_domains: []
related_features: []
related_decisions:
  - ADR-0002
tags:
  - standards
  - observability
risk: High
complexity: Medium
---

# STD-OBSERVABILITY

## Scope

Covers what must be instrumented (metrics, error tracking, alerting,
dashboards) across `apps/api` and `apps/web`, and the operational cadence
around it. Does not cover application-level structured logging
conventions themselves — `LoggingInterceptor`/`CorrelationIdMiddleware`
already exist and are out of scope here; this standard is about what
happens to that data once emitted (or doesn't, today).

## Rules

- **Every unhandled exception reaches Sentry with its `correlation_id`
  attached**, in both `apps/api` (via `AllExceptionsFilter`, which
  already catches everything — it just doesn't forward anywhere yet) and
  `apps/web` (via Next.js's error boundary / instrumentation hook).
  Rationale: a stack trace nobody sees is operationally equivalent to no
  error handling at all.
- **Every `api/v1/*` route exposes request count, latency, and error rate
  as Prometheus metrics**, labeled by route and status code, scraped from
  a `/metrics` endpoint. Rationale: per-module latency/error-rate is what
  `ARCHITECTURE.md`'s own "Observability-driven scaling" note already
  assumes exists to decide what to scale or extract first.
- **Payment state transitions and auth events are metriced, not just
  logged** — a counter per `PaymentStatus` transition and per
  auth-failure, so `SECURITY.md` §A09's "Prometheus alerts on auth
  failure-rate spikes and checkout error-rate spikes" is an enforceable
  alert rule, not aspirational prose.
- **A Grafana dashboard reviewed on a fixed cadence (weekly, until real
  on-call load data suggests otherwise)** — a dashboard nobody looks at
  is the same failure mode as an error tracker nobody reads.
- **No PII in metric labels or Sentry breadcrumbs** — email, name,
  shipping address, and payment details must never appear in a metric
  label (unbounded cardinality risk too) or an error report's
  breadcrumb/context; scrub before sending, don't rely on Sentry's own
  default scrubbing alone.

## Examples

**Compliant:** `payments.service.ts`'s `markSucceeded`/`markFailed`
already have exactly one clean place to emit a
`payment_status_transition_total{status="succeeded"}` counter increment
— the same method the Law 1 fix already isolated to one responsibility.

**Non-compliant:** logging a payment webhook's full raw body (which may
contain the customer's masked card details or billing address depending
on the provider's payload shape) directly into a Sentry breadcrumb
without scrubbing first.

## Exceptions

None identified yet — this Standard is unbuilt in its entirety, so there
is no existing compliant/non-compliant code to carve an exception out of.
Revisit once real instrumentation exists and a genuine case for deviation
appears.

## Enforcement

Code review at PR time for new routes/services (does this emit the
metrics this Standard requires?); no automated lint rule exists or is
planned — metric-emission completeness isn't something a linter can
verify without a much larger investment than this gets today.
