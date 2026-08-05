import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './utils/create-test-app';
import { cleanupTestUser, registerAndLogin, registerAndLoginAsAdmin, testPrisma, uniqueEmail } from './utils/auth-helpers';

describe('CMS + Analytics (integration)', () => {
  let app: INestApplication;
  const adminEmail = uniqueEmail('cms-admin');
  const customerEmail = uniqueEmail('cms-customer');
  let adminToken: string;
  let customerToken: string;
  let bannerId: string;

  beforeAll(async () => {
    app = await createTestApp();
    adminToken = (await registerAndLoginAsAdmin(app, adminEmail)).token;
    customerToken = (await registerAndLogin(app, customerEmail)).token;
  });

  afterAll(async () => {
    if (bannerId) await testPrisma.banner.deleteMany({ where: { id: bannerId } });
    await cleanupTestUser(adminEmail);
    await cleanupTestUser(customerEmail);
    await app.close();
  });

  describe('CMS banners', () => {
    it('a CUSTOMER cannot create a banner (RBAC)', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/admin/cms/banners')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ title: 'Should fail', imageRef: 'banners/x.jpg' })
        .expect(403);
    });

    it('an ADMIN can create an active banner and it appears on the public endpoint', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/admin/cms/banners')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: 'Integration Test Banner', imageRef: 'banners/integration.jpg' })
        .expect(201);
      bannerId = res.body.id;

      const publicList = await request(app.getHttpServer()).get('/api/v1/cms/banners').expect(200);
      expect(publicList.body.some((b: { id: string }) => b.id === bannerId)).toBe(true);
    });

    it('the public endpoint resolves imageRef into a loadable imageUrl', async () => {
      const publicList = await request(app.getHttpServer()).get('/api/v1/cms/banners').expect(200);
      const banner = publicList.body.find((b: { id: string }) => b.id === bannerId);

      // The storefront cannot build this itself: the ref is opaque and its
      // shape differs between the S3 and filesystem adapters.
      expect(banner.imageUrl).toMatch(/^https?:\/\/.+banners\/integration\.jpg$/);
      expect(banner.imageRef).toBe('banners/integration.jpg');
    });

    // Exercised here rather than in a unit test because only the real
    // ValidationPipe applies the DTO — the same reason the Returns status
    // filter's 400 (M14) was invisible to unit tests.
    it('accepts a root-relative linkUrl (the ordinary "link this at a category" case)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/admin/cms/banners')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: 'Relative link', imageRef: 'banners/rel.jpg', linkUrl: '/collections/rings' })
        .expect(201);

      expect(res.body.linkUrl).toBe('/collections/rings');
      await testPrisma.banner.delete({ where: { id: res.body.id } });
    });

    it.each([
      ['a javascript: URL', 'javascript:alert(1)'],
      ['a data: URL', 'data:text/html,<script>alert(1)</script>'],
      ['a protocol-relative URL posing as a path', '//evil.example/x'],
    ])('rejects %s as a linkUrl', async (_label, linkUrl) => {
      await request(app.getHttpServer())
        .post('/api/v1/admin/cms/banners')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: 'Bad link', imageRef: 'banners/bad.jpg', linkUrl })
        .expect(400);
    });

    it('a banner scheduled to start in the future is not yet publicly visible', async () => {
      const future = await request(app.getHttpServer())
        .post('/api/v1/admin/cms/banners')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Future Banner',
          imageRef: 'banners/future.jpg',
          startsAt: new Date(Date.now() + 7 * 86400000).toISOString(),
        })
        .expect(201);

      const publicList = await request(app.getHttpServer()).get('/api/v1/cms/banners').expect(200);
      expect(publicList.body.some((b: { id: string }) => b.id === future.body.id)).toBe(false);

      await testPrisma.banner.delete({ where: { id: future.body.id } });
    });

    it('deleting a banner removes it from the public list', async () => {
      await request(app.getHttpServer())
        .delete(`/api/v1/admin/cms/banners/${bannerId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const publicList = await request(app.getHttpServer()).get('/api/v1/cms/banners').expect(200);
      expect(publicList.body.some((b: { id: string }) => b.id === bannerId)).toBe(false);
      bannerId = '';
    });
  });

  describe('Analytics dashboard', () => {
    it('a CUSTOMER cannot view the analytics dashboard (RBAC)', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/admin/analytics/dashboard')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(403);
    });

    it('an unauthenticated request cannot view the analytics dashboard', async () => {
      await request(app.getHttpServer()).get('/api/v1/admin/analytics/dashboard').expect(401);
    });

    it('an ADMIN receives a well-shaped dashboard summary', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/admin/analytics/dashboard?windowDays=30')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body).toMatchObject({ windowDays: 30 });
      expect(typeof res.body.revenueMinorUnits).toBe('number');
      expect(typeof res.body.orderCount).toBe('number');
      expect(Array.isArray(res.body.topProducts)).toBe(true);
    });

    it('rejects an out-of-range windowDays', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/admin/analytics/dashboard?windowDays=9999')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });
  });
});
