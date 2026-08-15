/**
 * The video counterpart of `image-upload.constraints.ts`. Kept as a separate
 * file rather than merged in — the two allowlists and caps differ, and a
 * merged file would need every caller to branch on media type internally,
 * which the existing image-only callers don't expect.
 *
 * Limits recorded in `FEAT-PRODUCT-VIDEO-MEDIA` §9: mp4/webm only (no
 * transcoding pipeline exists, so only what a browser can play natively is
 * accepted), 40 MB cap. Duration is deliberately not a server-side
 * constraint — there is no ffprobe/media-inspection dependency in this app;
 * see `FEAT-PRODUCT-VIDEO-MEDIA` §7.6 for why that is a stated limitation
 * rather than a silent gap.
 */
export const ALLOWED_VIDEO_MIME_TYPES = ['video/mp4', 'video/webm'] as const;

/** The same allowlist in the form Nest's `addFileTypeValidator` wants. */
export const ALLOWED_VIDEO_MIME_REGEX = /^video\/(mp4|webm)$/;

export const MAX_VIDEO_BYTES = 40 * 1024 * 1024; // 40 MB

export function isAllowedVideoMimeType(mimeType: string): boolean {
  return (ALLOWED_VIDEO_MIME_TYPES as readonly string[]).includes(mimeType);
}
