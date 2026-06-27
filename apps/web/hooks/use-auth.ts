'use client';

import { useAuthStore } from '@/lib/auth-store';

export function useAuth() {
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const setSession = useAuthStore((s) => s.setSession);
  const logout = useAuthStore((s) => s.logout);

  return { token, user, isAuthenticated: Boolean(token), setSession, logout };
}
