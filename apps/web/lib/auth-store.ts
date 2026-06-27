import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AuthUser } from './api/types';

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  setSession: (token: string, user: AuthUser) => void;
  logout: () => void;
}

// Interim auth approach — see ARCHITECTURE.md (Auth.js named in the tech
// stack) vs. BACKEND.md §4 ("Auth.js bridging not implemented"): the backend
// issues its own JWT, so the frontend stores that token client-side rather
// than relying on an Auth.js session. Token lives in localStorage (via
// zustand/persist), sent as a Bearer header on every authenticated API call —
// not an httpOnly cookie, so it is not yet hardened against XSS the way a
// production auth integration should be. Flagged as a follow-up, not silently
// treated as equivalent to the Auth.js-backed design.
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      setSession: (token, user) => set({ token, user }),
      logout: () => set({ token: null, user: null }),
    }),
    { name: 'jwel-auth' },
  ),
);
