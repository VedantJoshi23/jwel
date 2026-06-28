import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getDashboardSummary } from './admin-analytics';

describe('getDashboardSummary', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({}), { status: 200 })));
  });
  afterEach(() => vi.unstubAllGlobals());

  it('defaults windowDays to 30', async () => {
    await getDashboardSummary('token-1');
    const [url] = (fetch as any).mock.calls[0];
    expect(url).toContain('windowDays=30');
  });

  it('passes a custom windowDays through', async () => {
    await getDashboardSummary('token-1', 7);
    const [url] = (fetch as any).mock.calls[0];
    expect(url).toContain('windowDays=7');
  });
});
