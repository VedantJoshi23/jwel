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
});
