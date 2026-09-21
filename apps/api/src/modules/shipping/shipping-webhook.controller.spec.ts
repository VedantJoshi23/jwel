import { RawBodyRequest, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { readFileSync } from 'fs';
import { join } from 'path';
import { ShippingWebhookController } from './shipping-webhook.controller';
import { ShipmentTrackingService } from './shipment-tracking.service';

const SECRET = 'e2e-test-webhook-token';
const SAMPLE_RAW = readFileSync(join(__dirname, 'providers', '__fixtures__', 'shiprocket-webhook-sample.json'));
const SAMPLE = JSON.parse(SAMPLE_RAW.toString('utf8')) as unknown;

function request(rawBody: Buffer | undefined = SAMPLE_RAW): RawBodyRequest<Request> {
  return { rawBody } as RawBodyRequest<Request>;
}

describe('ShippingWebhookController', () => {
  let tracking: { applyCarrierUpdate: jest.Mock };

  function controller(secret: string | undefined = SECRET) {
    const config = { get: () => secret } as unknown as ConfigService;
    return new ShippingWebhookController(config, tracking as unknown as ShipmentTrackingService);
  }

  beforeEach(() => {
    tracking = { applyCarrierUpdate: jest.fn().mockResolvedValue('unknown_awb') };
  });

  it("accepts Shiprocket's own sample with the right token and returns 200-shaped ack (Test Webhook path)", async () => {
    await expect(controller().carrier(SECRET, SAMPLE, request())).resolves.toEqual({
      received: true,
      outcome: 'unknown_awb',
    });
    expect(tracking.applyCarrierUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ awbCode: '59629792084', rawStatus: 'Delivered' }),
    );
  });

  it.each([
    ['a wrong token', 'not-the-token'],
    ['a token differing only in length', `${SECRET}x`],
    ['no token', undefined],
  ])('rejects %s with 401 before reading the payload', async (_label, presented) => {
    await expect(controller().carrier(presented, SAMPLE, request())).rejects.toBeInstanceOf(UnauthorizedException);
    expect(tracking.applyCarrierUpdate).not.toHaveBeenCalled();
  });

  it('rejects everything when SHIPROCKET_WEBHOOK_SECRET is unset — never an open endpoint', async () => {
    await expect(controller(undefined).carrier('anything', SAMPLE, request())).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    await expect(controller('').carrier('', SAMPLE, request())).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('acknowledges an authenticated but unparseable payload without applying anything', async () => {
    await expect(controller().carrier(SECRET, { hello: 'world' }, request(undefined))).resolves.toEqual({
      received: true,
    });
    expect(tracking.applyCarrierUpdate).not.toHaveBeenCalled();
  });
});
