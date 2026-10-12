import type { ReactNode } from 'react';

import { ComponentsAccountBoundary } from '@/component-catalog/shared/ComponentsAccountBoundary/ComponentsAccountBoundary';

import {
  ComponentNavigationProvider,
  ComponentNavigationShell,
  ComponentsHeader,
} from '@/component-catalog';

interface ComponentsLayoutProps {
  children: ReactNode;
}

export default function ComponentsLayout({ children }: ComponentsLayoutProps) {
  return (
    <ComponentNavigationProvider>
      <ComponentsAccountBoundary>
        <ComponentsHeader />
        <ComponentNavigationShell mobileOnly />
      </ComponentsAccountBoundary>
      {children}
    </ComponentNavigationProvider>
  );
}
