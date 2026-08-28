import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ShippingService } from './shipping.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { ShippingProviderPort } from './ports/shipping-provider.port';

const actor: AuthenticatedUser = { userId: 'admin-1', email: 'admin@example.com', role: 'ADMIN' };

describe('ShippingService', () => {
  let prisma: {
    pincodeServiceabilityOverride: {
      findUnique: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
  };
  let auditLog: { record: jest.Mock };
  let provider: { checkServiceability: jest.Mock };
  let service: ShippingService;

  beforeEach(() => {
    prisma = {
      pincodeServiceabilityOverride: {
        findUnique: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'o1', ...data })),
        update: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'o1', pincode: '400001', ...data })),
        delete: jest.fn(),
      },
    };
    auditLog = { record: jest.fn() };
    provider = { checkServiceability: jest.fn() };
    service = new ShippingService(
      prisma as unknown as PrismaService,
      auditLog as unknown as AuditLogService,
      provider as unknown as ShippingProviderPort,
    );
  });

  describe('checkServiceability', () => {
    it('delegates to the injected port — the service carries no adapter-specific logic itself', async () => {
      provider.checkServiceability.mockResolvedValue({
        pincode: '400001',
        deliverable: true,
        estimatedMinDays: 4,
        estimatedMaxDays: 7,
        source: 'ESTIMATED',
      });

      const result = await service.checkServiceability('400001');
      expect(provider.checkServiceability).toHaveBeenCalledWith('400001');
      expect(result.deliverable).toBe(true);
    });
  });

  describe('adminCreate', () => {
    it('creates an override and records an audit entry', async () => {
      const result = await service.adminCreate({ pincode: '400001', deliverable: true }, actor);
      expect(prisma.pincodeServiceabilityOverride.create).toHaveBeenCalled();
      expect(auditLog.record).toHaveBeenCalledWith(
        expect.objectContaining({ actor, action: 'shipping.pincode_override.create' }),
      );
      expect(result.pincode).toBe('400001');
    });

    it('refuses a second override for a pincode that already has one', async () => {
      prisma.pincodeServiceabilityOverride.findUnique.mockResolvedValue({ id: 'o1', pincode: '400001' });
      await expect(service.adminCreate({ pincode: '400001' }, actor)).rejects.toThrow(BadRequestException);
      expect(prisma.pincodeServiceabilityOverride.create).not.toHaveBeenCalled();
    });

    it('refuses an estimate window on a non-deliverable pincode (mirrors the DB CHECK constraint)', async () => {
      await expect(
        service.adminCreate({ pincode: '855107', deliverable: false, estimatedMinDays: 5 }, actor),
      ).rejects.toThrow(BadRequestException);
    });

    it('refuses estimatedMinDays greater than estimatedMaxDays', async () => {
      await expect(
        service.adminCreate({ pincode: '400001', estimatedMinDays: 10, estimatedMaxDays: 2 }, actor),
      ).rejects.toThrow(BadRequestException);
    });

    it('silently drops any window fields when deliverable is false, even if none were rejected outright', async () => {
      await service.adminCreate({ pincode: '855107', deliverable: false }, actor);
      const data = prisma.pincodeServiceabilityOverride.create.mock.calls[0][0].data;
      expect(data.estimatedMinDays).toBeNull();
      expect(data.estimatedMaxDays).toBeNull();
    });
  });

  describe('adminUpdate', () => {
    it('throws NotFoundException for an unknown id', async () => {
      prisma.pincodeServiceabilityOverride.findUnique.mockResolvedValue(null);
      await expect(service.adminUpdate('missing', {}, actor)).rejects.toThrow(NotFoundException);
    });

    it('flipping deliverable to false clears an existing estimate window', async () => {
      prisma.pincodeServiceabilityOverride.findUnique.mockResolvedValue({
        id: 'o1',
        pincode: '110001',
        deliverable: true,
        estimatedMinDays: 1,
        estimatedMaxDays: 2,
        note: null,
      });

      await service.adminUpdate('o1', { deliverable: false }, actor);
      const data = prisma.pincodeServiceabilityOverride.update.mock.calls[0][0].data;
      expect(data.estimatedMinDays).toBeNull();
      expect(data.estimatedMaxDays).toBeNull();
    });

    it('keeps the existing window when the update omits it entirely', async () => {
      prisma.pincodeServiceabilityOverride.findUnique.mockResolvedValue({
        id: 'o1',
        pincode: '110001',
        deliverable: true,
        estimatedMinDays: 1,
        estimatedMaxDays: 2,
        note: null,
      });

      await service.adminUpdate('o1', { note: 'Updated reason' }, actor);
      const data = prisma.pincodeServiceabilityOverride.update.mock.calls[0][0].data;
      expect(data.estimatedMinDays).toBe(1);
      expect(data.estimatedMaxDays).toBe(2);
      expect(data.note).toBe('Updated reason');
    });

    it('records an audit entry with before/after state', async () => {
      prisma.pincodeServiceabilityOverride.findUnique.mockResolvedValue({
        id: 'o1',
        pincode: '110001',
        deliverable: true,
        estimatedMinDays: 1,
        estimatedMaxDays: 2,
        note: null,
      });

      await service.adminUpdate('o1', { note: 'reason' }, actor);
      expect(auditLog.record).toHaveBeenCalledWith(
        expect.objectContaining({ actor, action: 'shipping.pincode_override.update', entityId: 'o1' }),
      );
    });
  });

  describe('adminDelete', () => {
    it('throws NotFoundException for an unknown id', async () => {
      prisma.pincodeServiceabilityOverride.findUnique.mockResolvedValue(null);
      await expect(service.adminDelete('missing', actor)).rejects.toThrow(NotFoundException);
    });

    it('deletes and records an audit entry', async () => {
      prisma.pincodeServiceabilityOverride.findUnique.mockResolvedValue({ id: 'o1', pincode: '110001' });
      await service.adminDelete('o1', actor);
      expect(prisma.pincodeServiceabilityOverride.delete).toHaveBeenCalledWith({ where: { id: 'o1' } });
      expect(auditLog.record).toHaveBeenCalledWith(
        expect.objectContaining({ actor, action: 'shipping.pincode_override.delete', entityId: 'o1' }),
      );
    });
  });
});
