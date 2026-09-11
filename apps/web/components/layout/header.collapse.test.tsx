import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SiteHeader } from './header';
import { getCart } from '@/lib/api/cart';

/**
 * The hide/reveal *decision* is covered exhaustively in
 * hooks/use-auto-hide-header.test.ts. This file covers only what that unit
 * test cannot: the two overrides `SiteHeader` layers on top of it — a mobile
 * panel open, and reduced motion — and that the decision actually reaches the
 * DOM through framer-motion's `animate`.
 *
 * framer-motion applies `animate` asynchronously even under its default,
 * near-instant test transition, so every assertion here goes through
 * `waitFor` rather than reading the style synchronously after a fire event.
 */

vi.mock('@/lib/api/cart', () => ({
  getCart: vi.fn(),
  addCartLine: vi.fn(),
  updateCartLine: vi.fn(),
  removeCartLine: vi.fn(),
  clearCart: vi.fn(),
  claimGuestCart: vi.fn(),
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/',
}));

const cart = vi.mocked(getCart);

function stubReducedMotion(matches: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockReturnValue({ matches, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
  );
}

function setScrollY(y: number) {
  Object.defineProperty(window, 'scrollY', { value: y, writable: true, configurable: true });
}

function scrollTo(y: number) {
  act(() => {
    setScrollY(y);
    window.dispatchEvent(new Event('scroll'));
  });
}

function renderHeader() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <SiteHeader />
    </QueryClientProvider>,
  );
}

async function expectTransform(matcher: (transform: string) => void) {
  await waitFor(() => {
    matcher(screen.getByRole('banner').getAttribute('style') ?? '');
  });
}

describe('SiteHeader — collapse wiring', () => {
  beforeEach(() => {
    cart.mockReset();
    cart.mockResolvedValue({ id: 'c1', userId: null, guestToken: 'g', items: [] } as never);
    setScrollY(0);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    setScrollY(0);
  });

  it('collapses on scroll-down once motion preference is known', async () => {
    stubReducedMotion(false);
    renderHeader();
    await waitFor(() => expect(screen.getByLabelText('Shopping bag, 0 items')).toBeInTheDocument());

    scrollTo(200);
    scrollTo(260);

    await expectTransform((t) => expect(t).toContain('-100%'));
  });

  it('never collapses under reduced motion, however far the page scrolls', async () => {
    stubReducedMotion(true);
    renderHeader();
    await waitFor(() => expect(screen.getByLabelText('Shopping bag, 0 items')).toBeInTheDocument());

    scrollTo(200);
    scrollTo(600);

    // Give the async animate path every chance to have applied something,
    // then assert it never did.
    await new Promise((r) => setTimeout(r, 50));
    const style = screen.getByRole('banner').getAttribute('style') ?? '';
    expect(style).not.toContain('-100%');
  });

  it('reopens and stays open while the mobile nav drawer is open', async () => {
    stubReducedMotion(false);
    renderHeader();
    await waitFor(() => expect(screen.getByLabelText('Shopping bag, 0 items')).toBeInTheDocument());
    scrollTo(200);
    scrollTo(260);
    await expectTransform((t) => expect(t).toContain('-100%'));

    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));

    await expectTransform((t) => expect(t).not.toContain('-100%'));

    // The drawer being open must keep it open even if a scroll event fires
    // while it's up — the visitor is reading the menu, not the page.
    scrollTo(320);
    scrollTo(400);
    const style = screen.getByRole('banner').getAttribute('style') ?? '';
    expect(style).not.toContain('-100%');
  });
});
