import { describe, expect, it } from 'vitest';
import { addressSchema, pincodeSchema } from './address';

const valid = { line1: '12 Test Lane', city: 'Ahmedabad', state: 'Gujarat', pincode: '380001' };

const failingFields = (payload: Record<string, unknown>) => {
  const result = addressSchema.safeParse(payload);
  return result.success ? [] : result.error.issues.map((i) => String(i.path[0]));
};

describe('pincodeSchema', () => {
  // The same accept/reject examples as the API's
  // src/common/validation/address.spec.ts. The rule is mirrored between the
  // two apps rather than shared (ADR-0025); these cases are what keep the
  // copies honest. If one side changes, the other's test is the one to update.
  it.each(['380001', '400001', '110001'])('accepts %s', (pincode) => {
    expect(pincodeSchema.safeParse(pincode).success).toBe(true);
  });

  it.each([
    ['too short', '38001'],
    ['too long', '3800011'],
    ['leading zero', '080001'],
    ['letters', 'ABCDEF'],
    ['the old API 4-character minimum', 'ABCD'],
    ['empty', ''],
  ])('refuses a pincode that is %s', (_why, pincode) => {
    expect(pincodeSchema.safeParse(pincode).success).toBe(false);
  });

  it('trims before checking, matching the API', () => {
    expect(pincodeSchema.parse(' 380001 ')).toBe('380001');
  });
});

describe('addressSchema', () => {
  it('accepts a complete address', () => {
    expect(failingFields(valid)).toEqual([]);
  });

  it.each(['line1', 'city', 'state'])('requires %s', (field) => {
    expect(failingFields({ ...valid, [field]: '' })).toContain(field);
  });

  it.each(['line1', 'city', 'state'])('treats a whitespace-only %s as empty', (field) => {
    expect(failingFields({ ...valid, [field]: '   ' })).toContain(field);
  });

  it('lets line2 be left out', () => {
    expect(failingFields({ ...valid, line2: '' })).toEqual([]);
    expect(failingFields(valid)).toEqual([]);
  });

  it('gives each missing field a message a customer can act on', () => {
    const result = addressSchema.safeParse({ line1: '', city: '', state: '', pincode: '12' });
    expect(result.success).toBe(false);
    const messages = result.success ? [] : result.error.issues.map((i) => i.message);
    expect(messages).toEqual(
      expect.arrayContaining([
        'Enter your street address.',
        'Enter your city.',
        'Enter your state.',
        'Enter a valid 6-digit pincode.',
      ]),
    );
  });
});
