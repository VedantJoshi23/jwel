---
id: ADR-0026
title: Client-Approved AI-Generated Reference Photography, Used as Atmosphere and Navigation Only
version: 0.1.0
status: Accepted
owner: Architecture
reviewers:
  - Vedant
created: 2026-09-12
updated: 2026-09-12
amended: 2026-09-12
milestone: M6
category: Decisions
priority: Medium
depends_on: []
required_by: []
related_documents:
  - FEAT-CLAIMS-GATE
related_decisions:
  - ADR-0027
tags:
  - decision
  - frontend
  - imagery
  - law-1
risk: Medium
complexity: Low
---

# ADR-0026 — Client-Approved AI-Generated Reference Photography, Used as Atmosphere and Navigation Only

## Context

The client supplied six AI-generated reference images for the storefront
polish pass covering header behaviour, lazy loading, card animation and
"traditional Indian artistic design" banners (that last item's own decision
is `ADR-0027`, not this one — the mandala and banner-art components it
produced are unaffected by this ADR). Three of the six show
staged jewellery photography that does not correspond to any real product in
the catalogue: a four-tile category composite (rings, earrings, bracelets and
bangles, necklaces and pendants), a grouped product display on stone
podiums, and a model wearing a full set. A fourth shows the same staged set
with no jewellery in it at all.

This mattered because the codebase had already made a decision here, on the
record. The home page's category section carries this comment, unchanged
since it was written:

```
{/* Stock lifestyle photography removed — a plain tile until real
    category photography exists. `rounded-m` stays: this is still
    navigational imagery, not the product-card imagery DESIGN.md
    §2.4 keeps sharp-framed. */}
```

Using any of the three jewellery images there — or anywhere a customer could
reasonably read "these are pieces I can buy" — would silently reopen that
decision rather than extend it, and would do so by putting jewellery in front
of a customer that this store does not sell. That is a Law 1 case (no surface
asserts a capability, or here an inventory, the system does not have),
squarely the same failure mode `FEAT-CLAIMS-GATE` exists to catch on the copy
side. It is not hypothetical for this kind of image specifically: a category
tile or a product-grouping banner is exactly the context a shopper reads as
"real merchandise," in a way a plain atmospheric backdrop is not.

Raised with the owner before building anything. The owner took it to the
client, who approved five of the six images and withheld the sixth — the
model shot, the one closest to a direct product claim.

## Decision

**Approved for use:** the mandala (already built, `ADR-0027`), the empty
arched-room set shot, the four-tile category composite, and
the product-grouping display.

**Withheld:** the model wearing the full set. Not used anywhere.

**The mitigation is placement, not disclosure.** None of the approved images
are used where a customer would read them as an offer to sell that exact
piece:

- The category composite is cropped to its **photography only** — the
  baked-in "Rings" / "Earrings" / "Necklaces & Pendants" title text is
  discarded, and the real category name is rendered as ordinary HTML text
  beside the crop, the same relationship the removed-comment's original
  tiles had to their own (real) photography. The crop keeps the ring,
  earring or pendant only as a soft focal point of an otherwise
  atmospheric tile — the same navigational role the comment above already
  established for this section, not a new one.
- The product-grouping shot is used only as a **low-opacity backdrop** behind
  a section heading, never at a size or clarity where an individual piece
  reads as identifiable, and never adjacent to a price or an add-to-cart
  control.
- The empty room shot carries no jewellery at all, so it carries no claim.

**Not extended to the fourth tile.** The category composite includes a
"Bracelets & Bangles" crop; `brand.homeCategories` features only three
categories today (rings, earrings, necklaces and pendants). Adding a fourth
featured category is a catalogue-curation decision, not an imagery one, and
is out of scope here. The fourth crop is exported to
`public/images/categories/bracelets-and-bangles.webp` for that later decision
— kept alongside the other three for consistency of source and export
settings — but `getHomeCategoryTileImage` deliberately does not map it, so
it ships in the repo without being reachable from any page today.

## Amendment — 2026-09-12

Recorded as an amendment rather than an edit to the Decision above, so the
original scope stays readable (Law 2).

**The fourth category tile is now in scope, and shipped.** The Decision
above held `Bracelets & Bangles` back on the grounds that featuring a fourth
category was "a catalogue-curation decision, not an imagery one". The owner
made that catalogue decision: all four of `brand.productTypes` are now
featured, and `homeCategoryTileImages` maps all four crops. This is the
Revisit Criterion below firing as written, not a reversal.

The reason given for it was that three-of-four made the omitted category
look discontinued rather than merely unfeatured — a Law 1 flavour of the
same concern this ADR is about, pointing the other way: the omission was
itself saying something untrue about the catalogue.

**The crops were re-cut.** The first export sliced the source composite into
plain quadrants, which is not where the tile boundaries are: the right-hand
crops carried a wedge of the composite's page background and one rounded
tile corner into the tile, visible on the live page as a pale border down
the right edge of the Earrings and Necklaces tiles. They are now cut from
the measured tile interiors, inside the corner radius, and **squared** —
square is the framing in which the piece itself is largest, where the
previous letterboxed tile spent most of its height on backdrop.

**A known gap this makes more visible, unchanged by it.** Every category
tile links to `/collections/<slug>`, and against the deployed API all four
of those slugs 404 today — the deployed catalogue has the curated
collections (`all`, `new-arrivals`, `bestsellers`) but not the top-level
categories. This predates this ADR and already affected the original three
tiles; it resolves correctly against a properly seeded stack, so it is a
data gap in the deployed environment rather than a defect in this work. It
is recorded here because giving those four tiles prominent photography makes
a dead link more inviting to click, not less.

**Related drift, not fixed here.** `apps/api/src/prisma/seed-demo.ts`
declares this category as `Bracelets & Anklets` / `bracelets-and-anklets`,
while `brand.productTypes` and the seeded database both say
`Bracelets & Bangles` / `bracelets-and-bangles` — despite that file's own
comment claiming it mirrors `brand.ts` exactly. Left alone deliberately:
which name is correct is the client's call, not ours to pick by fiat.


## Consequences

**Positive**

- Fills a real, previously-acknowledged gap (the category section, blank
  since the comment above was written) without waiting on a real photoshoot.
- Costs almost nothing: seven WEBP exports, 220KB combined (measured, after
  the amendment's re-cut and including the mandala mask of `ADR-0027`),
  against six source PNGs at 1.2–1.9MB each that never ship to a browser at
  all — they stay local reference material. The mandala mask is the largest
  single item at 38KB; no page loads all seven.
- The client's own approval is the record that resolves the Law 1 tension,
  rather than a unilateral call either way.

**Negative**

- **This is placeholder photography with a real product's face.** It is not
  disclosed as AI-generated or as non-representative anywhere on the
  storefront — the mitigation is that it never appears where it would read
  as a specific offer, not a label saying so. If that placement discipline
  erodes later (someone adds a "Shop this look" link under the grouping
  banner, say), the Law 1 problem this ADR raised returns.
- Once real category and lifestyle photography exists, these images should
  be retired, not layered under it as a fallback — see Revisit Criteria.

## Alternatives Considered

- **Use all six, including the model shot** — rejected by the client
  directly.
- **Use none of the three jewellery images, only the empty room shot** — the
  original recommendation. Rejected by the client in favour of filling the
  category-tile gap now rather than leaving it blank pending a real shoot.
- **Disclose the images as AI-generated with a visible label** — considered
  and not pursued: a disclosure label on a category tile is itself an odd,
  unprecedented storefront pattern, and the placement-only mitigation above
  was judged sufficient given how the images are actually used (atmosphere
  and soft focal points, never a clear, labelled product claim).

## Revisit Criteria

- **When real category photography exists**, the tiles in
  `app/(storefront)/page.tsx` swap to it and these crops are deleted from
  `public/images/categories/`, not kept as a secondary fallback.
- ~~**If a "Bracelets & Bangles" category is ever added to
  `homeCategories`**, add its slug to `homeCategoryTileImages`.~~ Fired
  2026-09-12 — see the Amendment above.
- **If a fifth category is ever added**, it has no approved crop: the source
  composite has exactly four. `getHomeCategoryTileImage` returns `null` and
  the tile falls back to plain colour, which is one blank tile in an
  otherwise photographic row — visible, and deliberately not papered over by
  reusing one of the four.
- **If the model shot is ever separately approved**, it needs its own
  decision, not an amendment to this one — the client withheld it
  specifically, and a future approval should be able to point at that fact
  rather than at a since-edited version of this document (Law 2).

## Cross References

- `ADR-0027` — the mandala and banner-art work from the same reference set;
  unaffected by this decision, which concerns only the jewellery/lifestyle
  images. (First written here as `ADR-0025`, which is a different decision
  entirely — a wrong number, corrected rather than left to mislead.)
- `FEAT-CLAIMS-GATE` — the copy-side version of the same Law 1 concern this
  ADR addresses for imagery.
- The category-section code comment in `app/(storefront)/page.tsx`, quoted
  above, which this decision extends rather than overrides.
