import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './utils/create-test-app';
import { cleanupTestUser, registerAndLogin, registerAndLoginAsAdmin, uniqueEmail } from './utils/auth-helpers';

describe('Auth (integration)', () => {
  let app: INestApplication;
  const email = uniqueEmail('auth');

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await cleanupTestUser(email);
    await app.close();
  });

  it('registers a new account and returns a usable access token', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email, password: 'a-strong-password', name: 'Test User' })
      .expect(201);

    expect(res.body.accessToken).toBeDefined();
    expect(res.body.user).toMatchObject({ email, name: 'Test User', role: 'CUSTOMER' });
    expect(res.body.user.id).toBeDefined();
  });

  it('rejects a duplicate registration with the same email', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email, password: 'a-strong-password' })
      .expect(409);
  });

  it('rejects registration with a too-short password', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email: uniqueEmail('shortpw'), password: 'short' })
      .expect(400);
  });

  it('logs in with correct credentials', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: 'a-strong-password' })
      .expect(200);
    expect(res.body.accessToken).toBeDefined();
  });

  it('rejects login with the wrong password', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: 'wrong-password' })
      .expect(401);
  });

  it('rejects login for a nonexistent account', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: uniqueEmail('nobody'), password: 'whatever123' })
      .expect(401);
  });

  it('a valid token authorizes access to a protected route (GET /me)', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: 'a-strong-password' })
      .expect(200);

    await request(app.getHttpServer())
      .get('/api/v1/me')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .expect(200)
      .expect((res: request.Response) => expect(res.body.email).toBe(email));
  });

  it('a missing token is rejected on a protected route', async () => {
    await request(app.getHttpServer()).get('/api/v1/me').expect(401);
  });

  it('a malformed token is rejected on a protected route', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/me')
      .set('Authorization', 'Bearer not-a-real-token')
      .expect(401);
  });
});

describe('Suspension → login → unsuspend (integration)', () => {
  let app: INestApplication;
  const adminEmail = uniqueEmail('suspend-admin');
  const targetEmail = uniqueEmail('suspend-target');
  const password = 'a-strong-password';
  let adminToken: string;
  let targetUserId: string;

  beforeAll(async () => {
    app = await createTestApp();
    adminToken = (await registerAndLoginAsAdmin(app, adminEmail)).token;
    const target = await registerAndLogin(app, targetEmail, password);
    targetUserId = target.userId;
  });

  afterAll(async () => {
    await cleanupTestUser(adminEmail);
    await cleanupTestUser(targetEmail);
    await app.close();
  });

  it('a suspended admin list shows the user by default, with their status', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/admin/users/${targetUserId}/suspend`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Fraudulent chargeback' })
      .expect(200);

    // Regression: adminListUsers used to hardcode `deletedAt: null`, so a
    // suspended user vanished from this list with no filter able to bring
    // them back — this is what proves the admin can actually find them.
    const res = await request(app.getHttpServer())
      .get('/api/v1/admin/users?pageSize=100')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const row = res.body.items.find((u: { id: string }) => u.id === targetUserId);
    expect(row).toMatchObject({ deletedAt: expect.any(String), suspensionReason: 'Fraudulent chargeback' });
  });

  it('the suspended user is told why, with a login that used the correct password', async () => {
    // Regression: this used to be an indistinguishable 401 "Invalid email or
    // password" — the account owner, using their own correct password, had
    // no way to learn they were suspended, let alone why.
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: targetEmail, password })
      .expect(403);
    expect(res.body.message).toContain('Fraudulent chargeback');
  });

  it('a wrong password on the same suspended account still gets the generic 401', async () => {
    // Anti-enumeration: guessing wrong learns nothing about suspension.
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: targetEmail, password: 'definitely-wrong' })
      .expect(401);
  });

  it('an existing token for a newly suspended user is rejected on the next request', async () => {
    const midSessionEmail = uniqueEmail('suspend-midsession');
    const freshLogin = await registerAndLogin(app, midSessionEmail, password);
    await request(app.getHttpServer())
      .patch(`/api/v1/admin/users/${freshLogin.userId}/suspend`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({})
      .expect(200);

    await request(app.getHttpServer())
      .get('/api/v1/me')
      .set('Authorization', `Bearer ${freshLogin.token}`)
      .expect(401);

    await cleanupTestUser(midSessionEmail);
  });

  it('unsuspending restores login', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/admin/users/${targetUserId}/unsuspend`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: targetEmail, password })
      .expect(200);
    expect(res.body.accessToken).toBeDefined();
  });

  it('unsuspending a user who is not suspended is refused', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/admin/users/${targetUserId}/unsuspend`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(400);
  });

  it('a CUSTOMER cannot suspend or unsuspend anyone (RBAC)', async () => {
    const customerEmail = uniqueEmail('suspend-rbac');
    const customer = await registerAndLogin(app, customerEmail, password);
    await request(app.getHttpServer())
      .patch(`/api/v1/admin/users/${targetUserId}/suspend`)
      .set('Authorization', `Bearer ${customer.token}`)
      .send({})
      .expect(403);
    await request(app.getHttpServer())
      .patch(`/api/v1/admin/users/${targetUserId}/unsuspend`)
      .set('Authorization', `Bearer ${customer.token}`)
      .expect(403);
    await cleanupTestUser(customerEmail);
  });
});
