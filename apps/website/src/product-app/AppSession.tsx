'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';

import {
  bootstrapPersonalWorkspace,
  getMe,
  logout,
  VelliraApiError,
  type MeResponse,
  type Workspace,
} from './api';

type SessionStatus = 'loading' | 'ready' | 'error';

type AppSessionValue = {
  status: SessionStatus;
  me: MeResponse['user'] | null;
  workspace: Workspace | null;
  error: string | null;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AppSessionContext = createContext<AppSessionValue | null>(null);

function safeLoadError(error: unknown) {
  if (
    error instanceof VelliraApiError &&
    error.code === 'workspace_unavailable'
  ) {
    return 'Your workspace is temporarily unavailable. Please try again.';
  }

  if (error instanceof VelliraApiError && error.code === 'rate_limited') {
    return 'Too many requests. Please try again shortly.';
  }

  return 'Vellira could not load your account. Please try again.';
}

export function AppSessionProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [status, setStatus] = useState<SessionStatus>('loading');
  const [me, setMe] = useState<MeResponse['user'] | null>(null);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setStatus('loading');
    setError(null);

    try {
      const meResponse = await getMe();
      const workspaceResponse = await bootstrapPersonalWorkspace();

      setMe(meResponse.user);
      setWorkspace(workspaceResponse.workspace);
      setStatus('ready');
    } catch (cause) {
      if (cause instanceof VelliraApiError && cause.status === 401) {
        setMe(null);
        setWorkspace(null);
        router.replace('/login');
        return;
      }

      setError(safeLoadError(cause));
      setStatus('error');
    }
  }, [router]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const signOut = useCallback(async () => {
    try {
      await logout();
    } catch (cause) {
      if (!(cause instanceof VelliraApiError && cause.status === 401)) {
        setError(safeLoadError(cause));
        setStatus('error');
        return;
      }
    }

    setMe(null);
    setWorkspace(null);
    router.replace('/login');
  }, [router]);

  const value = useMemo(
    () => ({
      status,
      me,
      workspace,
      error,
      refresh,
      signOut,
    }),
    [error, me, refresh, signOut, status, workspace]
  );

  return (
    <AppSessionContext.Provider value={value}>
      {children}
    </AppSessionContext.Provider>
  );
}

export function useAppSession() {
  const value = useContext(AppSessionContext);

  if (!value) {
    throw new Error('useAppSession must be used inside AppSessionProvider.');
  }

  return value;
}
