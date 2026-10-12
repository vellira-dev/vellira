'use client';

import { SiteHeader } from '@/components/layout/SiteHeader';
import { AppHeader } from '@/product-app/AppHeader';
import { AppSessionProvider, useAppSession } from '@/product-app/AppSession';

import { ComponentNavigationTrigger } from '../ComponentNavigationTrigger';
import { useComponentNavigation } from '../ComponentNavigationProvider';

// The catalog stays public; only a workspace-origin visit shares the
// authenticated product header. No second session or account authority.
function WorkspaceComponentsHeader() {
  const { status } = useAppSession();
  const { mainOpen, setMainNavigationOpen } = useComponentNavigation();

  if (status === 'unauthenticated' || status === 'error') {
    return (
      <SiteHeader
        variant='portal'
        mobileAction={<ComponentNavigationTrigger />}
        mobileMenuOpen={mainOpen}
        onMobileMenuOpenChange={setMainNavigationOpen}
      />
    );
  }

  return <AppHeader mobileAction={<ComponentNavigationTrigger />} />;
}

export function ComponentsHeader() {
  const { fromWorkspace, mainOpen, setMainNavigationOpen } =
    useComponentNavigation();

  if (fromWorkspace) {
    return (
      <AppSessionProvider
        redirectOnUnauthorized={false}
        bootstrapIfMissing={false}
      >
        <WorkspaceComponentsHeader />
      </AppSessionProvider>
    );
  }

  return (
    <SiteHeader
      variant='portal'
      mobileAction={<ComponentNavigationTrigger />}
      mobileMenuOpen={mainOpen}
      onMobileMenuOpenChange={setMainNavigationOpen}
    />
  );
}
