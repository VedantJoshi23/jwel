import type { ApiErrorEnvelope } from './types';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly correlationId?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface ApiFetchOptions extends RequestInit {
  token?: string;
  /** Server Components can opt into Next.js's fetch cache; client-side calls should not. */
  revalidate?: number | false;
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let envelope: ApiErrorEnvelope | undefined;
    try {
      envelope = await response.json();
    } catch {
      // Backend's AllExceptionsFilter always returns the JSON envelope — a
      // parse failure here means the API is unreachable, not a 4xx/5xx body.
    }
    const message = Array.isArray(envelope?.message)
      ? envelope.message.join(', ')
      : envelope?.message ?? response.statusText;
    throw new ApiError(message, response.status, envelope?.correlationId);
  }

  if (response.status === 204) {
    return undefined as T;
  }
  return response.json() as Promise<T>;
}

export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const { token, revalidate, headers, ...rest } = options;

  const response = await fetch(`${API_URL}${path}`, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    ...(revalidate !== undefined ? { next: { revalidate } } : {}),
  });

  return handleResponse<T>(response);
}

/**
 * Separate from `apiFetch` rather than a special-cased branch inside it —
 * a multipart upload must NOT set `Content-Type` itself (the browser sets
 * it, including the multipart boundary, only when it sees a `FormData` body
 * untouched by a manual header), which is the opposite of `apiFetch`'s
 * always-JSON default.
 */
export async function apiUpload<T>(path: string, formData: FormData, token?: string): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: formData,
  });
  return handleResponse<T>(response);
}
