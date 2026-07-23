// Boot-time environment validation.
//
// Written as a plain function passed to ConfigModule's `validate` hook rather
// than a Joi `validationSchema`, so no new dependency is needed — the checks
// here are simple presence/format assertions, not a schema language.
//
// The point is to convert silent misconfiguration into a loud startup crash.
// The motivating case: CORS_ALLOWED_ORIGINS unset used to yield an empty
// allowlist (main.ts), so the API booted "successfully" and then rejected
// every browser request — presenting as a frontend bug with no server-side
// signal at all.

const PLACEHOLDER_JWT_SECRET = 'local-dev-secret-not-for-production';

// Minimum entropy for a signing key. 32 chars is not a cryptographic
// guarantee, only a guard against someone shipping "secret".
const MIN_JWT_SECRET_LENGTH = 32;

function isValidUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function validateEnv(config: Record<string, unknown>): Record<string, unknown> {
  const errors: string[] = [];
  const get = (key: string): string => String(config[key] ?? '').trim();

  const nodeEnv = get('NODE_ENV') || 'development';
  const isProduction = nodeEnv === 'production';

  if (!get('DATABASE_URL')) {
    errors.push('DATABASE_URL is required.');
  }

  const jwtSecret = get('JWT_SECRET');
  if (!jwtSecret) {
    errors.push('JWT_SECRET is required.');
  } else if (isProduction) {
    if (jwtSecret === PLACEHOLDER_JWT_SECRET) {
      errors.push('JWT_SECRET is still the development placeholder; generate a real secret.');
    }
    if (jwtSecret.length < MIN_JWT_SECRET_LENGTH) {
      errors.push(`JWT_SECRET must be at least ${MIN_JWT_SECRET_LENGTH} characters in production.`);
    }
  }

  // Only enforced in production: local development legitimately runs without
  // these and falls back to the localhost defaults the adapters already carry.
  if (isProduction) {
    const corsOrigins = get('CORS_ALLOWED_ORIGINS')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean);
    if (corsOrigins.length === 0) {
      errors.push(
        'CORS_ALLOWED_ORIGINS is required in production (comma-separated origins); ' +
          'an empty value silently blocks every browser request.',
      );
    } else {
      const malformed = corsOrigins.filter((o) => !isValidUrl(o));
      if (malformed.length > 0) {
        errors.push(`CORS_ALLOWED_ORIGINS contains invalid origins: ${malformed.join(', ')}`);
      }
    }

    // With STORAGE_PROVIDER=filesystem this is baked into every media URL the
    // API hands out. Defaulting it to localhost in production yields product
    // images that are broken for every visitor.
    const publicBaseUrl = get('PUBLIC_BASE_URL');
    if (!publicBaseUrl) {
      errors.push('PUBLIC_BASE_URL is required in production (used to build media URLs).');
    } else if (!isValidUrl(publicBaseUrl)) {
      errors.push(`PUBLIC_BASE_URL must be an absolute http(s) URL, got: ${publicBaseUrl}`);
    } else if (publicBaseUrl.includes('localhost')) {
      errors.push(`PUBLIC_BASE_URL still points at localhost in production: ${publicBaseUrl}`);
    }
  }

  const storageProvider = get('STORAGE_PROVIDER') || 'filesystem';
  if (!['filesystem', 's3'].includes(storageProvider)) {
    errors.push(`STORAGE_PROVIDER must be "filesystem" or "s3", got: ${storageProvider}`);
  }

  if (errors.length > 0) {
    throw new Error(`Invalid environment configuration:\n  - ${errors.join('\n  - ')}`);
  }

  return config;
}
