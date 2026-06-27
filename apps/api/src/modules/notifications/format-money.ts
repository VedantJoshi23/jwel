export function formatMinorUnitsForEmail(minorUnits: number): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(
    minorUnits / 100,
  );
}
