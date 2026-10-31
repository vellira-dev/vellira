import assert from 'node:assert/strict';
import test from 'node:test';
import { decideRecovery } from './cloudflare-recovery-coordinator.mjs';

const a = 'a'.repeat(40);
const b = 'b'.repeat(40);
const base = { mainSha: b, productionSha: a, stagingRuns: [], productionRuns: [] };
test('dispatches one recovery for genuinely un-staged main', () => {
  assert.equal(decideRecovery(base).dispatch, true);
});
test('never retries deployed main', () => {
  assert.equal(decideRecovery({ ...base, productionSha: b }).dispatch, false);
});
test('never duplicates a full or failed recovery for the same SHA', () => {
  for (const status of ['completed', 'in_progress', 'queued']) {
    assert.equal(decideRecovery({ ...base, stagingRuns: [{ head_sha: b, event: 'workflow_dispatch', status, recoveryAttempt: true }] }).dispatch, false);
  }
});
test('does not race ongoing production', () => {
  assert.equal(decideRecovery({ ...base, productionRuns: [{ status: 'in_progress' }] }).dispatch, false);
});
test('does not stage after a push staging run of the same main', () => {
  assert.equal(decideRecovery({ ...base, stagingRuns: [{ head_sha: b, event: 'push', status: 'completed', fullStage: true }] }).dispatch, false);
});
test('fails closed for malformed SHA and run lists', () => {
  assert.throws(() => decideRecovery({ ...base, mainSha: 'not-sha' }));
  assert.throws(() => decideRecovery({ ...base, stagingRuns: null }));
});

test('ignores release-sync successful outer staging with skipped deploy', () => {
  const runs = [{ head_sha: b, event: 'push', status: 'completed', conclusion: 'success', fullStage: false }];
  assert.equal(decideRecovery({ ...base, stagingRuns: runs }).dispatch, true);
});
test('ignores unrelated manual preview but recognizes an explicit recovery attempt', () => {
  assert.equal(decideRecovery({ ...base, stagingRuns: [{ head_sha: b, event: 'workflow_dispatch', fullStage: false }] }).dispatch, true);
  assert.equal(decideRecovery({ ...base, stagingRuns: [{ head_sha: b, event: 'workflow_dispatch', recoveryAttempt: true }] }).dispatch, false);
});
