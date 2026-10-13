'use client';

import type { ReactNode } from 'react';

import { ComponentExplorer } from '../ComponentExplorer';
import { useComponentNavigation } from '../ComponentNavigationProvider';

type ComponentsIndexExperienceProps = {
  children: ReactNode;
  footer: ReactNode;
};

// The public /components index keeps its existing landing-page layout.
// Only an explicit /app -> /components?from=app journey enters the
// already-shipped explorer sidebar; there is no second catalog or route.
export function ComponentsIndexExperience({
  children,
  footer,
}: ComponentsIndexExperienceProps) {
  const { fromWorkspace, workspaceContextRequested, workspaceSessionStatus } =
    useComponentNavigation();

  // Hold the final explorer geometry during the session check. The sidebar
  // lists public components only; Back to workspace is authorized separately.
  const pendingWorkspace =
    workspaceContextRequested && workspaceSessionStatus === 'loading';

  if (!fromWorkspace && !pendingWorkspace) {
    return (
      <>
        {children}
        {footer}
      </>
    );
  }

  return (
    <ComponentExplorer activeSlug='' indexMode footer={footer}>
      {children}
    </ComponentExplorer>
  );
}
