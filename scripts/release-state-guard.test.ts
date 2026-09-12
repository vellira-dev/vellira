import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { assertReleaseStateSynchronized } = require(
  './release-state-guard.cjs'
);

describe('release state guard', () => {
  it('accepts a manifest synchronized with the latest reachable release tag', () => {
    expect(
      assertReleaseStateSynchronized({
        manifestVersion: '2.104.13',
        latestTag: 'v2.104.13',
      })
    ).toEqual({ manifestVersion: '2.104.13', latestTag: 'v2.104.13' });
  });

  it('allows the initial release when no release tag exists yet', () => {
    expect(
      assertReleaseStateSynchronized({
        manifestVersion: '1.0.0',
        latestTag: null,
      })
    ).toEqual({ manifestVersion: '1.0.0', latestTag: null });
  });

  it('fails closed before semantic-release when external release state is ahead', () => {
    expect(() =>
      assertReleaseStateSynchronized({
        manifestVersion: '2.104.12',
        latestTag: 'v2.104.13',
      })
    ).toThrow(
      'Release state is not synchronized: package.json is 2.104.12, latest reachable release tag is v2.104.13. Stop before semantic-release and run release recovery first.'
    );
  });

  it('rejects malformed manifest versions and release tags', () => {
    expect(() =>
      assertReleaseStateSynchronized({
        manifestVersion: 'latest',
        latestTag: 'v2.104.13',
      })
    ).toThrow('package.json version must be valid SemVer');

    expect(() =>
      assertReleaseStateSynchronized({
        manifestVersion: '2.104.13',
        latestTag: 'release-2.104.13',
      })
    ).toThrow('Latest reachable release tag must be v-prefixed SemVer');
  });

  it('runs before dependency installation and semantic-release in the Release workflow', () => {
    const workflow = readFileSync('.github/workflows/release.yml', 'utf8');
    const guard = workflow.indexOf('Guard synchronized release state');
    const install = workflow.indexOf('Install dependencies');
    const release = workflow.indexOf('\n      - name: Release\n');

    expect(guard).toBeGreaterThan(-1);
    expect(install).toBeGreaterThan(guard);
    expect(release).toBeGreaterThan(guard);
    expect(workflow).toContain('run: node scripts/release-state-guard.cjs');
  });
});
