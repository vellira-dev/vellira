import type { Metadata } from 'next';
import { SiteFooter } from '@/components/layout/SiteFooter';

import {
  COMPONENTS_INDEX_META_DESCRIPTION,
  ComponentsCatalog,
  ComponentsPageHero,
} from '@/component-catalog';

export const metadata: Metadata = {
  title: 'React Components',
  description: COMPONENTS_INDEX_META_DESCRIPTION,
  alternates: {
    canonical: '/components',
  },
  openGraph: {
    title: 'React Components | Vellira',
    description: COMPONENTS_INDEX_META_DESCRIPTION,
    url: '/components',
  },
};

export default function ComponentsPage() {
  return (
    <>
      <ComponentsPageHero />
      <ComponentsCatalog />
      <SiteFooter startSurface='canvas' />
    </>
  );
}
