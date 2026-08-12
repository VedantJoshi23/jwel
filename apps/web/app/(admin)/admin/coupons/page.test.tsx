import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AdminCouponsPage from './page';
import { useAuthStore } from '@/lib/auth-store';
import { adminCreateCoupon, adminDeactivateCoupon, adminListCoupons } from '@/lib/api/admin-coupons';
import type { Coupon } from '@/lib/api/types';

vi.mock('@/lib/api/admin-coupons', () => ({
  adminListCoupons: vi.fn(),
  adminCreateCoupon: vi.fn(),
  adminDeactivateCoupon: vi.fn(),
}));

const listCoupons = vi.mocked(adminListCoupons);
const createCoupon = vi.mocked(adminCreateCoupon);
const deactivateCoupon = vi.mocked(adminDeactivateCoupon);

function makeCoupon(overrides: Partial<Coupon> = {}): Coupon {
  return {
    id: 'c1',
    code: 'SHINE10',
    discountType: 'FLAT',
    value: 50000,
    minOrderAmountMinorUnits: 100000,
    maxRedemptions: 200,
    maxRedemptionsPerUser: 1,
    validFrom: '2026-08-01T00:00:00Z',
    validTo: '2026-09-01T00:00:00Z',
    isActive: true,
    ...overrides,
  };
}

async function fillRequired(getByLabelText: typeof screen.getByLabelText) {
  fireEvent.change(getByLabelText('Coupon code'), { target: { value: 'shine10' } });
  fireEvent.change(getByLabelText('Valid from'), { target: { value: '2026-08-01' } });
  fireEvent.change(getByLabelText('Valid to'), { target: { value: '2026-09-01' } });
}

describe('AdminCouponsPage', () => {
  beforeEach(() => {
    listCoupons.mockReset();
    createCoupon.mockReset();
    deactivateCoupon.mockReset();
    listCoupons.mockResolvedValue([]);
    useAuthStore.getState().setSession('token-1', {
      id: 'u1',
      email: 'admin@example.com',
      name: null,
      role: 'ADMIN',
    });
  });
  afterEach(() => useAuthStore.getState().logout());

  it('renders a coupon\'s FLAT value as currency, not raw minor units', async () => {
    listCoupons.mockResolvedValue([makeCoupon({ discountType: 'FLAT', value: 50000 })]);
    render(<AdminCouponsPage />);
    expect(await screen.findByText('₹500')).toBeInTheDocument();
  });

  it('renders a PERCENTAGE value with a % suffix', async () => {
    listCoupons.mockResolvedValue([makeCoupon({ discountType: 'PERCENTAGE', value: 15 })]);
    render(<AdminCouponsPage />);
    expect(await screen.findByText('15%')).toBeInTheDocument();
  });

  it('shows the optional limits, or their unlimited/no-minimum fallback', async () => {
    listCoupons.mockResolvedValue([
      makeCoupon({ minOrderAmountMinorUnits: 100000, maxRedemptions: 200, maxRedemptionsPerUser: 2 }),
    ]);
    render(<AdminCouponsPage />);
    expect(await screen.findByText('Min order ₹1,000')).toBeInTheDocument();
    expect(screen.getByText('200 uses total · 2/customer')).toBeInTheDocument();
  });

  it('shows "no minimum" and "unlimited" when the limits were never set', async () => {
    listCoupons.mockResolvedValue([
      makeCoupon({ minOrderAmountMinorUnits: null, maxRedemptions: null, maxRedemptionsPerUser: 1 }),
    ]);
    render(<AdminCouponsPage />);
    expect(await screen.findByText('No minimum order')).toBeInTheDocument();
    expect(screen.getByText('Unlimited total uses · 1/customer')).toBeInTheDocument();
  });

  it('converts a typed rupee FLAT amount to minor units on submit', async () => {
    createCoupon.mockResolvedValue(makeCoupon());
    render(<AdminCouponsPage />);
    await fillRequired(screen.getByLabelText);
    fireEvent.change(screen.getByLabelText('Discount type'), { target: { value: 'FLAT' } });
    fireEvent.change(screen.getByLabelText('Discount amount in rupees'), { target: { value: '250' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create coupon' }));

    await waitFor(() => expect(createCoupon).toHaveBeenCalled());
    expect(createCoupon.mock.calls[0][1]).toMatchObject({ value: 25000 });
  });

  it('sends a PERCENTAGE value as-is, with no unit conversion', async () => {
    createCoupon.mockResolvedValue(makeCoupon());
    render(<AdminCouponsPage />);
    await fillRequired(screen.getByLabelText);
    fireEvent.change(screen.getByLabelText('Discount percentage'), { target: { value: '15' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create coupon' }));

    await waitFor(() => expect(createCoupon).toHaveBeenCalled());
    expect(createCoupon.mock.calls[0][1]).toMatchObject({ value: 15 });
  });

  it('rejects a percentage above 100 without calling the API', async () => {
    render(<AdminCouponsPage />);
    await fillRequired(screen.getByLabelText);
    fireEvent.change(screen.getByLabelText('Discount percentage'), { target: { value: '150' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create coupon' }));

    expect(await screen.findByText(/between 0 and 100/)).toBeInTheDocument();
    expect(createCoupon).not.toHaveBeenCalled();
  });

  it('leaves the optional limits undefined, not zero, when left blank', async () => {
    createCoupon.mockResolvedValue(makeCoupon());
    render(<AdminCouponsPage />);
    await fillRequired(screen.getByLabelText);
    fireEvent.change(screen.getByLabelText('Discount percentage'), { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create coupon' }));

    await waitFor(() => expect(createCoupon).toHaveBeenCalled());
    expect(createCoupon.mock.calls[0][1]).toMatchObject({
      minOrderAmountMinorUnits: undefined,
      maxRedemptions: undefined,
      maxRedemptionsPerUser: undefined,
    });
  });

  it('converts a typed rupee minimum order amount to minor units', async () => {
    createCoupon.mockResolvedValue(makeCoupon());
    render(<AdminCouponsPage />);
    await fillRequired(screen.getByLabelText);
    fireEvent.change(screen.getByLabelText('Discount percentage'), { target: { value: '10' } });
    fireEvent.change(screen.getByLabelText('Min order (₹) — optional'), {
      target: { value: '750' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create coupon' }));

    await waitFor(() => expect(createCoupon).toHaveBeenCalled());
    expect(createCoupon.mock.calls[0][1]).toMatchObject({ minOrderAmountMinorUnits: 75000 });
  });

  it('deactivating a coupon calls the API and reloads the list', async () => {
    listCoupons.mockResolvedValue([makeCoupon()]);
    deactivateCoupon.mockResolvedValue(makeCoupon({ isActive: false }));
    render(<AdminCouponsPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Deactivate' }));
    await waitFor(() => expect(deactivateCoupon).toHaveBeenCalledWith('token-1', 'c1'));
  });

  it('shows an empty state when there are no coupons', async () => {
    render(<AdminCouponsPage />);
    expect(await screen.findByText('No coupons yet.')).toBeInTheDocument();
  });
});
