import { isOAuthLoginMethod, type OAuthLoginMethod } from './authPreference';
import { connectionApiPath, type OAuthConnection } from './oauthConnection';

const DEFAULT_API_BASE_URL = 'https://api.vellira.dev';

export type MeResponse = {
  user: {
    id: string;
    status: string;
    emailVerified: boolean;
  };
};

export type Workspace = {
  id: string;
  name: string;
  status: 'active' | 'disabled';
  membership: {
    role: 'owner' | 'member';
  };
};

type WorkspaceResponse = {
  workspace: Workspace;
};

type WorkspacesResponse = {
  workspaces: Workspace[];
};

type ApiErrorEnvelope = {
  error?: {
    code?: unknown;
  };
};

export class VelliraApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly retryAfterSeconds?: number;

  constructor(status: number, code: string, retryAfterSeconds?: number) {
    super(code);
    this.name = 'VelliraApiError';
    this.status = status;
    this.code = code;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

function readRetryAfterSeconds(response: Response) {
  const value = response.headers.get('Retry-After')?.trim();
  if (!value) return undefined;

  if (/^\d+$/.test(value)) {
    const seconds = Number(value);
    return Number.isSafeInteger(seconds) ? Math.min(seconds, 3600) : undefined;
  }

  const at = Date.parse(value);
  if (!Number.isFinite(at)) return undefined;
  return Math.min(Math.max(0, Math.ceil((at - Date.now()) / 1000)), 3600);
}

export function getApiUrl(pathname: string) {
  const configured = process.env.NEXT_PUBLIC_VELLIRA_API_BASE_URL?.trim();
  return new URL(pathname, configured || DEFAULT_API_BASE_URL).toString();
}

async function readErrorCode(response: Response) {
  try {
    const payload = (await response.json()) as ApiErrorEnvelope;
    return typeof payload.error?.code === 'string'
      ? payload.error.code
      : 'request_failed';
  } catch {
    return 'request_failed';
  }
}

async function apiRequest<T>(pathname: string, init: RequestInit = {}) {
  const response = await fetch(getApiUrl(pathname), {
    ...init,
    credentials: 'include',
    cache: 'no-store',
    headers: new Headers(init.headers),
  });

  if (!response.ok) {
    throw new VelliraApiError(
      response.status,
      await readErrorCode(response),
      readRetryAfterSeconds(response)
    );
  }

  return (await response.json()) as T;
}

async function postJson<T>(pathname: string, body: unknown) {
  return apiRequest<T>(pathname, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export function login(email: string, password: string) {
  return postJson<{ authenticated: boolean }>('/v1/auth/login', {
    email,
    password,
  });
}

export function register(email: string, password: string) {
  return postJson<{ registered: boolean }>('/v1/auth/register', {
    email,
    password,
  });
}

export function requestVerification(email: string) {
  return postJson<{ accepted: boolean }>('/v1/auth/email/resend', { email });
}

export function verifyEmail(token: string) {
  return postJson<{ verified: boolean }>('/v1/auth/email/verify', { token });
}

export function requestPasswordReset(email: string) {
  return postJson<{ accepted: boolean }>('/v1/auth/password/forgot', { email });
}

export function resetPassword(token: string, newPassword: string) {
  return postJson<{ passwordReset: boolean }>('/v1/auth/password/reset', {
    token,
    newPassword,
  });
}

export function getMe() {
  return apiRequest<MeResponse>('/v1/me');
}

export function listWorkspaces() {
  return apiRequest<WorkspacesResponse>('/v1/workspaces');
}

export type AccountProfile = {
  fullName: string;
  displayName: string;
  locale: 'en' | 'fr';
  timeZone: string;
  revision: number;
};

export type AccountProfileChanges = Omit<AccountProfile, 'revision'>;

function readAccountProfile(payload: unknown): AccountProfile {
  if (!payload || typeof payload !== 'object' || !('profile' in payload)) {
    throw new Error('Invalid account profile response');
  }
  const value = payload.profile;
  if (!value || typeof value !== 'object' ||
    !('fullName' in value) || typeof value.fullName !== 'string' ||
    !('displayName' in value) || typeof value.displayName !== 'string' ||
    !('locale' in value) || (value.locale !== 'en' && value.locale !== 'fr') ||
    !('timeZone' in value) || typeof value.timeZone !== 'string' ||
    !('revision' in value) || !Number.isSafeInteger(value.revision) ||
    (value.revision as number) < 1) {
    throw new Error('Invalid account profile response');
  }
  return {
    fullName: value.fullName,
    displayName: value.displayName,
    locale: value.locale,
    timeZone: value.timeZone,
    revision: value.revision as number,
  };
}

// Profile is independent of auth identity, workspace and subscriptions.
// Reads are strictly read-only; no lazy bootstrap or optimistic local authority.
export async function getAccountProfile(signal?: AbortSignal): Promise<AccountProfile> {
  return readAccountProfile(await apiRequest<unknown>('/v1/profile', { signal }));
}

export async function saveAccountProfile(
  profile: AccountProfile
): Promise<AccountProfile> {
  const csrfToken = await getCsrfToken();
  return readAccountProfile(await apiRequest<unknown>('/v1/profile', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrfToken,
    },
    body: JSON.stringify(profile),
  }));
}

export type WorkspaceSubscription = {
  productKey: string;
  planKey: string;
  status: 'pending' | 'trialing' | 'active' | 'past_due' | 'paused' | 'ended';
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  scheduledEndAt: string | null;
  endedAt: string | null;
};

export type WorkspaceBillingResponse = {
  subscription: WorkspaceSubscription | null;
};

// A read-only, provider-neutral workspace billing view. The backend checks
// billing.read on every request; frontend role controls are presentation only.
export function getWorkspaceBilling(workspaceId: string) {
  return apiRequest<WorkspaceBillingResponse>(
    `/v1/workspaces/${encodeURIComponent(workspaceId)}/billing`
  );
}

export async function getCsrfToken() {
  const response = await apiRequest<{ csrfToken: string }>('/v1/auth/csrf');
  return response.csrfToken;
}

export async function resendCurrentVerification() {
  const csrfToken = await getCsrfToken();

  return apiRequest<{ accepted: boolean }>('/v1/auth/email/resend/current', {
    method: 'POST',
    headers: { 'X-CSRF-Token': csrfToken },
  });
}

export async function bootstrapPersonalWorkspace() {
  const csrfToken = await getCsrfToken();

  return apiRequest<WorkspaceResponse>('/v1/workspaces/bootstrap', {
    method: 'POST',
    headers: { 'X-CSRF-Token': csrfToken },
  });
}

export async function logout() {
  const csrfToken = await getCsrfToken();

  return apiRequest<{ loggedOut: boolean }>('/v1/auth/logout', {
    method: 'POST',
    headers: { 'X-CSRF-Token': csrfToken },
  });
}

export async function getOAuthConnection(connection: OAuthConnection) {
  const result = await apiRequest<{
    provider: string;
    readyToConnect: boolean;
  }>(connectionApiPath(connection));
  if (
    result.provider !== connection.provider ||
    typeof result.readyToConnect !== 'boolean'
  )
    throw new Error('Invalid connection response');
  return result;
}
export async function completeOAuthConnection(connection: OAuthConnection) {
  const csrfToken = await getCsrfToken();
  const result = await apiRequest<{ connected: boolean }>(
    connectionApiPath(connection),
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken,
      },
      body: '{}',
    }
  );
  if (result.connected !== true) throw new Error('Invalid connection response');
}

export type AuthProviderDiscovery = {
  providers: OAuthLoginMethod[];
  recoverInBrowser: boolean;
};

function parseAuthProviders(data: unknown): OAuthLoginMethod[] | null {
  if (
    !data ||
    typeof data !== 'object' ||
    !('providers' in data) ||
    !Array.isArray(data.providers) ||
    data.providers.length > 3 ||
    !data.providers.every(isOAuthLoginMethod)
  )
    return null;

  const configured = new Set(data.providers);
  return (['google', 'apple', 'github'] as const).filter((provider) =>
    configured.has(provider)
  );
}

// Server-rendered availability is presentation only. No user cookies or secrets
// are forwarded. A valid empty list is authoritative; only a failed/invalid
// server discovery may request one bounded browser retry of the same endpoint.
export async function getAuthProviderDiscovery(): Promise<AuthProviderDiscovery> {
  try {
    const response = await fetch(getApiUrl('/v1/auth/providers'), {
      cache: 'no-store',
      credentials: 'omit',
      redirect: 'error',
      signal: AbortSignal.timeout(1500),
    });
    if (!response.ok) return { providers: [], recoverInBrowser: true };

    const text = await response.text();
    if (text.length > 1024) return { providers: [], recoverInBrowser: true };

    const providers = parseAuthProviders(JSON.parse(text));
    if (!providers) return { providers: [], recoverInBrowser: true };

    return { providers, recoverInBrowser: false };
  } catch {
    return { providers: [], recoverInBrowser: true };
  }
}

export async function getAuthProviders(): Promise<OAuthLoginMethod[]> {
  return (await getAuthProviderDiscovery()).providers;
}
