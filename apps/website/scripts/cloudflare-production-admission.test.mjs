import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assessProductionAdmissionEligibility,
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

test('expected superseded admission is ineligible without throwing', async () => {
  const state = await assessProductionAdmissionEligibility({
    candidateSha: A,
    mainSha: B,
    repository: 'vellira-dev/vellira',
    githubToken: 'test-token',
    assess: async () => {
      const { ProductionCandidateSupersededError } = await import(
        './cloudflare-production-freshness.mjs'
      );
      throw new ProductionCandidateSupersededError('stale candidate', {
        candidateSha: A,
        mainSha: B,
        relevantPaths: ['apps/website/app/page.tsx'],
      });
    },
  });
  assert.equal(state.deploymentEquivalent, false);
  assert.equal(state.superseded, true);
  assert.deepEqual(state.relevantPaths, ['apps/website/app/page.tsx']);
  const plan = planCurrentProductionAdmission({
    currentMainSha: B,
    currentRunId: 1,
    runs: [run({ id: 1, candidateSha: A, runNumber: 10 })],
    currentCandidateEligible: state.deploymentEquivalent,
  });
  assert.equal(plan.admitCurrent, false);
  assert.equal(plan.reason, 'stale_candidate');
});

test('untrusted admission and GitHub API errors remain fatal', async () => {
  for (const reason of [
    'GitHub API not reachable',
    'GitHub compare ambiguous',
  ]) {
    await assert.rejects(
      assessProductionAdmissionEligibility({
        candidateSha: A,
        mainSha: B,
        repository: 'vellira-dev/vellira',
        githubToken: 'test-token',
        assess: async () => {
          throw new Error(reason);
        },
      }),
      new RegExp(reason)
    );
  }
});
