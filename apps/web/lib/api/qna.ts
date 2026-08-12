import { apiFetch } from './client';
import type { Answer, PaginatedResult, Question } from './types';

// Local, matching products.ts's own (file-local, non-exported) convention
// rather than introducing a new shared util.
function toQueryString<T extends object>(query: T): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query as Record<string, string | number | undefined>)) {
    if (value !== undefined && value !== '') {
      params.set(key, String(value));
    }
  }
  const str = params.toString();
  return str ? `?${str}` : '';
}

/**
 * Public read — `token` is optional. Passed, it lets the API compute
 * `upvotedByMe` for the caller (OptionalJwtAuthGuard on the API side);
 * omitted, this is still a normal 200, per DOM-PRODUCT-QA Invariant 8.
 */
export function getProductQuestions(productId: string, page = 1, pageSize = 10, token?: string) {
  return apiFetch<PaginatedResult<Question>>(
    `/products/${productId}/questions${toQueryString({ page, pageSize })}`,
    { token, cache: 'no-store' },
  );
}

export function askQuestion(token: string, productId: string, body: string) {
  return apiFetch<Question>(`/products/${productId}/questions`, {
    method: 'POST',
    token,
    body: JSON.stringify({ body }),
  });
}

export function postAnswer(token: string, questionId: string, body: string) {
  return apiFetch<Answer>(`/questions/${questionId}/answers`, {
    method: 'POST',
    token,
    body: JSON.stringify({ body }),
  });
}

export function upvoteQuestion(token: string, questionId: string) {
  return apiFetch<void>(`/questions/${questionId}/upvote`, { method: 'POST', token });
}

export function removeQuestionUpvote(token: string, questionId: string) {
  return apiFetch<void>(`/questions/${questionId}/upvote`, { method: 'DELETE', token });
}

export function upvoteAnswer(token: string, answerId: string) {
  return apiFetch<void>(`/answers/${answerId}/upvote`, { method: 'POST', token });
}

export function removeAnswerUpvote(token: string, answerId: string) {
  return apiFetch<void>(`/answers/${answerId}/upvote`, { method: 'DELETE', token });
}
