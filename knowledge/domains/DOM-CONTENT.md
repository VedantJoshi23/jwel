---
id: DOM-CONTENT
title: 'Jwel / ELYSIAN — Domain: Content'
version: 1.0.0
status: Frozen
owner: Architecture
reviewers:
  - Vedant
created: 2026-08-07
updated: 2026-08-07
milestone: M5
category: Domains
priority: Medium
depends_on:
  - ARCH-001
  - CONSTITUTION
required_by: []
related_documents:
  - DISC-005
  - DISC-008
related_decisions:
  - ADR-0013
tags:
  - domain
  - content
risk: Low
complexity: Low
---

# DOM-CONTENT

**Depth tier: Full** — small, but owns data and a scheduling rule.

## 1. Overview

Content owns merchandising material the client can change without a deploy —
today, homepage banners and their scheduling.

`PRODUCT.md` FR-23 scoped a much larger CMS (category landing content,
lookbook and editorial pages). Only the banner slice is built, and the admin UI
says so in its own copy (KC-037).

## 2. Ownership

**Owns** — `Banner`: title, image reference, link, sort order, active flag and
the scheduling window.

**Explicitly does NOT own** — product data (Catalog); the storefront's own
copy, which lives in `brand.ts` and is white-label configuration, not CMS
content (KC-085); image bytes, which Storage holds.

## 3. Invariants

| # | Invariant | Source |
| --- | --- | --- |
| 1 | A banner is displayed only when `isActive` **and** the current time falls within `startsAt`–`endsAt` where those are set. | schema |
| 2 | Display order is `sortOrder` ascending, indexed `(isActive, sortOrder)`. | schema |
| 3 | Banner images are referenced, not embedded — `imageRef` points at Storage. | KC-155 |
| 4 | Content never writes product data. A banner links to a collection or product; it does not define one. | Law 5 |
| 5 | `endsAt > startsAt` where both are set, enforced by a **database CHECK constraint** — mirroring `Coupon`'s `valid_date_range`. | Owner decision, 2026-08-07; Law 4 |
| 6 | Banner images are validated on upload for **type and size**, and must additionally be validated for **actual content type** (magic bytes, not the client-declared MIME) and **maximum dimensions**. | Owner decision, 2026-08-07 |

**Invariant 5 brings this domain into Law 4 compliance.** It was recorded as
non-compliance when this spec was drafted: `Coupon` has exactly this constraint
and `Banner` did not, so an inverted window silently hid a banner with nothing
to catch it. One migration closes it.

**Invariant 6 is partly already true.** Upload validation exists in
`common/media/image-upload.constraints.ts` and is applied twice — once by the
controller's file interceptor and validator pipe, once in the service:

- MIME allowlist: `image/jpeg`, `image/png`, `image/webp`
- Maximum size: 8 MB

Two residual gaps make up the rest of the invariant:

- **The MIME type is client-declared** (`file.mimetype`) and therefore
  spoofable. Content-type validation should read the file's magic bytes.
- **No dimension cap exists.** A 20000x20000 PNG can sit under 8 MB and will
  exhaust memory in whatever resizes or serves it.

Both apply equally to product media (`DOM-CATALOG`), since the constraints are
shared infrastructure.

## 4. API Surface

**Customer** — `GET /cms/banners` (active, in-window only)
**Admin** — `GET /admin/cms/banners`, `POST`, `PUT /:id`, `DELETE /:id`

## 5. Events

**Publishes** — none. **Consumes** — none.

## 6. Data Ownership

`banners` — indexed `(isActive, sortOrder)`.

## 7. Dependencies

**Allowed** — Storage (shared infrastructure); audit log.

**Forbidden** — writing or reading any other domain's tables.

## 8. Edge Cases & Validations

1. **`endsAt` before `startsAt`.** Rejected by the CHECK constraint
   (Invariant 5). Previously accepted silently.
2. **No active banners.** The homepage must render without one.
3. **`imageRef` pointing at a missing object.** Must degrade, not break the
   homepage.
4. **Overlapping banners with equal `sortOrder`.** Order is then
   non-deterministic. Acceptable, but worth knowing.
5. **Timezone of the scheduling window.** Stored as `DateTime`; whether the
   client reasons in IST is unstated.

## Constitution compliance

Law 1 — §1 states that only the banner slice of FR-23 exists. Law 2 — sourced.
Law 4 — satisfied once Invariant 5's constraint is added; it was recorded as
non-compliance in the draft and is now a specified rule rather than a gap.
Law 5 — Invariant 4.

## Open items

- **Invariant 5's constraint is unbuilt** — a one-line migration.
- **Invariant 6's magic-byte and dimension checks are unbuilt.**
- Scheduling timezone is unstated.
