'use client';

// RBAC at the frontend layer is a UX convenience, not the security boundary
// — every admin API call still goes through the backend's @Roles guard
// (RolesGuard, see BACKEND.md §9.4-style identity handling), which is what
// actually enforces access. This just keeps a CUSTOMER from ever rendering
// admin UI or seeing a flash of admin data before a 403 comes back.
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/auth-store';

const ADMIN_ROLES = ['ADMIN', 'STAFF'];

export function AdminGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.token);

  // zustand/persist rehydrates from localStorage asynchronously, after this
  // component's first render — so on a hard navigation (a bookmarked
  // /admin/* URL, a full page reload) `token`/`user` are still their
  // pre-hydration `null` on mount, even for an already-authenticated admin.
  // Deciding to redirect before rehydration finishes bounced a legitimately
  // logged-in admin to /login; caught by testing the new Returns page with a
  // fresh browser navigation, then confirmed as pre-existing by reproducing
  // the same failure on the unmodified Orders page — not something specific
  // to one page's code.
  const [hasHydrated, setHasHydrated] = useState(useAuthStore.persist.hasHydrated());

  useEffect(() => {
    if (hasHydrated) return;
    return useAuthStore.persist.onFinishHydration(() => setHasHydrated(true));
  }, [hasHydrated]);

  useEffect(() => {
    if (!hasHydrated) return;
    if (!token || !user) {
      router.replace('/login?next=/admin');
      return;
    }
    if (!ADMIN_ROLES.includes(user.role)) {
      router.replace('/');
    }
  }, [hasHydrated, token, user, router]);

  if (!hasHydrated || !token || !user || !ADMIN_ROLES.includes(user.role)) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-sm text-ink-muted">
        Checking access…
      </div>
    );
  }

  return <>{children}</>;
}
