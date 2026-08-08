import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import AdminOrdersPage from './page';
import { useAuthStore } from '@/lib/auth-store';
import { adminListOrders } from '@/lib/api/admin-orders';
import type { AdminOrder } from '@/lib/api/types';

vi.mock('@/lib/api/admin-orders', () => ({
  adminListOrders: vi.fn(),
  adminUpdateOrderStatus: vi.fn(),
}));

const listOrders = vi.mocked(adminListOrders);

function makeOrder(overrides: Partial<AdminOrder> = {}) {
  return {
    id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    status: 'DELIVERED' as const,
    totalMinorUnits: 250000,
    partiallyReturned: false,
    user: { id: 'u1', email: 'customer@example.com', name: 'Asha' },
    items: [],
    ...overrides,
  } as never;
}

describe('AdminOrdersPage', () => {
  beforeEach(() => {
    listOrders.mockReset();
    listOrders.mockResolvedValue({ items: [makeOrder()], page: 1, pageSize: 50, total: 1 } as never);
    useAuthStore.getState().setSession('token-1', {
      id: 'u1',
      email: 'admin@example.com',
      name: null,
      role: 'ADMIN',
    });
  });
  afterEach(() => useAuthStore.getState().logout());

  it('renders an order with its customer and status', async () => {
    render(<AdminOrdersPage />);
    expect(await screen.findByText('Asha')).toBeInTheDocument();
    expect(screen.getByText('DELIVERED')).toBeInTheDocument();
  });

  /**
   * DOM-RETURNS invariant 9. A partially refunded order stays DELIVERED in the
   * data model on purpose, so this row is the only place the difference can
   * show — without it an admin cannot tell the two apart without opening the
   * order.
   */
  describe('partial-return differentiator', () => {
    it('marks a partially returned order', async () => {
      listOrders.mockResolvedValue({
        items: [makeOrder({ partiallyReturned: true })],
        page: 1,
        pageSize: 50,
        total: 1,
      } as never);

      render(<AdminOrdersPage />);

      expect(await screen.findByText('Partially returned')).toBeInTheDocument();
      // Still DELIVERED — the status itself does not change.
      expect(screen.getByText('DELIVERED')).toBeInTheDocument();
    });

    it('highlights the status rather than replacing it', async () => {
      listOrders.mockResolvedValue({
        items: [makeOrder({ partiallyReturned: true })],
        page: 1,
        pageSize: 50,
        total: 1,
      } as never);

      render(<AdminOrdersPage />);

      const badge = await screen.findByText('DELIVERED');
      expect(badge.className).toContain('warning');
      expect(badge).toHaveAttribute('title', expect.stringContaining('refunded'));
    });

    it('leaves an ordinary delivered order unmarked', async () => {
      render(<AdminOrdersPage />);
      await screen.findByText('Asha');

      expect(screen.queryByText('Partially returned')).not.toBeInTheDocument();
      expect(screen.getByText('DELIVERED').className).toContain('success');
    });
  });
});
