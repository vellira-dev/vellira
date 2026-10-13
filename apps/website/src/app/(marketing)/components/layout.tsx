import type { ReactNode } from 'react';

import {
  ComponentNavigationProvider,
  ComponentNavigationShell,
  ComponentsContentBoundary,
  ComponentsHeader,
} from '@/component-catalog';

interface ComponentsLayoutProps {
  children: ReactNode;
}

export default function ComponentsLayout({ children }: ComponentsLayoutProps) {
  return (
    <ComponentNavigationProvider>
      <ComponentsHeader />
      <ComponentNavigationShell mobileOnly />
      <ComponentsContentBoundary>{children}</ComponentsContentBoundary>
    </ComponentNavigationProvider>
  );
}
