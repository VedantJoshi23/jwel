import { API_URL } from '@/lib/api/client';

// Plain anchors, not client-side navigation — these must be full page loads
// so the browser actually leaves the SPA and follows the backend's redirect
// to the provider (GET /api/v1/auth/{provider}); a router.push() here would
// just 404 against Next.js's own route table.
const PROVIDERS = [
  {
    name: 'google' as const,
    label: 'Continue with Google',
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
        <path
          fill="#4285F4"
          d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.28 1.48-1.13 2.73-2.4 3.58v2.98h3.86c2.26-2.08 3.56-5.14 3.56-8.8Z"
        />
        <path
          fill="#34A853"
          d="M12 24c3.24 0 5.95-1.07 7.93-2.91l-3.86-2.99c-1.08.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.28v3.09C3.25 21.3 7.31 24 12 24Z"
        />
        <path fill="#FBBC05" d="M5.27 14.29a7.2 7.2 0 0 1 0-4.58V6.62H1.28a12 12 0 0 0 0 10.76l3.99-3.09Z" />
        <path
          fill="#EA4335"
          d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.94 1.19 15.24 0 12 0 7.31 0 3.25 2.7 1.28 6.62l3.99 3.09C6.22 6.86 8.87 4.75 12 4.75Z"
        />
      </svg>
    ),
  },
  {
    name: 'facebook' as const,
    label: 'Continue with Meta',
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
        <path
          fill="#1877F2"
          d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.7 4.53-4.7 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.96.93-1.96 1.89v2.26h3.33l-.53 3.49h-2.8V24C19.61 23.1 24 18.1 24 12.07Z"
        />
      </svg>
    ),
  },
  {
    name: 'apple' as const,
    label: 'Continue with Apple',
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true" fill="currentColor">
        <path d="M16.36 1.43c0 1.14-.42 2.2-1.24 3.03-.94.95-2.16 1.5-3.36 1.4-.13-1.14.42-2.32 1.24-3.14C13.86.68 15.2.06 16.28 0c.05.48.08.95.08 1.43ZM20.5 17.35c-.5 1.15-.74 1.66-1.39 2.68-.9 1.42-2.18 3.2-3.75 3.21-1.4.02-1.76-.9-3.66-.9-1.9 0-2.3.88-3.69.92-1.55.05-2.73-1.53-3.64-2.94-1.98-3.05-3.5-8.62-1.46-12.38 1.01-1.87 2.83-3.05 4.79-3.08 1.5-.03 2.9.99 3.82.99.9 0 2.62-1.23 4.42-1.05.75.03 2.86.3 4.22 2.25-.11.07-2.52 1.44-2.49 4.32.03 3.43 3.09 4.58 3.13 4.6-.03.09-.5 1.66-1.6 3.38Z" />
      </svg>
    ),
  },
];

export function SocialLoginButtons() {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs uppercase tracking-wide text-ink-secondary">Or continue with</span>
        <div className="h-px flex-1 bg-border" />
      </div>
      {PROVIDERS.map((provider) => (
        <a
          key={provider.name}
          href={`${API_URL}/auth/${provider.name}`}
          className="flex h-11 w-full items-center justify-center gap-3 rounded-s border border-border text-sm font-medium hover:bg-surface-alt"
        >
          {provider.icon}
          {provider.label}
        </a>
      ))}
    </div>
  );
}
