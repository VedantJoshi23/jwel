import { ConflictException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { PrismaService } from '../../prisma/prisma.service';
import { Role } from '../../common/enums/role.enum';

jest.mock('bcrypt');

type MockPrisma = { user: { findUnique: jest.Mock; create: jest.Mock } };

describe('AuthService', () => {
  let prisma: MockPrisma;
  let jwt: { sign: jest.Mock };
  let service: AuthService;

  beforeEach(() => {
    prisma = { user: { findUnique: jest.fn(), create: jest.fn() } };
    jwt = { sign: jest.fn().mockReturnValue('signed-jwt-token') };
    service = new AuthService(prisma as unknown as PrismaService, jwt as unknown as JwtService);
    jest.clearAllMocks();
    jwt.sign.mockReturnValue('signed-jwt-token');
  });

  describe('register', () => {
    it('throws ConflictException when the email is already registered', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'existing' });
      await expect(service.register({ email: 'a@b.com', password: 'password123' })).rejects.toThrow(
        ConflictException,
      );
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('hashes the password and creates a CUSTOMER, never trusting a client-supplied role', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
      prisma.user.create.mockResolvedValue({
        id: 'u1',
        email: 'a@b.com',
        name: 'A',
        role: Role.CUSTOMER,
      });

      const result = await service.register({ email: 'a@b.com', password: 'password123', name: 'A' });

      expect(bcrypt.hash).toHaveBeenCalledWith('password123', 12);
      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ role: Role.CUSTOMER, passwordHash: 'hashed-password' }) }),
      );
      expect(result.accessToken).toBe('signed-jwt-token');
      expect(result.user).toEqual({ id: 'u1', email: 'a@b.com', name: 'A', role: Role.CUSTOMER });
    });

    it('signs the JWT with the user id, email, and role', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
      prisma.user.create.mockResolvedValue({ id: 'u1', email: 'a@b.com', name: null, role: Role.CUSTOMER });

      await service.register({ email: 'a@b.com', password: 'password123' });

      expect(jwt.sign).toHaveBeenCalledWith({ sub: 'u1', email: 'a@b.com', role: Role.CUSTOMER });
    });
  });

  describe('login', () => {
    it('throws UnauthorizedException when no account exists for the email', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.login({ email: 'nobody@b.com', password: 'x' })).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException for a soft-deleted (suspended) account', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', passwordHash: 'hash', deletedAt: new Date() });
      await expect(service.login({ email: 'a@b.com', password: 'x' })).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException for an account with no password hash set', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', passwordHash: null, deletedAt: null });
      await expect(service.login({ email: 'a@b.com', password: 'x' })).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when the password does not match', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', passwordHash: 'hash', deletedAt: null });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);
      await expect(service.login({ email: 'a@b.com', password: 'wrong' })).rejects.toThrow(UnauthorizedException);
    });

    it('returns an access token and user info on successful login', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'a@b.com',
        name: 'A',
        role: Role.ADMIN,
        passwordHash: 'hash',
        deletedAt: null,
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.login({ email: 'a@b.com', password: 'correct' });

      expect(result.accessToken).toBe('signed-jwt-token');
      expect(result.user.role).toBe(Role.ADMIN);
    });
  });
});
