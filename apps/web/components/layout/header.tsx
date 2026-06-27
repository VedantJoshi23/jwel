'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { Search, ShoppingBag, User } from 'lucide-react';
import { useCart } from '@/hooks/use-cart';
import { useAuth } from '@/hooks/use-auth';

export function SiteHeader() {
  const router = useRouter();
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
      <div className="bg-brand-primary px-4 py-2.5 text-center text-sm font-semibold text-white">
        Free shipping on orders over &#8377;6,249 — use code SHINE75
      </div>
      <div className="flex items-center gap-10 border-b border-border px-6 py-4 lg:px-8">
        <Link
          href="/"
          className="border border-brand-accent px-3 py-2 font-display text-base font-bold tracking-[0.2em]"
        >
          JWEL
        </Link>

        <nav aria-label="Primary" className="hidden gap-7 text-base font-medium md:flex">
          <Link href="/collections/all">Shop</Link>
          <Link href="/collections/gold">Gold Collections</Link>
          <Link href="/collections/diamond">Diamond Collections</Link>
        </nav>

        <form
          role="search"
          onSubmit={handleSearch}
          className="ml-auto flex w-full max-w-[300px] items-center gap-2 rounded-s border border-brand-primary px-3 py-2.5 text-sm text-ink-muted"
        >
          <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
          <label htmlFor="site-search" className="sr-only">
            Search products
          </label>
          <input
            id="site-search"
            type="search"
            placeholder="Search products"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-transparent text-ink-primary outline-none placeholder:text-ink-muted"
          />
        </form>

        <Link href="/cart" className="relative" aria-label={`Shopping bag, ${itemCount} items`}>
          <ShoppingBag className="h-5 w-5" aria-hidden="true" />
          {itemCount > 0 && (
            <span className="absolute -right-2 -top-2 flex h-4 w-4 items-center justify-center rounded-full bg-brand-accent text-[10px] font-semibold text-white">
              {itemCount}
            </span>
          )}
        </Link>

        <Link
          href={isAuthenticated ? '/profile' : '/login'}
          aria-label={isAuthenticated ? 'My account' : 'Log in'}
        >
          <User className="h-5 w-5" aria-hidden="true" />
        </Link>
      </div>
    </header>
  );
}
