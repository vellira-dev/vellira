import {
  readBrowserStorage,
  removeBrowserStorage,
  writeBrowserStorage,
} from '../utils/browserStorage';

export type SavedLoginMethod = 'email' | 'github' | 'google' | 'apple';
export type OAuthLoginMethod = Exclude<SavedLoginMethod, 'email'>;
export type SavedLoginPreference = {
  version: 2;
  email?: string;
  lastSuccessfulMethod?: SavedLoginMethod;
};
const STORAGE_KEY = 'vellira-auth-login-preference';
const PENDING_KEY = 'vellira-auth-remember-request';
const PENDING_TTL = 15 * 60 * 1000;
export function isOAuthLoginMethod(value: unknown): value is OAuthLoginMethod {
  return value === 'github' || value === 'google' || value === 'apple';
}
function isMethod(value: unknown): value is SavedLoginMethod {
  return value === 'email' || isOAuthLoginMethod(value);
}
function boundedEmail(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.length > 320) return;
  const email = value.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : undefined;
}
export function readSavedLoginPreference(): SavedLoginPreference | null {
  try {
    const raw = readBrowserStorage('localStorage', STORAGE_KEY);
    if (!raw || raw.length > 1024) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
      return null;
    const value = parsed as Record<string, unknown>;
    // Legacy provider values represented clicks, not proven authentication.
    // Retain an independently saved email, but never relabel those as success.
    if (value.version !== undefined && value.version !== 2) return null;
    const email = boundedEmail(value.email);
    const method =
      value.version === 2
        ? value.lastSuccessfulMethod
        : value.method === 'email'
          ? 'email'
          : undefined;
    const lastSuccessfulMethod = isMethod(method) ? method : undefined;
    if (!email && !lastSuccessfulMethod) return null;
    return {
      version: 2,
      ...(email ? { email } : {}),
      ...(lastSuccessfulMethod ? { lastSuccessfulMethod } : {}),
    };
  } catch {
    return null;
  }
}
export function saveLoginPreference(
  method: SavedLoginMethod,
  email?: string
): void {
  if (!isMethod(method)) return;
  const savedEmail = boundedEmail(email) ?? readSavedLoginPreference()?.email;
  const value: SavedLoginPreference = {
    version: 2,
    ...(savedEmail ? { email: savedEmail } : {}),
    lastSuccessfulMethod: method,
  };
  writeBrowserStorage('localStorage', STORAGE_KEY, JSON.stringify(value));
}
export function clearOAuthPreferenceIntent(): void {
  removeBrowserStorage('sessionStorage', PENDING_KEY);
}
export function clearLoginPreference(): void {
  removeBrowserStorage('localStorage', STORAGE_KEY);
  clearOAuthPreferenceIntent();
}
// Per-tab opt-in only: never a successful method, credential, state or token.
export function prepareOAuthPreference(rememberRequested: boolean): void {
  clearOAuthPreferenceIntent();
  if (!rememberRequested) {
    clearLoginPreference();
    return;
  }
  writeBrowserStorage(
    'sessionStorage',
    PENDING_KEY,
    JSON.stringify({ rememberRequested: true, requestedAt: Date.now() })
  );
}
// Call only after the normal /v1/me endpoint has confirmed an active session.
export function completeOAuthPreference(
  provider: OAuthLoginMethod | undefined
): void {
  const raw = readBrowserStorage('sessionStorage', PENDING_KEY);
  clearOAuthPreferenceIntent();
  if (!provider || !raw || raw.length > 128) return;
  try {
    const pending = JSON.parse(raw) as Record<string, unknown>;
    if (
      pending.rememberRequested === true &&
      typeof pending.requestedAt === 'number' &&
      Number.isFinite(pending.requestedAt) &&
      Date.now() >= pending.requestedAt &&
      Date.now() - pending.requestedAt <= PENDING_TTL
    )
      saveLoginPreference(provider);
  } catch {
    /* Storage is non-authoritative. */
  }
}
