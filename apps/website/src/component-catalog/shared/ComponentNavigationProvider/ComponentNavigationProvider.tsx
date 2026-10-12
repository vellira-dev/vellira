'use client';

import { usePathname } from 'next/navigation';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

type ComponentNavigationContextValue = {
  open: boolean;
  mainOpen: boolean;
  // Navigation context only, never identity or entitlement authority.
  fromWorkspace: boolean;
  workspaceContextRequested: boolean;
  setWorkspaceSessionReady: (ready: boolean) => void;

  openNavigation: () => void;
  closeNavigation: () => void;
  toggleNavigation: () => void;

  openMainNavigation: () => void;
  closeMainNavigation: () => void;

  switchToMainNavigation: () => void;
  setMainNavigationOpen: (open: boolean) => void;
};

const ComponentNavigationContext =
  createContext<ComponentNavigationContextValue | null>(null);

type ComponentNavigationProviderProps = {
  children: ReactNode;
};

export function ComponentNavigationProvider({
  children,
}: ComponentNavigationProviderProps) {
  const pathname = usePathname();
  const previousPathname = useRef(pathname);
  const [open, setOpen] = useState(false);
  const [mainOpen, setMainOpen] = useState(false);
  const [workspaceContextRequested, setWorkspaceContextRequested] =
    useState(false);
  const [workspaceSessionReady, setWorkspaceSessionReady] = useState(false);
  // Query parameters request a layout; only the canonical session can grant it.
  const fromWorkspace = workspaceContextRequested && workspaceSessionReady;

  // A public catalog deep link remains standalone unless a user deliberately
  // entered via /components?from=app. Preserve that context across sibling
  // component routes without storing any account/session data.
  useEffect(() => {
    // Route navigation away from ?from=app must restore the public catalog.
    // Do not persist account-only presentation on subsequent ordinary links.
    const requested =
      new URLSearchParams(window.location.search).get('from') === 'app';
    setWorkspaceContextRequested(requested);
    if (!requested) setWorkspaceSessionReady(false);
  }, [pathname]);

  useEffect(() => {
    if (previousPathname.current === pathname) {
      return;
    }

    previousPathname.current = pathname;
    setOpen(false);
    setMainOpen(false);
  }, [pathname]);

  const setMainNavigationOpen = useCallback((nextOpen: boolean) => {
    setOpen(false);
    setMainOpen(nextOpen);
  }, []);

  const openNavigation = useCallback(() => {
    setMainOpen(false);
    setOpen(true);
  }, []);

  const closeNavigation = useCallback(() => {
    setOpen(false);
  }, []);

  const toggleNavigation = useCallback(() => {
    setMainOpen(false);
    setOpen((current) => !current);
  }, []);

  const openMainNavigation = useCallback(() => {
    setOpen(false);
    setMainOpen(true);
  }, []);

  const closeMainNavigation = useCallback(() => {
    setMainOpen(false);
  }, []);

  const switchToMainNavigation = useCallback(() => {
    setOpen(false);
    setMainOpen(true);
  }, []);

  const value = useMemo(
    () => ({
      open,
      mainOpen,
      fromWorkspace,
      workspaceContextRequested,
      setWorkspaceSessionReady,

      openNavigation,
      closeNavigation,
      toggleNavigation,

      openMainNavigation,
      closeMainNavigation,

      switchToMainNavigation,
      setMainNavigationOpen,
    }),
    [
      closeMainNavigation,
      closeNavigation,
      mainOpen,
      fromWorkspace,
      workspaceContextRequested,
      open,
      openMainNavigation,
      openNavigation,
      switchToMainNavigation,
      setMainNavigationOpen,
      toggleNavigation,
    ]
  );

  return (
    <ComponentNavigationContext.Provider value={value}>
      {children}
    </ComponentNavigationContext.Provider>
  );
}

export function useComponentNavigation() {
  const context = useContext(ComponentNavigationContext);

  if (!context) {
    throw new Error(
      'useComponentNavigation must be used within ComponentNavigationProvider'
    );
  }

  return context;
}
