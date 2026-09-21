import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { readFileSync } from 'fs';
import { join } from 'path';
import request from 'supertest';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ShippingWebhookController } from './shipping-webhook.controller';
import { ShipmentTrackingService } from './shipment-tracking.service';

const SECRET = 'http-test-webhook-token';
const SAMPLE_RAW = readFileSync(join(__dirname, 'providers', '__fixtures__', 'shiprocket-webhook-sample.json'));

/**
 * The webhook through the real HTTP pipeline, not a direct method call: the
 * global JwtAuthGuard (must be bypassed by @Public), main.ts's exact
 * ValidationPipe (must not reject an untyped body under
 * forbidNonWhitelisted), and `rawBody: true` (must reach the controller —
 * the AWB is read from it). Only the database-facing tracking service is
 * mocked; the integration suite needs a `jwel_test` Postgres this doesn't.
 */
describe('POST /api/v1/shipping/webhooks/carrier (HTTP pipeline)', () => {
  let app: INestApplication;
  const tracking = { applyCarrierUpdate: jest.fn() };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ShippingWebhookController],
      providers: [
        { provide: ShipmentTrackingService, useValue: tracking },
        { provide: ConfigService, useValue: { get: (key: string) => (key === 'SHIPROCKET_WEBHOOK_SECRET' ? SECRET : undefined) } },
        // The real global guard, as app.module.ts registers it.
        { provide: APP_GUARD, useClass: JwtAuthGuard },
      ],
    }).compile();

    app = moduleRef.createNestApplication<NestExpressApplication>({ rawBody: true });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    await app.init();
  });

  afterAll(() => app.close());

  beforeEach(() => {
    tracking.applyCarrierUpdate.mockReset().mockResolvedValue('unknown_awb');
  });

  function post() {
    return request(app.getHttpServer())
      .post('/api/v1/shipping/webhooks/carrier')
      .set('Content-Type', 'application/json');
  }

  it("returns 200 for Shiprocket's sample with the right x-api-key — what \"Test Webhook\" needs", async () => {
    const res = await post().set('x-api-key', SECRET).send(SAMPLE_RAW.toString('utf8')).expect(200);

    expect(res.body).toEqual({ received: true, outcome: 'unknown_awb' });
    // Proves rawBody reached the controller: the AWB came through as text.
    expect(tracking.applyCarrierUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ awbCode: '59629792084', rawStatus: 'Delivered' }),
    );
  });

  it('returns 401 for a wrong token, without a JWT being demanded first', async () => {
    await post().set('x-api-key', 'wrong').send(SAMPLE_RAW.toString('utf8')).expect(401);
    expect(tracking.applyCarrierUpdate).not.toHaveBeenCalled();
  });

  it('returns 401 with no token at all', async () => {
    await post().send(SAMPLE_RAW.toString('utf8')).expect(401);
  });

  it('keeps a 17-digit AWB exact end to end', async () => {
    await post()
      .set('x-api-key', SECRET)
      .send('{"awb": 12345678901234567, "current_status": "In Transit", "current_timestamp": "2026-09-21 10:00:00"}')
      .expect(200);
    expect(tracking.applyCarrierUpdate).toHaveBeenCalledWith(expect.objectContaining({ awbCode: '12345678901234567' }));
  });

  it('is not reachable by GET', async () => {
    await request(app.getHttpServer()).get('/api/v1/shipping/webhooks/carrier').expect(404);
  });
});
