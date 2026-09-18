import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { buildBlogIndexMetadata } from '@/blog/seo';
import { SiteFooter } from '@/components/layout/SiteFooter';

interface BlogLayoutProps {
  children: ReactNode;
}

export const metadata: Metadata = buildBlogIndexMetadata();

export default function BlogLayout({ children }: BlogLayoutProps) {
  return (
    <>
      {children}
      <SiteFooter startSurface='canvas' />
    </>
  );
}
