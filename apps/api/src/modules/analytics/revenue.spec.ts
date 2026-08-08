import { averageOrderValue, computeRevenue } from './revenue';

/**
 * DOM-REPORTING invariants 3 and 4, and the §8 edge cases that decide what
 * each figure means.
 */
describe('revenue', () => {
  describe('computeRevenue', () => {
    it('reports three figures, not one (invariant 4)', () => {
      expect(computeRevenue(100_000, 25_000)).toEqual({
        grossMinorUnits: 100_000,
        refundsMinorUnits: 25_000,
        netMinorUnits: 75_000,
      });
    });

    it('nets to gross when nothing was refunded', () => {
      expect(computeRevenue(100_000, 0).netMinorUnits).toBe(100_000);
    });

    it('nets a fully refunded window to zero without a special case', () => {
      // The point of deducting from returns rather than branching on order
      // status: every item of a fully refunded order appears in refunds.
      expect(computeRevenue(100_000, 100_000).netMinorUnits).toBe(0);
    });

    it('handles a partial refund by arithmetic, not a branch (§8.4)', () => {
      // One of three items refunded: the order still contributes its full
      // total to gross, and that item's refund to refunds.
      expect(computeRevenue(300_000, 100_000).netMinorUnits).toBe(200_000);
    });

    it('does not clamp a negative net', () => {
      // Refunds exceeding gross is a real and alarming state — a window with
      // few orders and large refunds against them. A floor of zero would be
      // the dashboard lying to protect its own appearance.
      expect(computeRevenue(10_000, 30_000).netMinorUnits).toBe(-20_000);
    });

    it('reports zeroes for an empty window rather than anything derived', () => {
      expect(computeRevenue(0, 0)).toEqual({
        grossMinorUnits: 0,
        refundsMinorUnits: 0,
        netMinorUnits: 0,
      });
    });
  });

  describe('averageOrderValue', () => {
    it('is computed on gross — what a customer typically spends', () => {
      expect(averageOrderValue(300_000, 3)).toBe(100_000);
    });

    it('rounds to whole minor units', () => {
      expect(averageOrderValue(100_000, 3)).toBe(33_333);
    });

    it('is zero rather than NaN when there are no orders', () => {
      expect(averageOrderValue(0, 0)).toBe(0);
    });
  });
});
