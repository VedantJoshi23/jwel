import { beforeEach, describe, expect, it } from 'vitest';
import { useAuthStore } from './auth-store';
import type { AuthUser } from './api/types';

const fakeUser: AuthUser = { id: 'u1', email: 'a@b.com', name: 'A', role: 'CUSTOMER' };

describe('useAuthStore', () => {
  beforeEach(() => {
    useAuthStore.getState().logout();
  });

  it('starts with no token and no user', () => {
    expect(useAuthStore.getState().token).toBeNull();
    expect(useAuthStore.getState().user).toBeNull();
  });

  it('setSession stores the token and user', () => {
    useAuthStore.getState().setSession('jwt-token', fakeUser);
    expect(useAuthStore.getState().token).toBe('jwt-token');
    expect(useAuthStore.getState().user).toEqual(fakeUser);
  });

  it('logout clears both token and user', () => {
    useAuthStore.getState().setSession('jwt-token', fakeUser);
    useAuthStore.getState().logout();
    expect(useAuthStore.getState().token).toBeNull();
    expect(useAuthStore.getState().user).toBeNull();
  });
});
