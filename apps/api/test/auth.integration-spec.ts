import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './utils/create-test-app';
import { cleanupTestUser, uniqueEmail } from './utils/auth-helpers';

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
