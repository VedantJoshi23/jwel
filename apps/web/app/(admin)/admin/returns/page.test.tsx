import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AdminReturnsPage from './page';
import { useAuthStore } from '@/lib/auth-store';
import { adminListReturns, adminUpdateReturnStatus } from '@/lib/api/admin-returns';
import type { AdminReturn } from '@/lib/api/types';

vi.mock('@/lib/api/admin-returns', () => ({
  adminListReturns: vi.fn(),
  adminUpdateReturnStatus: vi.fn(),
}));

const listReturns = vi.mocked(adminListReturns);
const updateStatus = vi.mocked(adminUpdateReturnStatus);

function makeReturn(overrides: Partial<AdminReturn> = {}) {
  return {
    id: 'r1',
    reason: 'OTHER' as const,
    notes: null,
    status: 'REQUESTED' as const,
    refundAmountMinorUnits: null,
    createdAt: '2026-07-28T00:00:00Z',
    orderItem: {
      id: 'oi1',
      orderId: 'o1',
      productNameSnapshot: 'Diamond Halo Ring',
      quantity: 1,
      unitPriceMinorUnits: 250000,
      order: { user: { email: 'customer@example.com' } },
    },
    ...overrides,
  } as never;
}

describe('AdminReturnsPage', () => {
  beforeEach(() => {
    listReturns.mockReset();
    updateStatus.mockReset();
    listReturns.mockResolvedValue([makeReturn()]);
    useAuthStore.getState().setSession('token-1', {
      id: 'u1',
      email: 'admin@example.com',
      name: null,
      role: 'ADMIN',
    });
  });
  afterEach(() => useAuthStore.getState().logout());

  it('renders a return request with its product, customer, and status', async () => {
    render(<AdminReturnsPage />);
    expect(await screen.findByText('Diamond Halo Ring')).toBeInTheDocument();
    expect(screen.getByText('customer@example.com')).toBeInTheDocument();
    // "REQUESTED" also appears as a filter <option> — scope to the badge.
    expect(screen.getByRole('cell', { name: 'REQUESTED' })).toBeInTheDocument();
  });

  it('loads unfiltered by default', async () => {
    render(<AdminReturnsPage />);
    await screen.findByText('Diamond Halo Ring');
    expect(listReturns).toHaveBeenCalledWith('token-1', undefined);
  });

  it('only offers transitions ReturnsService actually allows for the current status', async () => {
    render(<AdminReturnsPage />);
    await screen.findByText('Diamond Halo Ring');
    // REQUESTED -> APPROVED | REJECTED, per apps/api's ALLOWED_TRANSITIONS —
    // REFUND_PROCESSING or REFUNDED must not appear this early.
    expect(screen.getByRole('button', { name: 'APPROVED' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'REJECTED' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'REFUNDED' })).not.toBeInTheDocument();
  });

  it('clicking a plain transition calls the API with no refund amount and reloads', async () => {
    updateStatus.mockResolvedValue(makeReturn({ status: 'APPROVED' } as never));
    render(<AdminReturnsPage />);
    await screen.findByText('Diamond Halo Ring');

    fireEvent.click(screen.getByRole('button', { name: 'APPROVED' }));

    await waitFor(() => {
      expect(updateStatus).toHaveBeenCalledWith('token-1', 'r1', 'APPROVED', undefined);
    });
    expect(listReturns).toHaveBeenCalledTimes(2); // initial load + reload after the transition
  });

  // The highest-risk row in this page: REFUND_PROCESSING -> REFUNDED is what
  // triggers PaymentsService.refundForOrder's real Razorpay call, so the
  // amount actually sent must be exactly what the admin typed, converted
  // correctly from rupees to paise.
  describe('the REFUNDED transition', () => {
    beforeEach(() => {
      listReturns.mockResolvedValue([makeReturn({ status: 'REFUND_PROCESSING' } as never)]);
    });

    it('pre-fills the refund amount from the item price, in rupees', async () => {
      render(<AdminReturnsPage />);
      const input = await screen.findByPlaceholderText('₹ amount');
      expect(input).toHaveValue(2500); // 250000 paise -> ₹2,500
    });

    // The actual bug this guards: the pre-filled value is only ever backed by
    // component state once `onChange` fires. An admin who trusts the visible
    // pre-fill and clicks straight through — never touching the field — must
    // still submit that pre-filled amount, not silently fail validation
    // because the state behind it was never written. Caught in a real
    // browser, where no keystroke happens before the click; every other test
    // here calls fireEvent.change first, which papered over exactly this.
    it('submits the pre-filled amount as-is when the admin never edits it', async () => {
      updateStatus.mockResolvedValue(makeReturn({ status: 'REFUNDED' } as never));
      render(<AdminReturnsPage />);
      await screen.findByPlaceholderText('₹ amount');

      fireEvent.click(screen.getByRole('button', { name: /Refund via Razorpay/i }));

      await waitFor(() => {
        expect(updateStatus).toHaveBeenCalledWith('token-1', 'r1', 'REFUNDED', 250000);
      });
    });

    it('converts the typed rupee amount to paise on submit', async () => {
      updateStatus.mockResolvedValue(makeReturn({ status: 'REFUNDED' } as never));
      render(<AdminReturnsPage />);
      const input = await screen.findByPlaceholderText('₹ amount');

      fireEvent.change(input, { target: { value: '1200.50' } });
      fireEvent.click(screen.getByRole('button', { name: /Refund via Razorpay/i }));

      await waitFor(() => {
        expect(updateStatus).toHaveBeenCalledWith('token-1', 'r1', 'REFUNDED', 120050);
      });
    });

    it('refuses to submit an invalid refund amount without calling the API', async () => {
      render(<AdminReturnsPage />);
      const input = await screen.findByPlaceholderText('₹ amount');

      fireEvent.change(input, { target: { value: 'not-a-number' } });
      fireEvent.click(screen.getByRole('button', { name: /Refund via Razorpay/i }));

      await screen.findByText(/valid refund amount/i);
      expect(updateStatus).not.toHaveBeenCalled();
    });

    it('refuses a negative refund amount', async () => {
      render(<AdminReturnsPage />);
      const input = await screen.findByPlaceholderText('₹ amount');

      fireEvent.change(input, { target: { value: '-50' } });
      fireEvent.click(screen.getByRole('button', { name: /Refund via Razorpay/i }));

      await screen.findByText(/valid refund amount/i);
      expect(updateStatus).not.toHaveBeenCalled();
    });
  });

  it('shows the refunded amount once a return reaches REFUNDED', async () => {
    listReturns.mockResolvedValue([
      makeReturn({ status: 'REFUNDED', refundAmountMinorUnits: 250000 } as never),
    ]);
    render(<AdminReturnsPage />);
    expect(await screen.findByText(/₹2,500 refunded/)).toBeInTheDocument();
    expect(screen.getByText('final state')).toBeInTheDocument();
  });

  it('shows an empty state scoped to the active filter', async () => {
    listReturns.mockResolvedValue([]);
    render(<AdminReturnsPage />);
    expect(await screen.findByText('No return requests.')).toBeInTheDocument();
  });

  it('surfaces an API error rather than failing silently', async () => {
    updateStatus.mockRejectedValue(new Error('network down'));
    render(<AdminReturnsPage />);
    await screen.findByText('Diamond Halo Ring');

    fireEvent.click(screen.getByRole('button', { name: 'REJECTED' }));

    expect(await screen.findByText('Failed to update return status')).toBeInTheDocument();
  });
});
