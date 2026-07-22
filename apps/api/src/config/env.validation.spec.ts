import { validateEnv } from './env.validation';

const PROD_BASE = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgresql://u:p@db:5432/jwel',
  JWT_SECRET: 'a'.repeat(48),
  CORS_ALLOWED_ORIGINS: 'https://shop.example.com',
  PUBLIC_BASE_URL: 'https://api.example.com',
};

describe('validateEnv', () => {
  describe('development', () => {
    it('accepts a minimal config and does not require production-only vars', () => {
      expect(() =>
        validateEnv({ DATABASE_URL: 'postgresql://localhost/jwel', JWT_SECRET: 'short-dev-secret' }),
      ).not.toThrow();
    });

    it('tolerates the dev placeholder secret outside production', () => {
      expect(() =>
        validateEnv({
          DATABASE_URL: 'postgresql://localhost/jwel',
          JWT_SECRET: 'local-dev-secret-not-for-production',
        }),
      ).not.toThrow();
    });

    it('returns the config unchanged so ConfigModule keeps every value', () => {
      const config = { DATABASE_URL: 'postgresql://localhost/jwel', JWT_SECRET: 's', EXTRA: 'kept' };

      expect(validateEnv(config)).toBe(config);
    });
  });

  describe('always enforced', () => {
    it('requires DATABASE_URL', () => {
      expect(() => validateEnv({ JWT_SECRET: 's' })).toThrow(/DATABASE_URL is required/);
    });

    it('requires JWT_SECRET', () => {
      expect(() => validateEnv({ DATABASE_URL: 'postgresql://localhost/jwel' })).toThrow(
        /JWT_SECRET is required/,
      );
    });

    it('rejects an unknown STORAGE_PROVIDER', () => {
      expect(() =>
        validateEnv({ DATABASE_URL: 'x', JWT_SECRET: 's', STORAGE_PROVIDER: 'gcs' }),
      ).toThrow(/STORAGE_PROVIDER must be "filesystem" or "s3"/);
    });

    it('reports every problem at once rather than one per restart', () => {
      expect(() => validateEnv({})).toThrow(/DATABASE_URL[\s\S]*JWT_SECRET/);
    });
  });

  describe('production', () => {
    it('accepts a fully configured production env', () => {
      expect(() => validateEnv({ ...PROD_BASE })).not.toThrow();
    });

    it('rejects the dev placeholder secret', () => {
      expect(() =>
        validateEnv({ ...PROD_BASE, JWT_SECRET: 'local-dev-secret-not-for-production' }),
      ).toThrow(/still the development placeholder/);
    });

    it('rejects a short JWT_SECRET', () => {
      expect(() => validateEnv({ ...PROD_BASE, JWT_SECRET: 'too-short' })).toThrow(
        /at least 32 characters/,
      );
    });

    // The motivating bug: this used to boot fine and block every browser call.
    it('rejects an empty CORS allowlist', () => {
      expect(() => validateEnv({ ...PROD_BASE, CORS_ALLOWED_ORIGINS: '' })).toThrow(
        /CORS_ALLOWED_ORIGINS is required in production/,
      );
    });

    it('rejects malformed CORS origins', () => {
      expect(() =>
        validateEnv({ ...PROD_BASE, CORS_ALLOWED_ORIGINS: 'https://ok.example.com,not-a-url' }),
      ).toThrow(/invalid origins: not-a-url/);
    });

    it('accepts a comma-separated allowlist with surrounding whitespace', () => {
      expect(() =>
        validateEnv({
          ...PROD_BASE,
          CORS_ALLOWED_ORIGINS: 'https://a.example.com , https://b.example.com',
        }),
      ).not.toThrow();
    });

    it('requires PUBLIC_BASE_URL', () => {
      expect(() => validateEnv({ ...PROD_BASE, PUBLIC_BASE_URL: '' })).toThrow(
        /PUBLIC_BASE_URL is required in production/,
      );
    });

    // Would otherwise bake localhost into every product image URL.
    it('rejects a localhost PUBLIC_BASE_URL', () => {
      expect(() => validateEnv({ ...PROD_BASE, PUBLIC_BASE_URL: 'http://localhost:4000' })).toThrow(
        /still points at localhost/,
      );
    });

    it('rejects a non-absolute PUBLIC_BASE_URL', () => {
      expect(() => validateEnv({ ...PROD_BASE, PUBLIC_BASE_URL: '/api' })).toThrow(
        /must be an absolute http\(s\) URL/,
      );
    });

    it('rejects a non-http protocol', () => {
      expect(() => validateEnv({ ...PROD_BASE, PUBLIC_BASE_URL: 'ftp://files.example.com' })).toThrow(
        /must be an absolute http\(s\) URL/,
      );
    });
  });
});
