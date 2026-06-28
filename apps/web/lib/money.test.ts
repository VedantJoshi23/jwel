import { describe, expect, it } from 'vitest';
import { formatMinorUnits } from './money';

describe('formatMinorUnits', () => {
  it('converts minor units (paise) to a whole-rupee currency string', () => {
    expect(formatMinorUnits(259900)).toBe('₹2,599');
  });

  it('rounds to whole rupees (no decimal places shown)', () => {
    expect(formatMinorUnits(250050)).toBe('₹2,501'); // 2500.5 -> Intl rounds to 2501
  });

  it('formats zero correctly', () => {
    expect(formatMinorUnits(0)).toBe('₹0');
  });

  it('supports a different currency code', () => {
    expect(formatMinorUnits(100000, 'USD')).toMatch(/\$|USD/);
  });

  it('uses Indian digit grouping for large amounts', () => {
    expect(formatMinorUnits(1000000000)).toBe('₹1,00,00,000'); // 1 crore, Indian grouping
  });
});
