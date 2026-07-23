import { ServiceUnavailableException } from '@nestjs/common';
import { HealthController } from './health.controller';
import { PrismaService } from '../../prisma/prisma.service';

describe('HealthController', () => {
  let prisma: { $queryRaw: jest.Mock };
  let controller: HealthController;

  beforeEach(() => {
    prisma = { $queryRaw: jest.fn() };
    controller = new HealthController(prisma as unknown as PrismaService);
  });

  describe('liveness', () => {
    it('reports ok with the process uptime', () => {
      const result = controller.liveness();

      expect(result.status).toBe('ok');
      expect(result.uptimeSeconds).toBeGreaterThanOrEqual(0);
    });

    // The point of splitting liveness from readiness: a DB outage must not be
    // able to get a healthy process killed and restarted.
    it('does not touch the database', () => {
      controller.liveness();

      expect(prisma.$queryRaw).not.toHaveBeenCalled();
    });
  });

  describe('readiness', () => {
    it('reports ok when the database responds', async () => {
      prisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);

      await expect(controller.readiness()).resolves.toEqual({ status: 'ok', database: 'ok' });
      expect(prisma.$queryRaw).toHaveBeenCalled();
    });

    it('throws 503 rather than 500 when the database is unreachable', async () => {
      prisma.$queryRaw.mockRejectedValue(new Error('connection refused'));

      await expect(controller.readiness()).rejects.toThrow(ServiceUnavailableException);
    });

    it('does not leak the underlying database error to the caller', async () => {
      prisma.$queryRaw.mockRejectedValue(new Error('password authentication failed for user "jwel"'));

      await expect(controller.readiness()).rejects.toMatchObject({
        response: { status: 'error', database: 'unreachable' },
      });
    });

    it('tolerates a non-Error rejection', async () => {
      prisma.$queryRaw.mockRejectedValue('socket hang up');

      await expect(controller.readiness()).rejects.toThrow(ServiceUnavailableException);
    });
  });
});
