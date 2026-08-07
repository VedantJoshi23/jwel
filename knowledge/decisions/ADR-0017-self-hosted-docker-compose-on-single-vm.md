---
id: ADR-0017
title: Self-hosted Docker Compose on a single VM
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
  - ADR-0010
tags:
  - technology
  - hosting
  - deployment
risk: Medium
complexity: Medium
---

# ADR-0017 — Self-hosted Docker Compose on a single VM

> **Retroactively recorded.** Taken pre-Oriveda and never written down.
> Authored 2026-08-07 under `OV-004` to close the gap Constitution **Law 2**
> exists to prevent. **The reasoning below is reconstructed from evidence**, not
> a contemporaneous record; where the original deliberation is unknown this
> document says so rather than inventing it.

## Context

The system needed a deployment target. `PRODUCT.md` NFR-3 specified "NestJS on
ECS" with Redis caching — **that is not what was built**, and `ADR-0010`
restated the requirement to match reality rather than changing the system.

This ADR records the choice that was actually made and never written down.

## Options Considered

- **Self-hosted Docker Compose on one VM** — lowest cost, no vendor lock-in,
  full control, everything version-controlled in `deploy/`. No redundancy, no
  managed backups, manual operational burden.
- **AWS ECS + RDS** (the NFR-3 assumption) — managed scaling, managed backups,
  multi-AZ availability. Materially higher cost and operational complexity for
  a prelaunch store with no traffic, and significant vendor lock-in.
- **A PaaS (Vercel + a managed Postgres)** — best DX, near-zero ops. Rejected
  on cost at scale, weaker control over the API's runtime, and awkward fit for
  co-hosting Elasticsearch, Prometheus, Grafana and Metabase.

## Decision

**Self-hosted Docker Compose on a single VM**, behind Caddy with automatic TLS.
Five composable files — api, postgres, elasticsearch, metabase, monitoring —
sharing one bridge network (KC-163, KC-164).

## Consequences

1. **Proportionate to the business.** A prelaunch store with no traffic does not
   need managed autoscaling. `ADR-0010` accepted this posture explicitly and
   restated NFR-2 and NFR-3 around it.
2. **The deployment is reproducible and version-controlled** — Caddyfile, nginx
   config, compose files, `backup.sh`, `GO-LIVE.md` and `RUNBOOK.md` all live in
   `deploy/`, not in someone's shell history.
3. **Observability is self-hosted and provisioned in code** — Prometheus and
   Grafana with datasources, dashboards and alert rules in version control
   (KC-169), with the metrics endpoint bound to the internal network only.
4. **No redundancy.** One VM, one Postgres container, no failover. Deploys
   restart containers, and that downtime is unmasked. This is why `ADR-0010`
   claims no numeric availability figure.
5. **Reliability rests entirely on backup and restore** — and that restore
   **has never been performed** (KC-205). Constitution **Law 6** makes this a
   live non-compliance, and `ARCH-001` §5.3 surfaces it rather than hiding it.
   It is the first item on `DISC-010`'s Improve list.
6. **Product imagery lives in a Docker volume moved by rsync** (KC-026). For a
   jewellery store, imagery *is* the product; this is the highest-consequence
   dependency in the deployment.

## Revisit Criteria

- Traffic requires horizontal scaling — noting that **the in-process event bus
  is the first blocker, not the hosting** (KC-165, `ARCH-001` §3.1).
- The operational burden of self-hosting exceeds the cost saving.
- A restore drill fails, or reveals that recovery is not actually achievable
  within an acceptable window.

## Cross References

- `ADR-0010` — the reliability posture this hosting choice implies.
- `DISC-007` KC-163, KC-164, KC-169 — the measured topology.
- `DISC-009` KC-205 — the untested restore.
