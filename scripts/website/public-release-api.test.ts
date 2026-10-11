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

  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    expect(url.origin).toBe('https://registry.npmjs.org');
    expect(url.pathname.startsWith('/@vellira-ui%2F')).toBe(true);
    expect(url.pathname).not.toContain('/-/package/');
    expect(url.pathname).not.toContain('/dist-tags');
    expect(init?.method).toBe('GET');
    expect(init?.headers).toMatchObject({
      Accept:
        'application/vnd.npm.install-v1+json; q=1.0, application/json; q=0.8',
    });
    expect(init?.redirect).toBe('error');
    const name = decodeURIComponent(url.pathname.slice(1));
    calls += 1;

    if (offline) throw new TypeError('npm temporarily unavailable');

    if (!versions.has(name)) {
      return Response.json({ error: 'unexpected package' }, { status: 404 });
    }
    const version = versions.get(name);
    if (!version) throw new Error('Missing mock npm version');
    return Response.json({
      name,
      'dist-tags': { latest: version },
      versions: { [version]: { name, version } },
    });
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

  it('rejects malformed public packuments and unproven latest versions', async () => {
    const cases = [
      {
        name: '@wrong/package',
        'dist-tags': { latest: '2.139.0' },
        versions: { '2.139.0': {} },
      },
      {
        name: publishedPackageNames[0],
        latest: '2.139.0',
        versions: { '2.139.0': {} },
      },
      {
        name: publishedPackageNames[0],
        'dist-tags': { latest: '2.139.0' },
        versions: {},
      },
      {
        name: publishedPackageNames[0],
        'dist-tags': { latest: '2.139.0' },
        versions: [],
      },
    ];
    for (const malformed of cases) {
      const fetchImpl = (async (input: RequestInfo | URL) => {
        const name = decodeURIComponent(
          new URL(String(input)).pathname.slice(1)
        );
        return Response.json(
          name === publishedPackageNames[0]
            ? malformed
            : {
                name,
                'dist-tags': { latest: '2.139.0' },
                versions: { '2.139.0': { name, version: '2.139.0' } },
              }
        );
      }) as typeof fetch;
      const GET = createPublicReleaseHandler({ fetchImpl, now: () => START });
      const response = await GET();
      expect(response.status).toBe(503);
      expect(response.headers.get('X-Vellira-Public-Release-Reason')).toBe(
        'registry_metadata_invalid'
      );
    }
  });

  it('treats registry HTTP errors as unavailable, without using tokens', async () => {
    const fetchImpl = (async () =>
      Response.json({ error: 'unauthorized' }, { status: 401 })) as typeof fetch;
    const GET = createPublicReleaseHandler({ fetchImpl, now: () => START });
    const response = await GET();
    expect(response.status).toBe(503);
    expect(response.headers.get('X-Vellira-Public-Release-Reason')).toBe(
      'registry_unavailable'
    );
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

  it('does not disguise unexpected programming errors as npm outages', async () => {
    let clockReads = 0;
    const fetchImpl = (async (input: RequestInfo | URL) => {
      const name = decodeURIComponent(new URL(String(input)).pathname.slice(1));
      return Response.json({
        name,
        'dist-tags': { latest: '2.139.0' },
        versions: { '2.139.0': { name, version: '2.139.0' } },
      });
    }) as typeof fetch;
    const GET = createPublicReleaseHandler({
      fetchImpl,
      now: () => {
        clockReads += 1;
        if (clockReads > 1) throw new Error('clock failure');
        return START;
      },
    });
    await expect(GET()).rejects.toThrow('clock failure');
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
