import { readFileSync } from 'fs';
import { join } from 'path';
import { ShipmentStatus } from '@prisma/client';
import { extractAwb, mapShiprocketStatus, parseIstTimestamp, parseShiprocketWebhook } from './shiprocket-webhook';

// Byte-exact copy of the sample downloaded from the client's Shiprocket
// Webhooks page (2026-09-21). Read raw, because the AWB is read from raw text.
const SAMPLE_RAW = readFileSync(join(__dirname, '__fixtures__', 'shiprocket-webhook-sample.json'));
const SAMPLE = JSON.parse(SAMPLE_RAW.toString('utf8')) as Record<string, unknown>;

describe('parseShiprocketWebhook — against the real sample payload', () => {
  it('extracts AWB, status, IST time and ETD, and discards placeholder text', () => {
    expect(parseShiprocketWebhook(SAMPLE, SAMPLE_RAW)).toEqual({
      awbCode: '59629792084',
      rawStatus: 'Delivered',
      // 16:41:59 IST is 11:11:59 UTC — not 16:41:59 UTC.
      occurredAt: new Date('2021-07-02T11:11:59.000Z'),
      // The sample literally says "enter courier_name"; that is not a courier.
      courierName: null,
      estimatedDelivery: new Date('2021-07-02T11:11:59.000Z'),
    });
  });

  it('falls back to the newest scan when current_timestamp is unusable', () => {
    const body = { ...SAMPLE, current_timestamp: 'garbage' };
    expect(parseShiprocketWebhook(body)?.occurredAt).toEqual(new Date('2019-06-25T06:38:00.000Z'));
  });

  it('falls back to shipment_status when current_status is missing', () => {
    const body = { ...SAMPLE, current_status: undefined, shipment_status: 'In Transit' };
    expect(parseShiprocketWebhook(body)?.rawStatus).toBe('In Transit');
  });

  it.each([
    ['no AWB', { ...SAMPLE, awb: undefined }],
    ['no status', { ...SAMPLE, current_status: undefined, shipment_status: undefined }],
    ['no usable time anywhere', { ...SAMPLE, current_timestamp: undefined, scans: [] }],
    ['not an object', 'hello'],
    ['null', null],
  ])('returns null for a payload with %s', (_label, body) => {
    expect(parseShiprocketWebhook(body)).toBeNull();
  });
});

describe('extractAwb', () => {
  it('reads a 17-digit AWB exactly from raw text, where JSON.parse would round it', () => {
    const raw = Buffer.from('{"awb": 12345678901234567, "current_status": "Delivered"}');
    const parsed = JSON.parse(raw.toString('utf8')) as { awb: number };
    expect(String(parsed.awb)).not.toBe('12345678901234567'); // the hazard itself
    expect(extractAwb(raw, parsed)).toBe('12345678901234567');
  });

  it('accepts a quoted AWB', () => {
    expect(extractAwb(Buffer.from('{"awb":"SR123ABC"}'), {})).toBe('SR123ABC');
  });

  it('without a raw body, accepts a string or a safe-integer number and refuses an unsafe one', () => {
    expect(extractAwb(undefined, { awb: ' 777 ' })).toBe('777');
    expect(extractAwb(undefined, { awb: 59629792084 })).toBe('59629792084');
    expect(extractAwb(undefined, { awb: 2 ** 60 })).toBeNull();
    expect(extractAwb(undefined, {})).toBeNull();
  });
});

describe('parseIstTimestamp', () => {
  it.each([
    ['2021-07-02 16:41:59', '2021-07-02T11:11:59.000Z'],
    ['23 05 2023 11:43:52', '2023-05-23T06:13:52.000Z'],
    ['2021-07-02 16:41', '2021-07-02T11:11:00.000Z'],
  ])('parses %s as IST', (input, utc) => {
    expect(parseIstTimestamp(input)).toEqual(new Date(utc));
  });

  it.each([['not a date'], [''], [42], [undefined], ['2021-13-45 99:99:99']])('rejects %p', (input) => {
    expect(parseIstTimestamp(input)).toBeNull();
  });
});

describe('mapShiprocketStatus', () => {
  it.each([
    ['Delivered', ShipmentStatus.DELIVERED],
    ['DELIVERED', ShipmentStatus.DELIVERED],
    ['Undelivered', ShipmentStatus.NDR],
    ['NDR', ShipmentStatus.NDR],
    ['OUT FOR DELIVERY', ShipmentStatus.OUT_FOR_DELIVERY],
    ['Picked Up', ShipmentStatus.PICKED_UP],
    ['SHIPPED', ShipmentStatus.PICKED_UP],
    ['IN TRANSIT', ShipmentStatus.IN_TRANSIT],
    ['Reached At Destination Hub', ShipmentStatus.IN_TRANSIT],
    ['RTO Initiated', ShipmentStatus.RTO_INITIATED],
    ['RTO IN TRANSIT', ShipmentStatus.RTO_INITIATED],
    ['RTO_OFD', ShipmentStatus.RTO_INITIATED],
    // RTO checks must win over plain "delivered"/"undelivered".
    ['RTO Delivered', ShipmentStatus.RTO_DELIVERED],
    ['RTO_NDR', ShipmentStatus.RTO_INITIATED],
    ['RTO Undelivered', ShipmentStatus.RTO_INITIATED],
    ['Canceled', ShipmentStatus.CANCELLED],
    ['Cancelled', ShipmentStatus.CANCELLED],
  ])('%s → %s', (raw, expected) => {
    expect(mapShiprocketStatus(raw)).toBe(expected);
  });

  it.each([['Pickup Scheduled'], ['Out For Pickup'], ['AWB Assigned'], ['Cancellation Requested']])(
    'treats pre-pickup "%s" as recognised but moving nothing',
    (raw) => {
      expect(mapShiprocketStatus(raw)).toBeNull();
    },
  );

  it.each([['Lost'], ['Damaged'], ['Something New']])('returns undefined for unrecognised "%s"', (raw) => {
    expect(mapShiprocketStatus(raw)).toBeUndefined();
  });
});
