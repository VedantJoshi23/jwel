import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { toast } from 'sonner';
import ProfilePage from './page';
import { useAuthStore } from '@/lib/auth-store';
import { getOrders } from '@/lib/api/orders';
import { getReturns } from '@/lib/api/returns';
import { listAddresses, addAddress } from '@/lib/api/users';
import { ApiError } from '@/lib/api/client';
import type { CustomerReturn, Order } from '@/lib/api/types';

vi.mock('@/lib/api/orders', () => ({ getOrders: vi.fn() }));
vi.mock('@/lib/api/returns', () => ({ getReturns: vi.fn(), createReturn: vi.fn() }));
vi.mock('@/lib/api/users', () => ({
  getProfile: vi.fn().mockResolvedValue({}),
  listAddresses: vi.fn(),
  addAddress: vi.fn(),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const orders = vi.mocked(getOrders);
const returns = vi.mocked(getReturns);
const addAddressMock = vi.mocked(addAddress);
const toastSuccess = vi.mocked(toast.success);
const toastError = vi.mocked(toast.error);

function makeOrder(over: Partial<Order> = {}): Order {
  return {
    id: 'order-1',
    status: 'DELIVERED',
    subtotalMinorUnits: 250000,
    discountMinorUnits: 0,
    shippingMinorUnits: 0,
    totalMinorUnits: 250000,
    createdAt: '2026-08-01T00:00:00Z',
    items: [
      {
        id: 'oi-1',
        variantId: 'v-1',
        productNameSnapshot: 'Diamond Halo Ring',
        quantity: 1,
        unitPriceMinorUnits: 250000,
      },
    ],
    ...over,
  } as Order;
}

function makeReturn(over: Partial<CustomerReturn> = {}): CustomerReturn {
  return {
    id: 'r-1',
    reason: 'DAMAGED',
    notes: null,
    status: 'REQUESTED',
    refundAmountMinorUnits: null,
    createdAt: '2026-08-02T00:00:00Z',
    orderItem: {
      id: 'oi-1',
      orderId: 'order-1',
      productNameSnapshot: 'Diamond Halo Ring',
      quantity: 1,
      unitPriceMinorUnits: 250000,
    },
    ...over,
  } as CustomerReturn;
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <ProfilePage />
    </QueryClientProvider>,
  );
  // Radix tabs respond to pointer events, not a bare click — `fireEvent.click`
  // leaves the panel unmounted and every assertion below fails for the wrong
  // reason.
  return userEvent.setup();
}

async function openTab(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(screen.getByRole('tab', { name }));
}

describe('ProfilePage — returns', () => {
  beforeEach(() => {
    orders.mockReset();
    returns.mockReset();
    addAddressMock.mockReset();
    toastSuccess.mockClear();
    toastError.mockClear();
    vi.mocked(listAddresses).mockResolvedValue([] as never);
    orders.mockResolvedValue({ items: [makeOrder()], page: 1, pageSize: 10, total: 1 } as never);
    returns.mockResolvedValue([] as never);
    useAuthStore.getState().setSession('token-1', {
      id: 'u1',
      email: 'customer@example.com',
      name: null,
      role: 'CUSTOMER',
    });
  });
  afterEach(() => useAuthStore.getState().logout());

  it('shows a proper button for logging out, not bare text', () => {
    renderPage();
    // A `variant="ghost"` button with no icon and no border reads as plain
    // text until hovered — this asserts the fix, not just that a click
    // handler exists.
    const button = screen.getByRole('button', { name: 'Log out' });
    expect(button.querySelector('svg')).toBeInTheDocument();
  });

  it('offers a return on a delivered order', async () => {
    const user = renderPage();
    await openTab(user, 'Orders');
    expect(await screen.findByRole('button', { name: 'Request a return' })).toBeInTheDocument();
  });

  it('does not offer a return on an order that has not been delivered', async () => {
    // DOM-RETURNS Invariant 1. Offering it here would be a surface promising
    // something the API will refuse.
    orders.mockResolvedValue({
      items: [makeOrder({ status: 'SHIPPED' })],
      page: 1,
      pageSize: 10,
      total: 1,
    } as never);

    const user = renderPage();
    await openTab(user, 'Orders');
    await screen.findByText('order-1');
    expect(screen.queryByRole('button', { name: 'Request a return' })).not.toBeInTheDocument();
  });

  it('shows the existing request instead of offering a second one', async () => {
    // Invariant 2: each order item may have at most one request, ever.
    returns.mockResolvedValue([makeReturn()] as never);

    const user = renderPage();
    await openTab(user, 'Orders');

    expect(await screen.findByText(/Return requested/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Request a return' })).not.toBeInTheDocument();
  });

  describe('the Returns tab', () => {
    it('says where to start one when there are none', async () => {
      const user = renderPage();
      await openTab(user, 'Returns');
      expect(await screen.findByText(/You have no returns/)).toBeInTheDocument();
    });

    it('lists a request with its status and product', async () => {
      returns.mockResolvedValue([makeReturn({ status: 'REFUND_PROCESSING' })] as never);
      const user = renderPage();
      await openTab(user, 'Returns');

      expect(await screen.findByText('REFUND PROCESSING')).toBeInTheDocument();
      expect(screen.getAllByText('Diamond Halo Ring').length).toBeGreaterThan(0);
    });

    it('shows the refunded amount once money has moved', async () => {
      returns.mockResolvedValue([
        makeReturn({ status: 'REFUNDED', refundAmountMinorUnits: 250000 }),
      ] as never);
      const user = renderPage();
      await openTab(user, 'Returns');
      expect(await screen.findByText(/refunded/)).toBeInTheDocument();
    });

    it('points a rejected request out of band, and offers no re-request', async () => {
      // Invariant 6: no re-request path exists, by decision.
      returns.mockResolvedValue([makeReturn({ status: 'REJECTED' })] as never);
      const user = renderPage();
      await openTab(user, 'Returns');

      expect(await screen.findByText(/if you would like us to look at it again/)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /again|re-?request|cancel/i })).not.toBeInTheDocument();
    });
  });

  describe('the Addresses tab', () => {
    async function fillAndSubmit(user: ReturnType<typeof userEvent.setup>) {
      await openTab(user, 'Addresses');
      await user.type(await screen.findByPlaceholderText('Address line 1'), '221B Baker Street');
      await user.type(screen.getByPlaceholderText('City'), 'Mumbai');
      await user.type(screen.getByPlaceholderText('State'), 'Maharashtra');
      await user.type(screen.getByPlaceholderText('Pincode'), '400001');
      await user.click(screen.getByRole('button', { name: 'Save address' }));
    }

    it('confirms a successful save with a toast — previously there was no catch block at all, so a failed save and a successful one looked identical', async () => {
      addAddressMock.mockResolvedValue({} as never);
      const user = renderPage();
      await fillAndSubmit(user);

      await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith('Address saved'));
      expect(toastError).not.toHaveBeenCalled();
    });

    it('surfaces a failed save instead of silently discarding it', async () => {
      addAddressMock.mockRejectedValue(new ApiError('Pincode is invalid', 422));
      const user = renderPage();
      await fillAndSubmit(user);

      await waitFor(() => expect(toastError).toHaveBeenCalledWith('Pincode is invalid'));
      expect(toastSuccess).not.toHaveBeenCalled();
    });

    it('reloads the list so a saved address is actually visible, not just assumed', async () => {
      addAddressMock.mockResolvedValue({} as never);
      vi.mocked(listAddresses)
        .mockResolvedValueOnce([] as never)
        .mockResolvedValue([
          { id: 'a1', line1: '221B Baker Street', city: 'Mumbai', state: 'Maharashtra', pincode: '400001' },
        ] as never);
      const user = renderPage();
      await fillAndSubmit(user);

      expect(await screen.findByText(/221B Baker Street/)).toBeInTheDocument();
    });
  });
});
