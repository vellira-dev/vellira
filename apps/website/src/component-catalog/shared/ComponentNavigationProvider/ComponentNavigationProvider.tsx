'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import {
  Suspense,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

type WorkspaceSessionStatus = 'loading' | 'ready' | 'unauthenticated' | 'error';

type ComponentNavigationContextValue = {
  open: boolean;
  mainOpen: boolean;
  // Navigation context only, never identity or entitlement authority.
  fromWorkspace: boolean;
  workspaceContextRequested: boolean;
  workspaceSessionStatus: WorkspaceSessionStatus;
  setWorkspaceSessionStatus: (status: WorkspaceSessionStatus) => void;

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

// The URL reader is intentionally the only component behind Suspense:
// the public component catalog must retain its server-rendered HTML.
function WorkspaceContextUrlObserver({
  onChange,
}: {
  onChange: (requested: boolean) => void;
}) {
  const searchParams = useSearchParams();
  const requested = searchParams?.get('from') === 'app';

  // Reconcile the visual route context before the next browser paint.
  // The canonical session, never the URL, still grants workspace controls.
  useLayoutEffect(() => {
    onChange(requested);
  }, [onChange, requested]);

  return null;
}

export function ComponentNavigationProvider({
  children,
}: ComponentNavigationProviderProps) {
  const pathname = usePathname();
  const previousPathname = useRef(pathname);
  const previousWorkspaceContextRequested = useRef<boolean | null>(null);
  const [open, setOpen] = useState(false);
  const [mainOpen, setMainOpen] = useState(false);
  const [workspaceContextRequested, setWorkspaceContextRequested] =
    useState(false);
  const [workspaceSessionStatus, setWorkspaceSessionStatus] =
    useState<WorkspaceSessionStatus>('loading');
  // Query parameters request a layout; only the canonical session can grant it.
  const fromWorkspace =
    workspaceContextRequested && workspaceSessionStatus === 'ready';

  // Query-only navigation and browser history must invalidate layout context
  // just like a pathname change. This is never an authentication decision.
  const syncWorkspaceContext = useCallback((requested: boolean) => {
    const previous = previousWorkspaceContextRequested.current;
    if (previous === requested) return;
    previousWorkspaceContextRequested.current = requested;
    setWorkspaceContextRequested(requested);

    // Initial URL reconciliation must not undo a just-opened public drawer.
    // Only an actual query-only context change dismisses existing menus.
    if (previous !== null) {
      setOpen(false);
      setMainOpen(false);
    }
    // Never inherit the previous URL context's authorization.
    setWorkspaceSessionStatus('loading');
  }, []);

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
      workspaceSessionStatus,
      setWorkspaceSessionStatus,

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
      workspaceSessionStatus,
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
      <Suspense fallback={null}>
        <WorkspaceContextUrlObserver onChange={syncWorkspaceContext} />
      </Suspense>
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
