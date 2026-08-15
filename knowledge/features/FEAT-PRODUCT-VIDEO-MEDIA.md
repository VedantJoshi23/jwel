---
id: FEAT-PRODUCT-VIDEO-MEDIA
title: 'Jwel / ELYSIAN — Feature: Product Video Media'
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
  - STD-API
  - STD-DATABASE
  - STD-SECURITY
  - STD-ACCESSIBILITY
  - STD-TESTING
related_domains:
  - DOM-CATALOG
related_decisions: []
tags:
  - feature
  - catalog
  - admin
  - storefront
risk: Medium
complexity: Medium
---

# FEAT-PRODUCT-VIDEO-MEDIA

## 1. Overview

`ProductMedia.type` has carried `MediaType.VIDEO` in the schema since the enum
was defined, and the storefront's `ProductMedia` TypeScript type already
includes `'VIDEO'` in its union — neither was ever wired to anything. Every
upload path assumes an image (`ALLOWED_IMAGE_MIME_REGEX`, `MAX_IMAGE_BYTES`),
and the storefront gallery filters `media` to `type === 'IMAGE'` before
rendering, so a video row would be silently dropped if one existed. This
closes that gap: admins can upload a short video alongside a product's
images, and customers can play it on the product page. The thumbnail — the
first thing a customer sees in a listing or at the top of the gallery — must
always be an image, never a video frame.

## 2. Owning Domain

**Owning domain: `DOM-CATALOG`.** `ProductMedia` is Catalog-owned data
(`DOM-CATALOG` §2); this feature extends it, it does not introduce a new
owner. No other domain is touched — Storage is used as already-Allowed
shared infrastructure (`DOM-CATALOG` §7).

## 3. Acceptance Criteria

1. An admin can upload a video file to a product's media, alongside its
   images, from the same media manager used for photos.
2. A video is rejected server-side if it is not an allowed format or exceeds
   the size cap — the same belt-and-braces pattern (controller pipe +
   service re-validation) already used for images.
3. **A video can never become the thumbnail.** The first media item shown to
   a customer — index 0 of the ordered set — is always an `IMAGE`. This is
   enforced at the database, not just in the UI (Constitution Law 4).
4. The admin "make thumbnail" action is unavailable on a video item.
5. The customer-facing product page plays the video inline, with standard
   HTML5 controls; it does not attempt to zoom it (`FEAT-PRODUCT-ZOOM-VIEWER`
   §3 scopes zoom to images only).
6. Deleting the product's only remaining image while a video is still present
   is rejected — that would leave no valid thumbnail. The admin is told to
   add another image or delete the video first.

## 4. API Surface

**Changed** — `POST admin/products/:id/media` (`products.controller.ts`):
accepts `video/mp4` and `video/webm` in addition to the existing image mimes,
routes to type-appropriate size/mime validation, and now sets
`ProductMedia.type` explicitly instead of always defaulting to `IMAGE`.

**Unchanged surface, new failure mode** —
`PUT admin/products/:id/media/reorder` and
`DELETE admin/products/:id/media/:mediaId` now can return `409` where they
previously could not, per Acceptance Criteria 3 and 6.

**No new routes.** Customer-facing `GET /products/:slug` is unchanged in
shape — `media[].type` already carried `'IMAGE' | 'VIDEO'` in the response
type; a `VIDEO` row simply stops being impossible.

## 5. Data Changes

No new columns. `ProductMedia.type` (already `MediaType`, default `IMAGE`) is
now set explicitly by the service based on the uploaded file's mime type.

**New database constraint**, per Constitution Law 4 / `STD-DATABASE` rule 4 —
the lowest layer that can enforce "thumbnail is always an image" is a
row-level `CHECK`, since `sortOrder` and `type` are both columns on the same
row:

```sql
ALTER TABLE product_media
  ADD CONSTRAINT product_media_thumbnail_is_image
  CHECK (sort_order <> 0 OR type = 'IMAGE');
```

This only protects the literal `sort_order = 0` row. It is made to actually
mean "first in display order" by a service-layer change: `removeMedia` now
re-sequences the remaining rows to a contiguous `0..n-1` inside the same
transaction as the delete, instead of leaving gaps. Previously, deleting the
row at `sort_order = 0` could leave a video sitting at `sort_order = 1` as
the new first-displayed item without ever violating the old (gap-tolerant)
ordering — the resequencing is what makes the `CHECK` constraint meaningful
rather than trivially satisfied.

## 6. Events

**Publishes** — `product.upserted`, already emitted by `addMedia` /
`removeMedia` / `reorderMedia`; unchanged, since `DOM-CATALOG` §5 already
covers media changes.
**Consumes** — none.

## 7. Edge Cases & Validations

1. **First upload to a product is a video.** Rejected — `sortOrder` would be
   `0`, violating the thumbnail-is-image rule. Server returns a `422` naming
   the reason, not a raw constraint-violation error. (Admin UI should also
   disable video upload until at least one image exists, but the API is the
   actual guarantee.)
2. **Reorder attempts to move a video to index 0.** Rejected `422` before the
   `$transaction` runs — validated against each id's `type`, not left to the
   `CHECK` constraint to surface as a generic Postgres error.
3. **Delete the sole image while a video remains.** Rejected `409` (Edge Case
   in §3 above).
4. **Delete a video.** Always permitted — removing a video never threatens
   the thumbnail invariant.
5. **Upload with a disallowed video mime (e.g. `video/quicktime`) or a file
   over the cap.** `422`/`413`, same shape as the existing image path.
6. **Video duration.** *Not enforced server-side* — there is no
   `ffprobe`/media-inspection dependency in `apps/api` today, and adding one
   is out of scope for this feature. The admin upload form reads the HTML5
   `<video>` element's `duration` metadata client-side and blocks the upload
   above a soft cap before it is sent. This is a UX guard, not a trust
   boundary (`STD-SECURITY` rule 5 is about the request body's DTO, not
   client-observed metadata) — stated here explicitly per Constitution Law 1
   rather than left implied.
7. **`storage.resolveUrl` for a video.** No change needed — the storage port
   is content-type agnostic (`UploadFileInput.mimeType` is already a
   parameter); it stores and returns whatever buffer it is given.

## 8. Non-Functional Considerations

| Standard | Bearing |
| --- | --- |
| **`STD-DATABASE`** | Rule 4 (Law 4): the thumbnail-is-image invariant is a `CHECK` constraint, not just application code. Rule 6: this doc records the constraint and the enforcing service (`products.service.ts`, `removeMedia`/`addMedia`/`reorderMedia`) together. |
| **`STD-API`** | Rule 3: video upload still crosses the trust boundary through the controller's `ParseFilePipeBuilder` DTO-equivalent validation, mirroring the existing image path. Rule 4: new `409`/`422` cases use the standard error envelope, not a hand-crafted shape. |
| **`STD-SECURITY`** | Rule 5: server-side mime/size validation is the actual control; the client-side duration check is explicitly *not* claimed as one (§7.6). |
| **`STD-ACCESSIBILITY`** | The `<video>` element ships with native controls (rule 3: keyboard operable by default) and `muted`/no autoplay, since an autoplaying video with sound is both a nuisance and a WCAG 2.1 concern (audio that plays without user control). No alt-text equivalent applies to video the way rule 4 requires for images — video is user-initiated playback, not passively presented content. |
| **`STD-PERFORMANCE`** | No new read path — reuses `[productId, sortOrder]`, already indexed. The size cap chosen (§9) bounds worst-case upload/storage cost per file. |
| **`STD-TESTING`** | New/changed service behaviour (`addMedia` type-branching, `removeMedia` resequencing + `CHECK`-violation handling, `reorderMedia`'s index-0 guard) gets unit tests beside the existing `products.service.spec.ts` suite, per rule 1. |

## 9. Chosen Limits

*(Owner deferred to sensible defaults; recorded here per Constitution Law 2 —
these are product decisions, not incidental implementation details.)*

- **Formats:** `video/mp4`, `video/webm`. Both play natively in every
  evergreen browser with no transcoding step — the project has no video
  processing pipeline, so format support is exactly what the browser can
  play directly.
- **Size cap:** 40 MB per video. Generous enough for a short 1080p clip at a
  reasonable bitrate, well below anything that would meaningfully stress the
  filesystem/S3 storage path already used for images.
- **Duration:** soft client-side cap of 30 seconds, unenforced server-side
  (§7.6). Chosen to match "short video" as requested — long enough to show a
  piece turning under light, short enough to stay a supplement to photos, not
  a replacement.

New constants live in `apps/api/src/common/media/video-upload.constraints.ts`,
mirroring `image-upload.constraints.ts` rather than merging into it — the two
have different allowlists and caps, and a merged file would need type
branching internally that the existing file's callers don't expect.

## 10. Definition of Done

Verified against a running API process on the test database
(`jwel_test`, migration applied via `prisma migrate deploy`), with real
multipart requests against `POST/DELETE/PUT admin/products/:id/media*` using
a JWT signed for a real seeded admin user — not just unit tests:

| Case | Result |
| --- | --- |
| Upload video as the product's first media item | **400** — verified live |
| Upload image after that | **201**, `sortOrder: 0` — verified live |
| Upload video once an image exists | **201**, `type: VIDEO`, `sortOrder: 1` — verified live |
| Reorder to move the video to index 0 | **400** — verified live |
| Delete the sole image while the video remains | **409** — verified live |
| Delete the video | **200** — verified live |
| Upload video ≤ 40 MB / > 40 MB size boundary | unit test (`products.service.spec.ts`) |

The size-boundary case wasn't re-verified live (a 41 MB fixture wasn't worth
generating for this pass); everything that touches the thumbnail invariant —
the actual point of this feature — was.

- [x] `ProductMedia` migration adds the `product_media_thumbnail_is_image`
      `CHECK` constraint — applied to the test database.
- [x] `video-upload.constraints.ts` added with the §9 limits.
- [x] `products.controller.ts` accepts video mimes, branches size/type
      validation by detected mime.
- [x] `products.service.ts`: `addMedia` sets `type` explicitly and rejects a
      video as the first upload; `removeMedia` resequences and surfaces the
      thumbnail-invariant violation as a `409`; `reorderMedia` rejects a video
      at index 0 before the transaction.
- [x] Admin media manager: video upload control, video tile with a play
      indicator, "make thumbnail" hidden for video tiles, client-side
      duration guard, move buttons disabled where they'd break the invariant.
- [x] Storefront gallery: stops filtering out `VIDEO`; renders a native
      `<video controls muted>` tile in the thumbnail strip and main viewer.
- [x] Unit tests for every §7 edge case (7 new/changed `products.service.spec.ts`
      cases).
- [x] `DOM-CATALOG` updated to record the thumbnail-is-image invariant
      (Invariant 12, v1.2.0).
- [ ] Admin page (`app/(admin)/admin/products/[id]/page.tsx`) has no
      component test — consistent with its pre-existing state (it had none
      before this feature either; the file sits outside `vitest.config.mts`'s
      coverage `include`), but named here rather than left implicit.

## 11. What this does not do

- No server-side duration enforcement (§7.6) — named as a limitation, not
  silently absent.
- No video transcoding, compression, or multiple-resolution delivery. What is
  uploaded is what is served.
- No poster-frame generation. The browser's own first-frame decode
  (`preload="metadata"`, no `poster` attribute) stands in for a thumbnail
  image of the video tile itself — acceptable because the *product*
  thumbnail is guaranteed to be a real image by §3; this only affects how the
  video's own tile looks before playback.
