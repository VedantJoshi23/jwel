import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import SharedWishlistPage, { metadata } from './page';
import { getSharedWishlist } from '@/lib/api/wishlist';
import { ApiError } from '@/lib/api/client';

vi.mock('@/lib/api/wishlist', () => ({ getSharedWishlist: vi.fn() }));
const notFound = vi.hoisted(() => vi.fn(() => { throw new Error('NEXT_NOT_FOUND'); }));
vi.mock('next/navigation', () => ({ notFound }));

const get = vi.mocked(getSharedWishlist);

const item = {
  id: 'i1',
  variantId: 'v1',
  addedAt: '2026-08-01T00:00:00Z',
  variant: {
    id: 'v1',
    sku: 'S1',
    metal: 'GOLD',
    size: '16',
    basePriceMinorUnits: 250000,
    product: { id: 'p1', name: 'Gold Ring', slug: 'gold-ring' },
  },
};

async function renderShared(token = 'tok-123') {
  const ui = await SharedWishlistPage({ params: Promise.resolve({ token }) });
  return render(ui);
}

describe('SharedWishlistPage', () => {
  beforeEach(() => {
    get.mockReset();
    notFound.mockClear();
    get.mockResolvedValue({ items: [item] } as never);
  });

  it('shows the shared pieces', async () => {
    await renderShared();
    expect(screen.getByRole('link', { name: 'Gold Ring' })).toBeInTheDocument();
  });

  /**
   * DOM-SHOPPING Invariant 9 — a shared view is read-only to the recipient and
   * never exposes the owner. The API enforces it by returning `{ items }` and
   * nothing else; this asserts the page does not invent an affordance the
   * invariant forbids.
   */
  it('offers no way to change the list', async () => {
    await renderShared();
    const labels = screen.queryAllByRole('button').map((b) => b.textContent?.toLowerCase() ?? '');
    for (const forbidden of ['remove', 'add to bag', 'save', 'delete', 'edit']) {
      expect(labels.some((l) => l.includes(forbidden))).toBe(false);
    }
  });

  it('names nobody', async () => {
    const { container } = await renderShared();
    // The recipient learns what was shared, not whose it is.
    expect(container.textContent).not.toMatch(/@/);
    expect(container.textContent?.toLowerCase()).not.toContain('wishlist of');
  });

  it('is not indexable — a private link must not become a public page', () => {
    expect(metadata.robots).toMatchObject({ index: false });
  });

  it('404s on an unknown token rather than explaining itself', async () => {
    get.mockRejectedValue(new ApiError('This wishlist link is invalid or has expired', 404));
    await expect(renderShared('nope')).rejects.toThrow('NEXT_NOT_FOUND');
    expect(notFound).toHaveBeenCalled();
  });

  it('does not swallow a real failure as a 404', async () => {
    // A 500 must surface. Treating every error as "not found" would hide an
    // outage behind a friendly page.
    get.mockRejectedValue(new ApiError('boom', 500));
    await expect(renderShared()).rejects.toThrow('boom');
    expect(notFound).not.toHaveBeenCalled();
  });

  it('handles an empty shared wishlist', async () => {
    get.mockResolvedValue({ items: [] } as never);
    await renderShared();
    expect(screen.getByText(/nothing in this wishlist/i)).toBeInTheDocument();
  });
});
