import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';

describe('AnalyticsController', () => {
  it('delegates to AnalyticsService.getDashboardSummary with the requested windowDays', () => {
    const service = { getDashboardSummary: jest.fn().mockReturnValue('summary') };
    const controller = new AnalyticsController(service as unknown as AnalyticsService);
    expect(controller.getDashboardSummary({ windowDays: 7 })).toBe('summary');
    expect(service.getDashboardSummary).toHaveBeenCalledWith(7);
  });
});
