import { describe, expect, it } from 'vitest';
import { safeRedirectPath } from './safe-redirect';

describe('safeRedirectPath', () => {
  it.each([
    ['/checkout', '/checkout'],
    ['/product/diamond-halo-ring', '/product/diamond-halo-ring'],
    ['/search?q=ring&sort=price', '/search?q=ring&sort=price'],
    ['/profile#orders', '/profile#orders'],
  ])('keeps a same-site path: %s', (next, expected) => {
    expect(safeRedirectPath(next)).toBe(expected);
  });

  it.each([
    ['an absolute URL to another site', 'https://phishing.example/login'],
    ['a protocol-relative URL', '//phishing.example'],
    ['a backslash protocol-relative URL', '/\\phishing.example'],
    ['a tab smuggled between the slashes', '/\t/phishing.example'],
    ['a newline smuggled between the slashes', '/\n/phishing.example'],
    ['a javascript: URL', 'javascript:alert(document.cookie)'],
    ['a data: URL', 'data:text/html,<script>alert(1)</script>'],
    ['a relative path with no leading slash', 'phishing.example'],
    ['an empty value', ''],
  ])('refuses %s', (_why, next) => {
    expect(safeRedirectPath(next)).toBe('/profile');
  });

  it('falls back when there is no next at all', () => {
    expect(safeRedirectPath(null)).toBe('/profile');
    expect(safeRedirectPath(undefined)).toBe('/profile');
  });

  it('does not send someone who just logged in back to the login page', () => {
    expect(safeRedirectPath('/login')).toBe('/profile');
    expect(safeRedirectPath('/login?next=/checkout')).toBe('/profile');
  });

  it('honours a caller-supplied fallback', () => {
    expect(safeRedirectPath('https://phishing.example', '/')).toBe('/');
  });
});
