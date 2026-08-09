---
id: FEAT-STOREFRONT-SEARCH
title: 'Jwel / ELYSIAN — Feature: Storefront Search Moves to Elasticsearch'
version: 0.1.0
status: Review
owner: Architecture
reviewers:
  - Vedant
created: 2026-08-09
updated: 2026-08-09
milestone: M6
category: Features
priority: Medium
depends_on:
  - DOM-SEARCH
  - ADR-0016
required_by: []
related_documents:
  - STD-ACCESSIBILITY
related_domains:
  - DOM-SEARCH
related_decisions:
  - ADR-0016
tags:
  - feature
  - search
  - storefront
risk: Medium
complexity: Medium
---

# FEAT-STOREFRONT-SEARCH

## 1. Overview

`DOM-SEARCH`'s open items said it in one line: *"Storefront still uses the
fallback."*

The search page called `/products?q=`, whose own DTO describes that path as
*"Postgres trigram fallback — Elasticsearch is the primary search path"*
(KC-116). `FR-3` specifies typo-tolerant search **with autosuggest**; the
capability was built, the UI reached around it, and there was no autocomplete
surface at all.

## 2. The client never decides whether Elasticsearch is up

KC-124 records the move as *"conditional on Elasticsearch being present"*, and
the conditionality already lives in the right place: `/search` catches an
unreachable Elasticsearch and degrades to the same Postgres query, logging
loudly (`DOM-SEARCH` property 2).

So the storefront calls `/search` unconditionally. A client-side check would
have to guess at something only the server can know, and would have quietly
turned the fallback into dead code — which KC-124 explicitly warns against,
because CI exercises that path deliberately.

## 3. The sort control had to go

`/search` has **no sort parameter**, and that is correct: results are ordered by
*relevance*, and a relevance search re-sorted by "newest" is no longer a
relevance search.

The old dropdown worked against `/products`. Keeping it here would have left a
control that quietly did nothing — the same defect found twice already this
milestone (the cart's gift-wrap checkbox and the newsletter opt-in). So it is
removed, and category listings keep their sorting, where sorting is the whole
idea.

**This is a visible change and worth an owner's opinion.** Sorting search
results is a reasonable thing to want; it needs a sort parameter on the search
API and an equivalent in the fallback, which is a larger change than moving the
page over.

## 4. A search hit is not a product

`ProductCard` derives its price range from `variants`, which a `SearchHit` does
not carry — the API computes `priceMin`/`priceMax` instead. Rendering hits
through that card would mean inventing the missing half, so search results have
their own card showing what the search actually returned, including an
out-of-stock note in words rather than colour alone.

## 5. Autosuggest

A `listbox` with `role="option"` entries, and a `combobox` input owning
`aria-expanded` and `aria-controls`. A div of links would tell a screen reader
nothing about how many suggestions there are or that they belong to the input.

- **Debounced at 200ms** and **not requested below two characters**: one letter
  matches most of a catalogue, and a request per keystroke puts queries on the
  wire that nobody will read.
- **Chosen with `onMouseDown`, not `onClick`** — a click fires after blur, and
  blur closes the list, so the button would be gone before the click landed.
- **A suggestion goes to the product**, not to a search for its name. It is a
  way to get somewhere, not a results page in miniature.
- **When Elasticsearch is down** the endpoint returns `[]` by existing design,
  and this renders nothing — the surface disappears rather than breaking.

## 6. Edge Cases & Validations

1. **Elasticsearch unreachable.** Search degrades server-side; autosuggest
   disappears. *Verified both.*
2. **Facets.** Computed by Elasticsearch only; empty on the fallback. Not yet
   surfaced — see §8.
3. **A query matching nothing.** Says so.
4. **Server-rendered results.** Kept on screen while the client refetches —
   skeletons show only when there is genuinely nothing yet. *(Found by writing
   the test: hiding results during a refetch blanked a page that was already
   correct.)*

## 7. Definition of Done

Verified against a live API **with Elasticsearch both down and up**, in the same
session — a real 7.17 container, indexed from Postgres:

| Case | Elasticsearch down | Elasticsearch up |
| --- | --- | --- |
| `search?q=diamond` | Diamond Halo Ring | Diamond Halo Ring |
| `search?q=daimond` *(typo)* | **no match** | **Diamond Halo Ring** |
| Facets | empty | `metals: GOLD(2)`, `categories: rings(2)` |
| Autocomplete `dia` | `[]` | Diamond Halo Ring |
| Storefront `/search?q=daimond` | "No products matched" | renders the ring |

That table is the feature: the middle column is what customers have been
getting, and the right column is what was already built and unreachable.

- [x] Search page and results on `/search`.
- [x] Autosuggest in the header, accessible and debounced.
- [x] Fallback kept as a live path, exercised in verification.
- [x] Sort control removed rather than left inert.
- [x] 476 web tests green.

## 8. What is still open

- **Facets are returned and not shown.** Elasticsearch computes metal,
  category, certification and price-range buckets; the storefront renders none
  of them. That is the next thing this unlocks, and it is a real UI design
  question rather than plumbing.
- **Sorting search results** — see §3.
- **Elasticsearch is not deployed.** `deploy/docker-compose.elasticsearch.yml`
  exists and the production stack does not run it, so today every customer is
  still served by the fallback. This change is what makes starting it *matter*;
  until then the improvement is latent.
