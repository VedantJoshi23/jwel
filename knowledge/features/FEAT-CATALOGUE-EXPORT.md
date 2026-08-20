---
id: FEAT-CATALOGUE-EXPORT
title: 'Jwel / ELYSIAN — Feature: Catalogue PDF Export'
version: 0.1.0
status: Review
owner: Architecture
reviewers:
  - Vedant
created: 2026-08-20
updated: 2026-08-20
milestone: M6
category: Features
priority: Medium
depends_on:
  - DOM-CATALOG
required_by: []
related_documents:
  - STD-PERFORMANCE
  - STD-SECURITY
related_domains:
  - DOM-CATALOG
related_decisions: []
tags:
  - feature
  - catalog
  - admin
risk: Low
complexity: Medium
---

# FEAT-CATALOGUE-EXPORT

## 1. Overview

An admin who wants to send the catalogue — or one category, or one curated
collection — to someone outside the platform (a wholesale buyer, a customer
asking over the phone, a prospective stockist) has no way to do that today
beyond screenshotting the storefront. This adds a **download as PDF** control
in the admin panel: pick a scope (whole catalogue, one category, or one
collection), get back a generated PDF grouped by category, one image + name +
price per product.

## 2. Owning Domain

**Owning domain: `DOM-CATALOG`.** Reads `Product`, `Category`, `Collection`
and `CollectionProduct` — all Catalog's own data — and adds no new table.
Storage is read (already an Allowed dependency, `DOM-CATALOG` §7) to resolve
each product's thumbnail image.

## 3. Acceptance Criteria

1. An admin can generate a PDF of the **whole catalogue** — every `PUBLISHED`,
   non-deleted product, grouped by category.
2. An admin can instead generate a PDF scoped to **one category** or **one
   collection**, picked from the same lists the rest of the admin panel
   already uses.
3. Each product in the PDF shows its thumbnail image, name, and price —
   the same thumbnail (`sortOrder = 0`, guaranteed to be an image, never a
   video, per `FEAT-PRODUCT-VIDEO-MEDIA` §5) the storefront and admin media
   manager already treat as the product's face.
4. A product with no media at all still appears in the PDF, with a plain
   placeholder in place of an image — never silently dropped from the
   export.
5. **Draft products are never included**, in any scope — this is a document
   meant to leave the business, and an unpublished ₹0 placeholder or an
   in-progress listing has no business reaching a customer.

## 4. API Surface

**New** — `GET /admin/products/catalogue/pdf` (roles `ADMIN`, `STAFF`),
query parameters `categoryId` **or** `collectionId` (mutually exclusive;
neither present means the whole catalogue), returns
`application/pdf` as a file download (`Content-Disposition: attachment`).

No customer-facing surface — this is an admin tool.

## 5. Events

**Publishes** — none. **Consumes** — none. Generating a PDF is a read-only
export; it changes nothing and has no reason to touch the event bus.

## 6. Data Changes

None. No new table, no new column — every field the PDF needs already
exists on `Product`, `ProductVariant`, `ProductMedia`, `Category`, and
`Collection`.

## 7. Edge Cases & Validations

1. **An unknown `categoryId` or `collectionId`.** `404`, same shape as any
   other admin lookup failure — not a silently empty PDF.
2. **A scope with zero published products** (an empty category, or a
   collection whose products are all still drafts). A valid PDF is still
   generated, stating "No published products in this selection" rather than
   erroring — an admin exporting a genuinely empty category has a real
   answer, not a confusing failure.
3. **A product with no media.** Included with a placeholder image block, per
   Acceptance Criterion 4 — matches the storefront's own stock-image
   fallback philosophy (`getProductStockImage`), though the PDF's
   placeholder is a plain box, not a photo, since there is no per-product
   stock photo to embed here.
4. **An image fails to fetch** (storage hiccup, a stale `storageRef`). That
   one product falls back to the same placeholder as Edge Case 3, logged,
   and the export continues — one bad image must not fail the whole PDF, the
   same "one bad row doesn't stop the batch" posture `FEAT-BULK-IMPORT`
   already applies on the way in.
5. **A very large catalogue** (the live catalogue is already 1,000+
   products). This is a **synchronous** request — there is no background job
   or async generation. Named explicitly rather than assumed fine: if this
   proves too slow in practice for the whole-catalogue scope, per
   Constitution Law 3 the fix is a named follow-up (a queued/background
   generation job), not a silent workaround. Not built speculatively now
   because it has not been measured to be a problem yet.

## 8. Non-Functional Considerations

| Standard | Bearing |
| --- | --- |
| **`STD-SECURITY`** | Admin/Staff-only route, behind the existing role guard (rule 2); no new input beyond two optional UUIDs, validated by existence lookup rather than a DTO with free-text fields. |
| **`STD-PERFORMANCE`** | No new index needed — category/collection product listing already has one (`DOM-CATALOG`'s existing indexes). Edge Case 5 names the one real, unmeasured performance risk rather than optimizing pre-emptively; per `STD-PERFORMANCE` rule 5, no throughput claim is made about large-catalogue export because none has been measured. |
| **`STD-ACCESSIBILITY`** | The PDF itself is a downloaded document, outside the scope `STD-ACCESSIBILITY` covers (the storefront/admin web surfaces); the admin-panel *control* that triggers the download is a standard button/select, reachable by keyboard like the rest of the page. |
| **`STD-TESTING`** | Unit tests cover: whole-catalogue scope, category scope, collection scope, the three Edge Cases above (unknown id, empty scope, missing/failed image), and that a `DRAFT` product never appears in any scope. |

## 9. Definition of Done

Verified: full backend suite (76 files, 895 tests) and full frontend suite
(101 files, 666 tests) both green, coverage gate held (96.94%/96.68%/91.2%
statements/branches/functions on the frontend, `components/**` scope
includes the new control).

- [x] `GET /admin/products/catalogue/pdf` implemented, all three scopes.
- [x] Draft products excluded in every scope (Acceptance Criterion 5) — the
      `where` clause is `status: PUBLISHED, deletedAt: null` in all three
      query paths, asserted directly in `catalogue-export.service.spec.ts`.
- [x] Missing/failed images fall back to a placeholder rather than failing
      the export (Edge Cases 3–4) — covered for both "no media at all" and
      "fetch failed".
- [x] Admin UI: a scope picker (whole catalogue / category / collection)
      next to the existing bulk-import control, triggering the download
      (`CatalogueExportControl`).
- [x] Unit tests for all three scopes and the named edge cases — backend
      (`catalogue-export.service.spec.ts`, `products.controller.spec.ts`)
      and frontend (`catalogue-export-control.test.tsx`).
- [x] Edge Case 5 (large-catalogue performance) is named here, not silently
      assumed fine — no separate action taken since it hasn't been measured
      to be a problem; not exercised against the real ~1,000-product
      catalogue this session (only against small mocked fixtures), so "not
      measured" is accurate, not just cautious phrasing.

## 10. What this does not do

- No background/async generation — see Edge Case 5.
- No per-product description, size, or metal detail in the PDF — image,
  name, and price only, for this first version. A richer layout is a
  follow-up if requested, not built speculatively now.
- No WhatsApp-specific integration — this produces a plain downloadable PDF
  an admin can share through any channel by hand, including WhatsApp;
  it is unrelated to the automated WhatsApp catalogue sync `ADR-0022`/
  `docs/milestones/roadmap-whatsapp-ordering.md` describes for the ordering
  vertical, which feeds Wati's own in-chat catalogue, not a PDF.
