import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';
import { PrismaService } from '../../../prisma/prisma.service';

describe('JwtStrategy', () => {
  let prisma: { user: { findUnique: jest.Mock } };
  let strategy: JwtStrategy;

  beforeEach(() => {
    prisma = { user: { findUnique: jest.fn() } };
    const config = { getOrThrow: jest.fn().mockReturnValue('test-secret') } as unknown as ConfigService;
    strategy = new JwtStrategy(config, prisma as unknown as PrismaService);
  });

  it('throws UnauthorizedException when the user no longer exists', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(strategy.validate({ sub: 'u1', email: 'a@b.com', role: 'CUSTOMER' })).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('throws UnauthorizedException for a suspended (soft-deleted) account, even with a still-valid token', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'a@b.com', role: 'CUSTOMER', deletedAt: new Date() });
    await expect(strategy.validate({ sub: 'u1', email: 'a@b.com', role: 'CUSTOMER' })).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('returns the current user info from the database, not just the token payload', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'new-email@b.com', role: 'ADMIN', deletedAt: null });
    const result = await strategy.validate({ sub: 'u1', email: 'stale-email@b.com', role: 'CUSTOMER' });
    // role/email come from the DB lookup, not the (possibly stale) token claims —
    // a promotion to ADMIN takes effect on next request without needing a new token.
    expect(result).toEqual({ userId: 'u1', email: 'new-email@b.com', role: 'ADMIN' });
  });
});
