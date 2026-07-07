'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';
import { Menu, Search, ShoppingBag, User, X } from 'lucide-react';
import { useCart } from '@/hooks/use-cart';
import { useAuth } from '@/hooks/use-auth';
import { brand } from '@/lib/brand';

export function SiteHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const { itemCount } = useCart();
  const { isAuthenticated } = useAuth();
  const [query, setQuery] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

  // Close any open mobile panel on navigation, rather than leaving it open
  // over the new page.
  useEffect(() => {
    setMobileMenuOpen(false);
    setMobileSearchOpen(false);
  }, [pathname]);

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
      <div className="flex items-center gap-4 border-b border-border px-4 py-4 md:gap-6 md:px-6 lg:gap-10 lg:px-8">
        {/* Hamburger — mobile/tablet only */}
        <button
          type="button"
          className="shrink-0 md:hidden"
          aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={mobileMenuOpen}
          onClick={() => {
            setMobileMenuOpen((v) => !v);
            setMobileSearchOpen(false);
          }}
        >
          {mobileMenuOpen ? <X className="h-6 w-6" aria-hidden="true" /> : <Menu className="h-6 w-6" aria-hidden="true" />}
        </button>

        {/* Boxed logo with gold border */}
        <Link
          href="/"
          className="shrink-0 border-[1.5px] border-brand-accent px-4 py-3 font-display text-base font-bold tracking-logo"
        >
          {brand.name}
        </Link>

        {/* Primary nav — desktop/tablet */}
        <nav aria-label="Primary" className="hidden gap-6 whitespace-nowrap text-base font-medium md:flex lg:gap-8">
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

        {/* Search — desktop/tablet */}
        <form
          role="search"
          onSubmit={handleSearch}
          className="ml-auto hidden items-center gap-2 rounded-s border border-brand-primary px-3 py-2.5 text-sm text-ink-muted md:flex md:w-full md:max-w-[170px] lg:max-w-[300px]"
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
            className="w-full min-w-0 bg-transparent text-ink-primary outline-none placeholder:text-ink-muted"
          />
        </form>

        {/* Search toggle — mobile only */}
        <button
          type="button"
          className="ml-auto shrink-0 md:hidden"
          aria-label={mobileSearchOpen ? 'Close search' : 'Search'}
          aria-expanded={mobileSearchOpen}
          onClick={() => {
            setMobileSearchOpen((v) => !v);
            setMobileMenuOpen(false);
          }}
        >
          {mobileSearchOpen ? <X className="h-5 w-5" aria-hidden="true" /> : <Search className="h-5 w-5" aria-hidden="true" />}
        </button>

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

      {/* Mobile search row */}
      {mobileSearchOpen && (
        <form
          role="search"
          onSubmit={handleSearch}
          className="flex items-center gap-2 border-b border-border px-4 py-3 md:hidden"
        >
          <Search className="h-4 w-4 shrink-0 text-ink-muted" aria-hidden="true" />
          <label htmlFor="site-search-mobile" className="sr-only">
            Search products
          </label>
          <input
            id="site-search-mobile"
            type="search"
            autoFocus
            placeholder={brand.searchPlaceholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-transparent text-ink-primary outline-none placeholder:text-ink-muted"
          />
        </form>
      )}

      {/* Mobile nav drawer */}
      {mobileMenuOpen && (
        <nav aria-label="Primary mobile" className="border-b border-border px-4 py-4 md:hidden">
          <ul className="flex flex-col gap-4 text-base font-medium">
            {brand.nav.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={isActive ? 'text-brand-accent' : 'hover:text-ink-secondary'}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}
    </header>
  );
}
