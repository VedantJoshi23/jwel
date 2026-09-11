'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LogOut, Menu, X } from 'lucide-react';
import { AdminGuard } from '@/components/admin/admin-guard';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { href: '/admin', label: 'Reports' },
  { href: '/admin/products', label: 'Products' },
  { href: '/admin/categories', label: 'Categories' },
  { href: '/admin/collections', label: 'Collections' },
  { href: '/admin/inventory', label: 'Inventory' },
  { href: '/admin/orders', label: 'Orders' },
  { href: '/admin/returns', label: 'Returns' },
  { href: '/admin/reviews', label: 'Reviews' },
  { href: '/admin/qna', label: 'Q&A' },
  { href: '/admin/customers', label: 'Customers' },
  { href: '/admin/coupons', label: 'Coupons' },
  { href: '/admin/cms', label: 'CMS' },
  { href: '/admin/settings', label: 'Settings' },
  { href: '/admin/shipping', label: 'Delivery Estimate' },
];

function NavLinks({ pathname }: { pathname: string }) {
  return (
    <nav aria-label="Admin" className="space-y-1">
      {NAV_ITEMS.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'block rounded-sm px-3 py-2 text-sm font-medium',
              // The active item used to be gold text on a gold tint —
              // #C8922A on #F8ECDA, which measures 2.36:1 against the
              // 4.5:1 AA needs. Exactly the failure NFR-5 predicted for
              // "the luxury dark/gold palette", found by
              // e2e/accessibility.spec.ts on its first admin run.
              //
              // The gold identity moves to the tint and the left rule;
              // the label takes ink-primary (16.3:1). Contrast is not
              // the only signal either — the rule and the weight carry
              // it too (STD-ACCESSIBILITY rule 6).
              active
                ? 'border-l-2 border-brand-accent bg-brand-accent/10 font-semibold text-ink-primary'
                : 'text-ink-secondary hover:bg-surface',
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function LogoutButton({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="secondary" size="s" className="w-full" onClick={onClick}>
      <LogOut className="h-4 w-4" aria-hidden="true" />
      Log out
    </Button>
  );
}

/**
 * Below `lg` the sidebar used to stay a fixed 224px column, and the content
 * beside it — a flex item with the default `min-width: auto` — refused to
 * shrink below its widest table. On a 390px phone the page measured 1041px
 * wide: the sidebar took 57% of the screen, the orders table showed as a
 * sliver, and every table's own `overflow-x-auto` was useless because its
 * parent never got narrow enough to need it. Same mechanism as the storefront
 * overflow fixed in 6f2fe7d.
 *
 * Now: a top bar with a menu below `lg`, the unchanged sidebar from `lg` up,
 * and `min-w-0` on the content so wide tables scroll inside their own card.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const current = NAV_ITEMS.find((item) => item.href === pathname)?.label;

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [menuOpen]);

  return (
    <AdminGuard>
      <div className="flex min-h-screen flex-col lg:flex-row">
        {/* Phone and tablet: a slim bar instead of a column that would eat
            most of the screen. The menu renders its links only while open, so
            the page never carries two copies of the nav. */}
        <div className="material-panel sticky top-0 z-40 border-b border-border lg:hidden">
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <Link href="/admin" className="font-display text-lg font-bold">
              Jwel Admin
            </Link>
            <div className="flex min-w-0 items-center gap-2">
              {current ? <span className="truncate text-sm text-ink-secondary">{current}</span> : null}
              <button
                type="button"
                onClick={() => setMenuOpen((open) => !open)}
                aria-expanded={menuOpen}
                aria-controls="admin-mobile-menu"
                aria-label={menuOpen ? 'Close admin menu' : 'Open admin menu'}
                className="-mr-1 rounded-sm p-2 text-ink-primary hover:bg-surface"
              >
                {menuOpen ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
              </button>
            </div>
          </div>
          {menuOpen ? (
            <div id="admin-mobile-menu" className="max-h-[calc(100vh-4rem)] overflow-y-auto border-t border-border px-4 py-4">
              <NavLinks pathname={pathname} />
              <div className="mt-4">
                <LogoutButton onClick={logout} />
              </div>
            </div>
          ) : null}
        </div>

        {/* Heavier material than the content beside it: §12's rule that
            darker/heavier surfaces separate structural regions. Inert under
            the classic theme. */}
        {/* No `bg-surface-alt` alongside `material-panel`: the utility layer
            would silently outrank the component-layer glass background (same
            fix as the header — see components/layout/header.tsx). */}
        <aside className="material-panel sticky top-0 hidden h-screen w-56 shrink-0 flex-col overflow-y-auto border-r border-border px-4 py-6 lg:flex">
          <Link href="/admin" className="mb-6 block font-display text-xl font-bold">
            Jwel Admin
          </Link>
          <NavLinks pathname={pathname} />
          {/* `mt-auto` pins this to the sidebar's bottom regardless of how
              short the nav list is — there was previously no way to leave
              the admin section at all short of clearing localStorage by
              hand, found investigating a report of a stuck "unauthorized"
              admin session with no visible way back to /login. */}
          <div className="mt-auto pt-4">
            <LogoutButton onClick={logout} />
          </div>
        </aside>
        {/* id here, not on a wrapper: this is now the page's only <main>. It
            used to be nested inside SiteChrome's, which is invalid HTML and
            left the root layout's skip link pointing at the storefront's
            <main> rather than the admin content. */}
        <main id="main-content" className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </AdminGuard>
  );
}
