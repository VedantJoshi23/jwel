'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AdminGuard } from '@/components/admin/admin-guard';
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
  { href: '/admin/customers', label: 'Customers' },
  { href: '/admin/coupons', label: 'Coupons' },
  { href: '/admin/cms', label: 'CMS' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <AdminGuard>
      <div className="flex min-h-screen">
        {/* Heavier material than the content beside it: §12's rule that
            darker/heavier surfaces separate structural regions. Inert under
            the classic theme. */}
        {/* No `bg-surface-alt` alongside `material-panel`: the utility layer
            would silently outrank the component-layer glass background (same
            fix as the header — see components/layout/header.tsx). */}
        <aside className="material-panel sticky top-0 h-screen w-56 shrink-0 overflow-y-auto border-r border-border px-4 py-6">
          <Link href="/admin" className="mb-6 block font-display text-xl font-bold">
            Jwel Admin
          </Link>
          <nav className="space-y-1">
            {NAV_ITEMS.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'block rounded-s px-3 py-2 text-sm font-medium',
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
        </aside>
        {/* id here, not on a wrapper: this is now the page's only <main>. It
            used to be nested inside SiteChrome's, which is invalid HTML and
            left the root layout's skip link pointing at the storefront's
            <main> rather than the admin content. */}
        <main id="main-content" className="flex-1 px-8 py-8">
          {children}
        </main>
      </div>
    </AdminGuard>
  );
}
