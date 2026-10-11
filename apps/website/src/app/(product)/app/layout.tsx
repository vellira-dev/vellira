import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { AppShell } from '@/product-app/AppShell';

export const metadata: Metadata = {
  title: 'Vellira App',
  robots: { index: false, follow: false },
};

export default function VelliraAppLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <AppShell>{children}</AppShell>;
}
