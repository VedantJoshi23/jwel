import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './utils/create-test-app';
import { cleanupTestUser, registerAndLogin, registerAndLoginAsAdmin, uniqueEmail } from './utils/auth-helpers';

// A 1x1 PNG — a real decodable image rather than random bytes, so nothing
// downstream can reject it for being malformed rather than for the reason
// under test.
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

describe('Admin image uploads (integration)', () => {
  let app: INestApplication;
  const adminEmail = uniqueEmail('uploads-admin');
  const customerEmail = uniqueEmail('uploads-customer');
  let adminToken: string;
  let customerToken: string;

  beforeAll(async () => {
    app = await createTestApp();
    adminToken = (await registerAndLoginAsAdmin(app, adminEmail)).token;
    customerToken = (await registerAndLogin(app, customerEmail)).token;
  });

  afterAll(async () => {
    await cleanupTestUser(adminEmail);
    await cleanupTestUser(customerEmail);
    await app.close();
  });

  describe('folder allowlist', () => {
    it.each(['banners', 'collections'])('accepts an upload to "%s"', async (folder) => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/admin/uploads/${folder}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', PNG_1X1, { filename: 'hero.png', contentType: 'image/png' })
        .expect(201);

      expect(res.body.storageRef).toContain(folder);
      expect(res.body.url).toMatch(/^https?:\/\//);
    });

    // FilesystemStorageProvider does join(uploadsDir, folder), so a folder
    // taken from the URL could otherwise write outside the uploads directory.
    // Tested over real HTTP because URL normalisation happens in the router,
    // before any of this code runs — a service-level test cannot prove what
    // the routing layer actually delivers here.
    it.each([
      ['an unlisted folder', 'products'],
      ['an unlisted folder with traversal', 'banners%2F..%2F..%2Fetc'],
      ['a bare traversal segment', '..'],
    ])('rejects %s', async (_label, folder) => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/admin/uploads/${folder}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', PNG_1X1, { filename: 'hero.png', contentType: 'image/png' });

      // Either the route does not match at all (404) or the allowlist
      // rejects it (400) — what must never happen is a 201.
      expect([400, 404]).toContain(res.status);
    });
  });

  describe('file validation', () => {
    // Nest inspects the file's magic numbers, not the declared Content-Type,
    // so this is rejected for what the bytes actually are — renaming a PDF to
    // .jpg and declaring image/jpeg does not get past it.
    it('rejects a non-image upload even when it claims an image content type', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/admin/uploads/banners')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', Buffer.from('%PDF-1.4'), { filename: 'x.jpg', contentType: 'image/jpeg' })
        .expect(400);
    });

    it('rejects a request with no file attached', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/admin/uploads/banners')
        .set('Authorization', `Bearer ${adminToken}`);

      expect([400, 422]).toContain(res.status);
    });
  });

  describe('RBAC', () => {
    it('a CUSTOMER cannot upload', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/admin/uploads/banners')
        .set('Authorization', `Bearer ${customerToken}`)
        .attach('file', PNG_1X1, { filename: 'hero.png', contentType: 'image/png' })
        .expect(403);
    });

    it('an unauthenticated request cannot upload', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/admin/uploads/banners')
        .attach('file', PNG_1X1, { filename: 'hero.png', contentType: 'image/png' })
        .expect(401);
    });
  });
});
