import { apiFetch } from './client';
import { getAnonymousId } from '../anonymous-id';
import type { AuthResponse } from './types';

export function login(email: string, password: string) {
  return apiFetch<AuthResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

/**
 * `anonymousId` carries this browser's guest view history into the new
 * account — `DOM-RECOMMENDATION` Invariant 9, so what someone browsed before
 * signing up still counts afterwards.
 *
 * Read here rather than asked for by the caller: every registration should
 * claim it, and a form that had to remember to pass it is a form that will
 * eventually forget.
 */
export function register(email: string, password: string, name?: string, phone?: string) {
  return apiFetch<AuthResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      email,
      password,
      name,
      phone,
      anonymousId: getAnonymousId() ?? undefined,
    }),
  });
}
