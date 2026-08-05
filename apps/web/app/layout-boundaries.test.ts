import { readFileSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Guards the route-group split between the storefront and the admin portal.
//
// This is a structural test rather than a rendering one because the bug it
// exists for was structural and invisible to every rendering test we had: the
// root layout wrapped *everything* in SiteChrome, so `(admin)` — a route
// group, which does not escape the root layout — rendered the shop's category
// nav, cart icon, newsletter footer and demo banner around the admin sidebar,
// plus a second nested <main>. It shipped that way for months. Component tests
// mount pages in isolation and never see their layout ancestry, and the admin
// E2E specs cannot log in (no seeded admin account), so nothing caught it.

const APP_DIR = __dirname;

function read(path: string): string {
  return readFileSync(join(APP_DIR, path), 'utf8');
}

// Matches the import, not the bare identifier — these files discuss SiteChrome
// in their own explanatory comments, and matching the word alone fails on them.
const IMPORTS_SITE_CHROME = /^import\s*\{[^}]*\bSiteChrome\b[^}]*\}\s*from/m;

describe('app router layout boundaries', () => {
  it('keeps storefront chrome out of the root layout', () => {
    // The tempting "fix" for the original bug is a
    // usePathname().startsWith('/admin') branch inside SiteChrome. That forces
    // the header and footer client-side for every shopper and flashes the
    // storefront chrome on admin pages before hydration removes it. If this
    // assertion fails, move the chrome down a layout instead of branching.
    expect(read('layout.tsx')).not.toMatch(IMPORTS_SITE_CHROME);
  });

  it('renders storefront chrome from the storefront group layout', () => {
    expect(read('(storefront)/layout.tsx')).toMatch(IMPORTS_SITE_CHROME);
  });

  it('gives the admin layout its own #main-content, not a nested one', () => {
    const adminLayout = read('(admin)/admin/layout.tsx');
    expect(adminLayout).toMatch(/<main[^>]*id="main-content"/);
    expect(adminLayout).not.toMatch(IMPORTS_SITE_CHROME);
  });

  it('places every storefront route inside the storefront group', async () => {
    // Route groups are erased from URLs, so a page dropped at app/<route>/
    // instead of app/(storefront)/<route>/ serves on the same path while
    // silently losing its header and footer — the failure this catches.
    const entries = await readdir(APP_DIR, { withFileTypes: true });
    const strays = entries
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith('('))
      .map((entry) => entry.name);

    expect(strays).toEqual([]);
  });
});
