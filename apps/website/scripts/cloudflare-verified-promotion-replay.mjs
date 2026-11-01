import assert from 'node:assert/strict';
import { appendFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const SHA = /^[0-9a-f]{40}$/;
const STAGING_WORKFLOW = '.github/workflows/deploy-website-cloudflare-staging.yml';
const STAGING_JOB = 'Build, deploy, and verify merged main on website staging';

export async function validateVerifiedStagingReplay({
  candidateSha,
  stagingRunId,
  stagingRunAttempt,
  repository,
  githubGet,
  waitForCompletion = (milliseconds) =>
    new Promise((resolve) => setTimeout(resolve, milliseconds)),
  maxCompletionPolls = 24,
  completionPollMs = 3000,
}) {
  assert.match(candidateSha ?? '', SHA, 'Replay candidate must be an exact SHA');
  assert.match(repository ?? '', /^[\w.-]+\/[\w.-]+$/, 'Invalid repository');
  assert.ok(Number.isSafeInteger(stagingRunId) && stagingRunId > 0, 'Invalid staging run ID');
  assert.ok(Number.isSafeInteger(stagingRunAttempt) && stagingRunAttempt > 0, 'Invalid staging attempt');

  const runPath = `/repos/${repository}/actions/runs/${stagingRunId}`;
  let run = await githubGet(runPath);
  // A direct handoff may start replay before GitHub marks staging complete.
  // The immutable run identity must match before and after bounded polling.
  assert.equal(run.id, stagingRunId, 'Staging run ID mismatch');
  assert.equal(run.repository?.full_name, repository, 'Staging repository mismatch');
  assert.equal(run.head_sha, candidateSha, 'Staging SHA differs from replay candidate');
  for (
    let attempt = 0;
    run.status !== 'completed' && attempt < maxCompletionPolls;
    attempt++
  ) {
    assert.ok(
      ['requested', 'queued', 'pending', 'waiting', 'in_progress'].includes(
        run.status
      ),
      'Unknown staging workflow status'
    );
    await waitForCompletion(completionPollMs);
    run = await githubGet(runPath);
  }
  assert.equal(run.id, stagingRunId, 'Staging run ID mismatch');
  assert.equal(run.run_attempt, stagingRunAttempt, 'Staging run attempt mismatch');
  assert.equal(run.repository?.full_name, repository, 'Staging repository mismatch');
  assert.equal(run.path, STAGING_WORKFLOW, 'Wrong staging workflow');
  assert.equal(run.head_branch, 'main', 'Staging must target main');
  assert.equal(run.head_sha, candidateSha, 'Staging SHA differs from replay candidate');
  assert.ok(['push', 'workflow_dispatch'].includes(run.event), 'Invalid staging event');
  assert.equal(run.status, 'completed', 'Staging is not completed');
  assert.equal(run.conclusion, 'success', 'Staging did not succeed');

  const jobs = await githubGet(
    `/repos/${repository}/actions/runs/${stagingRunId}/jobs?per_page=100`
  );
  assert.ok(jobs.total_count < 100, 'Staging jobs require pagination');
  const deployed = jobs.jobs.filter((job) => job.name === STAGING_JOB);
  assert.equal(deployed.length, 1, 'Missing or ambiguous staging deployment job');
  assert.equal(deployed[0].conclusion, 'success', 'Staging deployment was skipped or failed');

  // The production workflow separately downloads and validates the immutable
  // evidence artifact, including productionRecovery for manual staging.
  return { eventName: run.event, stagingRunId, stagingRunAttempt };
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
  if (!response.ok) throw new Error(`GitHub GET ${path}: ${response.status}`);
  return response.json();
}

async function main() {
  assert.equal(process.env.GITHUB_REF, 'refs/heads/main', 'Replay requires main');
  const evidence = await validateVerifiedStagingReplay({
    candidateSha: process.env.REPLAY_CANDIDATE_SHA,
    stagingRunId: Number(process.env.STAGING_RUN_ID),
    stagingRunAttempt: Number(process.env.STAGING_RUN_ATTEMPT),
    repository: process.env.GITHUB_REPOSITORY,
    githubGet,
  });
  assert.ok(process.env.GITHUB_OUTPUT, 'GITHUB_OUTPUT required');
  await appendFile(process.env.GITHUB_OUTPUT, `event_name=${evidence.eventName}\n`);
  console.log(`Verified staging run ${evidence.stagingRunId}/${evidence.stagingRunAttempt} for ${process.env.REPLAY_CANDIDATE_SHA}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
