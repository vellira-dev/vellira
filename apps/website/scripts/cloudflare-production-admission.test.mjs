import assert from 'node:assert/strict';
import test from 'node:test';

import {
  forceCancelSupersededProductionRun,
  planCurrentProductionAdmission,
  promotionCandidateSha,
  supersededProductionRunIds,
} from './cloudflare-production-admission.mjs';

const A = 'a'.repeat(40);
const B = 'b'.repeat(40);

function run({
  id,
  candidateSha,
  runNumber,
  status = 'in_progress',
}) {
  return {
    id,
    runNumber,
    status,
    displayTitle: `Promote staging ${candidateSha}`,
  };
}

test('promotion title parsing is exact and ignores emergency recovery', () => {
  assert.equal(promotionCandidateSha(`Promote staging ${A}`), A);
  assert.equal(promotionCandidateSha(`Promote staging ${A} extra`), null);
  assert.equal(promotionCandidateSha(`Emergency production recovery ${A}`), null);
});

test('oldest active current-main candidate owns admission', () => {
  assert.deepEqual(
    planCurrentProductionAdmission({
      currentMainSha: B,
      currentRunId: 1,
      currentCandidateEligible: true,
      runs: [
        run({ id: 1, candidateSha: B, runNumber: 10 }),
        run({ id: 2, candidateSha: B, runNumber: 11 }),
      ],
    }),
    {
      ownerRunId: 1,
      admitCurrent: true,
      reason: 'admitted',
    }
  );
});

test('newer same-SHA rerun fails closed without mutating the owner', () => {
  assert.deepEqual(
    planCurrentProductionAdmission({
      currentMainSha: B,
      currentRunId: 2,
      currentCandidateEligible: true,
      runs: [
        run({ id: 1, candidateSha: B, runNumber: 10 }),
        run({ id: 2, candidateSha: B, runNumber: 11 }),
      ],
    }),
    {
      ownerRunId: 1,
      admitCurrent: false,
      reason: 'existing_current_candidate',
    }
  );
});

test('deployment-ineligible current run fails closed', () => {
  assert.deepEqual(
    planCurrentProductionAdmission({
      currentMainSha: B,
      currentRunId: 1,
      currentCandidateEligible: false,
      runs: [run({ id: 1, candidateSha: A, runNumber: 10 })],
    }),
    {
      ownerRunId: null,
      admitCurrent: false,
      reason: 'stale_candidate',
    }
  );
});

test('deployment-equivalent ancestor can own admission when no exact-main promotion exists', () => {
  assert.deepEqual(
    planCurrentProductionAdmission({
      currentMainSha: B,
      currentRunId: 1,
      currentCandidateEligible: true,
      runs: [run({ id: 1, candidateSha: A, runNumber: 10 })],
    }),
    {
      ownerRunId: 1,
      admitCurrent: true,
      reason: 'admitted',
    }
  );
});

test('exact-main promotion supersedes an equivalent ancestor promotion', () => {
  assert.deepEqual(
    planCurrentProductionAdmission({
      currentMainSha: B,
      currentRunId: 1,
      currentCandidateEligible: true,
      runs: [
        run({ id: 1, candidateSha: A, runNumber: 10 }),
        run({ id: 2, candidateSha: B, runNumber: 11 }),
      ],
    }),
    {
      ownerRunId: 2,
      admitCurrent: false,
      reason: 'existing_current_candidate',
    }
  );
});

test('unrelated stale runs do not block the current-main owner', () => {
  assert.deepEqual(
    planCurrentProductionAdmission({
      currentMainSha: B,
      currentRunId: 2,
      currentCandidateEligible: true,
      runs: [
        run({ id: 1, candidateSha: A, runNumber: 10 }),
        run({ id: 2, candidateSha: B, runNumber: 11 }),
      ],
    }),
    {
      ownerRunId: 2,
      admitCurrent: true,
      reason: 'admitted',
    }
  );
});


test('admitted exact-main promotion supersedes only older waiting or pending stale candidates', () => {
  const runs = [
    run({ id: 1, candidateSha: A, runNumber: 10, status: 'waiting' }),
    run({ id: 2, candidateSha: A, runNumber: 11, status: 'pending' }),
    run({ id: 3, candidateSha: A, runNumber: 12, status: 'in_progress' }),
    run({ id: 4, candidateSha: B, runNumber: 13, status: 'in_progress' }),
    run({ id: 5, candidateSha: A, runNumber: 14, status: 'waiting' }),
  ];

  assert.deepEqual(
    supersededProductionRunIds({
      currentRunId: 4,
      runs,
      admitCurrent: true,
    }),
    [1, 2]
  );
});

test('supersede planning never cancels when current promotion was not admitted', () => {
  assert.deepEqual(
    supersededProductionRunIds({
      currentRunId: 2,
      admitCurrent: false,
      runs: [
        run({ id: 1, candidateSha: A, runNumber: 10, status: 'waiting' }),
        run({ id: 2, candidateSha: B, runNumber: 11, status: 'waiting' }),
      ],
    }),
    []
  );
});

test('same-candidate waiting promotion is never treated as stale cancellation target', () => {
  assert.deepEqual(
    supersededProductionRunIds({
      currentRunId: 2,
      admitCurrent: true,
      runs: [
        run({ id: 1, candidateSha: B, runNumber: 10, status: 'waiting' }),
        run({ id: 2, candidateSha: B, runNumber: 11, status: 'in_progress' }),
      ],
    }),
    []
  );
});


test('force-cancel rechecks a stale waiting run immediately before mutation', async () => {
  const calls = [];
  const request = async (path, options = {}) => {
    calls.push({ path, method: options.method ?? 'GET' });
    if ((options.method ?? 'GET') === 'GET') {
      return {
        id: 1,
        run_number: 10,
        status: 'waiting',
        display_title: `Promote staging ${A}`,
      };
    }
    return null;
  };

  assert.deepEqual(
    await forceCancelSupersededProductionRun({
      repository: 'vellira-dev/vellira',
      currentRunId: 2,
      currentRunNumber: 11,
      currentCandidateSha: B,
      targetRunId: 1,
      request,
    }),
    {
      runId: 1,
      forceCancelled: true,
      observedStatus: 'waiting',
    }
  );
  assert.deepEqual(calls, [
    {
      path: '/repos/vellira-dev/vellira/actions/runs/1',
      method: 'GET',
    },
    {
      path: '/repos/vellira-dev/vellira/actions/runs/1/force-cancel',
      method: 'POST',
    },
  ]);
});

test('force-cancel refuses a stale run that became in-progress before mutation', async () => {
  const calls = [];
  const request = async (path, options = {}) => {
    calls.push({ path, method: options.method ?? 'GET' });
    return {
      id: 1,
      run_number: 10,
      status: 'in_progress',
      display_title: `Promote staging ${A}`,
    };
  };

  assert.deepEqual(
    await forceCancelSupersededProductionRun({
      repository: 'vellira-dev/vellira',
      currentRunId: 2,
      currentRunNumber: 11,
      currentCandidateSha: B,
      targetRunId: 1,
      request,
    }),
    {
      runId: 1,
      forceCancelled: false,
      observedStatus: 'in_progress',
    }
  );
  assert.deepEqual(calls, [
    {
      path: '/repos/vellira-dev/vellira/actions/runs/1',
      method: 'GET',
    },
  ]);
});

test('completed same-SHA runs do not retain admission ownership', () => {
  assert.deepEqual(
    planCurrentProductionAdmission({
      currentMainSha: B,
      currentRunId: 2,
      currentCandidateEligible: true,
      runs: [
        run({
          id: 1,
          candidateSha: B,
          runNumber: 10,
          status: 'completed',
        }),
        run({ id: 2, candidateSha: B, runNumber: 11 }),
      ],
    }),
    {
      ownerRunId: 2,
      admitCurrent: true,
      reason: 'admitted',
    }
  );
});

test('missing current run fails closed', () => {
  assert.deepEqual(
    planCurrentProductionAdmission({
      currentMainSha: B,
      currentRunId: 99,
      currentCandidateEligible: true,
      runs: [run({ id: 1, candidateSha: B, runNumber: 10 })],
    }),
    {
      ownerRunId: null,
      admitCurrent: false,
      reason: 'current_run_missing',
    }
  );
});

test('missing deployment eligibility decision fails closed', () => {
  assert.throws(
    () =>
      planCurrentProductionAdmission({
        currentMainSha: B,
        currentRunId: 1,
        runs: [run({ id: 1, candidateSha: B, runNumber: 10 })],
      }),
    /currentCandidateEligible must be boolean/
  );
});

test('invalid identities fail closed', () => {
  assert.throws(() =>
    planCurrentProductionAdmission({
      currentMainSha: 'main',
      currentRunId: 1,
      currentCandidateEligible: true,
      runs: [],
    })
  );
  assert.throws(() =>
    planCurrentProductionAdmission({
      currentMainSha: B,
      currentRunId: 0,
      currentCandidateEligible: true,
      runs: [],
    })
  );
});
