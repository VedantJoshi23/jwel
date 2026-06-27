import { apiFetch } from './client';
import type { DashboardSummary } from './types';

export function getDashboardSummary(token: string, windowDays = 30) {
  return apiFetch<DashboardSummary>(`/admin/analytics/dashboard?windowDays=${windowDays}`, {
    token,
    cache: 'no-store',
  });
}
