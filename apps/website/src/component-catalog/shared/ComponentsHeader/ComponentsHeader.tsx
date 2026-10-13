'use client';

import { useCallback, useLayoutEffect } from 'react';

import { SiteHeader } from '@/components/layout/SiteHeader';
import { AppHeader } from '@/product-app/AppHeader';
import { AppWorkspaceMobileMenu } from '@/product-app/AppShell';
import { AppSessionProvider, useAppSession } from '@/product-app/AppSession';

import { ComponentNavigationTrigger } from '../ComponentNavigationTrigger';
import { useComponentNavigation } from '../ComponentNavigationProvider';

// The catalog stays public; only a workspace-origin visit shares the
// authenticated product header. No second session or account authority.
function WorkspaceComponentsHeader() {
  const { status } = useAppSession();
  const {
    mainOpen,
    setMainNavigationOpen,
    openNavigation,
    setWorkspaceSessionStatus,
  } = useComponentNavigation();

  // Update catalog geometry together with the canonical session's header.
  useLayoutEffect(() => {
    setWorkspaceSessionStatus(status);
    return () => setWorkspaceSessionStatus('loading');
  }, [status, setWorkspaceSessionStatus]);
  const closeWorkspaceNavigation = useCallback(
    () => setMainNavigationOpen(false),
    [setMainNavigationOpen]
  );

  // Do not flash the public navigation while verifying a workspace visit.
  // A definitive denial or error still returns to the ordinary public site.
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

  return (
    <>
      <AppHeader mobileAction={<ComponentNavigationTrigger />} />
      {status === 'ready' && (
        <AppWorkspaceMobileMenu
          open={mainOpen}
          onClose={closeWorkspaceNavigation}
          onComponentsSwitch={openNavigation}
        />
      )}
    </>
  );
}

export function ComponentsHeader() {
  const { workspaceContextRequested, mainOpen, setMainNavigationOpen } =
    useComponentNavigation();

  if (workspaceContextRequested) {
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
