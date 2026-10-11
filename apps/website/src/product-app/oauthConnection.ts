import { isOAuthLoginMethod, type OAuthLoginMethod } from './authPreference';

// Public navigation locator only. The API requires its HttpOnly browser binding
// and a fresh ordinary Vellira session before explicit CSRF-protected completion.
export type OAuthConnection = { id: string; provider: OAuthLoginMethod };
export function isOAuthConnection(value: unknown): value is OAuthConnection {
  if (!value || typeof value !== 'object') return false;
  const link = value as Record<string, unknown>;
  return (
    typeof link.id === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(
      link.id
    ) &&
    isOAuthLoginMethod(link.provider)
  );
}
export function readOAuthConnection(
  params: URLSearchParams
): OAuthConnection | undefined {
  if (
    params.getAll('link').length !== 1 ||
    params.getAll('link_provider').length !== 1
  )
    return;
  const connection = {
    id: params.get('link'),
    provider: params.get('link_provider'),
  };
  return isOAuthConnection(connection) ? connection : undefined;
}
export function connectionQuery(connection: OAuthConnection): string {
  if (!isOAuthConnection(connection))
    throw new Error('Invalid connection locator');
  return new URLSearchParams({
    link: connection.id,
    link_provider: connection.provider,
  }).toString();
}
export function connectionHref(connection: OAuthConnection): string {
  return '/auth/connect?' + connectionQuery(connection);
}
export function connectionApiPath(connection: OAuthConnection): string {
  if (!isOAuthConnection(connection))
    throw new Error('Invalid connection locator');
  return `/v1/auth/oauth/${connection.provider}/link/${connection.id}`;
}
export function oauthProviderName(provider: OAuthLoginMethod): string {
  return { github: 'GitHub', google: 'Google', apple: 'Apple' }[provider];
}
