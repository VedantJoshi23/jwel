'use client';

import { useId, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { adminUploadImage, type UploadFolder } from '@/lib/api/admin-uploads';
import { ApiError } from '@/lib/api/client';

interface ImageUploadFieldProps {
  label: string;
  folder: UploadFolder;
  token: string | null;
  /** The persisted storage ref, or null when nothing is set yet. */
  value: string | null;
  /** Resolved URL for an already-saved image, so editing shows the current one. */
  previewUrl?: string | null;
  onChange: (storageRef: string | null, previewUrl: string | null) => void;
  disabled?: boolean;
}

/**
 * Replaces the raw "Image ref (storage path)" text inputs the banner and
 * collection admin forms used to carry.
 *
 * Those asked an operator to type an opaque value like
 * `local:banners/9f3c…jpg` — a string only a developer who had already
 * uploaded the file another way could know. There was no other way: file
 * upload existed solely on the product-media route. The feature was
 * therefore complete on paper and unusable by the person it was built for.
 *
 * The ref is still what gets persisted; it is just never typed by hand.
 */
export function ImageUploadField({
  label,
  folder,
  token,
  value,
  previewUrl,
  onChange,
  disabled,
}: ImageUploadFieldProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  async function handleFile(file: File | undefined) {
    if (!file || !token) return;
    setUploading(true);
    setError('');
    try {
      const result = await adminUploadImage(token, folder, file);
      onChange(result.storageRef, result.url);
    } catch (err) {
      // The API's own message names the actual problem (unsupported type,
      // over the 8 MB cap) — more use to an operator than "upload failed".
      setError(err instanceof ApiError ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      // Clear the input so re-picking the same file after an error still
      // fires a change event.
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  function handleRemove() {
    onChange(null, null);
    setError('');
  }

  return (
    <div>
      {/* A real <label htmlFor>, not a styled <span>: without the
          association, the only accessible name a screen reader gets for this
          control is "Choose file". */}
      <label htmlFor={inputId} className="mb-1 block text-xs font-medium">
        {label}
      </label>

      {previewUrl && (
        // Deliberately a plain <img>: the source is a just-uploaded file on
        // whatever host the storage adapter resolves to, inside an admin
        // screen behind auth. next/image would demand that host be in
        // next.config's remotePatterns and gains nothing here.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={previewUrl}
          // Not alt="": this preview is the only confirmation the operator
          // gets that the right file landed, so it is content, not decoration.
          alt={`${label} preview`}
          className="mb-2 h-28 w-full rounded-s border border-border object-cover"
        />
      )}

      <input
        id={inputId}
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        disabled={disabled || uploading || !token}
        onChange={(e) => handleFile(e.target.files?.[0])}
        className="block w-full text-sm file:mr-3 file:rounded-s file:border-0 file:bg-brand-primary file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white"
      />

      <div className="mt-1 flex items-center gap-3">
        {uploading && <span className="text-xs text-ink-muted">Uploading…</span>}
        {value && !uploading && (
          <>
            <span className="truncate font-mono text-xs text-ink-muted" title={value}>
              {value}
            </span>
            <Button type="button" variant="ghost" size="s" onClick={handleRemove} disabled={disabled}>
              Remove
            </Button>
          </>
        )}
      </div>

      {error && (
        <p role="alert" className="mt-1 text-xs text-feedback-error">
          {error}
        </p>
      )}
      <p className="mt-1 text-xs text-ink-muted">JPEG, PNG or WebP, up to 8 MB.</p>
    </div>
  );
}
