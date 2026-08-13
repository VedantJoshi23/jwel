import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import CheckoutPage from './page';
import { useAuthStore } from '@/lib/auth-store';
import { listAddresses } from '@/lib/api/users';
import { createOrder } from '@/lib/api/orders';
import type { Address } from '@/lib/api/types';

vi.mock('@/lib/api/users', () => ({ listAddresses: vi.fn() }));
vi.mock('@/lib/api/orders', () => ({ createOrder: vi.fn(), getOrders: vi.fn() }));
vi.mock('@/lib/api/coupons', () => ({ validateCoupon: vi.fn() }));
vi.mock('@/lib/api/payments', () => ({ verifyPayment: vi.fn() }));

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }) }));

vi.mock('@/hooks/use-cart', () => ({
  useCart: () => ({
    lines: [
      {
        id: 'line-1',
        variantId: 'v-1',
        productSlug: 'diamond-halo-ring',
        productName: 'Diamond Halo Ring',
        unitPriceMinorUnits: 250000,
        quantity: 1,
        imageUrl: null,
      },
    ],
    subtotalMinorUnits: 250000,
    clear: vi.fn(),
  }),
}));

const listAddressesMock = vi.mocked(listAddresses);
const createOrderMock = vi.mocked(createOrder);

function makeAddress(overrides: Partial<Address> = {}): Address {
  return {
    id: 'addr-1',
    label: 'Home',
    line1: '221B Baker Street',
    line2: null,
    city: 'Mumbai',
    state: 'Maharashtra',
    pincode: '400001',
    country: 'IN',
    isDefault: false,
    ...overrides,
  };
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <CheckoutPage />
    </QueryClientProvider>,
  );
  return userEvent.setup();
}

describe('CheckoutPage — saved addresses', () => {
  beforeEach(() => {
    listAddressesMock.mockReset();
    createOrderMock.mockReset();
    mockPush.mockReset();
    listAddressesMock.mockResolvedValue([]);
    useAuthStore.getState().setSession('token-1', {
      id: 'u1',
      email: 'customer@example.com',
      name: null,
      role: 'CUSTOMER',
    });
  });
  afterEach(() => useAuthStore.getState().logout());

  it('shows no address picker and falls back to the manual form when there are no saved addresses', async () => {
    renderPage();
    await waitFor(() => expect(listAddressesMock).toHaveBeenCalled());
    expect(screen.queryByText('Shipping address')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Address')).toBeInTheDocument();
  });

  it('pre-selects the default saved address and hides the manual form', async () => {
    listAddressesMock.mockResolvedValue([
      makeAddress({ id: 'addr-1', line1: 'Non-default address' }),
      makeAddress({ id: 'addr-2', line1: 'Default address', isDefault: true }),
    ]);
    renderPage();

    const defaultOption = await screen.findByRole('radio', { name: /Default address/ });
    expect(defaultOption).toBeChecked();
    expect(screen.queryByLabelText('Address')).not.toBeInTheDocument();
  });

  it('falls back to the first saved address when none is marked default', async () => {
    listAddressesMock.mockResolvedValue([
      makeAddress({ id: 'addr-1', line1: 'First address' }),
      makeAddress({ id: 'addr-2', line1: 'Second address' }),
    ]);
    renderPage();

    expect(await screen.findByRole('radio', { name: /First address/ })).toBeChecked();
  });

  it('reveals the manual form when "Use a new address" is picked', async () => {
    listAddressesMock.mockResolvedValue([makeAddress()]);
    const user = renderPage();

    await user.click(await screen.findByRole('radio', { name: 'Use a new address' }));
    expect(screen.getByLabelText('Address')).toBeInTheDocument();
  });

  it('submits the selected saved address, not a blank one', async () => {
    listAddressesMock.mockResolvedValue([makeAddress({ isDefault: true })]);
    createOrderMock.mockResolvedValue({
      orderId: 'order-1',
      totalMinorUnits: 250000,
      checkout: { simulated: true },
    } as never);

    const user = renderPage();
    await screen.findByRole('radio', { name: /221B Baker Street/ });
    await user.type(screen.getByLabelText('Email Address'), 'customer@example.com');
    await user.type(screen.getByLabelText('Full Name'), 'Jane Doe');
    await user.click(screen.getByRole('button', { name: /Place|Pay|Continue/i }));

    await waitFor(() => expect(createOrderMock).toHaveBeenCalled());
    expect(createOrderMock.mock.calls[0][1]).toMatchObject({
      shippingAddress: expect.objectContaining({
        line1: '221B Baker Street',
        city: 'Mumbai',
        state: 'Maharashtra',
        pincode: '400001',
      }),
    });
  });
});
