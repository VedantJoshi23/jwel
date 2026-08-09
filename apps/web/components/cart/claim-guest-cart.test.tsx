import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ClaimGuestCart } from './claim-guest-cart';
import { useAuthStore } from '@/lib/auth-store';
import { claimGuestCart } from '@/lib/api/cart';

vi.mock('@/lib/api/cart', () => ({ claimGuestCart: vi.fn() }));
const claim = vi.mocked(claimGuestCart);

const cart = (count: number) => ({
  id: 'c',
  userId: null,
  guestToken: null,
  items: Array.from({ length: count }, (_, i) => ({ id: `l${i}` })),
});

function renderIt() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <ClaimGuestCart />
    </QueryClientProvider>,
  );
  return userEvent.setup();
}

function signIn() {
  useAuthStore.getState().setSession('token-1', {
    id: 'u1',
    email: 'a@b.c',
    name: null,
    role: 'CUSTOMER',
  });
}

/** DOM-SHOPPING Invariants 6, 12 and 17 — the prompt nothing used to show. */
describe('ClaimGuestCart', () => {
  beforeEach(() => {
    claim.mockReset();
    claim.mockResolvedValue({ outcome: 'adopted', cart: cart(1) } as never);
    window.localStorage.setItem('jwel-guest-cart', 'guest-1');
  });
  afterEach(() => {
    useAuthStore.getState().logout();
    window.localStorage.clear();
  });

  it('does nothing for a visitor who is not signed in', async () => {
    renderIt();
    await waitFor(() => expect(claim).not.toHaveBeenCalled());
  });

  it('does nothing when this browser has no guest bag', async () => {
    window.localStorage.removeItem('jwel-guest-cart');
    signIn();
    renderIt();
    await waitFor(() => expect(claim).not.toHaveBeenCalled());
  });

  it('claims silently and shows no prompt when the account bag was empty', async () => {
    signIn();
    const { container } = render(
      <QueryClientProvider client={new QueryClient()}>
        <ClaimGuestCart />
      </QueryClientProvider>,
    );

    // No strategy on the first call — the API decides whether to adopt or ask.
    await waitFor(() => expect(claim).toHaveBeenCalledWith('token-1', 'guest-1'));
    await waitFor(() => expect(container).toBeEmptyDOMElement());
    // The token now points at a cart that no longer exists.
    expect(window.localStorage.getItem('jwel-guest-cart')).toBeNull();
  });

  describe('when signing in finds two bags (Invariant 12)', () => {
    beforeEach(() => {
      claim.mockResolvedValue({
        outcome: 'conflict',
        cart: cart(2),
        guestCart: cart(1),
      } as never);
    });

    it('asks, and does not decide', async () => {
      signIn();
      renderIt();

      expect(await screen.findByText(/You have two bags/)).toBeInTheDocument();
      // The first call carried no strategy, and nothing was chosen for them.
      expect(claim).toHaveBeenCalledWith('token-1', 'guest-1');
      expect(claim).toHaveBeenCalledTimes(1);
      // The token stays until the choice is made — otherwise the bag becomes
      // unreachable.
      expect(window.localStorage.getItem('jwel-guest-cart')).toBe('guest-1');
    });

    it('says which bag "replace" keeps', async () => {
      // Both bags are this person's, so the label has to say which survives.
      signIn();
      renderIt();
      expect(
        await screen.findByRole('button', { name: /Keep the bag I was just building/ }),
      ).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Keep the bag I was just building/ })).toHaveTextContent(
        /wishlist/,
      );
    });

    it('sends merge when they choose to keep both', async () => {
      signIn();
      const user = renderIt();
      await screen.findByText(/You have two bags/);

      claim.mockResolvedValue({ outcome: 'merged', cart: cart(3) } as never);
      await user.click(screen.getByRole('button', { name: 'Keep both' }));

      await waitFor(() => expect(claim).toHaveBeenCalledWith('token-1', 'guest-1', 'merge'));
      await waitFor(() => expect(screen.queryByText(/You have two bags/)).not.toBeInTheDocument());
      expect(window.localStorage.getItem('jwel-guest-cart')).toBeNull();
    });

    it('sends replace when they choose the newer bag', async () => {
      signIn();
      const user = renderIt();
      await screen.findByText(/You have two bags/);

      claim.mockResolvedValue({ outcome: 'replaced', cart: cart(1) } as never);
      await user.click(screen.getByRole('button', { name: /Keep the bag I was just building/ }));

      await waitFor(() => expect(claim).toHaveBeenCalledWith('token-1', 'guest-1', 'replace'));
    });
  });

  it('stays silent when the claim fails', async () => {
    // Nothing is lost — the guest bag stays where it is and the next sign-in
    // tries again. Alarming someone mid-login helps nobody.
    signIn();
    claim.mockRejectedValue(new Error('offline'));
    const { container } = render(
      <QueryClientProvider client={new QueryClient()}>
        <ClaimGuestCart />
      </QueryClientProvider>,
    );

    await waitFor(() => expect(claim).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
    expect(window.localStorage.getItem('jwel-guest-cart')).toBe('guest-1');
  });
});
