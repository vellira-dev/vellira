import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const {
  assertReleaseStateSynchronized,
  classifyReleaseState,
  compareSemver,
} = require('./release-state-guard.cjs');

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

  it('classifies external release state ahead of main as recoverable', () => {
    expect(
      classifyReleaseState({
        manifestVersion: '2.104.12',
        latestTag: 'v2.104.13',
      })
    ).toEqual({
      state: 'recoverable',
      manifestVersion: '2.104.12',
      latestTag: 'v2.104.13',
      latestVersion: '2.104.13',
    });
    expect(() =>
      assertReleaseStateSynchronized({
        manifestVersion: '2.104.12',
        latestTag: 'v2.104.13',
      })
    ).toThrow('Automatic recovery must reconcile');
  });

  it('fails closed when the manifest is not an exact match and is not older', () => {
    expect(
      classifyReleaseState({
        manifestVersion: '2.104.14',
        latestTag: 'v2.104.13',
      }).state
    ).toBe('invalid');
    expect(() =>
      assertReleaseStateSynchronized({
        manifestVersion: '2.104.14',
        latestTag: 'v2.104.13',
      })
    ).toThrow('not an exact synchronized version');
  });

  it('uses SemVer precedence including prereleases', () => {
    expect(compareSemver('2.126.0', '2.126.0')).toBe(0);
    expect(compareSemver('2.126.0-beta.2', '2.126.0-beta.10')).toBeLessThan(0);
    expect(compareSemver('2.126.0-beta.10', '2.126.0')).toBeLessThan(0);
    expect(compareSemver('2.126.1', '2.126.0')).toBeGreaterThan(0);
  });

  it('requires exact version identity even when SemVer precedence is equal', () => {
    expect(
      classifyReleaseState({
        manifestVersion: '2.126.0+local',
        latestTag: 'v2.126.0+published',
      }).state
    ).toBe('invalid');

    expect(
      classifyReleaseState({
        manifestVersion: '2.126.0+published',
        latestTag: 'v2.126.0+published',
      }).state
    ).toBe('synchronized');
  });

  it('rejects malformed manifest versions and release tags', () => {
    expect(() =>
      classifyReleaseState({
        manifestVersion: 'latest',
        latestTag: 'v2.104.13',
      })
    ).toThrow('package.json version must be valid SemVer');

    expect(() =>
      classifyReleaseState({
        manifestVersion: '2.104.13',
        latestTag: 'release-2.104.13',
      })
    ).toThrow('Latest reachable release tag must be v-prefixed SemVer');
  });

  it('routes recoverable push state into synchronous verified reconciliation', () => {
    const workflow = readFileSync('.github/workflows/release.yml', 'utf8');
    const classifyStart = workflow.indexOf('release-state:');
    const reconcileStart = workflow.indexOf('auto-reconcile-existing-release:');
    const releaseStart = workflow.indexOf('\n  release:');
    const recoveryStart = workflow.indexOf('\n  recover-existing-release:');

    expect(classifyStart).toBeGreaterThan(-1);
    expect(reconcileStart).toBeGreaterThan(classifyStart);
    expect(releaseStart).toBeGreaterThan(reconcileStart);
    expect(recoveryStart).toBeGreaterThan(releaseStart);
    expect(workflow).toContain(
      "needs.release-state.outputs.state == 'recoverable'"
    );
    expect(workflow).toContain(
      "needs.release-state.outputs.state == 'synchronized'"
    );
    expect(workflow).toContain(
      'run: node scripts/release-state-guard.cjs --classify'
    );
    expect(workflow).toContain(
      'run: node scripts/release-recovery/cli.cjs verify-existing'
    );
    expect(workflow).toContain('Create or update automatic version sync PR');
    expect(workflow).toContain(
      'Enable auto-merge for automatic version sync PR'
    );
    expect(workflow).not.toContain('gh workflow run release.yml --ref main');
    expect(workflow).not.toContain('actions: write');
  });

  it('bounds release execution and isolates machine version-sync commits from Husky', () => {
    const workflow = readFileSync('.github/workflows/release.yml', 'utf8');
    const releaseStart = workflow.indexOf('\n  release:');
    const recoveryStart = workflow.indexOf('\n  recover-existing-release:');
    const releaseJob = workflow.slice(releaseStart, recoveryStart);

    expect(releaseStart).toBeGreaterThan(-1);
    expect(recoveryStart).toBeGreaterThan(releaseStart);
    expect(releaseJob).toContain('timeout-minutes: 45');
    expect(workflow).toContain(
      "!startsWith(github.event.head_commit.message, 'chore(release): sync package versions')"
    );
    expect(workflow.match(/- name: Create version sync PR/g)).toHaveLength(2);
    expect(workflow.match(/HUSKY: '0'/g)).toHaveLength(3);
  });

  it('reuses exact merged PR validation instead of rerunning full CI in release', () => {
    const workflow = readFileSync('.github/workflows/release.yml', 'utf8');
    const releaseStart = workflow.indexOf('\n  release:');
    const recoveryStart = workflow.indexOf('\n  recover-existing-release:');
    const releaseJob = workflow.slice(releaseStart, recoveryStart);

    expect(releaseJob).toContain('checks: read');
    expect(releaseJob).toContain('pull-requests: read');
    expect(releaseJob).toContain('- name: Verify merged PR validation');
    expect(releaseJob).toContain('merge_commit_sha == $sha');
    expect(releaseJob).toContain('check-runs?per_page=100');

    for (const checkName of [
      'Build, Test & Validate',
      'Typecheck & API Contracts',
      'Tooling & IndexNow Tests',
      'Quality & Component Quality',
      'Storybook & Browser Tests',
      'Unit & Coverage Tests',
      'CodeQL',
      'chromatic',
    ]) {
      expect(releaseJob).toContain(`"${checkName}"`);
    }

    for (const duplicatedCommand of [
      'pnpm ci:quality',
      'pnpm ci:build',
      'pnpm ci:typecheck',
      'pnpm ci:playwright',
      'pnpm test:unit',
      'pnpm test:storybook',
      'pnpm test:coverage',
    ]) {
      expect(releaseJob).not.toContain(duplicatedCommand);
    }

    expect(releaseJob).toContain('- name: Build publishable packages');
    expect(releaseJob).toContain('run: pnpm build');
    expect(releaseJob).toContain('run: pnpm ci:smoke');
  });

  it('keeps semantic-release GitHub publication issue-write free', () => {
    const config = readFileSync('release.config.cjs', 'utf8');

    expect(config).toContain("['@semantic-release/github'");
    expect(config).toContain('successComment: false');
    expect(config).toContain('failComment: false');
    expect(config).toContain('releasedLabels: false');
  });

  it('enables auto-merge for normal and recovered version-sync PRs', () => {
    const workflow = readFileSync('.github/workflows/release.yml', 'utf8');
    const releaseStart = workflow.indexOf('\n  release:');
    const recoveryStart = workflow.indexOf('\n  recover-existing-release:');
    const releaseJob = workflow.slice(releaseStart, recoveryStart);
    const recoveryJob = workflow.slice(recoveryStart);
    const expectAfter = (source: string, before: string, after: string) => {
      expect(source.indexOf(after)).toBeGreaterThan(source.indexOf(before));
    };

    expectAfter(
      releaseJob,
      'Verify version sync PR creation',
      'Enable auto-merge for version sync PR'
    );
    expectAfter(
      recoveryJob,
      'Verify version sync PR creation',
      'Enable auto-merge for recovered version sync PR'
    );
    expect(workflow.match(/gh pr merge/g)).toHaveLength(3);
    expect(workflow.match(/--auto/g)).toHaveLength(3);
    expect(workflow.match(/--squash/g)).toHaveLength(3);
    expect(workflow.match(/--delete-branch/g)).toHaveLength(3);
    expect(recoveryJob).toContain(
      'GH_TOKEN: ${{ steps.recovery-release-sync-token.outputs.token }}'
    );
  });

  it('seeds release-sync refs at exact main without workflow permission', () => {
    const workflow = readFileSync('.github/workflows/release.yml', 'utf8');
    const releaseStart = workflow.indexOf('\n  release:');
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
      3
    );
    expect(workflow.match(/git\/ref\/heads\/main/g)).toHaveLength(3);
    expect(workflow.match(/matching-refs\/heads\/\$BRANCH/g)).toHaveLength(3);
    expect(workflow.match(/git\/refs\/heads\/\$BRANCH/g)).toHaveLength(3);
    expect(workflow.match(/-F force=true/g)).toHaveLength(3);
    expect(workflow).not.toContain('permission-workflows: write');
  });

  it('keeps the strict guard before semantic-release in the synchronized Release job', () => {
    const workflow = readFileSync('.github/workflows/release.yml', 'utf8');
    const releaseStart = workflow.indexOf('\n  release:');
    const recoveryStart = workflow.indexOf('\n  recover-existing-release:');
    const releaseJob = workflow.slice(releaseStart, recoveryStart);
    const guard = releaseJob.indexOf('Guard synchronized release state');
    const install = releaseJob.indexOf('Install dependencies');
    const release = releaseJob.indexOf('\n      - name: Release\n');

    expect(guard).toBeGreaterThan(-1);
    expect(install).toBeGreaterThan(guard);
    expect(release).toBeGreaterThan(guard);
    expect(releaseJob).toContain('run: node scripts/release-state-guard.cjs');
  });
});
