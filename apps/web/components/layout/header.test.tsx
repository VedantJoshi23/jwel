import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SiteHeader } from './header';
import { useAuthStore } from '@/lib/auth-store';
import { useCartStore } from '@/lib/cart-store';

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  usePathname: () => '/',
}));

describe('SiteHeader', () => {
  beforeEach(() => {
    push.mockClear();
    useAuthStore.getState().logout();
    useCartStore.getState().clear();
  });

  it('navigates to the search page with the entered query on submit', () => {
    render(<SiteHeader />);
    fireEvent.change(screen.getByLabelText('Search products'), { target: { value: 'gold ring' } });
    fireEvent.submit(screen.getByRole('search'));
    expect(push).toHaveBeenCalledWith('/search?q=gold%20ring');
  });

  it('does not navigate when the search query is empty/whitespace', () => {
    render(<SiteHeader />);
    fireEvent.change(screen.getByLabelText('Search products'), { target: { value: '   ' } });
    fireEvent.submit(screen.getByRole('search'));
    expect(push).not.toHaveBeenCalled();
  });

  it('shows no cart item-count badge when the cart is empty', () => {
    render(<SiteHeader />);
    expect(screen.getByLabelText('Shopping bag, 0 items')).toBeInTheDocument();
  });

  it('shows the cart item count from the cart store', () => {
    useCartStore.getState().addLine({
      variantId: 'v1',
      productSlug: 'gold-ring',
      productName: 'Gold Ring',
      metal: 'GOLD',
      size: null,
      unitPriceMinorUnits: 1000,
      quantity: 3,
    });
    render(<SiteHeader />);
    expect(screen.getByLabelText('Shopping bag, 3 items')).toBeInTheDocument();
  });

  it('links the account icon to /login when not authenticated', () => {
    render(<SiteHeader />);
    expect(screen.getByLabelText('Log in')).toHaveAttribute('href', '/login');
  });

  it('links the account icon to /profile when authenticated', () => {
    useAuthStore.getState().setSession('token', { id: 'u1', email: 'a@b.com', name: null, role: 'CUSTOMER' });
    render(<SiteHeader />);
    expect(screen.getByLabelText('My account')).toHaveAttribute('href', '/profile');
  });
});
