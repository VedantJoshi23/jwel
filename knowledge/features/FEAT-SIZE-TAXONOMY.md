---
id: FEAT-SIZE-TAXONOMY
title: 'Jwel / ELYSIAN — Feature: Category-Aware Size Taxonomy & Filter'
version: 0.2.0
status: Review
owner: Architecture
reviewers:
  - Vedant
created: 2026-08-07
updated: 2026-08-07
milestone: M6
category: Features
priority: Critical
depends_on:
  - DOM-CATALOG
  - CONSTITUTION
required_by: []
related_documents:
  - ARCH-001
  - STD-DATABASE
  - STD-API
  - STD-SEO
  - STD-ACCESSIBILITY
related_domains:
  - DOM-CATALOG
related_decisions:
  - ADR-0014
  - ADR-0015
tags:
  - feature
  - catalog
  - sizing
risk: Medium
complexity: Medium
---

# FEAT-SIZE-TAXONOMY

> **Amended 2026-08-07 (v0.2.0)** — owner decision on legacy data. Criterion 8
> originally nulled unmappable sizes; it now preserves them verbatim as
> **custom** options, and criteria 10–11 were added. Rounding an unmappable
> value to a nearby seeded size would silently change what a product physically
> is, which is worse than either keeping it or dropping it.

## 1. Overview

Customers cannot currently filter or reliably read product size, because
`ProductVariant.size` is an unconstrained `String?` — free text with no
vocabulary, no validation and no filter. The client has asked for standard ring
sizes to be shown, and for size to appear **only on categories that
semantically have one**.

This feature introduces a **per-category sizing scheme** with a seeded
standards table, constrains variant sizes to it, and exposes size as a
customer-facing filter and a product-detail size guide.

**Why this is sequenced first.** The client is about to populate 1,045
placeholder products (KC-030, KC-049). If sizes are entered as free text before
a vocabulary exists, the result is 1,045 rows of inconsistent strings —
`"16"`, `"Size 16"`, `"16 (US 8)"` — and a data-migration problem instead of a
data-entry convention. **This must land before catalog data entry, not after.**

## 2. Owning Domain

**Owning domain: `DOM-CATALOG`.** Size is an attribute of `ProductVariant`,
which Catalog owns, and the sizing scheme is an attribute of `Category`, also
Catalog's.

**Dependencies** — each checked against the initiating domain's Allowed list
per `OV-007`:

| Domain | Call | Allowed by |
| --- | --- | --- |
| Search | Catalog emits `product.upserted`; Search reindexes with the size field | `DOM-CATALOG` §5 publishes it; `DOM-SEARCH` §5 consumes it |

No new cross-domain dependency is introduced. Shopping, Ordering and Inventory
read variants as they already do; a size value is just another variant column
to them.

## 3. Acceptance Criteria

1. A category declares a **sizing scheme** or declares that it has none.
   Categories without a scheme show no size UI anywhere.
2. Standard size values are **seeded reference data**, not free text, and are
   the only values a variant may take for its category's scheme.
3. **Rings use the Indian numeric scale.** Each option carries its inner
   diameter and circumference in millimetres, plus US and UK equivalents.
4. A variant in a sized category **must** carry a valid size; a variant in an
   unsized category **must not**.
5. Admin product forms present size as a **constrained selector**, never a text
   input, and only for sized categories.
6. Customers can **filter a category listing by size**, and the filter appears
   only where the category has a scheme.
7. The product detail page shows the size, and a **size guide** giving the
   physical measurements and international equivalents.
8. Existing free-text sizes are either **normalised** to a seeded value or
   **preserved exactly as a custom option**. Nothing is rounded, clubbed with a
   nearby size, or discarded — a ring genuinely made at 16.5 is not a 16, and
   changing it would misrepresent a physical product.
9. Bulk CSV import validates size against the scheme and rejects rows that do
   not match, rather than importing them silently.
10. A **custom** size is a first-class option for filtering and display, but is
    **never offered when creating a new product**. Without that exclusion,
    custom values become the new free text and the vocabulary drifts again.
11. Every seeded (non-custom) size has a real circumference. A custom size may
    have none, and the size guide omits rows it cannot measure rather than
    printing an invented figure.

## 4. API Surface

Consistent with `DOM-CATALOG` §4; no endpoint moves domain.

**New**

- `GET /sizes?scheme=<scheme>` — public. Returns the seeded options for a
  scheme, for the filter UI and the size guide.

**Changed**

- `GET /products` — accepts `size` as a filter, alongside the existing
  `metal`, price range and `sort` (`STD-API` r5 pagination unchanged).
- `GET /products/:slug` — variant payload gains the resolved size option
  (value, label, measurements) rather than a bare string.
- `POST /admin/products`, `PATCH /admin/products/:id` — size validated against
  the category's scheme.
- `POST /admin/products/bulk-import` — same validation (criterion 9).
- Category admin endpoints accept and return `sizeScheme`.

## 5. Events

**Publishes** — `product.upserted` on any variant size change, so Search
reindexes. Already declared in `DOM-CATALOG` §5; nothing new.

**Consumes** — none.

## 6. Data Changes

All within `DOM-CATALOG`'s Data Ownership.

**New enum** `SizeScheme` — `RING_INDIA`, `BANGLE_INDIA`, `CHAIN_LENGTH_MM`,
`BRACELET_LENGTH_MM`. A category with no scheme stores `NULL`.

**New table** `size_options` — reference data, seeded plus any custom values
recovered from legacy data:

| Column | Notes |
| --- | --- |
| `scheme` | `SizeScheme` |
| `value` | canonical stored value, e.g. `"16"` |
| `label` | display label, e.g. `"16"` |
| `diameter_mm` | `Decimal(5,2)`, nullable |
| `circumference_mm` | `Decimal(5,2)` — the authoritative physical measure |
| `us_equivalent`, `uk_equivalent` | nullable strings |
| `sort_order` | integer |
| `is_custom` | boolean, default false — recovered from legacy data, not part of the curated vocabulary |

Unique on `(scheme, value)`; indexed on `(scheme, sort_order)`.

**`circumference_mm` is NOT NULL only for non-custom rows**, enforced by a
CHECK constraint:

```sql
CHECK ((is_custom = false AND circumference_mm IS NOT NULL) OR is_custom = true)
```

The guarantee is kept exactly where it matters — every curated size has a real
measurement — while a custom row is allowed to be honest about not having one.
`"Free size"` has no circumference, and inventing one would be the fabrication
Law 1 forbids.

**Changed** — `Category.sizeScheme` (nullable enum). `ProductVariant.size`
keeps its column but its values become constrained to
`size_options.value` for the product's category scheme.

### Seed data — Indian ring sizes

Sourced from published Indian jewellery size charts (see §10). **Circumference
is the authoritative measure**; published diameter figures vary by roughly
0.2 mm between vendors, because diameter is derived and rounded differently.

| Size | Ø mm | Circ. mm | US | UK |
| --- | --- | --- | --- | --- |
| 6 | 14.68 | 46.1 | 3 | F |
| 8 | 15.29 | 48.0 | 4 | H½ |
| 10 | 15.90 | 50.0 | 5 | J½ |
| 12 | 16.51 | 51.9 | 6 | L½ |
| 14 | 17.32 | 54.4 | 7 | N½ |
| 16 | 17.93 | 56.3 | 8 | P½ |
| 18 | 18.54 | 58.3 | 9 | R½ |
| 20 | 19.15 | 60.2 | 10 | T½ |
| 22 | 19.76 | 62.1 | 11 | V½ |
| 24 | 20.37 | 64.0 | 12 | Y |
| 26 | 20.98 | 65.9 | 13 | Z+1 |

Abbreviated for readability — **the seed covers every integer size in the
adopted range**, not alternates.

**Adopted range: 6–26.** Published charts run 1–37, but sizes below 6 and above
26 are outside normal adult retail and would give the client a selector of
mostly unstockable options. The range is a **seed decision, not a physical
constraint** — extending it is a seed row, not a migration.

**Common sizes for reference:** women 10–12 (11 most common), men 17–20. Worth
surfacing in the size guide.

### Which categories get a scheme

| Category | Scheme | Reason |
| --- | --- | --- |
| Rings | `RING_INDIA` | Fit is essential; wrong size is unwearable |
| Bracelets & Anklets | `BRACELET_LENGTH_MM` | Length varies materially |
| Necklaces & Pendants | `CHAIN_LENGTH_MM` | Chain length is a real choice |
| Earrings | **none** | No meaningful size dimension for studs, hoops or jhumkas |

Sub-categories inherit their parent's scheme unless they override it —
"Adjustable" rings are the case that will need an override, since an adjustable
ring has no size.

## 7. Edge Cases & Validations

1. **Adjustable rings.** A ring that fits any finger has no size. Either the
   sub-category carries no scheme, or the scheme includes an explicit
   `ADJUSTABLE` option. **The sub-category override is preferable** — it keeps
   the size vocabulary physical.
2. **Existing free-text sizes.** Two published products and 1,045 drafts.
   Values that map cleanly to a seeded option are normalised. The rest are
   **preserved verbatim as custom options** (criteria 8, 10) and reported to
   the client as a review queue — not rounded, not clubbed, not nulled.
   Rounding would silently change what a product physically is.
3. **Category's scheme changed after variants exist.** Existing variant sizes
   become invalid. The change must be blocked while non-conforming variants
   exist, rather than orphaning data.
4. **A sized product published with no size.** Rejected — this criterion joins
   the publish-completeness check (KC-192), which is being built alongside.
5. **Filtering by a size no product has.** Returns an empty result set, not an
   error. The filter UI should ideally disable unavailable sizes.
6. **Kids' silver.** May need a different range from adult rings. Handled by a
   sub-category scheme override if it arises.
7. **Bulk import with an unrecognised size.** The row is rejected with a message
   naming the valid values (criterion 9). Importing 1,000 rows silently
   dropping sizes is the failure this prevents.
8. **A customer's size is between two options.** Out of scope; the size guide
   should advise sizing up.

## 8. Non-Functional Considerations

Checked against the Applicable Standards that bear on this feature's shape.

| Standard | Bearing |
| --- | --- |
| **`STD-DATABASE`** | Criterion 4's rule spans two tables via `Category`, so it **cannot** be a CHECK constraint — it is application-layer, and per r6 that limitation must be documented in the schema and the enforcing service named. `size_options` uniqueness and `Category.sizeScheme` are database-enforced. Seed data is idempotent and re-runnable. |
| **`STD-API`** | Size joins the existing filter set on `GET /products`; pagination unchanged (r5). `GET /sizes` is public and returns reference data only. Admin size validation returns the standard error envelope (r4). |
| **`STD-ACCESSIBILITY`** | The size selector is a form control and must be labelled (r7) and keyboard-operable (r3). Availability must not be conveyed by colour alone (r6) — a disabled size needs text or an attribute, not just a greyed swatch. |
| **`STD-SEO`** | Size becomes part of variant data in the PDP's `Product` structured data (r2). Size filters must not generate crawlable duplicate URLs for every size combination — filtered listings should be `noindex` or canonicalised to the unfiltered category. |
| **`STD-TESTING`** | Scheme resolution, validation and normalisation are branching logic; each edge case in §7 needs a test (r6 ratchet applies to the migration too). |
| **`STD-CODE`** | Seed data lives in the migration/seed path, not inline in a service. |

**Law 1 check:** the size guide must not claim a fit accuracy the data does not
support. Published charts disagree by ~0.2 mm on diameter; the guide should
present circumference as the measurement to trust and advise measuring rather
than converting.

## 9. Definition of Done

- [x] `SizeScheme` enum, `size_options` table, `Category.sizeScheme` migrated.
- [x] Ring sizes 6–26 seeded with circumference, diameter, US and UK values;
      seed is idempotent.
- [x] Category schemes assigned per §6, including the Adjustable override.
- [x] Variant size validated against the category scheme on create, update and
      bulk import.
- [x] Existing free-text sizes normalised where they map, preserved as custom
      options where they do not; count of custom options reported to the client
      as a standing review queue (`normalise-variant-sizes.ts`).
- [x] Custom options excluded from the admin creation selector, present in
      filters and display (`curatedOnly`).
- [x] `GET /sizes` and the `size` filter on `GET /products` implemented and
      tested.
- [x] Admin forms use a constrained selector, shown only for sized categories.
- [x] Storefront filter and PDP size guide implemented, meeting
      `STD-ACCESSIBILITY`.
- [x] Every §7 edge case covered by a test.
- [x] `DOM-CATALOG` amended to carry the size invariants (its §3 does not yet
      mention sizing).
- [ ] Client informed that the size vocabulary is fixed before data entry
      begins, and given the custom-value review queue. **Outstanding — the only
      remaining item, and it is a conversation rather than code.**

### Not done deliberately

The normalisation script has **not been run against any real database**. It is
written, tested and verified against a throwaway Postgres container with
representative legacy data, but it **rewrites `product_variants` and inserts
into `size_options`**, so running it is a deliberate operational step rather
than something that happens because a script exists.

The procedure — backup, verify the backup is readable, run, read the report —
is `deploy/RUNBOOK.md` **§11a**, along with its prerequisites. Those matter:
run it before `seed-size-options.ts` and every existing size becomes a custom
option; run it before category schemes are assigned and sizes are **cleared**.

There is no dry-run mode. The backup is the mitigation.

## 10. Sources

Indian ring sizing researched rather than requested from the client, per the
owner's instruction:

- [Sukkhi — Rings Size Chart](https://sukkhi.com/pages/rings-size-chart) — full
  1–37 scale with diameter and circumference.
- [Chaitra — Ring Size Chart India](https://chaitra.co/ring-size-chart-india/) —
  6–27 with US and UK conversions.
- [Tanishq — Ring Size Guide](https://staticimg.tanishq.co.in/sizing-guide/ring-size-guide.pdf)
  and [CaratLane — Ring Sizing](https://www.caratlane.us/media/size-guide/rings.pdf) —
  market-leader guides, consistent with the scale above.

The two primary sources agree on structure and differ by ~0.2 mm on diameter,
which is why circumference is treated as authoritative.
