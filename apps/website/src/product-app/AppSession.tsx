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
  listWorkspaces,
  logout,
  VelliraApiError,
  type MeResponse,
  type Workspace,
} from './api';

type SessionStatus = 'loading' | 'ready' | 'error' | 'unauthenticated';

type AppSessionValue = {
  status: SessionStatus;
  me: MeResponse['user'] | null;
  workspace: Workspace | null;
  error: string | null;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AppSessionContext = createContext<AppSessionValue | null>(null);

// Local UI review only. Never enabled in a production build, regardless of
// public environment configuration. This does not authenticate API requests.
export const localAccountPreview =
  process.env.NODE_ENV === 'development' &&
  process.env.NEXT_PUBLIC_VELLIRA_LOCAL_PREVIEW === '1';

// A separate development-only fixture exercises the real unverified UI.
// It grants no session, sends no email and cannot be enabled in production.
const previewEmailUnverified =
  localAccountPreview &&
  process.env.NEXT_PUBLIC_VELLIRA_LOCAL_PREVIEW_EMAIL_UNVERIFIED === '1';

const previewUser: MeResponse['user'] = {
  id: 'local-preview-user',
  status: 'active',
  emailVerified: !previewEmailUnverified,
};

const previewWorkspace: Workspace = {
  id: 'local-preview-workspace',
  name: 'Preview workspace',
  status: 'active',
  membership: { role: 'owner' },
};

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

  if (error instanceof VelliraApiError && error.code === 'account_disabled') {
    return 'This Vellira account is disabled.';
  }

  return 'Vellira could not load your account. Please try again.';
}

export function AppSessionProvider({
  children,
  redirectOnUnauthorized = true,
  bootstrapIfMissing = true,
}: {
  children: ReactNode;
  redirectOnUnauthorized?: boolean;
  bootstrapIfMissing?: boolean;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<SessionStatus>('loading');
  const [me, setMe] = useState<MeResponse['user'] | null>(null);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (localAccountPreview) {
      setMe(previewUser);
      setWorkspace(previewWorkspace);
      setError(null);
      setStatus('ready');
      return;
    }

    setStatus('loading');
    setError(null);

    try {
      const meResponse = await getMe();

      const workspaceList = await listWorkspaces();
      const workspace =
        workspaceList.workspaces[0] ??
        (bootstrapIfMissing
          ? (await bootstrapPersonalWorkspace()).workspace
          : null);

      setMe(meResponse.user);
      setWorkspace(workspace);
      setStatus('ready');
    } catch (cause) {
      if (cause instanceof VelliraApiError && cause.status === 401) {
        setMe(null);
        setWorkspace(null);
        if (redirectOnUnauthorized) {
          router.replace('/login');
        } else {
          // Public catalog routes remain available without a user session.
          setStatus('unauthenticated');
        }
        return;
      }

      setError(safeLoadError(cause));
      setStatus('error');
    }
  }, [bootstrapIfMissing, redirectOnUnauthorized, router]);

  useEffect(() => {
    void refresh();
  }, [refresh]);
  // Reconcile just GET /v1/me when returning from the verification link in
  // another tab. This is a read-only refresh, not a second auth/session store
  // and never triggers a personal-workspace bootstrap or CSRF mutation.
  useEffect(() => {
    if (localAccountPreview || status !== 'ready' || !me || me.emailVerified) {
      return;
    }

    let active = true;
    let inFlight = false;

    const recheck = async () => {
      if (!active || inFlight || document.visibilityState !== 'visible') {
        return;
      }
      inFlight = true;
      try {
        const response = await getMe();
        if (!active) return;
        if (response.user.id !== me.id) {
          void refresh();
          return;
        }
        // Only the canonical API can turn the warning into Verified.
        setMe((previous) =>
          previous?.id === response.user.id ? response.user : previous
        );
      } catch (cause) {
        if (
          active &&
          cause instanceof VelliraApiError &&
          cause.status === 401
        ) {
          void refresh();
        }
        // Transient failures preserve the unverified warning; they never
        // optimistically mark an email as verified.
      } finally {
        inFlight = false;
      }
    };

    const onVisible = () => {
      if (document.visibilityState === 'visible') void recheck();
    };
    const onFocus = () => void recheck();

    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onFocus);
    return () => {
      active = false;
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onFocus);
    };
  }, [me, refresh, status]);


  const signOut = useCallback(async () => {
    if (localAccountPreview) {
      router.replace('/login');
      return;
    }

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
