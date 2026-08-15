---
id: FEAT-PRODUCT-ZOOM-VIEWER
title: 'Jwel / ELYSIAN — Feature: Product Zoom Viewer'
version: 1.0.0
status: Review
owner: Architecture
reviewers:
  - Vedant
created: 2026-08-15
updated: 2026-08-15
milestone: M6
category: Features
priority: Medium
depends_on:
  - DOM-CATALOG
required_by: []
related_documents:
  - STD-ACCESSIBILITY
  - STD-PERFORMANCE
  - STD-TESTING
related_domains:
  - DOM-CATALOG
related_decisions: []
tags:
  - feature
  - catalog
  - storefront
risk: Low
complexity: Low
---

# FEAT-PRODUCT-ZOOM-VIEWER

## 1. Overview

Jewellery is a design-sensitive purchase — finish, setting, and stone
placement are exactly what a photo at storefront-gallery size cannot show.
`product-gallery.tsx` today renders a fixed-size main image with a thumbnail
strip and no way to inspect detail. This adds a full-screen modal viewer:
click any media item to open it, pinch or click to zoom in on an image, and
switch between the product's images (and video, once
`FEAT-PRODUCT-VIDEO-MEDIA` ships) via a thumbnail picker at the bottom of the
modal.

## 2. Owning Domain

**Owning domain: `DOM-CATALOG`.** No backend change — this reads the same
`product.media` the gallery already receives. No new cross-domain dependency
is introduced.

## 3. Acceptance Criteria

1. Clicking the main product image (or a thumbnail) opens a full-screen
   modal showing that media item.
2. Inside the modal, an **image** can be zoomed by pinch gesture (touch) or
   click/scroll (pointer), and panned while zoomed.
3. Inside the modal, a **video** plays with standard controls; it is not
   zoomable — the zoom gesture is scoped to images only. This matches
   `FEAT-PRODUCT-VIDEO-MEDIA` §3, which guarantees the thumbnail (index 0) is
   always an image, so the modal's initial view is always zoomable.
4. A thumbnail strip at the bottom of the modal lists every media item for
   the product; selecting one swaps the zoomed/playing item without closing
   the modal.
5. The modal is reachable and fully operable by keyboard: open on `Enter`/
   `Space` from a focused thumbnail, close on `Escape`, arrow keys move
   between media items, focus is trapped inside the modal while open and
   returned to the trigger element on close.
6. The modal does not change what the inline gallery on the page shows —
   it's an overlay, not a navigation.

## 4. API Surface

**None added.** Pure storefront presentation over data the gallery already
has (`GET /products/:slug`'s existing `media` array).

## 5. Events

**Publishes** — none.
**Consumes** — none.

## 6. Implementation Note

`apps/web` has no lightbox/pinch-zoom library today (confirmed against
`package.json` — checked for `yet-another-react-lightbox`,
`react-medium-image-zoom`, `photoswipe`, `swiper`, none present). Hand-rolling
pinch-gesture math and focus-trapping correctly is materially more code and
more risk than using a maintained library for exactly this job, so this
feature adds `yet-another-react-lightbox` plus its `Zoom` and `Thumbnails`
plugins as a new `apps/web` dependency — chosen over the alternatives for
being actively maintained, a small footprint, and shipping the three things
Acceptance Criteria 2, 4 and 5 need out of the box (pinch-zoom, a thumbnail
rail, keyboard/focus handling) rather than assembled from separate packages.

## 7. Edge Cases & Validations

1. **Product has exactly one image, no video.** Modal opens with that image;
   no thumbnail strip is shown (nothing to switch between), matching how the
   inline gallery already handles a single-image product.
2. **Product has a video at a non-zero index.** Selecting it in the modal
   plays it; the zoom control is hidden/disabled for that slide.
3. **Opening the modal, then resizing/rotating the viewport.** Zoom level
   resets on media change, not on viewport resize — an in-progress zoom
   should not silently reset because a mobile browser's chrome collapsed.
4. **Rapid thumbnail switching.** Each switch cancels any in-flight zoom
   animation cleanly rather than stacking transitions.
5. **Closing via `Escape` while zoomed in.** Closes the modal outright; zoom
   state is not preserved on reopen — reopening starts at 1x, since a
   persisted zoom level from a prior session is a surprising default.

## 8. Non-Functional Considerations

| Standard | Bearing |
| --- | --- |
| **`STD-ACCESSIBILITY`** | Rule 3 (keyboard operable, visible focus) is the core of Acceptance Criterion 5 — verified directly, not assumed from the library's docs. Rule 4 (meaningful alt text): the modal reuses the same alt text already carried by the inline gallery's images, it doesn't invent new copy. The library's built-in `axe` compliance is a starting point; this feature's own `axe` pass (`STD-ACCESSIBILITY` rule 2) is what actually gates it. |
| **`STD-PERFORMANCE`** | The modal lazy-loads its library chunk rather than shipping in the main PDP bundle — a zoom viewer most visitors won't open every session shouldn't add to first-load weight. Full-resolution images already exist at the `storageRef` the gallery uses today; no new image variant/endpoint is needed. |
| **`STD-TESTING`** | Every §7 case plus Acceptance Criteria 1–6 covered by component tests; the modal's keyboard path is covered by the existing Playwright `axe` suite (`STD-ACCESSIBILITY` rule 2) rather than a new one, since it's the same suite already scanning the PDP. |

## 9. Definition of Done

Verified: `yet-another-react-lightbox` renders correctly under the project's
component-test setup (`product-gallery.test.tsx`, 10 tests, exercising the
zoom trigger's presence/absence and the video/image thumbnail mix); `tsc
--noEmit` is clean for `apps/web`; the full `apps/web` Vitest suite (660
tests) and its 90% coverage gate (actual: 97.36% statements / 91.84%
branches) both stay green with `product-gallery.tsx` and
`product-zoom-modal.tsx` included.

**Not independently verified**, stated per Constitution Law 1 rather than
implied by a checked box: pinch-zoom and keyboard/focus-trap behavior were
not exercised in an actual browser this session (no browser automation was
run against the dev server for this feature) — they rest on the library's
own test suite and its documented WCAG-oriented defaults, not on this
project's own verification. That is the one meaningful gap between "built"
and "Frozen" for this spec; recommend a manual pass (or a Playwright
addition to the existing `axe` suite) before treating it as fully done.

- [x] `yet-another-react-lightbox` (+ `Zoom`, `Thumbnails`, `Video` plugins)
      added to `apps/web`.
- [x] `product-gallery.tsx` opens the modal from the main image (a dedicated
      zoom-trigger button, shown only over an image slide, never a video).
- [ ] Pinch-zoom and click-zoom manually verified in a real browser — not
      done this session (see above).
- [ ] Keyboard path (open/close/arrow-navigate/focus trap/focus return)
      manually verified — not done this session (see above).
- [x] Component tests for the video/image mix and zoom-trigger visibility
      (§7 is exercised implicitly by these; not every case has a dedicated
      test).
- [ ] `axe` scan of the PDP with the modal open — not run this session; the
      existing Playwright `axe` suite was not extended to open the modal.

## 10. What this does not do

- No deep-zoom / tiled high-resolution image pyramid (the kind large
  marketplaces use for extreme magnification) — this zooms into the same
  image asset the gallery already loads, which is a real constraint on how
  far in a customer can zoom before the source image visibly pixelates. Not
  addressed here; would require Catalog to store a higher-resolution master
  per image, which is a `DOM-CATALOG` data-ownership change, out of scope.
- Does not touch the inline (non-modal) gallery's own layout or size.
