import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './utils/create-test-app';
import { cleanupTestUser, registerAndLoginAsAdmin, testPrisma, uniqueEmail } from './utils/auth-helpers';

describe('Collections (integration)', () => {
  let app: INestApplication;
  const adminEmail = uniqueEmail('collections-admin');
  let adminToken: string;
  let categoryId: string;
  const createdCollectionIds: string[] = [];

  beforeAll(async () => {
    app = await createTestApp();
    adminToken = (await registerAndLoginAsAdmin(app, adminEmail)).token;

    const category = await testPrisma.category.create({
      data: { name: 'Integration Rings', slug: 'integration-rings' },
    });
    categoryId = category.id;
  });

  afterAll(async () => {
    await testPrisma.collection.deleteMany({ where: { id: { in: createdCollectionIds } } });
    await testPrisma.category.deleteMany({ where: { id: categoryId } });
    await cleanupTestUser(adminEmail);
    await app.close();
  });

  async function createCollection(body: Record<string, unknown>, expectStatus = 201) {
    const res = await request(app.getHttpServer())
      .post('/api/v1/admin/collections')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(body)
      .expect(expectStatus);
    if (res.body?.id) createdCollectionIds.push(res.body.id);
    return res;
  }

  describe('slug collision guard', () => {
    // The rule that makes /collections/[slug] safe to resolve against two
    // models. Exercised against a real database because it is a cross-table
    // uniqueness constraint that no single Prisma @unique expresses.
    it('refuses a collection slug an existing category already uses', async () => {
      const res = await createCollection(
        { name: 'Integration Rings', type: 'SEASONAL' },
        400,
      );
      expect(res.body.message).toMatch(/already uses the slug/i);
    });

    it('refuses a category slug an existing collection already holds (the mirror direction)', async () => {
      await createCollection({ name: 'Guard Edit', slug: 'guard-edit', type: 'EDITORIAL' });

      const res = await request(app.getHttpServer())
        .post('/api/v1/admin/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Guard Edit' })
        .expect(400);

      expect(res.body.message).toMatch(/collection "Guard Edit"/i);
    });

    it.each(['all', 'new-arrivals', 'bestsellers'])(
      'refuses the reserved storefront slug "%s"',
      async (slug) => {
        await createCollection({ name: slug, type: 'SEASONAL' }, 400);
      },
    );
  });

  describe('public feed', () => {
    it('serves a live collection at its slug', async () => {
      const created = await createCollection({ name: 'Live Edit', type: 'EDITORIAL' });

      const res = await request(app.getHttpServer()).get('/api/v1/collections/live-edit').expect(200);
      expect(res.body.id).toBe(created.body.id);
      expect(res.body.products.items).toEqual([]);
      expect(res.body.products.total).toBe(0);
    });

    it('404s a collection whose start date has not arrived', async () => {
      await createCollection({
        name: 'Future Edit',
        type: 'SEASONAL',
        startsAt: new Date(Date.now() + 86_400_000).toISOString(),
      });

      // A 404, not a 200 with no products: knowing the URL must not be enough
      // to preview an unlaunched drop.
      await request(app.getHttpServer()).get('/api/v1/collections/future-edit').expect(404);
    });

    it('404s a slug that is not a collection at all', async () => {
      // The storefront reads this as "fall back to the category page", which
      // is why every category URL producing a 404 here is expected.
      await request(app.getHttpServer()).get('/api/v1/collections/integration-rings').expect(404);
    });

    it('omits a scheduled collection from the public list but keeps it in the admin list', async () => {
      const publicList = await request(app.getHttpServer()).get('/api/v1/collections').expect(200);
      expect(publicList.body.some((c: { slug: string }) => c.slug === 'future-edit')).toBe(false);

      const adminList = await request(app.getHttpServer())
        .get('/api/v1/admin/collections')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(adminList.body.some((c: { slug: string }) => c.slug === 'future-edit')).toBe(true);
    });
  });

  describe('RBAC', () => {
    it('an unauthenticated request cannot create a collection', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/admin/collections')
        .send({ name: 'Nope', type: 'SEASONAL' })
        .expect(401);
    });
  });
});
