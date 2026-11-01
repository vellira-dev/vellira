import fs from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
import { ATOMIC_RELEASE_SYNC_PATHS, assertAtomicSyncFileSet, assertStableReleaseVersion, verifyAtomicManifestTransition, verifyAtomicStarterTransition } from './atomic-release-sync.mjs';

test('atomic file set includes seven package manifests and five Starter assets', () => {
  assert.equal(ATOMIC_RELEASE_SYNC_PATHS.length, 12);
  assertAtomicSyncFileSet(ATOMIC_RELEASE_SYNC_PATHS);
});
test('rejects partial root-only release sync', () => {
  assert.throws(() => assertAtomicSyncFileSet(ATOMIC_RELEASE_SYNC_PATHS.filter(x => !x.includes('workspace-starter'))));
});
test('rejects unexpected file or duplicate', () => {
  assert.throws(() => assertAtomicSyncFileSet([...ATOMIC_RELEASE_SYNC_PATHS, 'apps/website/src/app/page.tsx']));
  assert.throws(() => assertAtomicSyncFileSet([...ATOMIC_RELEASE_SYNC_PATHS, ATOMIC_RELEASE_SYNC_PATHS[0]]));
});

test('requires canonical stable semantic versions before atomic assembly', () => {
  for (const version of ['2.189.0', '0.0.1', '10.0.123']) {
    assert.doesNotThrow(() => assertStableReleaseVersion(version));
  }
  for (const version of ['v2.189.0', '2.189.0-beta.1', '02.1.0', '2.189', '2.189.0 ']) {
    assert.throws(() => assertStableReleaseVersion(version));
  }
});

test('version transition accepts only seven converged version-only changes', () => {
  const manifests = ATOMIC_RELEASE_SYNC_PATHS.filter(p => p === 'package.json' || (p.startsWith('packages/') && p.endsWith('/package.json')));
  const before = Object.fromEntries(manifests.map(p => [p, { name: p, version: '2.188.12', private: true }]));
  const after = Object.fromEntries(manifests.map(p => [p, { name: p, version: '2.189.0', private: true }]));
  const payload = { files: ATOMIC_RELEASE_SYNC_PATHS, before, after, version: '2.189.0' };
  assert.equal(verifyAtomicManifestTransition(payload).previousVersion, '2.188.12');
  assert.throws(() => verifyAtomicManifestTransition({
    ...payload, after: { ...after, 'package.json': { ...after['package.json'], scripts: { malicious: 'true' } } },
  }), /Unexpected manifest mutation/);
  assert.throws(() => verifyAtomicManifestTransition({
    ...payload, before: { ...before, 'package.json': { ...before['package.json'], version: '2.188.11' } },
  }), /not converged/);
});

test('release workflow prepares a combined PR only after publishing', () => {
  const workflow = fs.readFileSync('.github/workflows/release.yml', 'utf8');
  const publish = workflow.indexOf('      - name: Release');
  const prepare = workflow.indexOf('      - name: Prepare verified atomic release and Starter snapshot');
  const propose = workflow.indexOf('      - name: Create version sync PR');
  assert.ok(publish > -1 && prepare > publish && propose > prepare);
  const proposal = workflow.slice(propose, workflow.indexOf('      - name: Verify version sync PR creation', propose));
  for (const path of ATOMIC_RELEASE_SYNC_PATHS) {
    assert.ok(proposal.includes(path) || (path.startsWith('packages/') && proposal.includes('packages/*/package.json')), 'Missing atomic PR path: ' + path);
  }
});

test('manual release recovery also prepares one combined PR', () => {
  const workflow = fs.readFileSync('.github/workflows/release.yml', 'utf8');
  const recovery = workflow.slice(workflow.indexOf('  recover-existing-release:'));
  const verify = recovery.indexOf('      - name: Create or verify GitHub Release on existing tag');
  const prepare = recovery.indexOf('      - name: Prepare verified recovered release and Starter snapshot');
  const propose = recovery.indexOf('      - name: Create version sync PR');
  assert.ok(verify >= 0 && prepare > verify && propose > prepare);
  const proposal = recovery.slice(propose, recovery.indexOf('      - name: Verify version sync PR creation', propose));
  for (const p of ATOMIC_RELEASE_SYNC_PATHS) {
    assert.ok(proposal.includes(p) || (p.startsWith('packages/') && proposal.includes('packages/*/package.json')), 'Missing recovery sync path: ' + p);
  }
});

test('atomic Starter transitions reject unrelated manifest and README mutations', () => {
  const names = {
    web: ['@vellira-ui/react', '@vellira-ui/tokens', '@vellira-ui/icons'],
    native: ['@vellira-ui/react-native', '@vellira-ui/icons'],
  };
  const before = {
    'examples/workspace-starter/README.md': 'Use **Vellira 2.188.12 packages** today.',
  };
  const after = {
    'examples/workspace-starter/README.md': 'Use **Vellira 2.189.0 packages** today.',
  };
  for (const [platform, packages] of Object.entries(names)) {
    const filename = 'examples/workspace-starter/' + platform + '/package.json';
    before[filename] = { private: true, dependencies: Object.fromEntries(packages.map(name => [name, '2.188.12'])) };
    after[filename] = { private: true, dependencies: Object.fromEntries(packages.map(name => [name, '2.189.0'])) };
  }
  const args = { before, after, previousVersion: '2.188.12', version: '2.189.0' };
  assert.equal(verifyAtomicStarterTransition(args), true);
  assert.throws(() => verifyAtomicStarterTransition({
    ...args,
    after: { ...after, 'examples/workspace-starter/web/package.json': {
      ...after['examples/workspace-starter/web/package.json'], scripts: { postinstall: 'unexpected' },
    } },
  }), /Unexpected Starter manifest mutation/);
  assert.throws(() => verifyAtomicStarterTransition({
    ...args,
    after: { ...after, 'examples/workspace-starter/README.md': after['examples/workspace-starter/README.md'] + ' Extra content' },
  }), /Unexpected Starter README mutation/);
});
