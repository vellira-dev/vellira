import assert from 'node:assert/strict';
import test from 'node:test';
import { decideRecovery } from './cloudflare-recovery-coordinator.mjs';

const a = 'a'.repeat(40);
const b = 'b'.repeat(40);
const now = Date.parse('2026-11-01T13:00:00Z');
const base = { mainSha: b, productionSha: a, stagingRuns: [], productionRuns: [], nowMs: now };
const stage = {
  id: 123,
  head_sha: b,
  run_attempt: 1,
  event: 'push',
  status: 'completed',
  conclusion: 'success',
  fullStage: true,
  updated_at: '2026-11-01T12:00:00Z',
};

test('starts staging when current main has never been staged', () => {
  assert.deepEqual(decideRecovery(base), {
    dispatch: true,
    target: 'staging',
    reason: 'production_behind_unstaged_main',
  });
});

test('already-deployed main is never replayed', () => {
  assert.equal(decideRecovery({ ...base, productionSha: b }).dispatch, false);
});

test('replays existing verified staging without rebuilding it', () => {
  assert.deepEqual(decideRecovery({ ...base, stagingRuns: [stage] }), {
    dispatch: true,
    target: 'production',
    reason: 'verified_staging_without_production',
    stagingRunId: 123,
    stagingRunAttempt: 1,
  });
});

test('gives workflow_run time to start before replay', () => {
  assert.equal(
    decideRecovery({
      ...base,
      stagingRuns: [{ ...stage, updated_at: '2026-11-01T12:50:00Z' }],
    }).reason,
    'allow_workflow_run_propagation'
  );
});

test('does not duplicate a running or completed verified replay', () => {
  for (const status of ['completed', 'in_progress', 'waiting']) {
    assert.equal(decideRecovery({
      ...base,
      stagingRuns: [stage],
      productionRuns: [{
        status,
        event: 'workflow_dispatch',
        display_title: 'Promote staging ' + b,
      }],
    }).dispatch, false);
  }
});

test('does not race existing promotion, even one waiting for approval', () => {
  const plan = decideRecovery({
    ...base,
    stagingRuns: [stage],
    productionRuns: [{ status: 'waiting', event: 'workflow_run', display_title: 'Promote staging ' + b }],
  });
  assert.equal(plan.reason, 'promotion_exists_for_main');
});

test('does not retry a failed production promotion automatically', () => {
  assert.equal(decideRecovery({
    ...base,
    stagingRuns: [stage],
    productionRuns: [{ status: 'completed', conclusion: 'failure', display_title: 'Promote staging ' + b }],
  }).reason, 'failed_promotion_requires_review');
});

test('a successful production deployment with a mismatched runtime requires investigation', () => {
  assert.equal(decideRecovery({
    ...base,
    stagingRuns: [stage],
    productionRuns: [{ status: 'completed', conclusion: 'success', actualDeploy: true, display_title: 'Promote staging ' + b }],
  }).reason, 'production_runtime_mismatch_requires_review');
});

test('outer production head_sha is not proof of candidate identity', () => {
  const plan = decideRecovery({
    ...base,
    stagingRuns: [stage],
    productionRuns: [{
      head_sha: b,
      display_title: 'Promote staging ' + a,
      event: 'workflow_run',
      status: 'completed',
      conclusion: 'success',
    }],
  });
  assert.equal(plan.target, 'production');
});

test('never retries a failed recovery staging for the same SHA', () => {
  for (const status of ['completed', 'in_progress', 'queued']) {
    assert.equal(decideRecovery({
      ...base,
      stagingRuns: [{ head_sha: b, event: 'workflow_dispatch', status, recoveryAttempt: true }],
    }).dispatch, false);
  }
});

test('does not race an active production build', () => {
  assert.equal(decideRecovery({
    ...base, productionRuns: [{ status: 'in_progress' }],
  }).dispatch, false);
});

test('does not restart a pending staging run', () => {
  assert.equal(decideRecovery({
    ...base,
    stagingRuns: [{ head_sha: b, event: 'push', status: 'in_progress' }],
  }).dispatch, false);
});

test('ignores release sync staging with a skipped deploy', () => {
  assert.equal(decideRecovery({
    ...base,
    stagingRuns: [{ head_sha: b, event: 'push', status: 'completed', conclusion: 'success', fullStage: false }],
  }).target, 'staging');
});

test('invalid identifiers and input lists fail closed', () => {
  assert.throws(() => decideRecovery({ ...base, mainSha: 'invalid' }));
  assert.throws(() => decideRecovery({ ...base, stagingRuns: null }));
  assert.throws(() => decideRecovery({
    ...base, stagingRuns: [{ ...stage, id: 0 }],
  }));
});

test('failed staging after Cloudflare deploy must not trigger another deploy', () => {
  const plan = decideRecovery({
    ...base,
    stagingRuns: [{
      head_sha: b,
      event: 'push',
      status: 'completed',
      conclusion: 'failure',
      fullStage: false,
    }],
  });
  assert.deepEqual(plan, {
    dispatch: false,
    reason: 'failed_staging_requires_review',
  });
});

test('failed recovery is terminal for the exact commit, even if push was absent', () => {
  assert.equal(decideRecovery({
    ...base,
    stagingRuns: [{
      head_sha: b,
      event: 'workflow_dispatch',
      recoveryAttempt: true,
      status: 'completed',
      conclusion: 'failure',
    }],
  }).reason, 'failed_staging_requires_review');
});

test('failed staging cannot be hidden by a skipped release-sync staging run', () => {
  assert.equal(decideRecovery({
    ...base,
    stagingRuns: [
      { head_sha: b, event: 'push', status: 'completed', conclusion: 'failure' },
      { head_sha: b, event: 'push', status: 'completed', conclusion: 'success', fullStage: false },
    ],
  }).dispatch, false);
});

test('cancelled or timed-out staging cannot trigger an automatic redeploy', () => {
  for (const conclusion of ['cancelled', 'timed_out', 'action_required']) {
    assert.equal(decideRecovery({
      ...base,
      stagingRuns: [{ head_sha: b, event: 'push', status: 'completed', conclusion }],
    }).reason, 'failed_staging_requires_review');
  }
});
