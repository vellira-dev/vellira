import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { assertReleaseStateSynchronized } = require('./release-state-guard.cjs');

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

  it('bounds release execution and isolates machine version-sync commits from Husky', () => {
    const workflow = readFileSync('.github/workflows/release.yml', 'utf8');
    const releaseStart = workflow.indexOf('jobs:\n  release:');
    const recoveryStart = workflow.indexOf('\n  recover-existing-release:');
    const releaseJob = workflow.slice(releaseStart, recoveryStart);

    expect(releaseStart).toBeGreaterThan(-1);
    expect(recoveryStart).toBeGreaterThan(releaseStart);
    expect(releaseJob).toContain('timeout-minutes: 45');
    expect(releaseJob).toContain(
      "!startsWith(github.event.head_commit.message, 'chore(release): sync package versions')"
    );
    expect(workflow.match(/- name: Create version sync PR/g)).toHaveLength(2);
    expect(workflow.match(/HUSKY: '0'/g)).toHaveLength(2);
  });

  it('seeds release-sync refs at exact main without workflow permission', () => {
    const workflow = readFileSync('.github/workflows/release.yml', 'utf8');
    const releaseStart = workflow.indexOf('jobs:\n  release:');
    const recoveryStart = workflow.indexOf('\n  recover-existing-release:');
    const releaseJob = workflow.slice(releaseStart, recoveryStart);
    const recoveryJob = workflow.slice(recoveryStart);

    const releaseToken = releaseJob.indexOf(
      'Create release sync GitHub App token'
    );
    const releaseSeed = releaseJob.indexOf(
      'Seed version sync branch at exact main'
    );
    const releaseCreate = releaseJob.indexOf('- name: Create version sync PR');
    const recoveryToken = recoveryJob.indexOf(
      'Create recovery release sync GitHub App token'
    );
    const recoverySeed = recoveryJob.indexOf(
      'Seed recovery version sync branch at exact main'
    );
    const recoveryCreate = recoveryJob.indexOf(
      '- name: Create version sync PR'
    );

    expect(releaseToken).toBeGreaterThan(-1);
    expect(releaseSeed).toBeGreaterThan(releaseToken);
    expect(releaseCreate).toBeGreaterThan(releaseSeed);
    expect(recoveryToken).toBeGreaterThan(-1);
    expect(recoverySeed).toBeGreaterThan(recoveryToken);
    expect(recoveryCreate).toBeGreaterThan(recoverySeed);
    expect(workflow.match(/GH_TOKEN: \$\{\{ github\.token \}\}/g)).toHaveLength(
      2
    );
    expect(workflow.match(/git\/ref\/heads\/main/g)).toHaveLength(2);
    expect(workflow.match(/matching-refs\/heads\/\$BRANCH/g)).toHaveLength(2);
    expect(workflow.match(/git\/refs\/heads\/\$BRANCH/g)).toHaveLength(2);
    expect(workflow.match(/-F force=true/g)).toHaveLength(2);
    expect(workflow).not.toContain('permission-workflows: write');
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
