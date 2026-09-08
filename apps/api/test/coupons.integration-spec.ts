import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './utils/create-test-app';
import { cleanupTestUser, registerAndLogin, registerAndLoginAsAdmin, testPrisma, uniqueEmail } from './utils/auth-helpers';

describe('Coupons (integration)', () => {
  let app: INestApplication;
  const adminEmail = uniqueEmail('coupons-admin');
  const customerEmail = uniqueEmail('coupons-customer');
  let adminToken: string;
  let customerToken: string;
  const code = `SAVE10-${Date.now()}`;

  beforeAll(async () => {
    app = await createTestApp();
    adminToken = (await registerAndLoginAsAdmin(app, adminEmail)).token;
    customerToken = (await registerAndLogin(app, customerEmail)).token;
  });

  afterAll(async () => {
    await testPrisma.coupon.deleteMany({ where: { code } });
    await cleanupTestUser(adminEmail);
    await cleanupTestUser(customerEmail);
    await app.close();
  });

  it('a CUSTOMER cannot create a coupon (RBAC)', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/admin/coupons')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        code,
        discountType: 'PERCENTAGE',
        value: 10,
        validFrom: new Date(Date.now() - 86400000).toISOString(),
        validTo: new Date(Date.now() + 86400000).toISOString(),
      })
      .expect(403);
  });

  it('an ADMIN can create a percentage coupon', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/admin/coupons')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        code,
        discountType: 'PERCENTAGE',
        value: 10,
        validFrom: new Date(Date.now() - 86400000).toISOString(),
        validTo: new Date(Date.now() + 86400000).toISOString(),
      })
      .expect(201);
  });

  it('a logged-in customer can validate the coupon and receives the correct discount', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/coupons/validate')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ code, subtotalMinorUnits: 100000 })
      .expect(200);

    expect(res.body.discountMinorUnits).toBe(10000); // 10% of 100000
    expect(res.body.coupon.code).toBe(code);
  });

  it('rejects an unknown coupon code', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/coupons/validate')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ code: 'DOES-NOT-EXIST', subtotalMinorUnits: 100000 })
      .expect(404);
  });

  it('rejects validation without authentication', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/coupons/validate')
      .send({ code, subtotalMinorUnits: 100000 })
      .expect(401);
  });

  it('deactivating the coupon makes it invalid', async () => {
    const coupon = await testPrisma.coupon.findUnique({ where: { code } });
    await request(app.getHttpServer())
      .patch(`/api/v1/admin/coupons/${coupon!.id}/deactivate`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .post('/api/v1/coupons/validate')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ code, subtotalMinorUnits: 100000 })
      .expect(404);
  });

  describe('archive vs. permanent delete', () => {
    const archiveCode = `ARCHIVE-${Date.now()}`;
    const deleteCode = `DELETE-${Date.now()}`;
    const redeemedCode = `REDEEMED-${Date.now()}`;
    let customerUserId: string;

    async function createCoupon(couponCode: string) {
      const res = await request(app.getHttpServer())
        .post('/api/v1/admin/coupons')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          code: couponCode,
          discountType: 'PERCENTAGE',
          value: 5,
          validFrom: new Date(Date.now() - 86400000).toISOString(),
          validTo: new Date(Date.now() + 86400000).toISOString(),
        })
        .expect(201);
      return res.body.id as string;
    }

    beforeAll(async () => {
      const customer = await testPrisma.user.findUnique({ where: { email: customerEmail } });
      customerUserId = customer!.id;
    });

    afterAll(async () => {
      await testPrisma.couponRedemption.deleteMany({ where: { coupon: { code: redeemedCode } } });
      await testPrisma.order.deleteMany({ where: { coupon: { code: redeemedCode } } });
      await testPrisma.coupon.deleteMany({ where: { code: { in: [archiveCode, deleteCode, redeemedCode] } } });
    });

    it('archiving a never-used coupon hides it from the admin list but keeps the row', async () => {
      const id = await createCoupon(archiveCode);

      await request(app.getHttpServer())
        .patch(`/api/v1/admin/coupons/${id}/archive`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const list = await request(app.getHttpServer())
        .get('/api/v1/admin/coupons')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(list.body.some((c: { id: string }) => c.id === id)).toBe(false);

      // The row itself still exists — this was a soft delete.
      expect(await testPrisma.coupon.findUnique({ where: { id } })).not.toBeNull();
    });

    it('permanently deletes a never-used coupon outright', async () => {
      const id = await createCoupon(deleteCode);

      await request(app.getHttpServer())
        .delete(`/api/v1/admin/coupons/${id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(await testPrisma.coupon.findUnique({ where: { id } })).toBeNull();
    });

    it('refuses to permanently delete a coupon that has been redeemed, against a real database', async () => {
      const id = await createCoupon(redeemedCode);

      // A minimal but real Order + CouponRedemption, to prove the guard
      // against the actual foreign keys — not just a mocked count().
      const order = await testPrisma.order.create({
        data: {
          userId: customerUserId,
          subtotalMinorUnits: 100000,
          totalMinorUnits: 95000,
          discountMinorUnits: 5000,
          couponId: id,
          shippingAddress: { line1: '1 Test St', city: 'Test City', state: 'TS', pincode: '400001', country: 'IN' },
        },
      });
      await testPrisma.couponRedemption.create({
        data: { couponId: id, orderId: order.id, userId: customerUserId },
      });

      const res = await request(app.getHttpServer())
        .delete(`/api/v1/admin/coupons/${id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
      expect(res.body.message).toMatch(/redeemed 1 time\(s\)/);

      // Untouched — refused before anything was removed.
      expect(await testPrisma.coupon.findUnique({ where: { id } })).not.toBeNull();
      expect(await testPrisma.couponRedemption.findMany({ where: { couponId: id } })).toHaveLength(1);

      // Archiving the same coupon still works — this is exactly the case
      // adminArchive exists for.
      await request(app.getHttpServer())
        .patch(`/api/v1/admin/coupons/${id}/archive`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });

    it('a non-admin cannot archive or permanently delete a coupon (ADMIN-only, unlike list/create which also allow STAFF)', async () => {
      const id = await createCoupon(`STAFF-${Date.now()}`);
      await request(app.getHttpServer())
        .patch(`/api/v1/admin/coupons/${id}/archive`)
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(403);
      await request(app.getHttpServer())
        .delete(`/api/v1/admin/coupons/${id}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(403);
      await testPrisma.coupon.deleteMany({ where: { id } });
    });
  });
});
