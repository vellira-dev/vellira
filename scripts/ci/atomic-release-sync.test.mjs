import { isReleaseSyncFileSet, isAtomicReleaseSyncFileSet } from './release-sync-contract.mjs';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
import { ATOMIC_RELEASE_SYNC_PATHS, assertAtomicSyncFileSet, assertStableReleaseVersion, verifyAtomicManifestTransition, verifyAtomicStarterTransition, verifyAtomicReleaseContents } from './atomic-release-sync.mjs';

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
  assert.equal(verifyAtomicStarterTransition(args).previousStarterVersion, '2.188.12');
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

test('atomic shape detection never relaxes the legacy production admission', () => {
  assert.equal(isAtomicReleaseSyncFileSet(ATOMIC_RELEASE_SYNC_PATHS), true);
  assert.equal(isReleaseSyncFileSet(ATOMIC_RELEASE_SYNC_PATHS), false);
  assert.equal(isAtomicReleaseSyncFileSet(ATOMIC_RELEASE_SYNC_PATHS.slice(0, -1)), false);
  assert.equal(isAtomicReleaseSyncFileSet([...ATOMIC_RELEASE_SYNC_PATHS, ATOMIC_RELEASE_SYNC_PATHS[0]]), false);
  assert.equal(isAtomicReleaseSyncFileSet([...ATOMIC_RELEASE_SYNC_PATHS, 'apps/website/src/app/page.tsx']), false);
});

test('atomic content authority validates registry lock integrity and blocks tampering', () => {
  const before = {};
  const after = {};
  const old = '2.188.12';
  const version = '2.189.0';
  for (const p of ATOMIC_RELEASE_SYNC_PATHS.filter(p => p === 'package.json' || (p.startsWith('packages/') && p.endsWith('/package.json')))) {
    before[p] = { name: p, version: old };
    after[p] = { name: p, version };
  }
  before['examples/workspace-starter/README.md'] = 'Pinned **Vellira ' + old + ' packages**.';
  after['examples/workspace-starter/README.md'] = 'Pinned **Vellira ' + version + ' packages**.';
  const names = {
    web: ['@vellira-ui/react', '@vellira-ui/tokens', '@vellira-ui/icons'],
    native: ['@vellira-ui/react-native', '@vellira-ui/icons'],
  };
  for (const [platform, packages] of Object.entries(names)) {
    const prefix = 'examples/workspace-starter/' + platform + '/';
    const name = platform === 'web' ? 'vellira-workspace-react-starter' : 'vellira-workspace-native-starter';
    const oldDependencies = Object.fromEntries(packages.map(p => [p, old]));
    const dependencies = Object.fromEntries(packages.map(p => [p, version]));
    before[prefix + 'package.json'] = { name, private: true, dependencies: oldDependencies };
    after[prefix + 'package.json'] = { name, private: true, dependencies };
    after[prefix + 'package-lock.json'] = {
      name, lockfileVersion: 3, packages: {
        '': { dependencies },
        ...Object.fromEntries(packages.map(p => ['node_modules/' + p, {
          version, resolved: 'https://registry.npmjs.org/' + p + '/-/' + version + '.tgz',
          integrity: 'sha512-YWJjZA==',
        }])),
      },
    };
  }
  const input = { files: ATOMIC_RELEASE_SYNC_PATHS, before, after, version };
  assert.equal(verifyAtomicReleaseContents(input).version, version);
  const broken = structuredClone(after);
  broken['examples/workspace-starter/web/package-lock.json'].packages['node_modules/@vellira-ui/react'].integrity = '';
  assert.throws(() => verifyAtomicReleaseContents({ ...input, after: broken }), /integrity/);
  const wrongPin = structuredClone(after);
  wrongPin['examples/workspace-starter/native/package-lock.json'].packages['node_modules/@vellira-ui/icons'].version = old;
  assert.throws(() => verifyAtomicReleaseContents({ ...input, after: wrongPin }), /pin mismatch/);
});

test('Starter may lag root manifests but cannot diverge internally or downgrade', () => {
  const before = {
    'examples/workspace-starter/README.md': 'Using **Vellira 2.188.11 packages**.',
  };
  const after = {
    'examples/workspace-starter/README.md': 'Using **Vellira 2.189.0 packages**.',
  };
  const names = {
    web: ['@vellira-ui/react', '@vellira-ui/tokens', '@vellira-ui/icons'],
    native: ['@vellira-ui/react-native', '@vellira-ui/icons'],
  };
  for (const [platform, packages] of Object.entries(names)) {
    const filename = 'examples/workspace-starter/' + platform + '/package.json';
    before[filename] = { private: true, dependencies: Object.fromEntries(packages.map(name => [name, '2.188.11'])) };
    after[filename] = { private: true, dependencies: Object.fromEntries(packages.map(name => [name, '2.189.0'])) };
  }
  const input = { before, after, version: '2.189.0' };
  assert.equal(verifyAtomicStarterTransition(input).previousStarterVersion, '2.188.11');
  const mixed = structuredClone(before);
  mixed['examples/workspace-starter/native/package.json'].dependencies['@vellira-ui/icons'] = '2.188.12';
  assert.throws(() => verifyAtomicStarterTransition({ ...input, before: mixed }), /Prior Starter pins must converge/);
  const downgraded = structuredClone(after);
  for (const platform of Object.keys(names)) {
    const filename = 'examples/workspace-starter/' + platform + '/package.json';
    for (const name of names[platform]) downgraded[filename].dependencies[name] = '2.188.10';
  }
  downgraded['examples/workspace-starter/README.md'] = 'Using **Vellira 2.188.10 packages**.';
  assert.throws(() => verifyAtomicStarterTransition({ ...input, after: downgraded, version: '2.188.10' }), /downgrade/);
});

test('release-sync CLI never grants atomic admission from file names alone', () => {
  const source = fs.readFileSync('scripts/ci/release-sync-contract.mjs', 'utf8');
  assert.ok(source.includes('const detected = isReleaseSyncFileSet(files);'));
  assert.ok(source.includes('verifyAtomicCandidate({'));
  assert.ok(source.includes("VELLIRA_PUSH_ACTOR, 'vellira-release-sync[bot]'"));
  assert.ok(source.includes('Atomic sync parent must match base'));
});
