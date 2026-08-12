import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { adminListQuestions, adminModerateAnswer, adminModerateQuestion, adminPostAnswer } from './admin-qna';

describe('admin-qna API — FEAT-PRODUCT-QA', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ items: [], page: 1, pageSize: 20, total: 0 }), { status: 200 })),
    );
  });
  afterEach(() => vi.unstubAllGlobals());

  it('adminListQuestions fetches with the bearer token', async () => {
    await adminListQuestions('token-1');
    const [url, options] = (fetch as any).mock.calls[0];
    expect(url).toContain('/admin/qa/questions');
    expect(options.headers.Authorization).toBe('Bearer token-1');
  });

  it('adminListQuestions adds unanswered=true only when requested', async () => {
    await adminListQuestions('token-1', true);
    const [url] = (fetch as any).mock.calls[0];
    expect(url).toContain('unanswered=true');
  });

  it('adminListQuestions omits unanswered when not requested', async () => {
    await adminListQuestions('token-1', false);
    const [url] = (fetch as any).mock.calls[0];
    expect(url).not.toContain('unanswered');
  });

  it('adminModerateQuestion PATCHes the hidden flag', async () => {
    await adminModerateQuestion('token-1', 'q1', true);
    const [url, options] = (fetch as any).mock.calls[0];
    expect(url).toContain('/admin/qa/questions/q1/moderate');
    expect(options.method).toBe('PATCH');
    expect(JSON.parse(options.body)).toEqual({ hidden: true });
  });

  it('adminModerateAnswer PATCHes the hidden flag on the answer route', async () => {
    await adminModerateAnswer('token-1', 'a1', false);
    const [url, options] = (fetch as any).mock.calls[0];
    expect(url).toContain('/admin/qa/answers/a1/moderate');
    expect(JSON.parse(options.body)).toEqual({ hidden: false });
  });

  it('adminPostAnswer reuses the customer-facing answer route', async () => {
    await adminPostAnswer('token-1', 'q1', 'It is 3mm.');
    const [url, options] = (fetch as any).mock.calls[0];
    expect(url).toContain('/questions/q1/answers');
    expect(options.method).toBe('POST');
    expect(JSON.parse(options.body)).toEqual({ body: 'It is 3mm.' });
  });
});
