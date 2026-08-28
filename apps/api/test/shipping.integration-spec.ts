import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './utils/create-test-app';
import { cleanupTestUser, registerAndLoginAsAdmin, testPrisma, uniqueEmail } from './utils/auth-helpers';

describe('Shipping — interim pincode deliverability estimate (integration)', () => {
  let app: INestApplication;
  const adminEmail = uniqueEmail('shipping-admin');
  let adminToken: string;
  const createdOverrideIds: string[] = [];

  beforeAll(async () => {
    app = await createTestApp();
    adminToken = (await registerAndLoginAsAdmin(app, adminEmail)).token;
  });

  afterAll(async () => {
    await testPrisma.pincodeServiceabilityOverride.deleteMany({ where: { id: { in: createdOverrideIds } } });
    await cleanupTestUser(adminEmail);
    await app.close();
  });

  async function createOverride(body: Record<string, unknown>, expectStatus = 201) {
    const res = await request(app.getHttpServer())
      .post('/api/v1/admin/shipping/pincode-overrides')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(body)
      .expect(expectStatus);
    if (res.body?.id) createdOverrideIds.push(res.body.id);
    return res;
  }

  describe('public serviceability check', () => {
    it('falls back to the site-wide default window for a pincode with no override (FEAT-DELIVERY-ESTIMATE §7.1)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/shipping/serviceability')
        .query({ pincode: '600001' })
        .expect(200);

      expect(res.body).toMatchObject({ pincode: '600001', deliverable: true, source: 'ESTIMATED' });
      expect(typeof res.body.estimatedMinDays).toBe('number');
      expect(typeof res.body.estimatedMaxDays).toBe('number');
    });

    it('returns deliverable: false with no window for an admin-excluded pincode (§7.2)', async () => {
      await createOverride({ pincode: '855107', deliverable: false, note: 'Remote — no courier coverage' });

      const res = await request(app.getHttpServer())
        .get('/api/v1/shipping/serviceability')
        .query({ pincode: '855107' })
        .expect(200);

      expect(res.body).toEqual({
        pincode: '855107',
        deliverable: false,
        estimatedMinDays: null,
        estimatedMaxDays: null,
        source: 'ESTIMATED',
      });
    });

    it("uses an override's own window instead of the site default (§7.3)", async () => {
      await createOverride({ pincode: '110001', estimatedMinDays: 1, estimatedMaxDays: 2 });

      const res = await request(app.getHttpServer())
        .get('/api/v1/shipping/serviceability')
        .query({ pincode: '110001' })
        .expect(200);

      expect(res.body.estimatedMinDays).toBe(1);
      expect(res.body.estimatedMaxDays).toBe(2);
    });

    it('rejects a malformed pincode with a named 400, not a false "not deliverable" (§7.4)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/shipping/serviceability')
        .query({ pincode: '12345' }) // 5 digits
        .expect(400);
      expect(res.body.message.join(' ')).toMatch(/6-digit/i);
    });

    it('accepts the forward-compatible codRequested param without rejecting the request', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/shipping/serviceability')
        .query({ pincode: '600001', codRequested: 'true' })
        .expect(200);
    });
  });

  describe('admin pincode overrides CRUD', () => {
    it('an unauthenticated request cannot list, create, or delete an override', async () => {
      await request(app.getHttpServer()).get('/api/v1/admin/shipping/pincode-overrides').expect(401);
      await request(app.getHttpServer())
        .post('/api/v1/admin/shipping/pincode-overrides')
        .send({ pincode: '400001' })
        .expect(401);
    });

    it('refuses an estimate window on a non-deliverable pincode — the DB CHECK constraint backing this is exercised for real here', async () => {
      const res = await createOverride({ pincode: '700001', deliverable: false, estimatedMinDays: 3 }, 400);
      expect(res.body.message).toMatch(/cannot carry an estimated delivery window/i);
    });

    it('lists a created override', async () => {
      const created = await createOverride({ pincode: '380001', estimatedMinDays: 2, estimatedMaxDays: 3 });

      const list = await request(app.getHttpServer())
        .get('/api/v1/admin/shipping/pincode-overrides')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(list.body.items.some((o: { id: string }) => o.id === created.body.id)).toBe(true);
    });

    it('updating deliverable to false clears a previously-set window (real round trip through the DB)', async () => {
      const created = await createOverride({ pincode: '560001', estimatedMinDays: 1, estimatedMaxDays: 3 });

      const updated = await request(app.getHttpServer())
        .patch(`/api/v1/admin/shipping/pincode-overrides/${created.body.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ deliverable: false })
        .expect(200);

      expect(updated.body.estimatedMinDays).toBeNull();
      expect(updated.body.estimatedMaxDays).toBeNull();

      const check = await request(app.getHttpServer())
        .get('/api/v1/shipping/serviceability')
        .query({ pincode: '560001' })
        .expect(200);
      expect(check.body.deliverable).toBe(false);
    });

    it('deletes an override, after which the pincode falls back to the site default again', async () => {
      const created = await createOverride({ pincode: '500001', deliverable: false });

      await request(app.getHttpServer())
        .delete(`/api/v1/admin/shipping/pincode-overrides/${created.body.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const check = await request(app.getHttpServer())
        .get('/api/v1/shipping/serviceability')
        .query({ pincode: '500001' })
        .expect(200);
      expect(check.body.deliverable).toBe(true);
    });

    it('404s an update to an override id that does not exist', async () => {
      await request(app.getHttpServer())
        .patch('/api/v1/admin/shipping/pincode-overrides/00000000-0000-4000-8000-000000000000')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ note: 'x' })
        .expect(404);
    });
  });

  describe('tunable defaults via the existing Settings store', () => {
    it("an admin can raise the default window through the generic settings endpoint, and the estimate reflects it without a deploy", async () => {
      await request(app.getHttpServer())
        .patch('/api/v1/admin/settings/shipping.default_min_days')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ value: '10' })
        .expect(200);

      const res = await request(app.getHttpServer())
        .get('/api/v1/shipping/serviceability')
        .query({ pincode: '600002' })
        .expect(200);
      expect(res.body.estimatedMinDays).toBe(10);

      // Reset so this test does not leak state into any other test file that
      // reads the default (integration tests share one real database).
      await request(app.getHttpServer())
        .patch('/api/v1/admin/settings/shipping.default_min_days')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ value: '4' })
        .expect(200);
    });
  });
});
