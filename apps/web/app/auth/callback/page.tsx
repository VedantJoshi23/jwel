'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getProfile } from '@/lib/api/users';
import { useAuth } from '@/hooks/use-auth';
import { ApiError } from '@/lib/api/client';

// Landed here after GET /api/v1/auth/{google,facebook,apple}/callback on the
// backend redirects the browser back with `?token=`. The backend's redirect
// only carries the JWT, not the full user object (Google/Facebook/Apple
// profiles are shaped differently from AuthUser and normalizing them belongs
// in AuthService, not repeated in this redirect URL) — so this page's first
// job is exchanging that token for the profile the same way the rest of the
// app already does, via GET /me, before handing off to the same
// useAuth().setSession every other login path uses.
export default function OAuthCallbackPage() {
  return (
    <Suspense>
      <OAuthCallback />
    </Suspense>
  );
}

function OAuthCallback() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setSession } = useAuth();
  const [error, setError] = useState('');

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      setError('No login token was returned. Please try again.');
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const profile = await getProfile(token);
        if (cancelled) return;
        setSession(token, { id: profile.id, email: profile.email, name: profile.name, role: profile.role });
        router.replace('/profile');
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.message : 'Could not complete sign-in.');
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="mx-auto max-w-sm px-6 py-16 text-center">
      {error ? (
        <>
          <p role="alert" className="text-sm text-feedback-error">
            {error}
          </p>
          <button onClick={() => router.replace('/login')} className="mt-4 text-sm underline">
            Back to login
          </button>
        </>
      ) : (
        <p className="text-sm text-ink-secondary">Signing you in…</p>
      )}
    </div>
  );
}
