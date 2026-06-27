import type { Metadata } from 'next';
import { Fraunces, IBM_Plex_Mono, Inter } from 'next/font/google';
import './globals.css';
import { QueryProvider } from '@/providers/query-provider';
import { SiteHeader } from '@/components/layout/header';
import { SiteFooter } from '@/components/layout/footer';

const fontDisplay = Fraunces({ subsets: ['latin'], variable: '--font-display', weight: ['600', '700'] });
const fontSans = Inter({ subsets: ['latin'], variable: '--font-sans' });
const fontMono = IBM_Plex_Mono({ subsets: ['latin'], variable: '--font-mono', weight: ['500', '600'] });

export const metadata: Metadata = {
  title: {
    default: 'Jwel — Everyday shine, zero rules.',
    template: '%s | Jwel',
  },
  description:
    'Jwel is a luxury jewellery storefront for hoops, chains, stacking rings and statement pieces — designed to layer, mix and wear on repeat.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
  openGraph: {
    type: 'website',
    siteName: 'Jwel',
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fontDisplay.variable} ${fontSans.variable} ${fontMono.variable}`}>
      <body className="flex min-h-screen flex-col">
        <a href="#main-content" className="skip-link">
          Skip to content
        </a>
        <QueryProvider>
          <SiteHeader />
          <main id="main-content" className="flex-1">
            {children}
          </main>
          <SiteFooter />
        </QueryProvider>
      </body>
    </html>
  );
}
