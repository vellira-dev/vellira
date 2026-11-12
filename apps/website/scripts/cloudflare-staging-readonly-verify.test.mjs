import assert from 'node:assert/strict';
import test from 'node:test';

import { verifyStagingActivationReadOnly } from './cloudflare-staging-readonly-verify.mjs';

const sha = 'a'.repeat(40);
const runId = 123;
const attempt = 2;
const expectedBuildId = sha + '-123-2';
const staging = {
  id: runId,
  repository: { full_name: 'vellira-dev/vellira' },
  path: '.github/workflows/deploy-website-cloudflare-staging.yml',
  head_branch: 'main',
  head_sha: sha,
  run_attempt: attempt,
  event: 'push',
  status: 'completed',
  conclusion: 'failure',
};
const jobs = {
  total_count: 1,
  jobs: [{
    name: 'Build, deploy, and verify merged main on website staging',
    conclusion: 'failure',
    steps: [{
      name: 'Deploy website staging to Cloudflare Workers',
      status: 'completed',
      conclusion: 'success',
    }],
  }],
};

function fixture({ run = staging, jobsResult = jobs, mainSha = sha, runtimeBuildId = expectedBuildId } = {}) {
  const calls = [];
  let runtimeCalls = 0;
  return {
    calls,
    get runtimeCalls() { return runtimeCalls; },
    options: {
      candidateSha: sha,
      stagingRunId: runId,
      stagingRunAttempt: attempt,
      githubGet: async (path) => {
        calls.push(path);
        if (path.endsWith('/git/ref/heads/main')) return { object: { sha: mainSha } };
        if (path.endsWith('/actions/runs/' + runId)) return run;
        if (path.endsWith('/jobs?per_page=100')) return jobsResult;
        throw new Error('Unexpected read ' + path);
      },
      verifyRuntime: async ({ base, expectedBuildId: expected }) => {
        runtimeCalls++;
        assert.equal(base, 'https://vellira-website-staging.vellira.workers.dev');
        assert.equal(expected, expectedBuildId);
        return { buildId: runtimeBuildId, workerVersion: 'worker-v1' };
      },
    },
  };
}

test('failed post-deploy staging is eligible for read-only identity verification', async () => {
  const f = fixture();
  const result = await verifyStagingActivationReadOnly(f.options);
  assert.equal(result.status, 'runtime-identity-verified');
  assert.equal(result.buildId, expectedBuildId);
  assert.equal(f.runtimeCalls, 1);
  assert.equal(f.calls.length, 4);
});

test('successful staging run is eligible for read-only identity verification', async () => {
  const f = fixture({ run: { ...staging, conclusion: 'success' }, jobsResult: {
    ...jobs, jobs: [{ ...jobs.jobs[0], conclusion: 'success' }],
  } });
  assert.equal((await verifyStagingActivationReadOnly(f.options)).sourceSha, sha);
});

test('skipped/failed Wrangler step never probes runtime', async () => {
  for (const conclusion of ['skipped', 'failure', null]) {
    const f = fixture({ jobsResult: {
      ...jobs, jobs: [{
        ...jobs.jobs[0],
        steps: [{ ...jobs.jobs[0].steps[0], conclusion }],
      }],
    } });
    await assert.rejects(verifyStagingActivationReadOnly(f.options));
    assert.equal(f.runtimeCalls, 0);
  }
});

test('stale, running, wrong repo or mismatched attempt fail closed', async () => {
  const variants = [
    { mainSha: 'b'.repeat(40) },
    { run: { ...staging, status: 'in_progress' } },
    { run: { ...staging, repository: { full_name: 'other/repo' } } },
    { run: { ...staging, run_attempt: attempt + 1 } },
    { run: { ...staging, head_sha: 'b'.repeat(40) } },
    { run: { ...staging, path: '.github/workflows/other.yml' } },
  ];
  for (const config of variants) {
    const f = fixture(config);
    await assert.rejects(verifyStagingActivationReadOnly(f.options));
    assert.equal(f.runtimeCalls, 0);
  }
});

test('unverifiable jobs, duplicate deployment steps and mismatched runtime fail closed', async () => {
  const variants = [
    { jobsResult: { ...jobs, total_count: 100 } },
    { jobsResult: { ...jobs, jobs: [] } },
    { jobsResult: { ...jobs, jobs: [{
      ...jobs.jobs[0], steps: [jobs.jobs[0].steps[0], jobs.jobs[0].steps[0]],
    }] } },
    { runtimeBuildId: 'b'.repeat(40) + '-123-2' },
  ];
  for (const config of variants) {
    const f = fixture(config);
    await assert.rejects(verifyStagingActivationReadOnly(f.options));
  }
});

test('invalid inputs fail closed without remote calls', async () => {
  const f = fixture();
  await assert.rejects(verifyStagingActivationReadOnly({
    ...f.options, candidateSha: 'invalid',
  }));
  assert.equal(f.runtimeCalls, 0);
  assert.equal(f.calls.length, 0);
});

test('main advance during runtime probe invalidates prior evidence', async () => {
  let reads = 0;
  const f = fixture();
  const original = f.options.githubGet;
  await assert.rejects(verifyStagingActivationReadOnly({
    ...f.options,
    githubGet: async (path) => {
      if (path.endsWith('/git/ref/heads/main')) {
        reads++;
        if (reads === 2) return { object: { sha: 'b'.repeat(40) } };
      }
      return original(path);
    },
  }), /Main advanced during verification/);
  assert.equal(f.runtimeCalls, 1);
});
