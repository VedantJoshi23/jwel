'use client';

// RBAC at the frontend layer is a UX convenience, not the security boundary
// — every admin API call still goes through the backend's @Roles guard
// (RolesGuard, see BACKEND.md §9.4-style identity handling), which is what
// actually enforces access. This just keeps a CUSTOMER from ever rendering
// admin UI or seeing a flash of admin data before a 403 comes back.
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/auth-store';

const ADMIN_ROLES = ['ADMIN', 'STAFF'];

export function AdminGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.token);

  useEffect(() => {
    if (!token || !user) {
      router.replace('/login?next=/admin');
      return;
    }
    if (!ADMIN_ROLES.includes(user.role)) {
      router.replace('/');
    }
  }, [token, user, router]);

  if (!token || !user || !ADMIN_ROLES.includes(user.role)) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-sm text-ink-muted">
        Checking access…
      </div>
    );
  }

  return <>{children}</>;
}
