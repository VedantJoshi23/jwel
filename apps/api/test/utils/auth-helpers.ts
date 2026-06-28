import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.jwel.local`;
}

export async function registerAndLogin(
  app: INestApplication,
  email: string,
  password = 'a-strong-password',
): Promise<{ token: string; userId: string }> {
  const res = await request(app.getHttpServer())
    .post('/api/v1/auth/register')
    .send({ email, password })
    .expect(201);
  return { token: res.body.accessToken, userId: res.body.user.id };
}

/**
 * Registration always creates a CUSTOMER (AuthService.register hardcodes
 * this — by design, there's no public "register as admin" endpoint).
 * Promoting directly via Prisma and re-logging in (the JWT bakes the role
 * in at sign time, so a stale token from before the promotion would still
 * read CUSTOMER) is the realistic way to seed an admin identity for a test,
 * not a shortcut around anything the real app does differently.
 */
export async function registerAndLoginAsAdmin(
  app: INestApplication,
  email: string,
  password = 'a-strong-password',
): Promise<{ token: string; userId: string }> {
  const { userId } = await registerAndLogin(app, email, password);
  await prisma.user.update({ where: { id: userId }, data: { role: 'ADMIN' } });
  const res = await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .send({ email, password })
    .expect(200);
  return { token: res.body.accessToken, userId };
}

export async function cleanupTestUser(email: string): Promise<void> {
  await prisma.user.deleteMany({ where: { email } });
}

export { prisma as testPrisma };
