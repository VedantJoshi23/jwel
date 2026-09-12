---
id: ADR-0027
title: The Mandala Motif Ships as Extracted Reference Line Art, Not Hand-Traced Vector
version: 0.1.0
status: Accepted
owner: Architecture
reviewers:
  - Vedant
created: 2026-09-12
updated: 2026-09-12
milestone: M6
category: Decisions
priority: Low
depends_on: []
required_by: []
related_documents: []
related_decisions:
  - ADR-0026
tags:
  - decision
  - frontend
  - imagery
  - motion
risk: Low
complexity: Low
---

# ADR-0027 — The Mandala Motif Ships as Extracted Reference Line Art, Not Hand-Traced Vector

## Context

The client asked for "traditional Indian artistic designs with subtle
animations" on the home and title banners, and supplied a generated mandala
image as the reference. The first implementation recreated it as hand-built
SVG: primitive petal functions rotated into rings, roughly sixty paths,
`viewBox="0 0 500 500"`.

That version was rejected by the client as not matching. It was then rebuilt
once — the petal silhouette corrected from a plain lens to the reference's
onion-dome outline, an invented second petal ring removed, radii re-measured
against the source — and verified by compositing screenshots against the
reference crop by crop. The client's verdict on the rebuild was the same.

The rebuild was not sloppy; the approach has a ceiling. The source has ten
or more concentric bands, sixteen-fold rather than eight-fold symmetry in
several of them, and a centre rosette of overlapping layered petals at a
density that hand-fitting Béziers does not converge on. Each iteration got
closer and still read as "a mandala like that one" rather than that one.
The owner's instruction closed it: refine it, and if SVG cannot get there,
process the raw image instead.

## Decision

**The motif ships as line art extracted from the reference image**, not as
re-drawn geometry.

The extraction is a high-pass: subtract a heavily blurred copy of the
source's luminance from the source, which removes the maroon ground and its
lens flares — both low-frequency — while leaving the thin gold strokes.
The residual becomes an alpha channel, clipped to the largest circle that
fits inside the frame so the disc is symmetric rather than cut off top and
bottom the way the source image is. Output is 760×760 WEBP, 38KB.

**It is applied as a CSS `mask-image` over a gradient fill, not painted as
an image.** The asset carries shape only; the gold gradient underneath
supplies colour. This preserves the one property the vector version was
genuinely better at — `BannerArt`'s `tone` re-colouring the motif per panel
instead of one gold being baked into the pixels — and it is why the
component renders a gradient-filled `div` with a mask rather than an `<img>`
or a `next/image`.

Rotation animation and the `prefers-reduced-motion` opt-out are unchanged;
they were never a property of the drawing method.

## Consequences

**Positive**

- It matches, because it is the reference art rather than an approximation
  of it. This was the client's actual requirement and three vector passes
  did not meet it.
- Ends an open-ended iteration loop with no convergence criterion. "Closer"
  was the only available measure and it was not becoming "close enough".
- Re-colouring per banner tone survives the change, via the mask.

**Negative**

- **38KB where the vector was a few KB**, on a decorative element. Mitigated
  by it being one shared asset across every banner that uses it, cached
  after first paint, and never blocking: it is a CSS mask on a decorative,
  `aria-hidden` layer.
- Raster, so it does not stay crisp without limit. 760×760 covers every size
  the motif is actually rendered at today (largest is the hero's 140% bleed);
  a future full-bleed use at 2× on a large display would want a re-export,
  not a resize.
- The "draw its own outline in" animation the vector could have supported is
  no longer possible. It was never built, so nothing is lost today — but it
  is off the table without reverting this decision.
- The asset is derived from a gitignored reference PNG, so the derivation is
  not reproducible from a clean checkout. The source images are the client's
  and deliberately not committed (see `ADR-0026`); the recipe is recorded
  here and in the component's own comment instead.

## Alternatives Considered

- **A fourth hand-traced vector pass** — rejected. Three passes, each with a
  real correction, did not converge, and there was no reason to believe a
  fourth would. The limit is the technique, not the effort.
- **Trace the raster automatically to SVG** (potrace or similar) — rejected.
  On thin-stroke line art this produces thousands of outline pairs, larger
  than the WEBP and slower to render, with visible corner artefacts on the
  fine centre rosette. The "it's a vector" property would be nominal.
- **Use the reference PNG directly, gold baked in** — rejected. Simplest,
  but it fixes one gold, and the light-toned collection banners need the
  motif darker rather than lighter (see `BannerArt`'s `tone`). The mask
  costs nothing extra and keeps that working.

## Revisit Criteria

- **If the motif is ever needed full-bleed on a large display**, re-export
  from the reference at a larger size rather than scaling this asset.
- **If real brand artwork replaces the generated reference**, this whole
  approach is reconsidered from scratch — a designer-supplied mandala would
  likely arrive as vector already, which removes the reason this ADR exists.
- **If the reference images are ever committed** (they are gitignored today),
  the extraction should become a checked-in build script so the asset is
  reproducible rather than hand-generated.

## Cross References

- `ADR-0026` — the client's approval of the reference image set this motif
  is drawn from, and the Law 1 reasoning about using that imagery. Note that
  ADR-0026 as first written pointed at `ADR-0025` for "the mandala work";
  that was a wrong number (ADR-0025 is the forms decision) and this document
  is what it meant to reference.
- `components/motion/mandala.tsx` — the component, whose comment carries the
  same extraction recipe.
- `components/motion/banner-art.tsx` — the `tone` mechanism the mask exists
  to keep working.
