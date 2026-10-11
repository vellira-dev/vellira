import { describe, expect, it } from 'vitest';

import {
  parsePublicRelease,
  readCachedPublicRelease,
  readPublicRelease,
  PUBLIC_RELEASE_API_URL,
} from '../public-release/client';

const NOW = Date.UTC(2026, 9, 11, 12);
const PACKAGES = [
  '@vellira-ui/core',
  '@vellira-ui/icons',
  '@vellira-ui/react',
  '@vellira-ui/react-native',
  '@vellira-ui/tokens',
  '@vellira-ui/types',
];

const valid = () => ({
  schemaVersion: 1,
  source: 'npm-dist-tags',
  version: '2.139.0',
  packages: PACKAGES,
  verifiedAt: new Date(NOW).toISOString(),
  stale: false,
});

function memoryStorage() {
  const entries = new Map<string, string>();
  return {
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => {
      entries.set(key, value);
    },
  };
}

describe('public release browser client', () => {
  it('accepts a verified response but rejects unverified or expired facts', () => {
    expect(parsePublicRelease(valid(), NOW)).toMatchObject({
      version: '2.139.0',
      stale: false,
    });
    expect(parsePublicRelease({ ...valid(), version: 'evil' }, NOW)).toBeNull();
    expect(
      parsePublicRelease(
        { ...valid(), packages: [PACKAGES[0], PACKAGES[0]] },
        NOW
      )
    ).toBeNull();
    expect(
      parsePublicRelease(valid(), NOW + 25 * 60 * 60 * 1000)
    ).toBeNull();
  });

  it('stores a confirmed version and preserves it during network failure', async () => {
    const storage = memoryStorage();
    const online = (async (url: RequestInfo | URL) => {
      expect(String(url)).toBe(PUBLIC_RELEASE_API_URL);
      return Response.json(valid());
    }) as typeof fetch;

    const version = await readPublicRelease({
      fetchImpl: online,
      storage,
      now: () => NOW,
    });
    expect(version?.version).toBe('2.139.0');

    const offline = (async () => {
      throw new Error('offline');
    }) as typeof fetch;
    const stale = await readPublicRelease({
      fetchImpl: offline,
      storage,
      now: () => NOW + 60_000,
    });
    expect(stale).toMatchObject({ version: '2.139.0', stale: true });
    expect(
      readCachedPublicRelease(storage, NOW + 25 * 60 * 60 * 1000)
    ).toBeNull();
  });

  it('never stores a cached or malformed response as new proof', async () => {
    const storage = memoryStorage();
    const stale = (async () =>
      Response.json({ ...valid(), stale: true })) as typeof fetch;
    const result = await readPublicRelease({
      fetchImpl: stale,
      storage,
      now: () => NOW,
    });
    expect(result?.stale).toBe(true);
    expect(readCachedPublicRelease(storage, NOW)).toBeNull();

    const invalid = (async () =>
      Response.json({ ...valid(), version: 'not-a-version' })) as typeof fetch;
    expect(
      await readPublicRelease({
        fetchImpl: invalid,
        storage,
        now: () => NOW,
      })
    ).toBeNull();
  });
});
