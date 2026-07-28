import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';

describe('MetricsController', () => {
  it('returns whatever the registry produces', async () => {
    const registry = { metrics: jest.fn().mockResolvedValue('# HELP fake\nfake_metric 1\n') };
    const controller = new MetricsController({ registry } as unknown as MetricsService);

    await expect(controller.scrape()).resolves.toBe('# HELP fake\nfake_metric 1\n');
  });
});
