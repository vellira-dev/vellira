import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

import { waitForRuntimeStability } from './cloudflare-runtime-stabilization.mjs';

const SHA = /^[0-9a-f]{40}$/;
const OWNER = 'vellira-dev/vellira';
const STAGING_WORKFLOW = '.github/workflows/deploy-website-cloudflare-staging.yml';
const DEPLOY_JOB = 'Build, deploy, and verify merged main on website staging';
const DEPLOY_STEP = 'Deploy website staging to Cloudflare Workers';
const STAGING_URL = 'https://vellira-website-staging.vellira.workers.dev';

export async function verifyStagingActivationReadOnly({
  candidateSha,
  stagingRunId,
  stagingRunAttempt,
  repository = OWNER,
  githubGet,
  verifyRuntime = waitForRuntimeStability,
}) {
  assert.equal(repository, OWNER, 'Only canonical website repository is authorized');
  assert.match(candidateSha ?? '', SHA, 'Expected exact source SHA');
  assert.ok(Number.isSafeInteger(stagingRunId) && stagingRunId > 0, 'Invalid run ID');
  assert.ok(Number.isSafeInteger(stagingRunAttempt) && stagingRunAttempt > 0, 'Invalid run attempt');
  assert.equal(typeof githubGet, 'function');
  assert.equal(typeof verifyRuntime, 'function');

  // A read-only proof is valid only for the currently selected main commit.
  const main = await githubGet('/repos/' + OWNER + '/git/ref/heads/main');
  assert.equal(main.object?.sha, candidateSha, 'Main advanced; stale candidate verification denied');
  const run = await githubGet('/repos/' + OWNER + '/actions/runs/' + stagingRunId);
  assert.equal(run.id, stagingRunId);
  assert.equal(run.repository?.full_name, OWNER);
  assert.equal(run.path, STAGING_WORKFLOW);
  assert.equal(run.head_branch, 'main');
  assert.equal(run.head_sha, candidateSha);
  assert.equal(run.run_attempt, stagingRunAttempt);
  assert.ok(['push', 'workflow_dispatch'].includes(run.event));
  assert.equal(run.status, 'completed', 'Do not verify a running staging attempt');

  // A completed FAILED staging may have deployed successfully before later
  // smoke tests failed. Prove the actual Wrangler step, not the outer status.
  const jobs = await githubGet(
    '/repos/' + OWNER + '/actions/runs/' + stagingRunId + '/jobs?per_page=100'
  );
  assert.ok(jobs.total_count < 100, 'Ambiguous/paginated jobs; fail closed');
  const deployJobs = jobs.jobs.filter((job) => job.name === DEPLOY_JOB);
  assert.equal(deployJobs.length, 1, 'Exactly one staging deployment job required');
  const steps = deployJobs[0].steps ?? [];
  const deploySteps = steps.filter((step) => step.name === DEPLOY_STEP);
  assert.equal(deploySteps.length, 1, 'Exactly one Wrangler deployment step required');
  assert.equal(deploySteps[0].conclusion, 'success', 'Wrangler activation not proven');
  assert.equal(deploySteps[0].status, 'completed');
  const expectedBuildId = candidateSha + '-' + stagingRunId + '-' + stagingRunAttempt;
  const runtime = await verifyRuntime({ base: STAGING_URL, expectedBuildId });
  assert.equal(runtime.buildId, expectedBuildId, 'Remote runtime build ID mismatch');
  assert.ok(typeof runtime.workerVersion === 'string' && runtime.workerVersion.length > 0);

  // The commit could advance while network verification is in progress.
  const latest = await githubGet('/repos/' + OWNER + '/git/ref/heads/main');
  assert.equal(latest.object?.sha, candidateSha, 'Main advanced during verification');
  return {
    status: 'runtime-identity-verified',
    sourceSha: candidateSha,
    stagingRunId,
    stagingRunAttempt,
    buildId: expectedBuildId,
    workerVersion: runtime.workerVersion,
    note: 'Read-only runtime identity proof; not a Cloudflare deployment ID or full staging acceptance',
  };
}

async function githubGet(path) {
  const token = process.env.GITHUB_TOKEN;
  assert.ok(token, 'GITHUB_TOKEN required');
  const response = await fetch('https://api.github.com' + path, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: 'Bearer ' + token,
      'X-GitHub-Api-Version': '2022-11-28',
    },
    signal: AbortSignal.timeout(30000),
  });
  assert.equal(response.status, 200, 'GitHub read failed: ' + response.status);
  return response.json();
}

async function main() {
  assert.equal(process.env.GITHUB_REPOSITORY, OWNER);
  assert.equal(process.env.GITHUB_REF, 'refs/heads/main');
  const result = await verifyStagingActivationReadOnly({
    candidateSha: process.env.EXPECTED_SOURCE_SHA,
    stagingRunId: Number(process.env.STAGING_RUN_ID),
    stagingRunAttempt: Number(process.env.STAGING_RUN_ATTEMPT),
    githubGet,
  });
  console.log(JSON.stringify(result));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
