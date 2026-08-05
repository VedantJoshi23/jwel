'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AdminGuard } from '@/components/admin/admin-guard';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { href: '/admin', label: 'Reports' },
  { href: '/admin/products', label: 'Products' },
  { href: '/admin/categories', label: 'Categories' },
  { href: '/admin/inventory', label: 'Inventory' },
  { href: '/admin/orders', label: 'Orders' },
  { href: '/admin/returns', label: 'Returns' },
  { href: '/admin/customers', label: 'Customers' },
  { href: '/admin/coupons', label: 'Coupons' },
  { href: '/admin/cms', label: 'CMS' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <AdminGuard>
      <div className="flex min-h-screen">
        <aside className="w-56 shrink-0 border-r border-border bg-surface-alt px-4 py-6">
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
                    active ? 'bg-brand-accent/10 text-brand-accent' : 'text-ink-secondary hover:bg-surface',
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
