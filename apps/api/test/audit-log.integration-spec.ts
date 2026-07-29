import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './utils/create-test-app';
import { cleanupTestUser, registerAndLogin, registerAndLoginAsAdmin, testPrisma, uniqueEmail } from './utils/auth-helpers';

/**
 * Integration rather than unit: the point of this suite is proving the
 * mutation -> audit trail wiring actually fires end to end through a real
 * HTTP request and a real database, not that AuditLogService's own logic is
 * correct in isolation (covered by audit-log.service.spec.ts).
 */
describe('Audit log (integration)', () => {
  let app: INestApplication;
  const adminEmail = uniqueEmail('audit-admin');
  const customerEmail = uniqueEmail('audit-customer');
  let adminToken: string;
  let adminUserId: string;
  let customerToken: string;
  let categoryId: string;
  let productId: string;
  let variantId: string;

  beforeAll(async () => {
    app = await createTestApp();
    const admin = await registerAndLoginAsAdmin(app, adminEmail);
    adminToken = admin.token;
    adminUserId = admin.userId;
    customerToken = (await registerAndLogin(app, customerEmail)).token;

    const category = await testPrisma.category.upsert({
      where: { slug: 'audit-test-category' },
      create: { name: 'Audit Test Category', slug: 'audit-test-category' },
      update: {},
    });
    categoryId = category.id;

    const product = await testPrisma.product.create({
      data: {
        name: 'Audit Test Piece',
        slug: `audit-test-${Date.now()}`,
        categoryId,
        description: 'Fixture for the audit log endpoint.',
        status: 'PUBLISHED',
      },
    });
    productId = product.id;

    const variant = await testPrisma.productVariant.create({
      data: {
        productId,
        sku: `AUDIT-TEST-${Date.now()}`,
        metal: 'GOLD',
        purity: '18K',
        weightGrams: 1,
        basePriceMinorUnits: 100000,
      },
    });
    variantId = variant.id;

    await testPrisma.inventory.create({
      data: { variantId, quantityOnHand: 10, quantityReserved: 0, lowStockThreshold: 2 },
    });
  });

  afterAll(async () => {
    await testPrisma.auditLog.deleteMany({ where: { entityId: variantId } });
    await testPrisma.inventory.deleteMany({ where: { variantId } });
    await testPrisma.productVariant.deleteMany({ where: { id: variantId } });
    await testPrisma.product.deleteMany({ where: { id: productId } });
    await cleanupTestUser(adminEmail);
    await cleanupTestUser(customerEmail);
    await app.close();
  });

  it('a CUSTOMER cannot read the audit log (RBAC)', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/admin/audit-log')
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(403);
  });

  it('an admin inventory adjustment writes a retrievable audit entry with the acting admin as actor', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/admin/inventory/${variantId}/adjust`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ delta: 5 })
      .expect(200);

    const res = await request(app.getHttpServer())
      .get('/api/v1/admin/audit-log')
      .query({ entityType: 'Inventory', entityId: variantId })
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.items).toHaveLength(1);
    const entry = res.body.items[0];
    expect(entry).toMatchObject({
      actorId: adminUserId,
      actorEmail: adminEmail,
      action: 'inventory.adjusted',
      entityType: 'Inventory',
      entityId: variantId,
      metadata: { delta: 5, quantityOnHandAfter: 15 },
    });
  });
});
