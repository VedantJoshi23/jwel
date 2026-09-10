'use client';

/**
 * The last boundary. Next mounts this only when the root layout itself throws,
 * which means it *replaces* that layout — so it must render its own `<html>`
 * and `<body>`, and it cannot rely on fonts, providers, or anything else the
 * root layout would normally have set up.
 *
 * For that reason this file deliberately does not import `ErrorState` or any
 * other component: at this point the failure may well be in the component tree
 * itself, and a fallback that imports the thing that broke is not a fallback.
 * Styles are inline for the same reason.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1.5rem',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          background: '#faf8f7',
          color: '#1a1618',
        }}
      >
        <div style={{ maxWidth: '28rem', textAlign: 'center' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 600, margin: 0 }}>Something went wrong</h1>
          <p style={{ marginTop: '0.75rem', lineHeight: 1.6, color: '#5c5257' }}>
            The page could not be loaded. This has been logged.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: '2rem',
              minHeight: '3rem',
              padding: '0 2rem',
              fontSize: '1rem',
              color: '#ffffff',
              background: '#6b4d5b',
              border: 'none',
              borderRadius: '10px',
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
          {error.digest ? (
            <p style={{ marginTop: '2rem', fontSize: '0.75rem', color: '#8a7f84' }}>
              Reference: {error.digest}
            </p>
          ) : null}
        </div>
      </body>
    </html>
  );
}
