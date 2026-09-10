import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('MetricsController', () => {
  const registryReturning = (body: string) =>
    ({
      registry: { metrics: jest.fn().mockResolvedValue(body) },
    }) as unknown as MetricsService;

  const prismaReturning = (body: string) =>
    ({ $metrics: { prometheus: jest.fn().mockResolvedValue(body) } }) as unknown as PrismaService;

  const prismaThrowing = (error: Error) =>
    ({
      $metrics: { prometheus: jest.fn().mockRejectedValue(error) },
    }) as unknown as PrismaService;

  it('returns whatever the registry produces', async () => {
    const controller = new MetricsController(
      registryReturning('# HELP fake\nfake_metric 1\n'),
      prismaReturning(''),
    );

    await expect(controller.scrape()).resolves.toBe('# HELP fake\nfake_metric 1\n');
  });

  it('appends the Prisma connection-pool gauges to its own metrics', async () => {
    const controller = new MetricsController(
      registryReturning('http_requests_total 5\n'),
      prismaReturning('prisma_pool_connections_busy 3\n'),
    );

    const body = await controller.scrape();

    expect(body).toContain('http_requests_total 5');
    expect(body).toContain('prisma_pool_connections_busy 3');
  });

  it('still serves its own metrics when the Prisma gauges are unavailable', async () => {
    // Losing every metric because one source failed is the opposite of what
    // monitoring is for — and $metrics throws outright if the client was
    // generated without the preview feature.
    const controller = new MetricsController(
      registryReturning('http_requests_total 5\n'),
      prismaThrowing(new Error('metrics preview feature not enabled')),
    );

    await expect(controller.scrape()).resolves.toBe('http_requests_total 5\n');
  });
});
