import { buildDatasourceUrl } from './prisma.service';

describe('buildDatasourceUrl', () => {
  const base = 'postgresql://jwel:pw@localhost:5432/jwel?schema=public';

  it('leaves the URL untouched when neither pool variable is set', () => {
    expect(buildDatasourceUrl(base, {})).toBe(base);
  });

  it('appends connection_limit without disturbing the existing query string', () => {
    const result = buildDatasourceUrl(base, { DATABASE_CONNECTION_LIMIT: '20' })!;

    const url = new URL(result);
    expect(url.searchParams.get('connection_limit')).toBe('20');
    expect(url.searchParams.get('schema')).toBe('public');
    expect(url.pathname).toBe('/jwel');
  });

  it('appends pool_timeout', () => {
    const result = buildDatasourceUrl(base, { DATABASE_POOL_TIMEOUT: '15' })!;

    expect(new URL(result).searchParams.get('pool_timeout')).toBe('15');
  });

  it('does not override a value already present in the URL', () => {
    // The connection string is the more specific statement of intent;
    // silently overriding it would make it a lie.
    const explicit = `${base}&connection_limit=5`;

    const result = buildDatasourceUrl(explicit, { DATABASE_CONNECTION_LIMIT: '99' })!;

    expect(new URL(result).searchParams.get('connection_limit')).toBe('5');
  });

  it('hands back an unparseable URL untouched rather than masking the real error', () => {
    const broken = 'not a url';

    expect(buildDatasourceUrl(broken, { DATABASE_CONNECTION_LIMIT: '20' })).toBe(broken);
  });

  it('passes through an undefined DATABASE_URL', () => {
    expect(buildDatasourceUrl(undefined, { DATABASE_CONNECTION_LIMIT: '20' })).toBeUndefined();
  });
});
