import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';

import {
  planCurrentProductionAdmission,
  planProductionPromotionSupersession,
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

test('only the newest safe promotion for current main is kept', () => {
  assert.deepEqual(
    planProductionPromotionSupersession({
      currentMainSha: B,
      runs: [
        run({ id: 1, candidateSha: B, runNumber: 10 }),
        run({ id: 2, candidateSha: B, runNumber: 11 }),
      ],
    }),
    { keep: [2], cancel: [1] }
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

test('newest current-main run is admitted and supersedes older waiting duplicate', () => {
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
      keep: [2],
      cancel: [1],
      admitCurrent: true,
      reason: 'admitted',
    }
  );
});

test('older duplicate is rejected without cancelling itself', () => {
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
      keep: [2],
      cancel: [],
      admitCurrent: false,
      reason: 'superseded_or_protected',
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
      reason: 'superseded_or_protected',
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
      keep: [1],
      cancel: [],
      admitCurrent: false,
      reason: 'current_run_missing',
    }
  );
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
