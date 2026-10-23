import assert from 'node:assert/strict';
import test from 'node:test';
import {
  planRuntimeCandidates,
  applyRuntimeCandidates,
  verifyRuntimeResolution,
} from './dependabot-runtime-candidates.mjs';

const workspace = `packages:\n  - 'packages/*'\n\noverrides:\n  'vite@<=6.4.2': 6.4.3\n  ip-address: 10.7.1\n\npatchedDependencies:\n  'node-forge@1.4.0': patches/node-forge@1.4.0.patch\n`;
const lock = `lockfileVersion: '9.0'\npackages:\n  vite@6.4.3:\n  vite@8.3.5:\n  glob@10.3.3:\n  glob@13.0.6:\n  ip-address@10.7.1:\n  '@node-minify/core@9.0.2':\nsnapshots:\n  next@16.4.2(patch_hash=abc):\n  node-forge@1.4.0(patch_hash=abc):\n    sharp: 0.35.5\n`;
function alert(name, patched, number = 1, scope = 'runtime', severity = 'high') {
  return {
    state: 'open', number,
    dependency: { scope, package: { name, ecosystem: 'npm' } },
    security_advisory: { severity },
    security_vulnerability: { first_patched_version: { identifier: patched } },
  };
}

test('patches Vite 6 and ip-address without updating Vite 8 or forge', () => {
  const p = planRuntimeCandidates([
    alert('vite', '6.4.4', 120), alert('ip-address', '10.7.4', 121),
    alert('next', '16.4.1', 136),
    alert('vite', '6.4.4', 900, 'development'),
  ], workspace, lock);
  assert.deepEqual(p.changes.map((e) => e.name), ['ip-address', 'vite']);
  assert.ok(p.alreadyPatched.some((e) => e.name === 'next') === false);
  assert.ok(p.ownerReview.some((e) => e.name === 'next'));
  const updated = applyRuntimeCandidates(workspace, p);
  assert.match(updated, /vite@<=6\.4\.3': 6\.4\.4/);
  assert.match(updated, /ip-address: 10\.7\.4/);
  assert.match(updated, /node-forge@1\.4\.0/);
  const resolved = lock.replaceAll('vite@6.4.3:', 'vite@6.4.4:')
    .replaceAll('ip-address@10.7.1:', 'ip-address@10.7.4:');
  assert.doesNotThrow(() => verifyRuntimeResolution(resolved, p));
  assert.throws(() => verifyRuntimeResolution(lock, p), /Missing/);
});

test('adds only scoped glob override when no glob security override exists', () => {
  const p = planRuntimeCandidates([alert('glob', '10.5.0', 141)], workspace, lock);
  assert.equal(p.changes.length, 1);
  const output = applyRuntimeCandidates(workspace, p);
  assert.match(output, /'@node-minify\/core>glob': 10\.5\.0/);
  assert.doesNotMatch(output, /^  glob: /m);
});

test('already patched version does not reopen a runtime candidate', () => {
  const safe = lock.replace('vite@6.4.3:', 'vite@6.4.4:');
  const p = planRuntimeCandidates([alert('vite', '6.4.4')], workspace, safe);
  assert.equal(p.changes.length, 0);
  assert.equal(p.alreadyPatched.length, 1);
});

test('future major and ambiguous scope cannot gain write authority', () => {
  const p = planRuntimeCandidates([
    alert('vite', '7.0.0'), alert('next', '16.4.3', 22),
    alert('forge', '2.0.0', 23), alert('vite', '6.4.4', 24, 'development'),
  ], workspace, lock);
  assert.equal(p.changes.length, 0);
  assert.equal(p.ownerReview.length, 3);
  assert.deepEqual(applyRuntimeCandidates(workspace, p), workspace);
});

test('rejects missing and stale override authority', () => {
  const plan = planRuntimeCandidates([alert('vite', '6.4.4')], workspace, lock);
  assert.throws(() => applyRuntimeCandidates(workspace.replace('6.4.3', '6.4.0'), plan), /Stale/);
  assert.throws(() => applyRuntimeCandidates(workspace, {schemaVersion:1,changes:[{...plan.changes[0],to:'7.0.0'}]}));
});

test('keeps exact adjacent package lines and fails on missing patch identities', () => {
  const plan = planRuntimeCandidates([alert('glob', '10.5.0')], workspace, lock);
  let next = lock.replace('glob@10.3.3:', 'glob@10.5.0:');
  assert.doesNotThrow(() => verifyRuntimeResolution(next, plan));
  next = next.replace('node-forge@1.4.0(patch_hash=abc)', 'node-forge@1.4.0');
  assert.throws(() => verifyRuntimeResolution(next, plan), /Forge/);
});
