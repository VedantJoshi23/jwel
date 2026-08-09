import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ShareCart } from './share-cart';
import { createCartShare } from '@/lib/api/cart-share';
import { ApiError } from '@/lib/api/client';

vi.mock('@/lib/api/cart-share', () => ({ createCartShare: vi.fn() }));
const create = vi.mocked(createCartShare);

/** jsdom exposes `navigator.clipboard` as a getter, so it has to be defined. */
function stubClipboard(writeText: ReturnType<typeof vi.fn>) {
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
}

const lines = [
  { id: 'line-v1', giftWrap: false, giftNote: null, imageUrl: null, variantId: 'v1',
    productSlug: 'ring',
    productName: 'Ring',
    metal: 'GOLD',
    size: null,
    unitPriceMinorUnits: 100000,
    quantity: 2,
  },
];

describe('ShareCart', () => {
  beforeEach(() => {
    create.mockReset();
    create.mockResolvedValue({ token: 'tok-abc' } as never);
    stubClipboard(vi.fn().mockResolvedValue(undefined));
  });

  it('creates the link on demand, not before it is asked for', () => {
    render(<ShareCart lines={lines} />);
    expect(create).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /Share this bag/ })).toBeInTheDocument();
  });

  it('sends variants and quantities, and no prices', async () => {
    // Invariant 11 resolves price at open time, so there is nothing here for a
    // caller to lie about.
    const user = userEvent.setup();
    render(<ShareCart lines={lines} />);

    await user.click(screen.getByRole('button', { name: /Share this bag/ }));

    // Gift options travel too now that the sender's cart can carry them —
    // FEAT-SHAREABLE-CART §10's gap. Still no price: Invariant 11 resolves
    // that when the link is opened, and there is nothing here to lie about.
    await waitFor(() =>
      expect(create).toHaveBeenCalledWith([
        { variantId: 'v1', quantity: 2, giftWrap: false, giftNote: undefined },
      ]),
    );
    expect(JSON.stringify(create.mock.calls[0])).not.toMatch(/price/i);
  });

  it('shows the link and says what it exposes', async () => {
    const user = userEvent.setup();
    render(<ShareCart lines={lines} />);
    await user.click(screen.getByRole('button', { name: /Share this bag/ }));

    expect(await screen.findByText(/cart\/shared\/tok-abc/)).toBeInTheDocument();
    expect(screen.getByText(/does not show them who you are/)).toBeInTheDocument();
    expect(screen.getByText(/cannot change your bag/)).toBeInTheDocument();
  });

  it('still shows the link when the clipboard refuses', async () => {
    // A refused clipboard permission must not read as a failure to create the
    // link — the link exists either way.
    stubClipboard(vi.fn().mockRejectedValue(new Error('denied')));
    const user = userEvent.setup();
    render(<ShareCart lines={lines} />);

    await user.click(screen.getByRole('button', { name: /Share this bag/ }));

    expect(await screen.findByText(/cart\/shared\/tok-abc/)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('reports a refusal from the API', async () => {
    create.mockRejectedValue(new ApiError('One or more of these items no longer exists', 400));
    const user = userEvent.setup();
    render(<ShareCart lines={lines} />);

    await user.click(screen.getByRole('button', { name: /Share this bag/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/no longer exists/);
  });

  it('offers the WhatsApp share once a link exists', async () => {
    const user = userEvent.setup();
    render(<ShareCart lines={lines} />);
    await user.click(screen.getByRole('button', { name: /Share this bag/ }));

    const link = await screen.findByRole('link', { name: /Share on WhatsApp/ });
    expect(link).toHaveAttribute('href', expect.stringContaining('wa.me'));
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });
});
