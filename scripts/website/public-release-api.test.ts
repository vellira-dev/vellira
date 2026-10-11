import { describe, expect, it } from 'vitest';

import { publishedPackageNames } from '../../apps/website/src/config/homepageProductFacts';
import { createPublicReleaseHandler } from '../../apps/website/src/server/publicRelease';

const START = Date.UTC(2026, 9, 11, 12);
const FIFTEEN_MINUTES = 15 * 60 * 1000;
const ONE_DAY = 24 * 60 * 60 * 1000;

function registryFixture() {
  let currentTime = START;
  let offline = false;
  let calls = 0;
  const versions = new Map<string, string>(
    publishedPackageNames.map((name) => [name, '2.139.0'])
  );

  const fetchImpl = (async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    expect(url.origin).toBe('https://registry.npmjs.org');
    expect(url.pathname.startsWith('/-/package/')).toBe(true);
    expect(url.pathname.endsWith('/dist-tags')).toBe(true);
    const name = decodeURIComponent(
      url.pathname.slice('/-/package/'.length, -'/dist-tags'.length)
    );
    calls += 1;

    if (offline) throw new Error('npm temporarily unavailable');

    if (!versions.has(name)) {
      return Response.json({ error: 'unexpected package' }, { status: 404 });
    }
    return Response.json({ latest: versions.get(name) });
  }) as typeof fetch;

  const GET = createPublicReleaseHandler({
    fetchImpl,
    now: () => currentTime,
  });

  return {
    GET,
    getCalls: () => calls,
    advance: (ms: number) => {
      currentTime += ms;
    },
    setVersion: (name: string, version: string) => {
      versions.set(name, version);
    },
    setAll: (version: string) => {
      for (const name of publishedPackageNames) versions.set(name, version);
    },
    setOffline: (value: boolean) => {
      offline = value;
    },
  };
}

describe('public npm release API', () => {
  it('admits only one version across all six public packages and caches it', async () => {
    const registry = registryFixture();
    const response = await registry.GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(data).toMatchObject({
      schemaVersion: 1,
      source: 'npm-dist-tags',
      version: '2.139.0',
      packages: [...publishedPackageNames],
      stale: false,
    });
    expect(registry.getCalls()).toBe(6);

    await registry.GET();
    expect(registry.getCalls()).toBe(6);

    registry.advance(FIFTEEN_MINUTES);
    registry.setAll('2.139.1');
    expect((await (await registry.GET()).json()).version).toBe('2.139.1');
    expect(registry.getCalls()).toBe(12);
  });

  it('refuses to announce an incompletely published version', async () => {
    const registry = registryFixture();
    registry.setVersion(publishedPackageNames[0], '2.139.1');

    const incomplete = await registry.GET();
    expect(incomplete.status).toBe(503);
    expect(incomplete.headers.get('X-Vellira-Public-Release-State')).toBe(
      'unavailable'
    );
    expect(incomplete.headers.get('X-Vellira-Public-Release-Reason')).toBe(
      'packages_not_converged'
    );
    expect(incomplete.headers.get('Retry-After')).toBe('60');
    expect(await incomplete.json()).toEqual({
      error: 'published_release_unavailable',
    });

    registry.setAll('2.139.1');
    registry.advance(60_000);
    expect((await (await registry.GET()).json()).version).toBe('2.139.1');
  });

  it('retains only recently verified evidence on transient npm errors', async () => {
    const registry = registryFixture();
    await registry.GET();
    registry.advance(FIFTEEN_MINUTES);
    registry.setOffline(true);

    const cached = await registry.GET();
    expect(cached.status).toBe(200);
    expect(await cached.json()).toMatchObject({
      version: '2.139.0',
      stale: true,
    });
    const attempted = registry.getCalls();

    await registry.GET();
    expect(registry.getCalls()).toBe(attempted);

    registry.advance(ONE_DAY);
    const expired = await registry.GET();
    expect(expired.status).toBe(503);
    expect(expired.headers.get('Cache-Control')).toBe('no-store');
  });

  it('does not accept prerelease or malformed npm dist tags', async () => {
    const registry = registryFixture();
    registry.setVersion(publishedPackageNames[0], '2.140.0-rc.1');
    const invalid = await registry.GET();
    expect(invalid.status).toBe(503);
    expect(invalid.headers.get('X-Vellira-Public-Release-Reason')).toBe(
      'registry_metadata_invalid'
    );
  });

  it('reports a safe reason for a cold npm outage without fabricated versions', async () => {
    const registry = registryFixture();
    registry.setOffline(true);

    const unavailable = await registry.GET();
    expect(unavailable.status).toBe(503);
    expect(unavailable.headers.get('Cache-Control')).toBe('no-store');
    expect(unavailable.headers.get('X-Vellira-Public-Release-State')).toBe(
      'unavailable'
    );
    expect(unavailable.headers.get('X-Vellira-Public-Release-Reason')).toBe(
      'registry_unavailable'
    );
    expect(await unavailable.json()).toEqual({
      error: 'published_release_unavailable',
    });
  });

  it('deduplicates concurrent verification into a single six-package batch', async () => {
    const registry = registryFixture();
    const results = await Promise.all([
      registry.GET(),
      registry.GET(),
      registry.GET(),
    ]);
    expect(results.map((response) => response.status)).toEqual([200, 200, 200]);
    expect(registry.getCalls()).toBe(6);
  });
});
