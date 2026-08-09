import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SiteHeader } from './header';
import { useAuthStore } from '@/lib/auth-store';
import { getCart } from '@/lib/api/cart';

// The badge counts the server-held bag now.
vi.mock('@/lib/api/cart', () => ({
  getCart: vi.fn(),
  addCartLine: vi.fn(),
  updateCartLine: vi.fn(),
  removeCartLine: vi.fn(),
  clearCart: vi.fn(),
  claimGuestCart: vi.fn(),
}));

const cart = vi.mocked(getCart);

const line = (quantity: number) => ({
  id: 'line-1',
  variantId: 'v1',
  quantity,
  priceSnapshotMinorUnits: 1000,
  giftWrap: false,
  giftNote: null,
  variant: {
    id: 'v1',
    sku: 'S1',
    metal: 'GOLD',
    size: null,
    basePriceMinorUnits: 1000,
    product: { id: 'p1', name: 'Gold Ring', slug: 'gold-ring' },
  },
});

function renderHeader() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <SiteHeader />
    </QueryClientProvider>,
  );
}

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  usePathname: () => '/',
}));

describe('SiteHeader', () => {
  beforeEach(() => {
    push.mockClear();
    useAuthStore.getState().logout();
    cart.mockReset();
    cart.mockResolvedValue({ id: 'c1', userId: null, guestToken: 'g', items: [] } as never);
  });

  it('navigates to the search page with the entered query on submit', () => {
    renderHeader();
    fireEvent.change(screen.getByLabelText('Search products'), { target: { value: 'gold ring' } });
    fireEvent.submit(screen.getByRole('search'));
    expect(push).toHaveBeenCalledWith('/search?q=gold%20ring');
  });

  it('does not navigate when the search query is empty/whitespace', () => {
    renderHeader();
    fireEvent.change(screen.getByLabelText('Search products'), { target: { value: '   ' } });
    fireEvent.submit(screen.getByRole('search'));
    expect(push).not.toHaveBeenCalled();
  });

  it('shows no cart item-count badge when the cart is empty', () => {
    renderHeader();
    expect(screen.getByLabelText('Shopping bag, 0 items')).toBeInTheDocument();
  });

  it('shows the cart item count from the server-held bag', async () => {
    cart.mockResolvedValue({ id: 'c1', userId: null, guestToken: 'g', items: [line(3)] } as never);
    renderHeader();
    await waitFor(() =>
      expect(screen.getByLabelText('Shopping bag, 3 items')).toBeInTheDocument(),
    );
  });

  it('links the account icon to /login when not authenticated', () => {
    renderHeader();
    expect(screen.getByLabelText('Log in')).toHaveAttribute('href', '/login');
  });

  it('links the account icon to /profile when authenticated', () => {
    useAuthStore.getState().setSession('token', { id: 'u1', email: 'a@b.com', name: null, role: 'CUSTOMER' });
    renderHeader();
    expect(screen.getByLabelText('My account')).toHaveAttribute('href', '/profile');
  });
});
