'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { Search, ShoppingBag, User } from 'lucide-react';
import { useCart } from '@/hooks/use-cart';
import { useAuth } from '@/hooks/use-auth';
import { brand } from '@/lib/brand';

export function SiteHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const { itemCount } = useCart();
  const { isAuthenticated } = useAuth();
  const [query, setQuery] = useState('');

  function handleSearch(event: FormEvent) {
    event.preventDefault();
    if (query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query.trim())}`);
    }
  }

  return (
    <header>
      {/* Announcement bar */}
      <div className="overflow-hidden bg-brand-primary px-4 py-2.5 text-center text-sm font-semibold tracking-wide text-white">
        {brand.announcement}
      </div>

      {/* Main nav row */}
      <div className="flex items-center gap-10 border-b border-border px-6 py-4 lg:px-8">
        {/* Boxed logo with gold border */}
        <Link
          href="/"
          className="shrink-0 border-[1.5px] border-brand-accent px-4 py-3 font-display text-base font-bold tracking-logo"
        >
          {brand.name}
        </Link>

        {/* Primary nav */}
        <nav aria-label="Primary" className="hidden gap-8 text-base font-medium md:flex">
          {brand.nav.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                href={item.href}
                className={
                  isActive
                    ? 'border-b-2 border-brand-accent pb-0.5'
                    : 'hover:text-ink-secondary'
                }
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Search */}
        <form
          role="search"
          onSubmit={handleSearch}
          className="ml-auto flex w-full max-w-[300px] items-center gap-2 rounded-s border border-brand-primary px-3 py-2.5 text-sm text-ink-muted"
        >
          <Search className="h-4 w-4 shrink-0 text-ink-muted" aria-hidden="true" />
          <label htmlFor="site-search" className="sr-only">
            Search products
          </label>
          <input
            id="site-search"
            type="search"
            placeholder={brand.searchPlaceholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-transparent text-ink-primary outline-none placeholder:text-ink-muted"
          />
        </form>

        {/* Cart */}
        <Link href="/cart" className="relative shrink-0" aria-label={`Shopping bag, ${itemCount} items`}>
          <ShoppingBag className="h-5 w-5" aria-hidden="true" />
          {itemCount > 0 && (
            <span className="absolute -right-2 -top-2 flex h-4 w-4 items-center justify-center rounded-full bg-brand-accent text-[10px] font-semibold text-white">
              {itemCount}
            </span>
          )}
        </Link>

        {/* Account */}
        <Link
          href={isAuthenticated ? '/profile' : '/login'}
          className="shrink-0"
          aria-label={isAuthenticated ? 'My account' : 'Log in'}
        >
          <User className="h-5 w-5" aria-hidden="true" />
        </Link>
      </div>
    </header>
  );
}
