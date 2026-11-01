import assert from 'node:assert/strict';
import test from 'node:test';
import { validateVerifiedStagingReplay } from './cloudflare-verified-promotion-replay.mjs';

const SHA = 'a'.repeat(40);
const REPO = 'vellira-dev/vellira';
const RUN_ID = 41991;
const RUN_ATTEMPT = 2;
const stage = {
  id: RUN_ID,
  run_attempt: RUN_ATTEMPT,
  repository: { full_name: REPO },
  path: '.github/workflows/deploy-website-cloudflare-staging.yml',
  head_branch: 'main',
  head_sha: SHA,
  event: 'push',
  status: 'completed',
  conclusion: 'success',
};
const jobs = {
  total_count: 1,
  jobs: [
    {
      name: 'Build, deploy, and verify merged main on website staging',
      conclusion: 'success',
    },
  ],
};

function check(run = stage, jobResult = jobs, options = {}) {
  return validateVerifiedStagingReplay({
    candidateSha: SHA,
    stagingRunId: RUN_ID,
    stagingRunAttempt: RUN_ATTEMPT,
    repository: REPO,
    githubGet: async (path) => (path.endsWith('/jobs?per_page=100') ? jobResult : run),
    maxCompletionPolls: 0,
    ...options,
  });
}

test('verified replay accepts an exact successful staging run', async () => {
  assert.deepEqual(await check(), {
    eventName: 'push',
    stagingRunId: RUN_ID,
    stagingRunAttempt: RUN_ATTEMPT,
  });
});

test('verified recovery staging is eligible only with exact validated run', async () => {
  const result = await check({ ...stage, event: 'workflow_dispatch' });
  assert.equal(result.eventName, 'workflow_dispatch');
});

test('direct handoff waits for successful staging completion before promotion', async () => {
  let runReads = 0;
  const result = await validateVerifiedStagingReplay({
    candidateSha: SHA,
    stagingRunId: RUN_ID,
    stagingRunAttempt: RUN_ATTEMPT,
    repository: REPO,
    githubGet: async (path) => {
      if (path.endsWith('/jobs?per_page=100')) return jobs;
      runReads += 1;
      return runReads === 1
        ? { ...stage, status: 'in_progress', conclusion: null }
        : stage;
    },
    waitForCompletion: async () => {},
    maxCompletionPolls: 2,
    completionPollMs: 0,
  });
  assert.equal(runReads, 2);
  assert.equal(result.stagingRunId, RUN_ID);
});

test('incomplete staging cannot authorize production after bounded polling', async () => {
  let runReads = 0;
  await assert.rejects(
    validateVerifiedStagingReplay({
      candidateSha: SHA,
      stagingRunId: RUN_ID,
      stagingRunAttempt: RUN_ATTEMPT,
      repository: REPO,
      githubGet: async (path) => {
        if (path.endsWith('/jobs?per_page=100')) return jobs;
        runReads += 1;
        return { ...stage, status: 'in_progress', conclusion: null };
      },
      waitForCompletion: async () => {},
      maxCompletionPolls: 2,
      completionPollMs: 0,
    }),
    /Staging is not completed/
  );
  assert.equal(runReads, 3);
});

test('wrong SHA, attempt, event and branch are rejected before promotion', async () => {
  for (const run of [
    { ...stage, head_sha: 'b'.repeat(40) },
    { ...stage, run_attempt: RUN_ATTEMPT + 1 },
    { ...stage, head_branch: 'feature' },
    { ...stage, event: 'pull_request' },
    { ...stage, conclusion: 'failure' },
    { ...stage, status: 'in_progress' },
    { ...stage, path: 'another.yml' },
    { ...stage, repository: { full_name: 'attacker/repo' } },
  ]) {
    await assert.rejects(check(run));
  }
});

test('skipped, failed or ambiguous staging deployment fails closed', async () => {
  for (const result of [
    { total_count: 0, jobs: [] },
    { total_count: 1, jobs: [{ ...jobs.jobs[0], conclusion: 'skipped' }] },
    { total_count: 1, jobs: [{ ...jobs.jobs[0], conclusion: 'failure' }] },
    { total_count: 2, jobs: [jobs.jobs[0], jobs.jobs[0]] },
    { total_count: 100, jobs: [jobs.jobs[0]] },
  ]) {
    await assert.rejects(check(stage, result));
  }
});

test('malformed replay inputs are denied', async () => {
  await assert.rejects(
    validateVerifiedStagingReplay({
      candidateSha: 'invalid',
      stagingRunId: RUN_ID,
      stagingRunAttempt: RUN_ATTEMPT,
      repository: REPO,
      githubGet: async () => stage,
    })
  );
});
