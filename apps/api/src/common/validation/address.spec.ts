import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ShippingAddressInputDto } from '../../modules/orders/dto/create-order.dto';
import { CreateAddressDto } from '../../modules/users/dto/create-address.dto';
import { CheckServiceabilityDto } from '../../modules/shipping/dto/check-serviceability.dto';

const valid = {
  line1: '12 Test Lane',
  city: 'Ahmedabad',
  state: 'Gujarat',
  pincode: '380001',
};

async function errorsFor(cls: new () => object, payload: Record<string, unknown>) {
  const instance = plainToInstance(cls, payload);
  const errors = await validate(instance);
  return { instance, fields: errors.map((e) => e.property) };
}

/**
 * Both address DTOs are checked together because a saved address is copied
 * into an order at checkout. If they disagree, a customer can save an address
 * that is then refused only when they try to pay — which is what `@Length(4,
 * 10)` on the saved address used to allow.
 */
describe.each([
  ['order shipping address', ShippingAddressInputDto],
  ['saved address', CreateAddressDto],
] as const)('%s', (_name, cls) => {
  it('accepts a complete Indian address', async () => {
    expect((await errorsFor(cls, valid)).fields).toEqual([]);
  });

  it.each(['line1', 'city', 'state'])('refuses an empty %s', async (field) => {
    expect((await errorsFor(cls, { ...valid, [field]: '' })).fields).toContain(field);
  });

  it.each(['line1', 'city', 'state'])('refuses a whitespace-only %s', async (field) => {
    // A bare IsNotEmpty accepts "   " — trimming first is what makes this hold.
    expect((await errorsFor(cls, { ...valid, [field]: '   ' })).fields).toContain(field);
  });

  it('refuses a missing state — the case eleven historical orders slipped through', async () => {
    const { state: _omitted, ...withoutState } = valid;
    expect((await errorsFor(cls, withoutState)).fields).toContain('state');
  });

  it.each([
    ['too short', '38001'],
    ['too long', '3800011'],
    ['leading zero', '080001'],
    ['letters', 'ABCDEF'],
    ['the old 4-character minimum', 'ABCD'],
    ['empty', ''],
  ])('refuses a pincode that is %s', async (_why, pincode) => {
    expect((await errorsFor(cls, { ...valid, pincode })).fields).toContain('pincode');
  });

  it('trims surrounding whitespace rather than storing it in the snapshot', async () => {
    const { instance, fields } = await errorsFor(cls, {
      ...valid,
      line1: '  12 Test Lane  ',
      pincode: ' 380001 ',
    });
    expect(fields).toEqual([]);
    expect(instance).toMatchObject({ line1: '12 Test Lane', pincode: '380001' });
  });

  it('still allows line2 to be omitted, empty, or null', async () => {
    for (const line2 of [undefined, '', null]) {
      expect((await errorsFor(cls, { ...valid, line2 })).fields).toEqual([]);
    }
  });

  it('refuses a pathologically long line rather than storing it', async () => {
    expect((await errorsFor(cls, { ...valid, line1: 'x'.repeat(201) })).fields).toContain('line1');
  });
});

describe('one pincode rule across the API', () => {
  it('the delivery check and an order agree on what a valid pincode is', async () => {
    // These three used to be separate regexes and a length check, and they
    // disagreed. Exercising them together is what keeps them from drifting.
    for (const pincode of ['380001', '080001', 'ABCD', '12345']) {
      const check = (await errorsFor(CheckServiceabilityDto, { pincode })).fields.includes('pincode');
      const order = (await errorsFor(ShippingAddressInputDto, { ...valid, pincode })).fields.includes(
        'pincode',
      );
      const saved = (await errorsFor(CreateAddressDto, { ...valid, pincode })).fields.includes('pincode');
      expect({ pincode, order, saved }).toEqual({ pincode, order: check, saved: check });
    }
  });
});
