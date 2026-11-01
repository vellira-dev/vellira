import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';
import { classifySemanticReleaseOutcome } from './classify-semantic-release-outcome.mjs';
import { RELEASE_SYNC_MANIFESTS } from './release-sync-contract.mjs';

const HEAD = 'a'.repeat(40);
const OLD = 'b'.repeat(40);
const manifests = version => Object.fromEntries(RELEASE_SYNC_MANIFESTS.map(p => [p, version]));
const input = (overrides = {}) => ({
  sourceSha: HEAD, checkoutSha: HEAD,
  baselineVersion: '2.190.3', preparedVersion: '2.190.4',
  baselineManifestVersions: manifests('2.190.3'),
  preparedManifestVersions: manifests('2.190.4'),
  changedPaths: [...RELEASE_SYNC_MANIFESTS],
  candidateExists: true, preparedTagSha: HEAD, ...overrides,
});
const noRelease = (overrides = {}) => input({
  preparedVersion: '2.190.3', preparedManifestVersions: manifests('2.190.3'),
  changedPaths: [], candidateExists: false, preparedTagSha: OLD, ...overrides,
});

test('no new release skips atomic preparation without rebinding existing tag', () => {
  assert.deepEqual(classifySemanticReleaseOutcome(noRelease()),
    { released: false, version: '2.190.3', sourceSha: HEAD });
});
test('new release requires verified exact-source state', () => {
  assert.deepEqual(classifySemanticReleaseOutcome(input()),
    { released: true, version: '2.190.4', sourceSha: HEAD });
});
test('partial, mismatched, missing, or duplicated release evidence fails closed', () => {
  const cases = [
    [input({ candidateExists: false }), /prepared npm candidate/],
    [input({ preparedTagSha: OLD }), /exact workflow commit/],
    [input({ preparedTagSha: null }), /exact workflow commit/],
    [input({ changedPaths: RELEASE_SYNC_MANIFESTS.slice(1) }), /all seven exact/],
    [input({ changedPaths: [...RELEASE_SYNC_MANIFESTS, RELEASE_SYNC_MANIFESTS[0]] }), /Duplicate/],
    [input({ checkoutSha: OLD }), /checkout does not match/],
    [input({ baselineManifestVersions: { ...manifests('2.190.3'), 'packages/icons/package.json': '2.190.2' } }), /baseline version drift/],
    [input({ preparedManifestVersions: { ...manifests('2.190.4'), 'packages/types/package.json': '2.190.3' } }), /Prepared release version drift/],
    [input({ preparedVersion: '2.190.2', preparedManifestVersions: manifests('2.190.2') }), /advance SemVer/],
    [noRelease({ candidateExists: true }), /must not create/],
    [noRelease({ changedPaths: ['package.json'] }), /must not mutate/],
  ];
  for (const [value, message] of cases) {
    assert.throws(() => classifySemanticReleaseOutcome(value), message);
  }
});

test('release workflow gates atomic mutations on actual version publication', async () => {
  const yaml = await fs.readFile('.github/workflows/release.yml', 'utf8');
  const job = yaml.split('\n  release:\n')[1]?.split('\n  recover-existing-release:\n')[0];
  assert.ok(job, 'Release job missing');
  const classified = job.indexOf('id: release-result');
  const prepared = job.indexOf('name: Prepare verified atomic release and Starter snapshot');
  assert.ok(classified > job.indexOf('pnpm exec semantic-release'));
  assert.ok(prepared > classified, 'Classification must precede preparation');
  for (const name of [
    'Prepare verified atomic release and Starter snapshot',
    'Detect version sync changes',
    'Require unchanged pnpm lock for atomic release admission',
  ]) {
    assert.ok(job.includes("name: " + name + "\n        if: steps.release-result.outputs.released == 'true'"),
      'Missing no-release gate: ' + name);
  }
  assert.ok(job.includes("if: steps.version-sync.outputs.changed == 'true'"));
});
