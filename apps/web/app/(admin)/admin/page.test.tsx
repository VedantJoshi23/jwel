import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import AdminDashboardPage from './page';
import { useAuthStore } from '@/lib/auth-store';
import { getDashboardSummary } from '@/lib/api/admin-analytics';
import type { DashboardSummary } from '@/lib/api/types';

vi.mock('@/lib/api/admin-analytics', () => ({ getDashboardSummary: vi.fn() }));

const getSummary = vi.mocked(getDashboardSummary);

function makeSummary(overrides: Partial<DashboardSummary> = {}) {
  return {
    windowDays: 30,
    grossMinorUnits: 1_000_00,
    refundsMinorUnits: 0,
    netMinorUnits: 1_000_00,
    orderCount: 4,
    averageOrderValueMinorUnits: 250_00,
    ordersByStatus: { DELIVERED: 4 },
    topProducts: [],
    lowStockCount: 0,
    pendingReviewsCount: 0,
    newCustomers: 1,
    ...overrides,
  } as never;
}

describe('AdminDashboardPage', () => {
  beforeEach(() => {
    getSummary.mockReset();
    getSummary.mockResolvedValue(makeSummary());
    useAuthStore.getState().setSession('token-1', {
      id: 'u1',
      email: 'admin@example.com',
      name: null,
      role: 'ADMIN',
    });
  });
  afterEach(() => useAuthStore.getState().logout());

  /**
   * DOM-REPORTING invariant 4. This page showed one figure labelled "Revenue"
   * that was actually gross, so a month in which half the goods came back read
   * exactly like a month in which none did.
   */
  describe('the three revenue figures', () => {
    it('shows gross, refunds and net separately', async () => {
      getSummary.mockResolvedValue(
        makeSummary({ grossMinorUnits: 1_000_00, refundsMinorUnits: 250_00, netMinorUnits: 750_00 }),
      );

      render(<AdminDashboardPage />);

      expect(await screen.findByText('Gross sales')).toBeInTheDocument();
      expect(screen.getByText('Refunds')).toBeInTheDocument();
      expect(screen.getByText('Net of refunds')).toBeInTheDocument();
    });

    it('does not label anything simply "Revenue"', async () => {
      // The label is load-bearing: if refunds exclude shipping, a fully
      // refunded order nets to the shipping cost rather than zero, which reads
      // as a rounding error unless the label says what the number is.
      render(<AdminDashboardPage />);
      await screen.findByText('Gross sales');

      expect(screen.queryByText('Revenue')).not.toBeInTheDocument();
    });
  });

  describe('top products', () => {
    it('shows what a product actually contributed, and flags returns against it', async () => {
      getSummary.mockResolvedValue(
        makeSummary({
          topProducts: [
            {
              productId: 'p1',
              name: 'Dazzle Band',
              unitsSold: 3,
              grossMinorUnits: 900_00,
              refundsMinorUnits: 300_00,
              netMinorUnits: 600_00,
            },
          ],
        }),
      );

      render(<AdminDashboardPage />);

      expect(await screen.findByText('Dazzle Band')).toBeInTheDocument();
      expect(screen.getByText(/returned/)).toBeInTheDocument();
    });

    it('says nothing about returns for a product with none', async () => {
      getSummary.mockResolvedValue(
        makeSummary({
          topProducts: [
            {
              productId: 'p1',
              name: 'Dazzle Band',
              unitsSold: 3,
              grossMinorUnits: 900_00,
              refundsMinorUnits: 0,
              netMinorUnits: 900_00,
            },
          ],
        }),
      );

      render(<AdminDashboardPage />);
      await screen.findByText('Dazzle Band');

      expect(screen.queryByText(/returned/)).not.toBeInTheDocument();
    });
  });
});
