'use client';

import type { ReactNode } from 'react';

import { AppSessionProvider } from '@/product-app/AppSession';

import { useComponentNavigation } from '../ComponentNavigationProvider';

/** Share a single read-only account session between the product header and
 * mobile Components navigation, without requiring sign-in for public catalog
 * visitors or bootstrapping workspace data.
 */
export function ComponentsAccountBoundary({
  children,
}: {
  children: ReactNode;
}) {
  const { fromWorkspace } = useComponentNavigation();

  if (!fromWorkspace) return <>{children}</>;

  return (
    <AppSessionProvider
      redirectOnUnauthorized={false}
      bootstrapIfMissing={false}
    >
      {children}
    </AppSessionProvider>
  );
}
