import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RequestReturnForm } from './request-return-form';
import { createReturn } from '@/lib/api/returns';
import { ApiError } from '@/lib/api/client';
import type { OrderItem } from '@/lib/api/types';

vi.mock('@/lib/api/returns', () => ({ createReturn: vi.fn() }));

const create = vi.mocked(createReturn);

const item: OrderItem = {
  id: 'oi-1',
  variantId: 'v-1',
  productNameSnapshot: 'Diamond Halo Ring',
  quantity: 1,
  unitPriceMinorUnits: 250000,
};

describe('RequestReturnForm', () => {
  beforeEach(() => {
    create.mockReset();
    create.mockResolvedValue({} as never);
  });
  afterEach(() => vi.clearAllMocks());

  function open() {
    const onRequested = vi.fn();
    render(<RequestReturnForm token="t" item={item} onRequested={onRequested} />);
    fireEvent.click(screen.getByRole('button', { name: 'Request a return' }));
    return onRequested;
  }

  it('starts collapsed, so a delivered order is not a wall of forms', () => {
    render(<RequestReturnForm token="t" item={item} onRequested={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Request a return' })).toBeInTheDocument();
    expect(screen.queryByLabelText(/Why are you returning/)).not.toBeInTheDocument();
  });

  it('submits the item, the reason and the notes', async () => {
    const onRequested = open();
    fireEvent.change(screen.getByLabelText(/Why are you returning/), {
      target: { value: 'DAMAGED' },
    });
    fireEvent.change(screen.getByLabelText(/Anything else/), {
      target: { value: 'Clasp was bent' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Request return' }));

    await waitFor(() =>
      expect(create).toHaveBeenCalledWith('t', {
        orderItemId: 'oi-1',
        reason: 'DAMAGED',
        notes: 'Clasp was bent',
      }),
    );
    await waitFor(() => expect(onRequested).toHaveBeenCalled());
  });

  it('omits empty notes rather than sending an empty string', async () => {
    open();
    fireEvent.click(screen.getByRole('button', { name: 'Request return' }));
    await waitFor(() =>
      expect(create).toHaveBeenCalledWith('t', {
        orderItemId: 'oi-1',
        reason: 'SIZE_ISSUE',
        notes: undefined,
      }),
    );
  });

  it("shows the API's own refusal, not a generic message", async () => {
    // The API is the only thing that knows *why* — most often that the return
    // window has closed, and it names the date.
    create.mockRejectedValue(
      new ApiError('The 10-day return window for this order closed on 2026-08-01.', 400),
    );
    const onRequested = open();
    fireEvent.click(screen.getByRole('button', { name: 'Request return' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/closed on 2026-08-01/);
    expect(onRequested).not.toHaveBeenCalled();
  });

  it('keeps the form open after a refusal, so the shopper can read it', async () => {
    create.mockRejectedValue(new ApiError('Nope', 400));
    open();
    fireEvent.click(screen.getByRole('button', { name: 'Request return' }));
    await screen.findByRole('alert');
    expect(screen.getByLabelText(/Why are you returning/)).toBeInTheDocument();
  });

  /**
   * DOM-RETURNS Invariant 6 — a customer may not cancel a pending request, and
   * may not re-request after a rejection. The domain spec calls a cancel button
   * "the natural thing for a frontend developer to add", which is what this
   * test exists to catch.
   */
  it('offers no way to cancel a request', () => {
    open();
    const labels = screen
      .getAllByRole('button')
      .map((b) => b.textContent?.toLowerCase() ?? '');
    expect(labels.some((l) => l.includes('cancel'))).toBe(false);
    expect(labels.some((l) => l.includes('withdraw'))).toBe(false);
    // "Not now" closes the form before anything is submitted — it is not a
    // cancellation, and there is nothing yet to cancel.
    expect(labels).toContain('not now');
  });
});
