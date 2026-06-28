import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './utils/create-test-app';
import { cleanupTestUser, registerAndLogin, registerAndLoginAsAdmin, testPrisma, uniqueEmail } from './utils/auth-helpers';

describe('Products (integration)', () => {
  let app: INestApplication;
  const adminEmail = uniqueEmail('products-admin');
  const customerEmail = uniqueEmail('products-customer');
  let adminToken: string;
  let customerToken: string;
  let categoryId: string;
  let createdProductId: string;
  const slug = `test-product-${Date.now()}`;

  beforeAll(async () => {
    app = await createTestApp();
    adminToken = (await registerAndLoginAsAdmin(app, adminEmail)).token;
    customerToken = (await registerAndLogin(app, customerEmail)).token;

    const category = await testPrisma.category.upsert({
      where: { slug: 'integration-test-category' },
      create: { name: 'Integration Test Category', slug: 'integration-test-category' },
      update: {},
    });
    categoryId = category.id;
  });

  afterAll(async () => {
    if (createdProductId) {
      await testPrisma.product.deleteMany({ where: { id: createdProductId } });
    }
    await cleanupTestUser(adminEmail);
    await cleanupTestUser(customerEmail);
    await app.close();
  });

  it('a CUSTOMER cannot create a product (RBAC)', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/admin/products')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        name: 'Should Fail',
        slug: `should-fail-${Date.now()}`,
        categoryId,
        description: 'x',
        variants: [{ sku: `SF-${Date.now()}`, metal: 'GOLD', weightGrams: 1, basePriceMinorUnits: 1000 }],
      })
      .expect(403);
  });

  it('an unauthenticated request cannot create a product', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/admin/products')
      .send({ name: 'x', slug: 'x', categoryId, description: 'x', variants: [] })
      .expect(401);
  });

  it('an ADMIN can create a product, which starts as DRAFT and is invisible publicly', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/admin/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Integration Test Ring',
        slug,
        categoryId,
        description: 'A ring created by an integration test.',
        variants: [{ sku: `ITR-${Date.now()}`, metal: 'GOLD', weightGrams: 2.5, basePriceMinorUnits: 250000 }],
      })
      .expect(201);

    createdProductId = res.body.id;
    expect(res.body.status).toBe('DRAFT');

    await request(app.getHttpServer()).get(`/api/v1/products/${slug}`).expect(404);
  });

  it('publishing the product makes it visible on the public endpoint', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/admin/products/${createdProductId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'PUBLISHED' })
      .expect(200);

    const res = await request(app.getHttpServer()).get(`/api/v1/products/${slug}`).expect(200);
    expect(res.body.name).toBe('Integration Test Ring');
    expect(res.body.variants).toHaveLength(1);
  });

  it('the admin product list includes the product regardless of status; the public list only shows PUBLISHED', async () => {
    const adminList = await request(app.getHttpServer())
      .get('/api/v1/admin/products?pageSize=100')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(adminList.body.items.some((p: { id: string }) => p.id === createdProductId)).toBe(true);

    const publicList = await request(app.getHttpServer())
      .get(`/api/v1/products?q=${encodeURIComponent('Integration Test Ring')}`)
      .expect(200);
    expect(publicList.body.items.some((p: { id: string }) => p.id === createdProductId)).toBe(true);
  });

  it('archiving removes the product from the public listing again', async () => {
    await request(app.getHttpServer())
      .delete(`/api/v1/admin/products/${createdProductId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    await request(app.getHttpServer()).get(`/api/v1/products/${slug}`).expect(404);
  });

  it('returns 404 for a nonexistent product slug', async () => {
    await request(app.getHttpServer()).get('/api/v1/products/this-does-not-exist-at-all').expect(404);
  });
});
