---
id: STD-SEO
title: Jwel / ELYSIAN — Standard: SEO
version: 1.0.0
status: Frozen
owner: Architecture
reviewers:
  - Vedant
created: 2026-08-07
updated: 2026-08-07
milestone: M4
category: Standards
priority: High
depends_on:
  - CONSTITUTION
  - STD-000
required_by: []
related_decisions:
  - ADR-0013
tags:
  - standards
  - seo
risk: Medium
complexity: Low
---

# STD-SEO

## Scope

The public, crawlable storefront in `apps/web`. Admin routes are out of scope
and must not be indexable.

SEO is the stated primary acquisition channel, competing against established
organic footprints. NFR-7 is **substantially met** already (KC-170) — this
Standard protects that rather than establishing it.

## Rules

1. **Indexable pages are server-rendered.** Category and product pages in
   particular.
   *Rationale:* NFR-7 and `ADR-0013`. A client-rendered storefront concedes the
   organic position the business strategy depends on.

2. **Product pages emit `Product` structured data**, including price,
   availability and rating where present.
   *Rationale:* KC-170 — JSON-LD is already implemented on the PDP. It is what
   produces rich results for the queries this business competes on.

3. **`sitemap.ts` covers indexable routes; `robots.ts` disallows private ones**
   — currently `/cart`, `/checkout`, `/profile`, `/search`.
   *Rationale:* both exist. Private routes in an index waste crawl budget and
   expose surfaces with no SEO value.

4. **Every indexable page has a unique title and meta description**, sourced
   from `brand.ts` or the entity, never hardcoded per page.
   *Rationale:* the white-label seam (KC-085) means a rebrand must not require
   editing page files.

5. **A page that is not ready for customers is `noindex`.** The demo storefront
   is disallowed in its entirety while the demo banner is present.
   *Rationale:* `RUNBOOK` §13 step 8 requires re-enabling indexing at go-live,
   and notes that if the demo was ever publicly reachable, indexed URLs need
   removal via Search Console.

6. **URL slugs are stable.** Changing a product or collection slug requires a
   redirect from the old path.
   *Rationale:* slugs are the canonical identifier in every indexed URL;
   changing one without a redirect discards accumulated ranking.

7. **A claim in indexable copy must be true** — restated from Law 1, because
   storefront copy is simultaneously the SEO surface and the promise surface.
   *Rationale:* ten outstanding claims (`DISC-008`). Indexed copy is *harder*
   to retract than on-site copy: it persists in search results and caches.

## Examples

**Compliant** — private routes excluded from crawl:

```ts
{ userAgent: '*', allow: '/', disallow: ['/cart', '/checkout', '/profile', '/search'] }
```

**Non-compliant** — a title that defeats both uniqueness and white-labelling:

```tsx
export const metadata = { title: 'ELYSIAN' };   // same on every page, brand hardcoded
```

## Exceptions

Rule 5's blanket `noindex` is itself the exception to rule 1 and applies only
while the storefront is in demo mode. Removing it is a `GO-LIVE` step, not a
routine change.

## Enforcement

- Rules 1, 3: **structural** — Next.js file conventions; `robots.ts` and
  `sitemap.ts` are code and reviewable.
- Rules 2, 4, 6: **human review.**
- Rule 5: **checklist** — `RUNBOOK` §13 steps 4, 5 and 8, including the bundle
  verification that the demo banner is genuinely gone.
- Rule 7: **`RUNBOOK` step 0**, the content review gate.
