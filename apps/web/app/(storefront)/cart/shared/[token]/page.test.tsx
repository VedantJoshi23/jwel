import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import SharedCartPage, { metadata } from './page';
import { getSharedCart } from '@/lib/api/cart-share';
import { ApiError } from '@/lib/api/client';

vi.mock('@/lib/api/cart-share', () => ({ getSharedCart: vi.fn() }));
vi.mock('@/components/cart/adopt-shared-cart', () => ({
  AdoptSharedCart: () => <div data-testid="adopt" />,
}));
const notFound = vi.hoisted(() => vi.fn(() => { throw new Error('NEXT_NOT_FOUND'); }));
vi.mock('next/navigation', () => ({ notFound }));

const get = vi.mocked(getSharedCart);

const line = (over = {}) => ({
  variantId: 'v1',
  quantity: 2,
  giftWrap: false,
  giftNote: null,
  productName: 'Gold Ring',
  productSlug: 'gold-ring',
  metal: 'GOLD',
  size: '16',
  unitPriceMinorUnits: 100000,
  available: true,
  ...over,
});

async function renderShared(token = 'tok-abc') {
  const ui = await SharedCartPage({ params: Promise.resolve({ token }) });
  return render(ui);
}

describe('SharedCartPage', () => {
  beforeEach(() => {
    get.mockReset();
    notFound.mockClear();
    get.mockResolvedValue({ items: [line()] } as never);
  });

  it('shows what was shared, with quantity', async () => {
    await renderShared();
    expect(screen.getByRole('link', { name: 'Gold Ring' })).toBeInTheDocument();
    expect(screen.getByText(/Qty 2/)).toBeInTheDocument();
  });

  it('shows the gift note, which is part of what the sender meant', async () => {
    get.mockResolvedValue({
      items: [line({ giftWrap: true, giftNote: 'For Diya' })],
    } as never);
    await renderShared();
    expect(screen.getByText(/Gift wrapped/)).toBeInTheDocument();
    expect(screen.getByText(/For Diya/)).toBeInTheDocument();
  });

  it('shows an unavailable line rather than dropping it', async () => {
    // The recipient should see the sender meant to send it.
    get.mockResolvedValue({ items: [line({ available: false })] } as never);
    await renderShared();
    expect(screen.getByText(/No longer available/)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Gold Ring' })).not.toBeInTheDocument();
    expect(screen.getByText(/current as of now, not when this bag was shared/)).toBeInTheDocument();
  });

  it('names nobody', async () => {
    const { container } = await renderShared();
    expect(container.textContent).not.toMatch(/@/);
  });

  it('is not indexable', () => {
    expect(metadata.robots).toMatchObject({ index: false });
  });

  it('404s on an unknown token', async () => {
    get.mockRejectedValue(new ApiError('This cart link is invalid or has expired', 404));
    await expect(renderShared('nope')).rejects.toThrow('NEXT_NOT_FOUND');
  });

  it('does not swallow a real failure as a 404', async () => {
    get.mockRejectedValue(new ApiError('boom', 500));
    await expect(renderShared()).rejects.toThrow('boom');
    expect(notFound).not.toHaveBeenCalled();
  });

  it('renders the same variant twice when the configuration differs', async () => {
    // Invariant 1 — wrapped and unwrapped are two lines, so a React key on
    // variantId alone would collide.
    get.mockResolvedValue({
      items: [line({ giftWrap: true }), line({ giftWrap: false })],
    } as never);
    await renderShared();
    expect(screen.getAllByRole('link', { name: 'Gold Ring' })).toHaveLength(2);
  });
});
