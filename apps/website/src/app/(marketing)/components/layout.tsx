import type { ReactNode } from 'react';

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
      <ComponentsHeader />
      <ComponentNavigationShell mobileOnly />
      {children}
    </ComponentNavigationProvider>
  );
}
