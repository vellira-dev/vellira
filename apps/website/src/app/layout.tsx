import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Analytics } from '@vercel/analytics/next';
import { JsonLd } from '@/components/seo/JsonLd';

import '@vellira-ui/assets/styles';
import '@vellira-ui/react/styles';

import { WebsiteProviders } from '@/providers/WebsiteProviders';

import '../styles/globals.css';

const siteTitle = 'Vellira — React & React Native Design System';

const siteDescription =
  'Accessible React and React Native design system with shared tokens, theming, TypeScript APIs, and Storybook.';

export const metadata: Metadata = {
  metadataBase: new URL('https://vellira.dev'),
  title: {
    default: siteTitle,
    template: '%s | Vellira',
  },
  description: siteDescription,
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: siteTitle,
    description: siteDescription,
    url: '/',
    siteName: 'Vellira',
    images: [
      {
        url: '/brand/social/vellira-og-code-to-ui.png',
        width: 1200,
        height: 630,
        alt: 'Vellira React and React Native design system',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: siteTitle,
    description: siteDescription,
    images: ['/brand/social/vellira-og-code-to-ui.png'],
  },

  manifest: '/manifest.webmanifest',

  icons: {
    icon: [
      { url: '/brand/icons/favicon.svg', type: 'image/svg+xml' },
      { url: '/brand/icons/favicon.ico' },
      { url: '/brand/icons/favicon-32x32.png', sizes: '32x32' },
      { url: '/brand/icons/favicon-16x16.png', sizes: '16x16' },
    ],

    apple: '/brand/app-icons/vellira-apple-touch-icon.png',
  },
};

interface RootLayoutProps {
  children: ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  const isVercelRuntime = process.env.VERCEL === '1';

  return (
    <html lang='en' data-scroll-behavior='smooth' suppressHydrationWarning>
      <body>
        <JsonLd />
        <WebsiteProviders>{children}</WebsiteProviders>
        {isVercelRuntime ? <Analytics /> : null}
      </body>
    </html>
  );
}
