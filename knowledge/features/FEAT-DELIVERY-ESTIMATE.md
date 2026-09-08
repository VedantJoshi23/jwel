---
id: FEAT-DELIVERY-ESTIMATE
title: 'Jwel — Feature: Interim Pincode Deliverability Estimate'
version: 0.1.0
status: Frozen
owner: Architecture
reviewers:
  - Vedant
created: 2026-08-28
updated: 2026-08-28
milestone: M6
category: Features
priority: Medium
depends_on:
  - DOM-SHIPPING
  - ADR-0024
  - FEAT-SETTINGS-STORE
required_by: []
related_documents:
  - ADR-0001
  - ADR-0024
related_domains:
  - DOM-SHIPPING
related_features:
  - FEAT-SHIPPING
related_decisions:
  - ADR-0024
tags:
  - feature
  - shipping
  - interim
risk: Medium
complexity: Low
---

## Feature: Interim Pincode Deliverability Estimate

### 1. Overview

A pincode box on the home page and the product detail page that tells a
shopper whether an item can be delivered to them and an estimated delivery
window — built per `ADR-0024` as an honestly-scoped stand-in for the real
Shiprocket-backed serviceability check `FEAT-SHIPPING` describes, while that
feature remains blocked on the client's suspended Shiprocket account. This is
**not** a partial implementation of `FEAT-SHIPPING`: it has no COD-eligibility
check, is not gated into checkout, and is built to be replaced — not
extended — once a real courier integration exists.

### 2. Owning Domain

**Owning domain: `DOM-SHIPPING`.** Same call `FEAT-SHIPPING` already made:
deliverability and estimated-delivery-window are what this feature is about,
even though the adapter behind the port is an internal heuristic rather than
a carrier API. No other domain is involved — this feature makes no
cross-domain call at all (contrast `FEAT-SHIPPING`, which calls Inventory on
RTO; this feature has no RTO, no shipment, nothing to call out to).

### 3. Acceptance Criteria

- [x] A shopper can enter a 6-digit pincode on the home page and receive a
      result: either "Deliverable, estimated in X–Y days" or "We can't
      confirm delivery to this pincode yet."
- [x] The same check is available on the product detail page, worded
      identically (one component, two placements — not two implementations).
- [x] Every result the widget shows visibly discloses that it is an estimate
      (e.g. an "Estimated" label), never phrased as a live-carrier
      confirmation — the API's `source: 'ESTIMATED'` field is what the UI
      keys this wording off, not a hardcoded string maintained separately in
      each placement.
- [x] An admin can list, add, edit and delete pincode exceptions (mark a
      pincode non-deliverable, or override its estimated window) from the
      admin panel.
- [x] An admin can tune the two site-wide default estimate bounds
      (`shipping.default_min_days`, `shipping.default_max_days`) via the
      existing generic Settings admin page — no deploy required, same as
      `recommendations.min_co_occurrence`.
- [x] A malformed pincode (not 6 digits, non-numeric, leading zero) is
      rejected with a message naming the problem, not treated as "not
      deliverable."
- [x] Nothing in this feature touches checkout, `Order`, COD eligibility, or
      payment method selection — those remain `FEAT-SHIPPING`'s scope,
      unbuilt.

### 4. API Surface

- `GET /api/v1/shipping/serviceability?pincode=...` — public. Reuses
  `DOM-SHIPPING` §4's already-declared path; this feature does not accept
  that spec's `codRequested` parameter (out of scope per `ADR-0024`) — a
  request that includes it is not rejected, the parameter is simply ignored,
  since a future `ShiprocketProvider` behind the same route may honour it
  without a breaking change to callers who already send it.

  Response shape:

  ```json
  {
    "pincode": "400001",
    "deliverable": true,
    "estimatedMinDays": 4,
    "estimatedMaxDays": 7,
    "source": "ESTIMATED"
  }
  ```

- `GET /api/v1/admin/shipping/pincode-overrides` — `[Admin/Staff]` list.
- `POST /api/v1/admin/shipping/pincode-overrides` — `[Admin/Staff]` create.
- `PATCH /api/v1/admin/shipping/pincode-overrides/:id` — `[Admin/Staff]` update.
- `DELETE /api/v1/admin/shipping/pincode-overrides/:id` — `[Admin/Staff]` delete.

  These four are new surface `DOM-SHIPPING` did not declare (it describes an
  admin *queue* for NDRs, not a pincode-exception CRUD) — added here because
  this feature's whole mechanism is the exception list. `DOM-SHIPPING` §9
  already left "whether Shipping needs its own admin UI" as an open,
  feature-layer decision; this answers it for the narrow slice this feature
  owns, not for the admin shipment/NDR queue `FEAT-SHIPPING` still needs.

- Two new declared Settings keys (`modules/settings/settings.registry.ts`),
  served through the existing `GET/PATCH /api/v1/admin/settings` surface —
  no new endpoint.

### 5. Events

**None.** This feature is a stateless read (serviceability check) plus plain
CRUD (exceptions, settings) — no state transition, no side effect crossing a
domain boundary, so there is nothing to publish and nothing to consume. This
is a deliberate contrast with `FEAT-SHIPPING`, whose event catalog exists
because shipment status is a real lifecycle other domains react to.

### 6. Data Changes

New table, no existing table's ownership changes:

- `pincode_serviceability_overrides` — `id`, `pincode` (unique, 6-digit,
  `CHECK` constraint enforces the format at the database per `STD-DATABASE`
  r4), `deliverable` (boolean, default `true`), `estimatedMinDays` (int,
  nullable), `estimatedMaxDays` (int, nullable), `note` (text, nullable, the
  admin-facing reason), `createdAt`, `updatedAt`. Two further `CHECK`
  constraints: `estimatedMinDays <= estimatedMaxDays` when both are present,
  and a non-deliverable row carries no estimate window at all.

  This is explicitly **not** `DOM-SHIPPING` §6's `shipments` table or any
  part of it — no shipment, no AWB, no status history is created by this
  feature. A future `shipments` table (when `FEAT-SHIPPING` is built) has no
  foreign key relationship to this one; they answer different questions.

- Two new `Setting` rows (`shipping.default_min_days`,
  `shipping.default_max_days`) under the existing `settings` table —
  no schema change, just new registry entries.

### 7. Edge Cases & Validations

1. **Pincode not in the exceptions table.** Falls through to the pan-India
   default: `deliverable: true`, window from the two Settings defaults. This
   is the common case, by design (`ADR-0024` Consequence 2) — most pincodes
   nobody has flagged either way.
2. **Pincode explicitly marked non-deliverable.** Returns `deliverable:
   false` with no estimate window, regardless of the site-wide defaults.
3. **Pincode with an estimate override but still deliverable.** Returns the
   override's window, not the site-wide default — an override always wins
   over the default when present.
4. **Malformed pincode** (wrong length, non-digit characters, or a leading
   zero — Indian PINs never start with `0`). Rejected at the DTO layer with a
   `400` naming the constraint, mirroring `SettingsService.set`'s pattern of
   naming what was violated rather than a generic "invalid" message.
5. **An admin deletes an override that a shopper's browser cached the result
   of.** No consistency mechanism needed — this is a live re-check on every
   pincode entry, not a stored quote; the next check reflects the current
   table.
6. **Two overrides for the same pincode.** Prevented at the database
   (`pincode` is `@unique`) — an admin editing an existing entry uses the
   update endpoint, not a second create.

### 8. Non-Functional Considerations

| Standard | Bearing |
| --- | --- |
| **`STD-API`** | New endpoints follow the existing versioned-prefix, `admin/`-prefixed-and-role-guarded, DTO-validated, paginated-list convention (`STD-API` rules 1–5). The public serviceability endpoint is the one genuinely new *public* route; it is a pure read with no side effect, so no envelope or auth concern beyond what every other `@Public()` route already has. |
| **`STD-DATABASE`** | New table only; no cross-context write. Format and range invariants (pincode shape, min≤max, non-deliverable-has-no-window) are `CHECK` constraints per rule 4/Law 4, not application-only checks. |
| **`STD-TESTING`** | The default-fallback vs. override-wins vs. non-deliverable branches (Edge Cases 1–3) are exactly the kind of case needing a real test each, not one happy-path test — this codebase's 90%+ coverage gate applies unchanged on both `apps/api` and `apps/web`. |
| **`STD-SECURITY`** | No new auth surface — the public endpoint takes no identity and returns no user data; admin endpoints sit behind the same `RolesGuard` posture as every other admin CRUD screen. Pincode input is validated server-side regardless of client-side validation, same posture as every other DTO in this codebase. |
| **`STD-ACCESSIBILITY`** | The pincode input and its result are the only UI this feature adds. Labelled input, result announced via an `aria-live` region (a sighted user sees the result appear; a screen-reader user needs to be told it changed, since nothing moves focus), same keyboard operability as every other form input in this codebase. |
| **Observability** | Not applicable — this codebase has no observability infra for any module yet (a pre-existing gap `FEAT-SHIPPING` also names, not something this feature takes on). |

### 9. Definition of Done

- [x] `ShippingProviderPort` + `StaticZoneShippingProvider` implemented and
      unit-tested (mirrors `payment-provider.port.ts`'s test pattern).
- [x] Prisma migration for `pincode_serviceability_overrides`, with its three
      `CHECK` constraints.
- [x] `shipping.default_min_days` / `shipping.default_max_days` added to
      `settings.registry.ts`.
- [x] Public serviceability endpoint, admin exceptions CRUD, both covered by
      tests including the edge cases in §7 (unit + real-database integration
      tests, both green).
- [x] `PincodeCheck` component built once and used on both the home page and
      the product detail page.
- [x] Admin UI for managing pincode exceptions (`/admin/shipping`).
- [x] `DOM-SHIPPING.md`'s NOT IMPLEMENTED banner corrected to name this
      interim capability without overstating the rest of the domain as built
      (`ADR-0024`, Law 1).

Verified: `apps/api` 911 unit tests (78 suites) + 97 integration tests (10
suites, including the 12 new `shipping.integration-spec.ts` cases) green, run
against a real Postgres; `apps/web` full suite green with the 90% coverage
gate passing (`shipping.ts`/`pincode-check.tsx`/the admin page all at 100%);
both `tsc --noEmit` clean.
