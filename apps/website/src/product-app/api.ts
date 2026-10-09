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

  constructor(status: number, code: string) {
    super(code);
    this.name = 'VelliraApiError';
    this.status = status;
    this.code = code;
  }
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
    throw new VelliraApiError(response.status, await readErrorCode(response));
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

export async function getCsrfToken() {
  const response = await apiRequest<{ csrfToken: string }>('/v1/auth/csrf');
  return response.csrfToken;
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
