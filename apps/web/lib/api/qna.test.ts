import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  askQuestion,
  getProductQuestions,
  postAnswer,
  removeAnswerUpvote,
  removeQuestionUpvote,
  upvoteAnswer,
  upvoteQuestion,
} from './qna';

describe('qna API — FEAT-PRODUCT-QA', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ items: [], page: 1, pageSize: 10, total: 0 }), { status: 200 })),
    );
  });
  afterEach(() => vi.unstubAllGlobals());

  it('getProductQuestions works with no token — a public, unauthenticated read', async () => {
    await getProductQuestions('p1', 1, 10);
    const [url, options] = (fetch as any).mock.calls[0];
    expect(url).toContain('/products/p1/questions');
    expect(options.headers.Authorization).toBeUndefined();
  });

  it('getProductQuestions carries the bearer token when the caller is logged in', async () => {
    await getProductQuestions('p1', 1, 10, 'token-1');
    const [, options] = (fetch as any).mock.calls[0];
    expect(options.headers.Authorization).toBe('Bearer token-1');
  });

  it('askQuestion POSTs the body under the product', async () => {
    await askQuestion('token-1', 'p1', 'Does this tarnish?');
    const [url, options] = (fetch as any).mock.calls[0];
    expect(url).toContain('/products/p1/questions');
    expect(options.method).toBe('POST');
    expect(JSON.parse(options.body)).toEqual({ body: 'Does this tarnish?' });
  });

  it('postAnswer POSTs under the question', async () => {
    await postAnswer('token-1', 'q1', 'Yes, rhodium-plated.');
    const [url, options] = (fetch as any).mock.calls[0];
    expect(url).toContain('/questions/q1/answers');
    expect(JSON.parse(options.body)).toEqual({ body: 'Yes, rhodium-plated.' });
  });

  it('upvoteQuestion POSTs to the question upvote route', async () => {
    await upvoteQuestion('token-1', 'q1');
    const [url, options] = (fetch as any).mock.calls[0];
    expect(url).toContain('/questions/q1/upvote');
    expect(options.method).toBe('POST');
  });

  it('removeQuestionUpvote DELETEs the same route', async () => {
    await removeQuestionUpvote('token-1', 'q1');
    const [url, options] = (fetch as any).mock.calls[0];
    expect(url).toContain('/questions/q1/upvote');
    expect(options.method).toBe('DELETE');
  });

  it('upvoteAnswer POSTs to the answer upvote route', async () => {
    await upvoteAnswer('token-1', 'a1');
    const [url, options] = (fetch as any).mock.calls[0];
    expect(url).toContain('/answers/a1/upvote');
    expect(options.method).toBe('POST');
  });

  it('removeAnswerUpvote DELETEs the same route', async () => {
    await removeAnswerUpvote('token-1', 'a1');
    const [url, options] = (fetch as any).mock.calls[0];
    expect(url).toContain('/answers/a1/upvote');
    expect(options.method).toBe('DELETE');
  });
});
