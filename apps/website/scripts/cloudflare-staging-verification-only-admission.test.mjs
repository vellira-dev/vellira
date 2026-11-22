import assert from 'node:assert/strict';
import test from 'node:test';

import { classifyVerificationOnlyRecovery } from './cloudflare-staging-verification-only-admission.mjs';

const sha = 'a'.repeat(40);
const id = 123;
const run = {
  id,
  repository: { full_name: 'vellira-dev/vellira' },
  path: '.github/workflows/deploy-website-cloudflare-staging.yml',
  head_branch: 'main',
  head_sha: sha,
  run_attempt: 1,
  event: 'push',
  status: 'completed',
  conclusion: 'failure',
};
const job = {
  name: 'Build, deploy, and verify merged main on website staging',
  conclusion: 'failure',
  steps: [{
    name: 'Deploy website staging to Cloudflare Workers',
    conclusion: 'success',
    status: 'completed',
  }],
};
const jobs = { total_count: 1, jobs: [job] };
function check(overrides = {}) {
  return classifyVerificationOnlyRecovery({
    run, jobs, runId: id, attempt: 1, candidateSha: sha, ...overrides,
  });
}

test('failed staging with successful Wrangler is eligible for read-only verification', () => {
  assert.deepEqual(check(), {
    eligible: true,
    reason: 'failed_after_successful_wrangler',
    sourceSha: sha,
    stagingRunId: id,
    stagingRunAttempt: 1,
  });
});

test('skips when activation did not occur, including earlier migration failure', () => {
  assert.deepEqual(check({ jobs: { total_count: 0, jobs: [] } }), {
    eligible: false, reason: 'no_deployment_job',
  });
  for (const conclusion of ['failure', 'skipped', null]) {
    assert.equal(check({ jobs: {
      total_count: 1, jobs: [{
        ...job, steps: [{ ...job.steps[0], conclusion }],
      }],
    } }).eligible, false);
  }
});

test('refuses untrusted workflow provenance and attempts', () => {
  const changes = [
    { run: { ...run, repository: { full_name: 'attacker/repo' } } },
    { run: { ...run, path: '.github/workflows/not-staging.yml' } },
    { run: { ...run, head_branch: 'feature' } },
    { run: { ...run, event: 'workflow_dispatch' } },
    { run: { ...run, status: 'in_progress' } },
    { run: { ...run, conclusion: 'success' } },
    { run: { ...run, run_attempt: 2 } },
    { run: { ...run, head_sha: 'b'.repeat(40) } },
    { runId: 124 },
    { attempt: 2 },
    { candidateSha: 'invalid' },
    { jobs: { total_count: 100, jobs: [job] } },
    { jobs: { total_count: 2, jobs: [job, job] } },
    { jobs: { total_count: 1, jobs: [{ ...job, steps: [job.steps[0], job.steps[0]] }] } },
  ];
  for (const change of changes) {
    assert.throws(() => check(change));
  }
});
