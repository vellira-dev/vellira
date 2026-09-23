import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';

import {
  planCurrentProductionAdmission,
  planProductionPromotionSupersession,
  settlePendingApprovalTargets,
  promotionCandidateSha,
} from './cloudflare-production-promotion-supersede.mjs';

const A = 'a'.repeat(40);
const B = 'b'.repeat(40);

function run({
  id,
  candidateSha,
  runNumber,
  status = 'in_progress',
  deployStatus = 'waiting',
}) {
  return {
    id,
    runNumber,
    status,
    deployStatus,
    displayTitle: `Promote staging ${candidateSha}`,
  };
}

test('promotion title parsing is exact and ignores emergency runs', () => {
  assert.equal(promotionCandidateSha(`Promote staging ${A}`), A);
  assert.equal(promotionCandidateSha(`Promote staging ${A} extra`), null);
  assert.equal(promotionCandidateSha(`Emergency production recovery ${A}`), null);
});

test('stale waiting approvals are cancelled when main advances', () => {
  assert.deepEqual(
    planProductionPromotionSupersession({
      currentMainSha: B,
      runs: [run({ id: 1, candidateSha: A, runNumber: 10 })],
    }),
    { keep: [], cancel: [1] }
  );
});

test('standalone cleanup never supersedes current-main duplicate approvals', () => {
  assert.deepEqual(
    planProductionPromotionSupersession({
      currentMainSha: B,
      runs: [
        run({ id: 1, candidateSha: B, runNumber: 10 }),
        run({ id: 2, candidateSha: B, runNumber: 11 }),
      ],
    }),
    { keep: [1, 2], cancel: [] }
  );
});

test('approved or active production deploy is never cancelled', () => {
  assert.deepEqual(
    planProductionPromotionSupersession({
      currentMainSha: B,
      runs: [
        run({
          id: 1,
          candidateSha: A,
          runNumber: 10,
          deployStatus: 'in_progress',
        }),
        run({ id: 2, candidateSha: B, runNumber: 11 }),
      ],
    }),
    { keep: [1, 2], cancel: [] }
  );
});

test('queued post-approval deploy is preserved and duplicate waiting run is cancelled', () => {
  assert.deepEqual(
    planProductionPromotionSupersession({
      currentMainSha: B,
      runs: [
        run({
          id: 1,
          candidateSha: B,
          runNumber: 10,
          deployStatus: 'queued',
        }),
        run({ id: 2, candidateSha: B, runNumber: 11 }),
      ],
    }),
    { keep: [1], cancel: [2] }
  );
});

test('completed deploy stays protected while post-deploy follow-up is active', () => {
  assert.deepEqual(
    planProductionPromotionSupersession({
      currentMainSha: B,
      runs: [
        run({
          id: 1,
          candidateSha: A,
          runNumber: 10,
          status: 'in_progress',
          deployStatus: 'completed',
        }),
      ],
    }),
    { keep: [1], cancel: [] }
  );
});

test('completed runs do not participate in supersession', () => {
  assert.deepEqual(
    planProductionPromotionSupersession({
      currentMainSha: B,
      runs: [
        run({
          id: 1,
          candidateSha: A,
          runNumber: 10,
          status: 'completed',
          deployStatus: 'completed',
        }),
      ],
    }),
    { keep: [], cancel: [] }
  );
});

test('oldest current-main candidate owns admission without cancelling a rerun', () => {
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
      keep: [1],
      cancel: [],
      admitCurrent: true,
      reason: 'admitted',
    }
  );
});

test('newer same-SHA rerun is rejected without cancelling the pending owner', () => {
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
      keep: [1],
      cancel: [],
      admitCurrent: false,
      reason: 'existing_current_candidate',
    }
  );
});

test('admitted current candidate cancels only stale unprotected SHAs', () => {
  assert.deepEqual(
    planCurrentProductionAdmission({
      currentMainSha: B,
      currentRunId: 2,
      runs: [
        run({ id: 1, candidateSha: A, runNumber: 10 }),
        run({ id: 2, candidateSha: B, runNumber: 11 }),
        run({
          id: 3,
          candidateSha: A,
          runNumber: 12,
          deployStatus: 'in_progress',
        }),
      ],
    }),
    {
      keep: [2, 3],
      cancel: [1],
      admitCurrent: true,
      reason: 'admitted',
    }
  );
});

test('stale current run is rejected without self-cancellation', () => {
  assert.deepEqual(
    planCurrentProductionAdmission({
      currentMainSha: B,
      currentRunId: 1,
      runs: [run({ id: 1, candidateSha: A, runNumber: 10 })],
    }),
    {
      keep: [],
      cancel: [],
      admitCurrent: false,
      reason: 'stale_candidate',
    }
  );
});

test('protected current-main deploy prevents a new duplicate from admission', () => {
  assert.deepEqual(
    planCurrentProductionAdmission({
      currentMainSha: B,
      currentRunId: 2,
      runs: [
        run({
          id: 1,
          candidateSha: B,
          runNumber: 10,
          deployStatus: 'in_progress',
        }),
        run({ id: 2, candidateSha: B, runNumber: 11 }),
      ],
    }),
    {
      keep: [1],
      cancel: [],
      admitCurrent: false,
      reason: 'existing_current_candidate',
    }
  );
});

test('missing current run fails closed without cancelling unrelated promotions', () => {
  assert.deepEqual(
    planCurrentProductionAdmission({
      currentMainSha: B,
      currentRunId: 99,
      runs: [run({ id: 1, candidateSha: B, runNumber: 10 })],
    }),
    {
      keep: [],
      cancel: [],
      admitCurrent: false,
      reason: 'current_run_missing',
    }
  );
});

test('pending environment is rejected and must settle before cleanup succeeds', async () => {
  const events = [];
  const result = await settlePendingApprovalTargets({
    runIds: [1],
    inspectTarget: async () => {
      events.push('inspect');
      return {
        runStatus: 'in_progress',
        pendingEnvironmentIds: [101],
      };
    },
    rejectPendingTarget: async (runId, environmentIds) => {
      events.push(`reject:${runId}:${environmentIds.join(',')}`);
    },
    waitForCompletion: async () => {
      events.push('settled');
      return {
        status: 'completed',
        conclusion: 'failure',
      };
    },
  });

  assert.deepEqual(result, {
    ok: true,
    reason: 'settled',
    targetRunId: null,
    rejected: [1],
    skipped: [],
  });
  assert.deepEqual(events, ['inspect', 'reject:1:101', 'settled']);
});

test('approval that already crossed the pending boundary is never workflow-cancelled', async () => {
  let rejectionCalls = 0;
  const result = await settlePendingApprovalTargets({
    runIds: [1],
    inspectTarget: async () => ({
      runStatus: 'in_progress',
      pendingEnvironmentIds: [],
    }),
    rejectPendingTarget: async () => {
      rejectionCalls += 1;
    },
    waitForCompletion: async () => ({ status: 'completed' }),
  });

  assert.deepEqual(result, {
    ok: true,
    reason: 'settled',
    targetRunId: null,
    rejected: [],
    skipped: [1],
  });
  assert.equal(rejectionCalls, 0);
});

test('pending review rejection race fails closed instead of falling back to cancel', async () => {
  await assert.rejects(
    settlePendingApprovalTargets({
      runIds: [1],
      inspectTarget: async () => ({
        runStatus: 'in_progress',
        pendingEnvironmentIds: [101],
      }),
      rejectPendingTarget: async () => {
        throw new Error('pending deployment is no longer reviewable');
      },
      waitForCompletion: async () => ({ status: 'completed' }),
    }),
    /no longer reviewable/
  );
});

test('accepted pending rejection does not settle while target remains active', async () => {
  const result = await settlePendingApprovalTargets({
    runIds: [1],
    inspectTarget: async () => ({
      runStatus: 'in_progress',
      pendingEnvironmentIds: [101],
    }),
    rejectPendingTarget: async () => {},
    waitForCompletion: async () => null,
  });

  assert.deepEqual(result, {
    ok: false,
    reason: 'rejection_not_settled',
    targetRunId: 1,
    rejected: [],
    skipped: [],
  });
});

test('invalid main identity fails closed', () => {
  assert.throws(() =>
    planProductionPromotionSupersession({
      currentMainSha: 'main',
      runs: [],
    })
  );
});

test('supersession workflow is push-only, write-capable and independently self-cancelling', async () => {
  const workflow = await fs.readFile(
    '.github/workflows/supersede-stale-production-promotions.yml',
    'utf8'
  );

  assert.match(workflow, /push:\n {4}branches: \[main\]/);
  assert.doesNotMatch(workflow, /workflow_run:/);
  assert.match(workflow, /actions: write/);
  assert.match(
    workflow,
    /group: supersede-stale-production-promotions\n {2}cancel-in-progress: true/
  );
  assert.match(
    workflow,
    /node apps\/website\/scripts\/cloudflare-production-promotion-supersede\.mjs/
  );
});
