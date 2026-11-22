import assert from 'node:assert/strict';
import { appendFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const OWNER = 'vellira-dev/vellira';
const WORKFLOW_PATH = '.github/workflows/deploy-website-cloudflare-staging.yml';
const DEPLOY_JOB = 'Build, deploy, and verify merged main on website staging';
const DEPLOY_STEP = 'Deploy website staging to Cloudflare Workers';
const SHA = /^[0-9a-f]{40}$/;

export function classifyVerificationOnlyRecovery({ run, jobs, runId, attempt, candidateSha }) {
  assert.ok(Number.isSafeInteger(runId) && runId > 0);
  assert.ok(Number.isSafeInteger(attempt) && attempt > 0);
  assert.match(candidateSha ?? '', SHA);
  assert.equal(run?.id, runId, 'Run ID mismatch');
  assert.equal(run?.repository?.full_name, OWNER, 'Wrong repository');
  assert.equal(run?.path, WORKFLOW_PATH, 'Not staging workflow');
  assert.equal(run?.head_branch, 'main', 'Not main');
  assert.equal(run?.head_sha, candidateSha, 'Run SHA mismatch');
  assert.equal(run?.run_attempt, attempt, 'Run attempt mismatch');
  assert.equal(run?.event, 'push', 'Only normal main pushes eligible');
  assert.equal(run?.status, 'completed', 'Run must be complete');
  assert.equal(run?.conclusion, 'failure', 'Only failed staging eligible');
  assert.ok(Number.isSafeInteger(jobs?.total_count) && jobs.total_count < 100,
    'Ambiguous or paginated staging jobs');
  assert.ok(Array.isArray(jobs.jobs), 'Missing staging job list');
  const deployJobs = jobs.jobs.filter(job => job.name === DEPLOY_JOB);
  assert.ok(deployJobs.length <= 1, 'Duplicate staging deployment jobs');
  if (deployJobs.length === 0) return { eligible: false, reason: 'no_deployment_job' };
  const steps = deployJobs[0].steps ?? [];
  const matches = steps.filter(step => step.name === DEPLOY_STEP);
  assert.ok(matches.length <= 1, 'Duplicate Wrangler steps');
  if (matches.length === 0 ||
      matches[0].status !== 'completed' ||
      matches[0].conclusion !== 'success') {
    return { eligible: false, reason: 'wrangler_activation_not_proven' };
  }
  return {
    eligible: true,
    reason: 'failed_after_successful_wrangler',
    sourceSha: candidateSha,
    stagingRunId: runId,
    stagingRunAttempt: attempt,
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
    signal: AbortSignal.timeout(30_000),
  });
  assert.equal(response.status, 200, 'GitHub read failed: ' + response.status);
  return response.json();
}

async function main() {
  assert.equal(process.env.GITHUB_REPOSITORY, OWNER);
  assert.equal(process.env.GITHUB_REF, 'refs/heads/main');
  const runId = Number(process.env.FAILED_STAGING_RUN_ID);
  const attempt = Number(process.env.FAILED_STAGING_RUN_ATTEMPT);
  const candidateSha = process.env.FAILED_STAGING_SOURCE_SHA;
  assert.ok(Number.isSafeInteger(runId) && runId > 0);
  assert.ok(Number.isSafeInteger(attempt) && attempt > 0);
  assert.match(candidateSha ?? '', SHA);
  const [run, jobs] = await Promise.all([
    githubGet('/repos/' + OWNER + '/actions/runs/' + runId),
    githubGet('/repos/' + OWNER + '/actions/runs/' + runId + '/jobs?per_page=100'),
  ]);
  const result = classifyVerificationOnlyRecovery({ run, jobs, runId, attempt, candidateSha });
  console.log(JSON.stringify({ event: 'staging-verification-only-admission', ...result }));
  const output = process.env.GITHUB_OUTPUT;
  assert.ok(output, 'GITHUB_OUTPUT required');
  await appendFile(output,
    'eligible=' + (result.eligible ? 'true' : 'false') + '\n' +
    'reason=' + result.reason + '\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
