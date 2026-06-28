import { NotFoundException } from '@nestjs/common';
import { CmsService } from './cms.service';
import { PrismaService } from '../../prisma/prisma.service';

type MockPrisma = { banner: { findMany: jest.Mock; findUnique: jest.Mock; create: jest.Mock; update: jest.Mock; delete: jest.Mock } };

describe('CmsService', () => {
  let prisma: MockPrisma;
  let service: CmsService;

  beforeEach(() => {
    prisma = { banner: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() } };
    service = new CmsService(prisma as unknown as PrismaService);
  });

  describe('listActiveBanners', () => {
    it('queries with isActive: true and an unbounded-on-null scheduling window', async () => {
      prisma.banner.findMany.mockResolvedValue([]);
      await service.listActiveBanners();

      const where = prisma.banner.findMany.mock.calls[0][0].where;
      expect(where.isActive).toBe(true);
      // both bounds expressed as "null OR within range" so an unset bound never excludes a banner
      expect(where.OR).toEqual(expect.arrayContaining([{ startsAt: null }]));
    });

    it('orders by sortOrder ascending', async () => {
      prisma.banner.findMany.mockResolvedValue([]);
      await service.listActiveBanners();
      expect(prisma.banner.findMany.mock.calls[0][0].orderBy).toEqual({ sortOrder: 'asc' });
    });
  });

  describe('adminCreateBanner', () => {
    it('defaults sortOrder to 0 and isActive to true when omitted', async () => {
      prisma.banner.create.mockResolvedValue({});
      await service.adminCreateBanner({ title: 'T', imageRef: 'x.jpg' });
      expect(prisma.banner.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ sortOrder: 0, isActive: true, startsAt: null, endsAt: null }),
      });
    });

    it('converts startsAt/endsAt strings to Date objects', async () => {
      prisma.banner.create.mockResolvedValue({});
      await service.adminCreateBanner({
        title: 'T',
        imageRef: 'x.jpg',
        startsAt: '2026-01-01T00:00:00.000Z',
        endsAt: '2026-02-01T00:00:00.000Z',
      });
      const data = prisma.banner.create.mock.calls[0][0].data;
      expect(data.startsAt).toBeInstanceOf(Date);
      expect(data.endsAt).toBeInstanceOf(Date);
    });
  });

  describe('adminUpdateBanner / adminDeleteBanner', () => {
    it('throws NotFoundException when updating a nonexistent banner', async () => {
      prisma.banner.findUnique.mockResolvedValue(null);
      await expect(service.adminUpdateBanner('missing', { title: 'T', imageRef: 'x.jpg' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws NotFoundException when deleting a nonexistent banner', async () => {
      prisma.banner.findUnique.mockResolvedValue(null);
      await expect(service.adminDeleteBanner('missing')).rejects.toThrow(NotFoundException);
    });

    it('updates an existing banner, converting date strings to Date objects', async () => {
      prisma.banner.findUnique.mockResolvedValue({ id: 'b1' });
      prisma.banner.update.mockResolvedValue({ id: 'b1' });
      await service.adminUpdateBanner('b1', { title: 'T', imageRef: 'x.jpg', endsAt: '2026-01-01T00:00:00.000Z' });
      expect(prisma.banner.update.mock.calls[0][0].data.endsAt).toBeInstanceOf(Date);
    });

    it('hard-deletes (not soft-deletes) an existing banner', async () => {
      prisma.banner.findUnique.mockResolvedValue({ id: 'b1' });
      prisma.banner.delete.mockResolvedValue({});
      await service.adminDeleteBanner('b1');
      expect(prisma.banner.delete).toHaveBeenCalledWith({ where: { id: 'b1' } });
    });
  });
});
