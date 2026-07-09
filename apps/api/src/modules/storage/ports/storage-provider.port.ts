// Port per ARCHITECTURE.md §6/§9's "Storage Module (S3 / swappable port)" and
// DATABASE.md's `product_media.storageRef` comment: "opaque reference resolved
// by the Storage port (S3 key today, filesystem path if migrated)". S3 is the
// live/production adapter; Filesystem is the dev/test adapter — unlike
// Payments' Stripe/Razorpay split, the unconfigured adapter here is not a
// stub that throws (see FilesystemStorageProvider): storage isn't safety-
// critical the way money is, and requiring real AWS credentials just to run
// this locally would block development entirely.
export interface UploadFileInput {
  buffer: Buffer;
  mimeType: string;
  originalFilename: string;
  /** Logical grouping, e.g. "products" — becomes a path/key prefix. */
  folder: string;
}

export interface UploadFileResult {
  /** Opaque — callers persist this, never a resolved URL. */
  storageRef: string;
}

export interface StorageProviderPort {
  upload(input: UploadFileInput): Promise<UploadFileResult>;
  delete(storageRef: string): Promise<void>;
  /** Resolves an opaque storageRef this same adapter produced into a URL a browser can load. */
  resolveUrl(storageRef: string): string;
}

export const STORAGE_PROVIDER = 'STORAGE_PROVIDER';
