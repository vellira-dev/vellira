'use client';

import type { ReactNode } from 'react';

import { useComponentNavigation } from '../ComponentNavigationProvider';

// display: contents keeps the public/explorer layout and scroll geometry
// unchanged while the actual page becomes inert behind either mobile drawer.
export function ComponentsContentBoundary({
  children,
}: {
  children: ReactNode;
}) {
  const { open, mainOpen } = useComponentNavigation();

  return (
    <div
      data-components-content-boundary
      inert={open || mainOpen}
      style={{ display: 'contents' }}
    >
      {children}
    </div>
  );
}
