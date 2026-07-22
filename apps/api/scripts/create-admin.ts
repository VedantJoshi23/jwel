// Admin bootstrap — the only supported way to create the first ADMIN account.
//
// Deliberately NOT part of `prisma/seed.ts`: that script calls `resetCatalog()`
// (seed.ts:92-104), which `deleteMany`s productMedia/variants/products/
// categories for anything outside the demo taxonomy. Running it against a live
// database would orphan every image the client has uploaded. This script writes
// exactly one `users` row and touches nothing else.
//
// Idempotent — re-running promotes an existing account and resets its password,
// so it doubles as the recovery path if the client is locked out.
//
//   ADMIN_EMAIL=… ADMIN_PASSWORD=… pnpm admin:create
import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

// Matches AuthService's BCRYPT_ROUNDS (auth.service.ts:11) — a hash written
// here must verify against the same cost factor the login path expects.
const BCRYPT_ROUNDS = 12;

// Low bar on purpose: this guards against a fat-fingered env var, not against
// a determined operator. Real password policy belongs in RegisterDto.
const MIN_PASSWORD_LENGTH = 12;

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME?.trim() || 'Administrator';

  if (!email || !password) {
    throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD must both be set.');
  }
  if (!email.includes('@')) {
    throw new Error(`ADMIN_EMAIL does not look like an email address: ${email}`);
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`ADMIN_PASSWORD must be at least ${MIN_PASSWORD_LENGTH} characters.`);
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  // `deletedAt: null` on update is load-bearing: JwtStrategy.validate
  // (strategies/jwt.strategy.ts:27-32) rejects any user with deletedAt set, so
  // promoting a previously-suspended account without clearing it would produce
  // an admin who passes login but 401s on every subsequent request.
  // Checked up front rather than inferred from the upsert result: `createdAt`
  // is a DB-side now() while `@updatedAt` is stamped client-side by Prisma, so
  // comparing the two is not a reliable "was this new?" signal.
  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });

  const user = await prisma.user.upsert({
    where: { email },
    update: { role: Role.ADMIN, passwordHash, deletedAt: null },
    create: { email, name, passwordHash, role: Role.ADMIN },
    select: { id: true, email: true, role: true },
  });

  if (existing) {
    console.log(`Promoted existing account ${user.email} (${user.id}) to ADMIN; password reset.`);
  } else {
    console.log(`Created admin ${user.email} (${user.id}).`);
  }
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
