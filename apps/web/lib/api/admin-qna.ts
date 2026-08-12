import { apiFetch } from './client';
import type { AdminQuestion, PaginatedResult } from './types';

export function adminListQuestions(token: string, unanswered?: boolean, page = 1, pageSize = 20) {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (unanswered) params.set('unanswered', 'true');
  return apiFetch<PaginatedResult<AdminQuestion>>(`/admin/qa/questions?${params}`, {
    token,
    cache: 'no-store',
  });
}

export function adminModerateQuestion(token: string, id: string, hidden: boolean) {
  return apiFetch<AdminQuestion>(`/admin/qa/questions/${id}/moderate`, {
    method: 'PATCH',
    token,
    body: JSON.stringify({ hidden }),
  });
}

export function adminModerateAnswer(token: string, id: string, hidden: boolean) {
  return apiFetch<void>(`/admin/qa/answers/${id}/moderate`, {
    method: 'PATCH',
    token,
    body: JSON.stringify({ hidden }),
  });
}

/**
 * The admin's answer goes through the exact same customer-facing route —
 * DOM-PRODUCT-QA Invariant 6 needs no separate admin-answer endpoint, so
 * this is a thin re-export under the admin-facing name, not new API surface.
 */
export function adminPostAnswer(token: string, questionId: string, body: string) {
  return apiFetch<void>(`/questions/${questionId}/answers`, {
    method: 'POST',
    token,
    body: JSON.stringify({ body }),
  });
}
