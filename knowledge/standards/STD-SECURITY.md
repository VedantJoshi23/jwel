---
id: STD-SECURITY
title: Jwel / ELYSIAN — Standard: Security
version: 1.0.0
status: Frozen
owner: Architecture
reviewers:
  - Vedant
created: 2026-08-07
updated: 2026-08-07
milestone: M4
category: Standards
priority: Critical
depends_on:
  - CONSTITUTION
  - STD-000
required_by: []
related_decisions:
  - ADR-0005
  - ADR-0017
tags:
  - standards
  - security
risk: High
complexity: Medium
---

# STD-SECURITY

## Scope

Trust boundaries, authentication and authorisation, secret handling, and
exposure control across both apps and the edge.

**Not covered:** dependency vulnerability management (no process exists yet —
recorded as a gap below).

`DISC-007` rated security the strongest non-functional area and NFR-4 the one
NFR genuinely met (KC-166–168). These rules transcribe what exists.

## Rules

1. **No card or bank data is ever stored.** PCI scope is delegated entirely to
   the gateway; `Payment.providerRef` holds an opaque reference only.
   *Rationale:* `ADR-0005`, KC-132. Storing it would import a compliance regime
   the project cannot satisfy.

2. **Every non-public route is guarded**, and privileged routes carry an
   explicit role requirement.
   *Rationale:* KC-166. `@Public()` is opt-in, so the default is protected —
   the correct direction for a decorator to fail in.

3. **Secrets are validated at boot**, including a minimum length and rejection
   of known placeholder values. The process refuses to start otherwise.
   *Rationale:* KC-168. A placeholder JWT secret reaching production is
   unrecoverable; failing at boot is the only reliable place to catch it.

4. **Secrets never enter the repository.** `.env` is ignored; `.env.example` is
   the committed template.
   *Rationale:* the `.gitignore` negation exists precisely for this and
   documents itself.

5. **Input crosses the trust boundary through a validating DTO.**
   *Rationale:* the global `ValidationPipe` is the single audit point.

6. **Sensitive exposure is blocked at two independent layers.** Swagger is
   disabled outside development *and* 404'd at the edge by Caddy.
   *Rationale:* KC-167. Either layer alone is one misconfiguration from
   publishing the full API surface.

7. **Rate limiting is applied globally**, currently 120 requests / 60 seconds.
   *Rationale:* KC-166. Auth and search endpoints are the abuse surface NFR-4
   names.

8. **Administrative mutations are audit-logged**, and the audit trail survives
   deletion of the actor.
   *Rationale:* `ADR-0006`, KC-133. `AuditLog` deliberately omits `onDelete` on
   its actor FK — cascading would defeat the purpose.

9. **The metrics endpoint is not publicly reachable.**
   *Rationale:* KC-169 — Prometheus scrapes it over the internal Docker
   network; the public internet gets nothing.

## Examples

**Compliant** — refuse to boot rather than run with a placeholder:

```ts
if (secret === PLACEHOLDER_JWT_SECRET || secret.length < MIN_JWT_SECRET_LENGTH) {
  throw new Error('JWT_SECRET is a placeholder or too short — refusing to start');
}
```

**Non-compliant** — a warning that will be scrolled past:

```ts
if (!process.env.JWT_SECRET) logger.warn('JWT_SECRET not set, using default');
```

## Exceptions

Rule 6's second layer is edge configuration and does not exist in local
development. That is acceptable: the app-level control (rule 6, first layer)
holds in every environment, and the edge layer is defence in depth, not the
primary control.

## Enforcement

- Rules 1, 3, 4: **CI and boot.** Env validation fails the process; secret
  files fail `.gitignore` review.
- Rules 2, 5, 7, 9: **structural** — guards and pipes are registered globally;
  `apps/web/e2e/admin.spec.ts` covers admin redirect behaviour.
- Rules 6, 8: **human review**, plus the `GO-LIVE` checklist for rule 6.
- **Gap:** no dependency vulnerability scanning exists (no `npm audit` gate, no
  Dependabot). Recorded here rather than implied — a candidate for `STD-CICD`.
