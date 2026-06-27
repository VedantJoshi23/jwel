// Backend stores money as integer minor units (paise) — see DATABASE.md §1.
// Every display path must go through this formatter, never a raw division.
export function formatMinorUnits(minorUnits: number, currency: string = 'INR'): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(minorUnits / 100);
}
