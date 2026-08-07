import { canonicalise } from './normalise-variant-sizes';

/**
 * FEAT-SIZE-TAXONOMY criterion 8. `canonicalise` is deliberately conservative:
 * it strips only what it can recognise with certainty, and anything else
 * becomes a custom option rather than a guess. Rounding "16.5" to "16" would
 * silently change what the product physically is.
 */
describe('canonicalise', () => {
  it('trims surrounding whitespace', () => {
    expect(canonicalise('  16  ')).toBe('16');
  });

  it.each([
    ['Size 16', '16'],
    ['size 16', '16'],
    ['SIZE 16', '16'],
    ['Size: 16', '16'],
    ['Size- 16', '16'],
  ])('strips a "%s" prefix', (input, expected) => {
    expect(canonicalise(input)).toBe(expected);
  });

  it('strips a trailing parenthetical conversion', () => {
    expect(canonicalise('16 (US 8)')).toBe('16');
  });

  it('handles prefix and parenthetical together', () => {
    expect(canonicalise('Size 16 (US 8)')).toBe('16');
  });

  it('leaves an already-canonical value untouched', () => {
    expect(canonicalise('16')).toBe('16');
  });

  it('does NOT round a half size — it is not the neighbouring size', () => {
    // The rule this whole path exists for. 16.5 stays 16.5 and becomes a
    // custom option; clubbing it with 16 would misrepresent the product.
    expect(canonicalise('16.5')).toBe('16.5');
  });

  it('leaves an unrecognisable value intact for custom preservation', () => {
    expect(canonicalise('Free size')).toBe('Free size');
    expect(canonicalise('adjustable')).toBe('adjustable');
  });

  it('returns an empty string for whitespace only', () => {
    expect(canonicalise('   ')).toBe('');
  });

  it('does not strip a parenthetical that is the whole value', () => {
    // "(16)" trimmed to "" would lose the only information present, so the
    // suffix rule must not fire when nothing precedes it.
    expect(canonicalise('(16)')).toBe('');
  });
});
