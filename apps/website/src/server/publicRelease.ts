import { publishedPackageNames } from '../config/homepageProductFacts';

const VERSION_PATTERN = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/;
const REFRESH_MS = 15 * 60 * 1000;
const RETRY_MS = 60 * 1000;
const MAX_STALE_MS = 24 * 60 * 60 * 1000;

type VerifiedVersion = {
  version: string;
  verifiedAt: number;
};

type PublicReleaseFailureReason =
  | 'registry_unavailable'
  | 'registry_metadata_invalid'
  | 'packages_not_converged';

class PublicReleaseCheckError extends Error {
  constructor(
    readonly reason: PublicReleaseFailureReason,
    readonly upstream: string | null = null,
    readonly packageName: string | null = null
  ) {
    super(reason);
  }
}

// Only bounded, credential-free classifications may be shown in public
// response headers. Never echo an upstream body or arbitrary exception text.
function fetchFailureCode(error: unknown): string {
  if (!(error instanceof Error)) return 'fetch_other_error';
  if (error.name === 'TimeoutError' || error.name === 'AbortError') {
    return 'fetch_timeout';
  }
  if (/cache.*(?:not implemented|unsupported)/i.test(error.message)) {
    return 'fetch_cache_option';
  }
  if (/signal.*(?:unsupported|not implemented)/i.test(error.message)) {
    return 'fetch_signal_option';
  }
  if (/subrequest.*(?:limit|exceeded|blocked)/i.test(error.message)) {
    return 'fetch_subrequest_rejected';
  }
  return error.name === 'TypeError' ? 'fetch_type_error' : 'fetch_other_error';
}

type PublicReleaseHandlerOptions = {
  fetchImpl?: typeof fetch;
  now?: () => number;
  refreshMs?: number;
  retryMs?: number;
  maxStaleMs?: number;
};

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'X-Content-Type-Options': 'nosniff',
};

// Public package metadata is readable without npm credentials. The
// /-/package/:name/dist-tags management endpoint can require authentication
// for scoped packages even when the package is public. Keep the same latest
// dist-tag authority through the public abbreviated packument instead.
async function readRegistryTag(
  packageName: string,
  fetchImpl: typeof fetch
): Promise<string> {
  const escapedName = encodeURIComponent(packageName).replace(/^%40/, '@');
  let response: Response;
  try {
    response = await fetchImpl(`https://registry.npmjs.org/${escapedName}`, {
      method: 'GET',
      headers: {
        Accept:
          'application/vnd.npm.install-v1+json; q=1.0, application/json; q=0.8',
      },
      cache: 'no-store',
      // workerd does not implement redirect: 'error'. Manual + explicit
      // rejection below preserves the no-redirect security boundary.
      redirect: 'manual',
      signal: AbortSignal.timeout(8000),
    });
  } catch (error) {
    throw new PublicReleaseCheckError(
      'registry_unavailable',
      fetchFailureCode(error),
      packageName
    );
  }

  // Never follow npm redirects or trust data from a different origin. In
  // workerd, manual is the supported replacement for redirect: 'error'.
  if ((response.status >= 300 && response.status < 400) || response.redirected) {
    throw new PublicReleaseCheckError(
      'registry_unavailable',
      'redirect_rejected',
      packageName
    );
  }

  if (!response.ok) {
    const status = response.status;
    const upstream =
      Number.isSafeInteger(status) && status >= 400 && status <= 599
        ? `http_${status}`
        : 'http_other';
    throw new PublicReleaseCheckError(
      'registry_unavailable',
      upstream,
      packageName
    );
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new PublicReleaseCheckError('registry_metadata_invalid');
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new PublicReleaseCheckError('registry_metadata_invalid');
  }

  const metadata = data as Record<string, unknown>;
  const tags = metadata['dist-tags'];
  const versions = metadata.versions;
  if (
    metadata.name !== packageName ||
    !tags ||
    typeof tags !== 'object' ||
    Array.isArray(tags) ||
    !versions ||
    typeof versions !== 'object' ||
    Array.isArray(versions)
  ) {
    throw new PublicReleaseCheckError('registry_metadata_invalid');
  }

  const version = (tags as Record<string, unknown>).latest;
  if (
    typeof version !== 'string' ||
    !VERSION_PATTERN.test(version) ||
    version.length > 48 ||
    !Object.hasOwn(versions, version)
  ) {
    throw new PublicReleaseCheckError('registry_metadata_invalid');
  }

  return version;
}

export function createPublicReleaseHandler({
  fetchImpl = fetch,
  now = Date.now,
  refreshMs = REFRESH_MS,
  retryMs = RETRY_MS,
  maxStaleMs = MAX_STALE_MS,
}: PublicReleaseHandlerOptions = {}) {
  let latest: VerifiedVersion | null = null;
  let lastFailureReason: PublicReleaseFailureReason = 'registry_unavailable';
  let lastUpstream: string | null = null;
  let lastUpstreamPackage: string | null = null;
  let nextCheckAt = 0;
  let pending: Promise<VerifiedVersion | null> | null = null;

  async function checkAllPackages(): Promise<VerifiedVersion | null> {
    try {
      const versions = await Promise.all(
        publishedPackageNames.map((name) => readRegistryTag(name, fetchImpl))
      );
      if (new Set(versions).size !== 1) {
        throw new PublicReleaseCheckError('packages_not_converged');
      }

      const verified: VerifiedVersion = {
        version: versions[0],
        verifiedAt: now(),
      };
      latest = verified;
      nextCheckAt = now() + refreshMs;
      return verified;
    } catch (error) {
      // Only expected npm verification failures may produce the documented
      // auxiliary 503. A programming error must remain fatal to browser gates.
      if (!(error instanceof PublicReleaseCheckError)) throw error;
      lastFailureReason = error.reason;
      lastUpstream = error.upstream;
      lastUpstreamPackage = error.packageName;
      nextCheckAt = now() + retryMs;
      return null;
    }
  }

  return async function GET(): Promise<Response> {
    if (now() >= nextCheckAt && pending === null) {
      pending = checkAllPackages().finally(() => {
        pending = null;
      });
    }

    if (pending) {
      await pending;
    }

    if (!latest || now() - latest.verifiedAt > maxStaleMs) {
      return Response.json(
        { error: 'published_release_unavailable' },
        {
          status: 503,
          headers: {
            ...headers,
            'Cache-Control': 'no-store',
            'Retry-After': String(
              Math.max(1, Math.ceil((nextCheckAt - now()) / 1000))
            ),
            'X-Vellira-Public-Release-State': 'unavailable',
            'X-Vellira-Public-Release-Reason': lastFailureReason,
            ...(lastUpstream
              ? { 'X-Vellira-Public-Release-Upstream': lastUpstream }
              : {}),
            ...(lastUpstreamPackage
              ? {
                  'X-Vellira-Public-Release-Upstream-Package':
                    lastUpstreamPackage,
                }
              : {}),
          },
        }
      );
    }

    const stale = now() - latest.verifiedAt >= refreshMs;
    return Response.json(
      {
        schemaVersion: 1,
        source: 'npm-dist-tags',
        version: latest.version,
        packages: [...publishedPackageNames],
        verifiedAt: new Date(latest.verifiedAt).toISOString(),
        stale,
      },
      {
        headers: {
          ...headers,
          'Cache-Control': stale
            ? 'public, max-age=60, s-maxage=60'
            : 'public, max-age=60, s-maxage=300',
        },
      }
    );
  };
}
