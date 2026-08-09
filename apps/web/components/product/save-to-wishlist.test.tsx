import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SaveToWishlist } from './save-to-wishlist';
import { useAuthStore } from '@/lib/auth-store';
import { addToWishlist, getWishlist, removeFromWishlist } from '@/lib/api/wishlist';

vi.mock('@/lib/api/wishlist', () => ({
  getWishlist: vi.fn(),
  addToWishlist: vi.fn(),
  removeFromWishlist: vi.fn(),
}));

const get = vi.mocked(getWishlist);
const add = vi.mocked(addToWishlist);
const remove = vi.mocked(removeFromWishlist);

function renderIt() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <SaveToWishlist variantId="v1" productName="Gold Ring" />
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

describe('SaveToWishlist', () => {
  beforeEach(() => {
    get.mockReset();
    add.mockReset();
    remove.mockReset();
    get.mockResolvedValue({ id: 'w1', shareToken: 't', items: [] } as never);
    add.mockResolvedValue({} as never);
    remove.mockResolvedValue({} as never);
  });
  afterEach(() => useAuthStore.getState().logout());

  it('sends a logged-out visitor to log in rather than offering a control that would 401', () => {
    // There is no guest wishlist — DOM-SHOPPING Invariant 13 depends on that.
    renderIt();
    expect(screen.getByRole('link', { name: /Log in to save this/ })).toHaveAttribute(
      'href',
      '/login?next=/wishlist',
    );
    expect(get).not.toHaveBeenCalled();
  });

  it('saves the selected variant', async () => {
    signIn();
    const user = renderIt();
    await user.click(await screen.findByRole('button', { name: /Save to wishlist/ }));
    await waitFor(() => expect(add).toHaveBeenCalledWith('token-1', 'v1'));
  });

  it('shows an already-saved variant as saved, and removes it on a second press', async () => {
    signIn();
    get.mockResolvedValue({
      id: 'w1',
      shareToken: 't',
      items: [{ id: 'i1', variantId: 'v1', addedAt: '', variant: {} }],
    } as never);

    const user = renderIt();
    const button = await screen.findByRole('button', { name: /Saved to wishlist/ });
    expect(button).toHaveAttribute('aria-pressed', 'true');

    await user.click(button);
    await waitFor(() => expect(remove).toHaveBeenCalledWith('token-1', 'v1'));
    expect(add).not.toHaveBeenCalled();
  });

  it('says which state it is in with words, not only a filled icon', async () => {
    // STD-ACCESSIBILITY rule 6 — colour and shape must not carry the meaning
    // alone.
    signIn();
    renderIt();
    expect(await screen.findByRole('button', { name: /Save to wishlist/ })).toBeInTheDocument();
  });
});
