import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './utils/create-test-app';
import {
  cleanupTestUser,
  registerAndLogin,
  registerAndLoginAsAdmin,
  testPrisma,
  uniqueEmail,
} from './utils/auth-helpers';

/**
 * Integration rather than unit, deliberately.
 *
 * `listLowStock` is `$queryRaw`, which bypasses Prisma's `@map` translation —
 * so the bug this guards against (raw snake_case column names reaching the
 * client, crashing the admin Inventory page on `item.variantId.slice()`) is
 * invisible to a mocked-Prisma test. Only a real query against a real database
 * proves the aliases in the SQL actually work.
 */
describe('Inventory (integration)', () => {
  let app: INestApplication;
  const adminEmail = uniqueEmail('inventory-admin');
  const customerEmail = uniqueEmail('inventory-customer');
  let adminToken: string;
  let customerToken: string;
  let categoryId: string;
  let productId: string;
  let variantId: string;

  beforeAll(async () => {
    app = await createTestApp();
    adminToken = (await registerAndLoginAsAdmin(app, adminEmail)).token;
    customerToken = (await registerAndLogin(app, customerEmail)).token;

    const category = await testPrisma.category.upsert({
      where: { slug: 'inventory-test-category' },
      create: { name: 'Inventory Test Category', slug: 'inventory-test-category' },
      update: {},
    });
    categoryId = category.id;

    const product = await testPrisma.product.create({
      data: {
        name: 'Inventory Test Piece',
        slug: `inventory-test-${Date.now()}`,
        categoryId,
        description: 'Fixture for the low-stock endpoint.',
        status: 'PUBLISHED',
      },
    });
    productId = product.id;

    const variant = await testPrisma.productVariant.create({
      data: {
        productId,
        sku: `INV-TEST-${Date.now()}`,
        metal: 'GOLD',
        purity: '18K',
        weightGrams: 1,
        basePriceMinorUnits: 100000,
      },
    });
    variantId = variant.id;

    // On hand 1, threshold 5 → comfortably inside the low-stock predicate.
    await testPrisma.inventory.create({
      data: { variantId, quantityOnHand: 1, quantityReserved: 0, lowStockThreshold: 5 },
    });
  });

  afterAll(async () => {
    await testPrisma.inventory.deleteMany({ where: { variantId } });
    await testPrisma.productVariant.deleteMany({ where: { id: variantId } });
    await testPrisma.product.deleteMany({ where: { id: productId } });
    await cleanupTestUser(adminEmail);
    await cleanupTestUser(customerEmail);
    await app.close();
  });

  it('a CUSTOMER cannot read the low-stock list (RBAC)', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/admin/inventory/low-stock')
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(403);
  });

  // The regression guard. Before the fix this returned variant_id /
  // quantity_on_hand / … and the admin page died on `item.variantId.slice()`.
  it('returns camelCase fields, not the raw snake_case columns', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/admin/inventory/low-stock')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const row = (res.body as Array<Record<string, unknown>>).find((r) => r.variantId === variantId);

    expect(row).toBeDefined();
    expect(row).toEqual({
      variantId,
      quantityOnHand: 1,
      quantityReserved: 0,
      lowStockThreshold: 5,
    });
    // Explicit: the physical column names must not leak through.
    expect(Object.keys(row!)).not.toContain('variant_id');
    expect(Object.keys(row!)).not.toContain('quantity_on_hand');
  });

  it('adjusting stock is reflected in the low-stock list', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/admin/inventory/${variantId}/adjust`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ delta: 2 })
      .expect(200);

    const res = await request(app.getHttpServer())
      .get('/api/v1/admin/inventory/low-stock')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const row = (res.body as Array<Record<string, unknown>>).find((r) => r.variantId === variantId);
    expect(row?.quantityOnHand).toBe(3);
  });

  describe('GET /admin/inventory — the general list', () => {
    // Regression: the admin Inventory page only ever showed low-stock rows,
    // so once an item was restocked past its threshold there was no way
    // left to find it and add more — this endpoint is the fix.
    it('a CUSTOMER cannot read it (RBAC)', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/admin/inventory')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(403);
    });

    it('finds a variant that is well above its low-stock threshold — the actual bug', async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/admin/inventory/${variantId}/adjust`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ delta: 50 })
        .expect(200);

      // Confirms it has actually left the low-stock list...
      const lowStock = await request(app.getHttpServer())
        .get('/api/v1/admin/inventory/low-stock')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect((lowStock.body as Array<{ variantId: string }>).some((r) => r.variantId === variantId)).toBe(false);

      // ...and confirms it is still reachable here, with the product context
      // that lets the admin actually find it in the first place.
      const all = await request(app.getHttpServer())
        .get('/api/v1/admin/inventory?pageSize=100')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      const row = all.body.items.find((r: { variantId: string }) => r.variantId === variantId);
      expect(row).toMatchObject({ productName: 'Inventory Test Piece', quantityOnHand: 53 });
    });

    it('searches by product name', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/admin/inventory?q=Inventory Test Piece')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(res.body.items.some((r: { variantId: string }) => r.variantId === variantId)).toBe(true);
    });

    it('a search for something that does not exist returns an empty page, not an error', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/admin/inventory?q=no-such-product-xyz')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(res.body).toMatchObject({ items: [], total: 0 });
    });

    it('lowStockOnly=true excludes a restocked item that lowStockOnly=false includes', async () => {
      const restrictedRes = await request(app.getHttpServer())
        .get('/api/v1/admin/inventory?lowStockOnly=true&pageSize=100')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(
        restrictedRes.body.items.some((r: { variantId: string }) => r.variantId === variantId),
      ).toBe(false);

      const fullRes = await request(app.getHttpServer())
        .get('/api/v1/admin/inventory?pageSize=100')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(fullRes.body.items.some((r: { variantId: string }) => r.variantId === variantId)).toBe(true);
    });
  });
});
