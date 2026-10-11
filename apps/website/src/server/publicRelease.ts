import { publishedPackageNames } from '../config/homepageProductFacts';

const VERSION_PATTERN = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/;
const REFRESH_MS = 15 * 60 * 1000;
const RETRY_MS = 60 * 1000;
const MAX_STALE_MS = 24 * 60 * 60 * 1000;

type VerifiedVersion = {
  version: string;
  verifiedAt: number;
};

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

async function readRegistryTag(
  packageName: string,
  fetchImpl: typeof fetch
): Promise<string> {
  const response = await fetchImpl(
    `https://registry.npmjs.org/-/package/${encodeURIComponent(packageName)}/dist-tags`,
    {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(8000),
    }
  );

  if (!response.ok) {
    throw new Error('npm registry lookup failed');
  }

  const data: unknown = await response.json();
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Invalid npm dist-tags response');
  }

  const version = (data as Record<string, unknown>).latest;
  if (
    typeof version !== 'string' ||
    !VERSION_PATTERN.test(version) ||
    version.length > 48
  ) {
    throw new Error('npm latest is not a stable release version');
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
  let nextCheckAt = 0;
  let pending: Promise<VerifiedVersion | null> | null = null;

  async function checkAllPackages(): Promise<VerifiedVersion | null> {
    try {
      const versions = await Promise.all(
        publishedPackageNames.map((name) => readRegistryTag(name, fetchImpl))
      );
      if (new Set(versions).size !== 1) {
        throw new Error('npm package dist-tags have not converged');
      }

      const verified: VerifiedVersion = {
        version: versions[0],
        verifiedAt: now(),
      };
      latest = verified;
      nextCheckAt = now() + refreshMs;
      return verified;
    } catch {
      // Never announce a partially published release. Retain only a
      // previously verified version, bounded by maxStaleMs.
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
