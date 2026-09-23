import assert from 'node:assert/strict';
import test from 'node:test';

import {
  planCurrentProductionAdmission,
  promotionCandidateSha,
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

test('stale current run fails closed', () => {
  assert.deepEqual(
    planCurrentProductionAdmission({
      currentMainSha: B,
      currentRunId: 1,
      runs: [run({ id: 1, candidateSha: A, runNumber: 10 })],
    }),
    {
      ownerRunId: null,
      admitCurrent: false,
      reason: 'stale_candidate',
    }
  );
});

test('unrelated stale runs do not block the current-main owner', () => {
  assert.deepEqual(
    planCurrentProductionAdmission({
      currentMainSha: B,
      currentRunId: 2,
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

test('completed same-SHA runs do not retain admission ownership', () => {
  assert.deepEqual(
    planCurrentProductionAdmission({
      currentMainSha: B,
      currentRunId: 2,
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
      runs: [run({ id: 1, candidateSha: B, runNumber: 10 })],
    }),
    {
      ownerRunId: null,
      admitCurrent: false,
      reason: 'current_run_missing',
    }
  );
});

test('invalid identities fail closed', () => {
  assert.throws(() =>
    planCurrentProductionAdmission({
      currentMainSha: 'main',
      currentRunId: 1,
      runs: [],
    })
  );
  assert.throws(() =>
    planCurrentProductionAdmission({
      currentMainSha: B,
      currentRunId: 0,
      runs: [],
    })
  );
});
