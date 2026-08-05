/**
 * One definition of what counts as an acceptable image upload, shared by
 * every route that accepts one.
 *
 * These values previously existed twice — as a regex plus a byte cap in
 * `products.controller.ts` for the ParseFilePipe, and again as an array plus
 * the same byte cap in `products.service.ts` for the server-side re-check.
 * Two copies of a security limit drift: raising the cap in one place and not
 * the other produces a route that accepts a file the service then rejects,
 * or worse, the reverse.
 */
export const ALLOWED_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

/** The same allowlist in the form Nest's `addFileTypeValidator` wants. */
export const ALLOWED_IMAGE_MIME_REGEX = /^image\/(jpeg|png|webp)$/;

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8 MB

export function isAllowedImageMimeType(mimeType: string): boolean {
  return (ALLOWED_IMAGE_MIME_TYPES as readonly string[]).includes(mimeType);
}

/**
 * Folders an admin upload may target.
 *
 * This is a security boundary, not a tidiness convention: `folder` reaches
 * `FilesystemStorageProvider.upload`, which does `join(uploadsDir, folder)`.
 * A caller-supplied `../../` would write outside the uploads directory
 * entirely, and the S3 adapter would take the same string as a key prefix.
 * Only these fixed values are ever accepted — never a path from a request.
 */
export const UPLOAD_FOLDERS = ['banners', 'collections'] as const;

export type UploadFolder = (typeof UPLOAD_FOLDERS)[number];

export function isUploadFolder(value: string): value is UploadFolder {
  return (UPLOAD_FOLDERS as readonly string[]).includes(value);
}
