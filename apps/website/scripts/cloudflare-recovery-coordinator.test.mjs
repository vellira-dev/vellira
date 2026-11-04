import assert from 'node:assert/strict';
import test from 'node:test';
import { decideRecovery, assertCompleteRecoveryHistory, fetchCandidateProductionRuns, observedMainPushAt } from './cloudflare-recovery-coordinator.mjs';

const a = 'a'.repeat(40);
const b = 'b'.repeat(40);
const now = Date.parse('2026-11-01T13:00:00Z');
const base = { mainSha: b, productionSha: a, stagingRuns: [], productionRuns: [], nowMs: now, mainUpdatedAt: '2026-11-01T12:55:00Z' };
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

test('defers only expensive recovery staging while main is still changing', () => {
  const plan = decideRecovery({ ...base, mainUpdatedAt: '2026-11-01T12:59:30Z' });
  assert.deepEqual(plan, { dispatch: false, reason: 'main_quiet_period' });
  assert.equal(decideRecovery({
    ...base, mainUpdatedAt: '2026-11-01T12:57:00Z',
  }).target, 'staging');
});

test('verified staging remains eligible during quiet period', () => {
  const plan = decideRecovery({
    ...base, mainUpdatedAt: '2026-11-01T12:59:30Z', stagingRuns: [stage],
  });
  assert.equal(plan.target, 'production');
  assert.equal(plan.reason, 'verified_staging_without_production');
});

test('active production and current production remain dominant during quiet period', () => {
  const input = { ...base, mainUpdatedAt: '2026-11-01T12:59:30Z' };
  assert.equal(decideRecovery({ ...input, productionSha: b }).reason, 'already_deployed');
  assert.equal(decideRecovery({
    ...input, productionRuns: [{ status: 'in_progress' }],
  }).reason, 'production_active');
});

test('invalid commit timestamps are rejected rather than used as admission evidence', () => {
  assert.throws(() => decideRecovery({
    ...base, mainUpdatedAt: 'invalid',
  }), /Invalid immutable main commit date/);
});

test('one failed explicit recovery is terminal and requires investigation', () => {
  const plan = decideRecovery({
    ...base,
    stagingRuns: [{ head_sha: b, event: 'workflow_dispatch', status: 'completed',
      conclusion: 'failure', recoveryAttempt: true }],
  });
  assert.deepEqual(plan, { dispatch: false, reason: 'failed_recovery_requires_review',
    requiresReview: true });
});

test('recovery budget is bounded per SHA and resets for a newer main', () => {
  const earlier = [{ head_sha: b, event: 'workflow_dispatch', status: 'completed',
    conclusion: 'failure', recoveryAttempt: true }];
  const duplicate = decideRecovery({ ...base, stagingRuns: [...earlier, ...earlier] });
  assert.equal(duplicate.reason, 'recovery_budget_exceeded');
  assert.equal(duplicate.requiresReview, true);
  const latest = decideRecovery({
    ...base, mainSha: 'c'.repeat(40), stagingRuns: earlier,
    mainUpdatedAt: '2026-11-01T12:55:00Z',
  });
  assert.equal(latest.target, 'staging');
});

test('rapid A B C merges select latest main only after its quiet period', () => {
  const earlier = [a, b].map(sha => ({ head_sha: sha, event: 'workflow_dispatch',
    status: 'completed', conclusion: 'failure', recoveryAttempt: true }));
  const latestSha = 'c'.repeat(40);
  assert.equal(decideRecovery({
    ...base, mainSha: latestSha, stagingRuns: earlier,
    mainUpdatedAt: '2026-11-01T12:59:30Z',
  }).reason, 'main_quiet_period');
  assert.equal(decideRecovery({
    ...base, mainSha: latestSha, stagingRuns: earlier,
    mainUpdatedAt: '2026-11-01T12:56:00Z',
  }).target, 'staging');
});

test('failed recovery takes precedence over an older qualified staging candidate', () => {
  const result = decideRecovery({
    ...base, stagingRuns: [
      stage,
      { head_sha: b, event: 'workflow_dispatch', status: 'completed',
        conclusion: 'failure', recoveryAttempt: true },
    ],
  });
  assert.deepEqual(result, {
    dispatch: false, reason: 'failed_recovery_requires_review', requiresReview: true,
  });
});

test('a failed recovery does not override already-deployed production', () => {
  assert.equal(decideRecovery({
    ...base, productionSha: b,
    stagingRuns: [{ head_sha: b, recoveryAttempt: true,
      status: 'completed', conclusion: 'failure' }],
  }).reason, 'already_deployed');
});

test('incomplete production and staging histories fail closed before replay', () => {
  assert.throws(() => assertCompleteRecoveryHistory({
    total_count: 100, workflow_runs: [],
  }, 'Production'), /requires pagination/);
  assert.throws(() => assertCompleteRecoveryHistory({
    total_count: 100, workflow_runs: [],
  }, 'Staging'), /requires pagination/);
  assert.throws(() => assertCompleteRecoveryHistory({
    workflow_runs: [],
  }, 'Production'), /history count missing/);
  assert.deepEqual(assertCompleteRecoveryHistory({
    total_count: 1, workflow_runs: [{ id: 123 }],
  }, 'Production').workflow_runs, [{ id: 123 }]);
});

test('candidate-scoped history excludes unrelated accumulated production runs', async () => {
  const result = await fetchCandidateProductionRuns(async since => {
    assert.equal(since, '2026-11-01T12:50:00Z');
    return { total_count: 1, workflow_runs: [{
      id: 1, display_title: 'Promote staging ' + b,
      event: 'workflow_dispatch', status: 'completed',
    }] };
  }, '2026-11-01T12:50:00Z');
  assert.equal(decideRecovery({ ...base, stagingRuns: [stage], productionRuns: result }).reason,
    'verified_replay_already_attempted');
});

test('candidate-scoped query fails closed on truncated results or missing push', async () => {
  await assert.rejects(fetchCandidateProductionRuns(async () => ({
    total_count: 100, workflow_runs: [],
  }), '2026-11-01T12:50:00Z'), /requires pagination/);
  await assert.rejects(fetchCandidateProductionRuns(async () => ({
    total_count: 0, workflow_runs: [],
  }), null), /Missing reliable main push observation/);
});

test('quiet window follows observed push timestamp rather than git committer date', () => {
  const latest = observedMainPushAt([
    { head_sha: b, event: 'push', created_at: '2026-11-01T12:59:30Z' },
    { head_sha: b, event: 'workflow_dispatch', created_at: '2026-11-01T12:59:59Z' },
  ], b);
  assert.equal(latest, '2026-11-01T12:59:30.000Z');
  assert.equal(decideRecovery({ ...base, mainUpdatedAt: latest }).reason, 'main_quiet_period');
  assert.equal(observedMainPushAt([], b), null);
});

test('missing push evidence blocks recovery staging instead of bypassing the quiet period', () => {
  assert.deepEqual(decideRecovery({ ...base, mainUpdatedAt: null }), {
    dispatch: false,
    reason: 'main_push_observation_missing',
    requiresReview: true,
  });
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


test('skipped release-sync cannot hide a successful fully verified staging run', () => {
  assert.equal(decideRecovery({
    ...base,
    stagingRuns: [
      { head_sha: b, event: 'push', status: 'completed', conclusion: 'success', fullStage: false },
      stage,
    ],
  }).target, 'production');
});

test('failed push remains terminal even with an older qualified staging run', () => {
  const plan = decideRecovery({
    ...base,
    stagingRuns: [
      stage,
      { head_sha: b, event: 'push', status: 'completed',
        conclusion: 'failure', fullStage: false },
    ],
  });
  assert.deepEqual(plan, {
    dispatch: false, reason: 'failed_staging_requires_review',
  });
});
