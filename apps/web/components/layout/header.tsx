'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { FormEvent, useEffect, useRef, useState } from 'react';
import { useAnimate, useReducedMotion } from 'framer-motion';
import { Heart, Menu, Search, ShoppingBag, User, X } from 'lucide-react';
import { useCart } from '@/hooks/use-cart';
import { useAuth } from '@/hooks/use-auth';
import { brand } from '@/lib/brand';
import { springs } from '@/lib/motion';
import { SearchSuggestions } from '@/components/common/search-suggestions';
import type { Announcement } from '@/lib/api/types';

/**
 * The cart glyph, reacting to `itemCount` on its own rather than being told
 * to — "Add to bag" exists in three separate places (the PDP, each wishlist
 * row, and the shared-cart adopt flow), and every one of them already changes
 * `itemCount` through the same `useCart` mutation. Watching that value here
 * is one implementation that covers all three, instead of three call sites
 * each remembering to trigger a "something changed" effect.
 *
 * Skips the pop on first mount (a cart restored from a previous session
 * should not animate in) by comparing against the previous render's count
 * rather than firing on every render where `itemCount > 0`.
 *
 * Two implementation notes, both found by watching the actual computed style
 * across sampled animation frames rather than trusting the animation API's
 * resolved promise:
 *
 * - Uses `useAnimate()`, not `useAnimationControls()` — the latter is typed
 *   as `LegacyAnimationControls` in the installed framer-motion (12.x) and
 *   silently no-opped here: `.start()` resolved without ever putting a
 *   transform on the element. `useAnimate()` drives the DOM node directly via
 *   its own ref instead of through a `motion.*` component's `animate` prop.
 * - The pop is two chained single-target springs (up, then back to rest),
 *   not one spring across a `[1, 1.35, 1]` keyframe array. A spring animates
 *   toward *one* target by physics, not through a sequence of keyframes — the
 *   first attempt passed the array anyway, and framer collapsed it straight
 *   to the final keyframe (scale 1) with no motion at all, since spring(1→1)
 *   requires none. Two real springs is also more true to design-update.md's
 *   own rule than a keyframe hack would have been: bounce belongs on the leg
 *   the gesture actually drives (`springs.momentum`, arriving), not on
 *   settling back to rest (`springs.ui`, critically damped).
 */
function CartIcon({ itemCount }: { itemCount: number }) {
  const [scope, animate] = useAnimate();
  const previousCount = useRef(itemCount);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    if (itemCount !== previousCount.current && !prefersReducedMotion) {
      animate(scope.current, { scale: 1.35 }, springs.momentum).then(() => {
        animate(scope.current, { scale: 1 }, springs.ui);
      });
    }
    previousCount.current = itemCount;
  }, [itemCount, animate, scope, prefersReducedMotion]);

  return (
    <span ref={scope} className="relative flex">
      <ShoppingBag className="h-5 w-5" aria-hidden="true" />
      {itemCount > 0 && (
        <span className="absolute -right-2 -top-2 flex h-4 w-4 items-center justify-center rounded-full bg-brand-accent text-[10px] font-semibold text-white">
          {itemCount}
        </span>
      )}
    </span>
  );
}

interface SiteHeaderProps {
  /** Fetched server-side (SiteChrome) and admin-editable — see FEAT-SETTINGS-STORE. */
  announcement?: Announcement | null;
}

export function SiteHeader({ announcement = null }: SiteHeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { itemCount } = useCart();
  const { isAuthenticated } = useAuth();
  const [query, setQuery] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);

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
    <>
      {/*
        Announcement bar — deliberately *outside* `<header>` and therefore not
        part of the sticky unit, so it scrolls away and the nav row takes its
        place at the very top. It used to live inside `<header>` alongside the
        nav row; `position: sticky`'s containing block is the nearest
        block-level ancestor, so with both nested one level down, `<header>`
        was only ~120px tall (the two rows' own height) and the "sticky" nav
        row could never stick past its own container's bottom edge — it
        scrolled away with the rest of the page after a few hundred px. Moving
        the sticky class onto `<header>` itself, with `<body>` as its
        (page-height) containing block, is what makes it actually stay put.
      */}
      {announcement && (
        <div className="overflow-hidden bg-brand-primary px-4 py-2.5 text-center text-sm font-semibold tracking-wide text-white">
          {announcement.text}
        </div>
      )}

      {/*
        `material-chrome` gives the header its glass surface in both themes
        and makes it sticky (ADR-0019) — a glass bar with nothing passing
        underneath it is just a grey bar (design-update.md §12).
      */}
      {/*
        No `bg-canvas` here: Tailwind's utility layer sits *after*
        `@layer components` in the generated stylesheet, so a `bg-canvas`
        utility on this element would silently outrank `.material-chrome`'s
        background and flatten the glass back to opaque white regardless of
        which var it resolves to. `.material-chrome` supplies the background
        for both themes on its own.
      */}
      <header className="material-chrome">
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
        <div className="relative ml-auto hidden md:block md:w-full md:max-w-[170px] lg:max-w-[300px]">
          <form
            role="search"
            onSubmit={handleSearch}
            className="material-raised flex items-center gap-2 rounded-full border border-brand-ink px-4 py-2.5 text-sm text-ink-muted"
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
              onFocus={() => setSuggestionsOpen(true)}
              // Closed on blur, but the suggestion buttons use onMouseDown so
              // a choice still registers before this fires.
              onBlur={() => setSuggestionsOpen(false)}
              role="combobox"
              aria-expanded={suggestionsOpen}
              aria-controls="site-search-suggestions"
              aria-autocomplete="list"
              className="w-full min-w-0 bg-transparent text-ink-primary outline-none placeholder:text-ink-muted"
            />
          </form>
          {suggestionsOpen && (
            <SearchSuggestions
              query={query}
              inputId="site-search"
              onNavigate={() => {
                setSuggestionsOpen(false);
                setQuery('');
              }}
            />
          )}
        </div>

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

        {/*
          Wishlist — shown only when signed in, because there is no guest
          wishlist. An icon that leads to a login wall is worse than no icon:
          it advertises something the visitor cannot use yet.
        */}
        {isAuthenticated && (
          <Link href="/wishlist" className="shrink-0" aria-label="Wishlist">
            <Heart className="h-5 w-5" aria-hidden="true" />
          </Link>
        )}

        {/* Cart */}
        <Link href="/cart" className="relative shrink-0" aria-label={`Shopping bag, ${itemCount} items`}>
          <CartIcon itemCount={itemCount} />
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
    </>
  );
}
