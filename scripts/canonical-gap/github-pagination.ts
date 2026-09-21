import { CanonicalGapError } from './types';

export function trustedGitHubNextPagePath(
  link: string | null,
  apiBaseUrl: string
): string | null {
  if (!link) return null;
  const match = link.match(/<([^>]+)>;\s*rel="next"/);
  if (!match?.[1]) return null;

  const base = new URL(apiBaseUrl);
  const next = new URL(match[1]);
  if (next.origin !== base.origin || !next.pathname.startsWith(base.pathname)) {
    throw new CanonicalGapError(
      'GitHub pagination returned an unsafe next URL.'
    );
  }
  return `${next.pathname}${next.search}`;
}
