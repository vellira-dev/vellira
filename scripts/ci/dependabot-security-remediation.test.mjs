import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildRemediationPlan,
  stripMutableWorkspaceSections,
  validateRemediationDiff,
} from './dependabot-security-remediation.mjs';

test('plan selects only open high/critical npm alerts', () => {
  const plan = buildRemediationPlan([
    {
      number: 1,
      state: 'open',
      dependency: {
        package: { ecosystem: 'npm', name: 'fast-uri' },
        scope: 'development',
      },
      security_advisory: {
        severity: 'high',
        ghsa_id: 'GHSA-aaaa-bbbb-cccc',
      },
      security_vulnerability: {
        vulnerable_version_range: '<3.1.7',
        first_patched_version: { identifier: '3.1.7' },
      },
    },
    {
      number: 2,
      state: 'open',
      dependency: {
        package: { ecosystem: 'npm', name: 'low-only' },
        scope: 'development',
      },
      security_advisory: { severity: 'low' },
      security_vulnerability: {
        first_patched_version: { identifier: '1.0.1' },
      },
    },
  ]);

  assert.equal(plan.relevantAlertCount, 1);
  assert.equal(plan.fixableAlertCount, 1);
  assert.deepEqual(plan.packages, ['fast-uri']);
});

test('plan excludes runtime alerts from the bounded fallback', () => {
  const plan = buildRemediationPlan([
    {
      number: 3,
      state: 'open',
      dependency: {
        package: { ecosystem: 'npm', name: 'runtime-package' },
        scope: 'runtime',
      },
      security_advisory: {
        severity: 'critical',
        ghsa_id: 'GHSA-runtime-only',
      },
      security_vulnerability: {
        vulnerable_version_range: '<9.9.9',
        first_patched_version: { identifier: '9.9.9' },
      },
    },
  ]);

  assert.equal(plan.dependencyScope, 'development');
  assert.equal(plan.relevantAlertCount, 0);
  assert.equal(plan.fixableAlertCount, 0);
  assert.deepEqual(plan.packages, []);
});

test('low audit level includes moderate and low alerts', () => {
  const plan = buildRemediationPlan(
    [
      {
        number: 5,
        state: 'open',
        dependency: {
          package: { ecosystem: 'npm', name: 'moderate-package' },
          scope: 'development',
        },
        security_advisory: { severity: 'moderate' },
        security_vulnerability: {
          first_patched_version: { identifier: '1.2.4' },
        },
      },
      {
        number: 6,
        state: 'open',
        dependency: {
          package: { ecosystem: 'npm', name: 'low-package' },
          scope: 'development',
        },
        security_advisory: { severity: 'low' },
        security_vulnerability: {
          first_patched_version: { identifier: '2.0.1' },
        },
      },
    ],
    'low'
  );

  assert.equal(plan.relevantAlertCount, 2);
  assert.deepEqual(plan.packages, ['low-package', 'moderate-package']);
});

test('plan reports advisories without patched versions', () => {
  const plan = buildRemediationPlan([
    {
      number: 4,
      state: 'open',
      dependency: {
        package: { ecosystem: 'npm', name: 'blocked' },
        scope: 'development',
      },
      security_advisory: { severity: 'critical' },
      security_vulnerability: { first_patched_version: null },
    },
  ]);

  assert.equal(plan.fixableAlertCount, 0);
  assert.equal(plan.blockedAlertCount, 1);
});

test('diff guard permits only lockfile and security workspace sections', () => {
  const before = `packages:
  - 'packages/*'
minimumReleaseAgeExclude:
  - old@1.0.0
nodeLinker: hoisted

overrides:
  fast-uri: 3.1.6

patchedDependencies:
  next@1: patches/next.patch
`;
  const after = `packages:
  - 'packages/*'
minimumReleaseAgeExclude:
  - old@1.0.0
  - fast-uri@3.1.7
nodeLinker: hoisted

overrides:
  fast-uri: 3.1.7

patchedDependencies:
  next@1: patches/next.patch
`;

  const result = validateRemediationDiff({
    changedFiles: ['pnpm-workspace.yaml', 'pnpm-lock.yaml'],
    workspaceBefore: before,
    workspaceAfter: after,
  });

  assert.deepEqual(result.changedFiles, [
    'pnpm-lock.yaml',
    'pnpm-workspace.yaml',
  ]);
  assert.equal(
    stripMutableWorkspaceSections(before),
    stripMutableWorkspaceSections(after)
  );
});

test('diff guard permits a lockfile-only security update', () => {
  const source = "nodeLinker: hoisted\noverrides:\n  fast-uri: 3.1.7\n";

  const result = validateRemediationDiff({
    changedFiles: ['pnpm-lock.yaml'],
    workspaceBefore: source,
    workspaceAfter: source,
  });

  assert.deepEqual(result.changedFiles, ['pnpm-lock.yaml']);
});

test('diff guard rejects unexpected untracked files', () => {
  const source = "nodeLinker: hoisted\noverrides:\n  fast-uri: 3.1.7\n";

  assert.throws(
    () =>
      validateRemediationDiff({
        changedFiles: ['pnpm-lock.yaml'],
        untrackedFiles: [
          '.security-remediation/plan.json',
          'unexpected-security-output.txt',
        ],
        workspaceBefore: source,
        workspaceAfter: source,
      }),
    /forbidden untracked paths/
  );
});

test('diff guard rejects forbidden paths', () => {
  assert.throws(
    () =>
      validateRemediationDiff({
        changedFiles: ['package.json', 'pnpm-workspace.yaml'],
        workspaceBefore: 'nodeLinker: hoisted\noverrides:\n  fast-uri: 3.1.6\n',
        workspaceAfter: 'nodeLinker: hoisted\noverrides:\n  fast-uri: 3.1.7\n',
      }),
    /forbidden paths/
  );
});

test('diff guard rejects non-security workspace changes', () => {
  assert.throws(
    () =>
      validateRemediationDiff({
        changedFiles: ['pnpm-workspace.yaml'],
        workspaceBefore: 'nodeLinker: hoisted\noverrides:\n  fast-uri: 3.1.6\n',
        workspaceAfter: 'nodeLinker: isolated\noverrides:\n  fast-uri: 3.1.7\n',
      }),
    /outside overrides\/minimumReleaseAgeExclude/
  );
});
