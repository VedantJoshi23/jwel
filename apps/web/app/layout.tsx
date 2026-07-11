import type { Metadata } from 'next';
import { Fraunces, IBM_Plex_Mono, Inter } from 'next/font/google';
import { Toaster } from 'sonner';
import './globals.css';
import { QueryProvider } from '@/providers/query-provider';
import { SiteChrome } from '@/components/layout/site-chrome';
import { brand } from '@/lib/brand';

// To swap fonts for a white-label: change these three Google Font imports
// and update --font-display / --font-sans / --font-mono in globals.css.
const fontDisplay = Fraunces({ subsets: ['latin'], variable: '--font-display', weight: ['600', '700'] });
const fontSans = Inter({ subsets: ['latin'], variable: '--font-sans' });
const fontMono = IBM_Plex_Mono({ subsets: ['latin'], variable: '--font-mono', weight: ['500', '600'] });

export const metadata: Metadata = {
  title: {
    default: brand.seo.defaultTitle,
    template: brand.seo.titleTemplate,
  },
  description: brand.seo.defaultDescription,
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
  openGraph: {
    type: 'website',
    siteName: brand.seo.siteName,
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fontDisplay.variable} ${fontSans.variable} ${fontMono.variable}`}>
      {/* suppressHydrationWarning: browser extensions (e.g. Grammarly) inject
          data-gr-* attributes onto <body> before React hydrates, which is a
          client-only DOM mutation React can't and shouldn't try to reconcile. */}
      <body className="flex min-h-screen flex-col" suppressHydrationWarning>
        <a href="#main-content" className="skip-link">
          Skip to content
        </a>
        <QueryProvider>
          <SiteChrome>{children}</SiteChrome>
        </QueryProvider>
        <Toaster position="top-center" richColors closeButton />
      </body>
    </html>
  );
}
