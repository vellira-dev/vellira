import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

const SHA = /^[0-9a-f]{40}$/;
const STAGING = 'deploy-website-cloudflare-staging.yml';
const PRODUCTION = 'deploy-website-cloudflare-production.yml';
const OWNER = 'vellira-dev/vellira';
const RUNTIME_URL = 'https://vellira.dev/__vellira_runtime';
const MAIN_QUIET_PERIOD_MS = 2 * 60_000;
const MAX_RECOVERY_DISPATCHES_PER_SHA = 1;

export function assertCompleteRecoveryHistory(result, label) {
  assert.ok(Number.isSafeInteger(result?.total_count) && result.total_count >= 0,
    label + ' history count missing');
  assert.ok(result.total_count < 100, label + ' history requires pagination before safe dispatch');
  assert.ok(Array.isArray(result.workflow_runs), label + ' history runs missing');
  return result;
}

// Scan the bounded lifetime of this candidate, not the cumulative workflow
// history. Production workflow_run head_sha is NOT candidate identity.
export async function fetchCandidateProductionRuns(fetchPage, since) {
  const at = Date.parse(since ?? '');
  assert.ok(Number.isFinite(at), 'Missing reliable main push observation');
  const result = await fetchPage(since);
  assertCompleteRecoveryHistory(result, 'Candidate production');
  return result.workflow_runs;
}

export function observedMainPushAt(stagingRuns, mainSha) {
  const timestamps = stagingRuns.filter(run =>
    run.head_sha === mainSha && run.event === 'push'
  ).map(run => Date.parse(run.created_at ?? ''));
  return timestamps.length && timestamps.every(Number.isFinite)
    ? new Date(Math.max(...timestamps)).toISOString()
    : null;
}

export function decideRecovery({
  mainSha,
  productionSha,
  stagingRuns,
  productionRuns,
  nowMs = Date.now(),
  mainUpdatedAt = null,
}) {
  assert.match(mainSha, SHA);
  assert.match(productionSha, SHA);
  assert.ok(Array.isArray(stagingRuns) && Array.isArray(productionRuns));
  if (productionSha === mainSha) return { dispatch: false, reason: 'already_deployed' };

  // A normal production run in progress owns its candidate. Old approval
  // queues ('waiting') must not hold newer production candidates hostage.
  if (productionRuns.some((run) => run.status !== 'completed' && run.status !== 'waiting')) {
    return { dispatch: false, reason: 'production_active' };
  }

  const sameSha = stagingRuns.filter((run) => run.head_sha === mainSha);
  const explicitRecoveries = sameSha.filter((run) => run.recoveryAttempt === true);
  // One explicit recovery per immutable SHA. Newer SHAs get a fresh budget.
  if (explicitRecoveries.length > MAX_RECOVERY_DISPATCHES_PER_SHA) {
    return { dispatch: false, reason: 'recovery_budget_exceeded', requiresReview: true };
  }
  if (explicitRecoveries.some((run) => run.status === 'completed' && run.conclusion !== 'success')) {
    return { dispatch: false, reason: 'failed_recovery_requires_review', requiresReview: true };
  }
  // Never rebuild/redeploy the same SHA automatically after a failed
  // staging run: deployment may already have succeeded before verification
  // failed (e.g. a transient Cloudflare/RSC 503). Without immutable
  // deployment proof, only manual diagnosis can authorize a retry.
  if (sameSha.some((run) =>
    (run.event === 'push' || run.recoveryAttempt === true) &&
    run.status === 'completed' &&
    run.conclusion !== 'success' &&
    run.conclusion !== 'skipped'
  )) {
    return { dispatch: false, reason: 'failed_staging_requires_review' };
  }

  const qualified = sameSha
    .filter((run) =>
      run.fullStage === true &&
      run.status === 'completed' &&
      run.conclusion === 'success'
    )
    .sort((left, right) => right.id - left.id);
  if (qualified.length > 0) {
    const staging = qualified[0];
    const promotions = productionRuns.filter(
      (run) => run.display_title === 'Promote staging ' + mainSha
    );
    if (promotions.some((run) => run.event === 'workflow_dispatch')) {
      return { dispatch: false, reason: 'verified_replay_already_attempted' };
    }
    if (promotions.some((run) => run.status !== 'completed')) {
      return { dispatch: false, reason: 'promotion_exists_for_main' };
    }
    if (promotions.some((run) => run.conclusion !== 'success')) {
      return { dispatch: false, reason: 'failed_promotion_requires_review' };
    }
    if (promotions.some((run) => run.actualDeploy === true)) {
      return { dispatch: false, reason: 'production_runtime_mismatch_requires_review' };
    }
    const ageMs = nowMs - Date.parse(staging.updated_at ?? '');
    if (!Number.isFinite(ageMs) || ageMs < 15 * 60_000) {
      return { dispatch: false, reason: 'allow_workflow_run_propagation' };
    }
    assert.ok(Number.isSafeInteger(staging.id) && staging.id > 0);
    assert.ok(Number.isSafeInteger(staging.run_attempt) && staging.run_attempt > 0);
    return {
      dispatch: true,
      target: 'production',
      reason: 'verified_staging_without_production',
      stagingRunId: staging.id,
      stagingRunAttempt: staging.run_attempt,
    };
  }

  // Do not create a duplicate staging run while an attempt for this SHA
  // exists. A failed explicit recovery is terminal until manually reviewed.
  if (sameSha.some((run) => run.recoveryAttempt === true || run.fullStage === true ||
      (run.event === 'push' && run.status !== 'completed'))) {
    return { dispatch: false, reason: 'staging_exists_for_main' };
  }
  // A release-sync-only push intentionally skipped staging deployment.
  // It is not evidence that Cloudflare requires a fresh deployment. Until
  // immutable deployed-build proof is available, fail closed instead of
  // silently spending another Cloudflare deployment on this SHA.
  if (sameSha.some((run) =>
    run.event === 'push' &&
    run.status === 'completed' &&
    run.conclusion === 'success' &&
    run.fullStage === false
  )) {
    return { dispatch: false, reason: 'skipped_staging_requires_review' };
  }

  // A newly merged main SHA is moving-target territory. Defer expensive
  // recovery staging until a short quiet window has elapsed; normal push
  // staging and already-verified candidates retain priority.
  if (mainUpdatedAt === null) {
    return { dispatch: false, reason: 'main_push_observation_missing', requiresReview: true };
  }
  if (mainUpdatedAt !== null) {
    const updated = Date.parse(mainUpdatedAt);
    assert.ok(Number.isFinite(updated), 'Invalid immutable main commit date');
    const elapsed = nowMs - updated;
    if (elapsed < MAIN_QUIET_PERIOD_MS) {
      return { dispatch: false, reason: 'main_quiet_period' };
    }
  }
  return { dispatch: true, target: 'staging', reason: 'production_behind_unstaged_main' };
}

let executionMode = null;

async function github(path, { method = 'GET', body } = {}) {
  if (method !== 'GET') {
    assert.equal(executionMode, 'dispatch', 'Read-only recovery may never write to GitHub');
  }
  const token = process.env.GITHUB_TOKEN;
  assert.ok(token, 'GITHUB_TOKEN required');
  const response = await fetch('https://api.github.com' + path, {
    method,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: 'Bearer ' + token,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(30000),
  });
  assert.ok(response.ok, 'GitHub ' + method + ' ' + path + ': ' + response.status);
  return response.status === 204 ? null : response.json();
}

async function runtimeSha() {
  const response = await fetch(RUNTIME_URL, { headers: { 'Cache-Control': 'no-cache' }, signal: AbortSignal.timeout(30000) });
  assert.equal(response.status, 200, 'Production runtime must be externally verified');
  const data = await response.json();
  // Only accept the explicit immutable build ID, never infer from page text.
  const buildId = data.buildId ?? data.build?.buildId;
  assert.equal(typeof buildId, 'string', 'Missing production build identity');
  const match = /^([0-9a-f]{40})-\d+-\d+$/.exec(buildId);
  assert.ok(match, 'Invalid production build identity');
  return match[1];
}

async function main(mode) {
  assert.ok(mode === 'plan' || mode === 'dispatch', 'Explicit plan or dispatch mode required');
  executionMode = mode;
  assert.equal(process.env.GITHUB_REPOSITORY, OWNER);
  const [ref, productionSha] = await Promise.all([
    github('/repos/' + OWNER + '/git/ref/heads/main'),
    runtimeSha(),
  ]);
  const mainSha = ref.object?.sha;
  assert.match(mainSha, SHA);
  if (productionSha === mainSha) {
    console.log(JSON.stringify({ mainSha, productionSha, dispatch: false, reason: 'already_deployed' }));
    return;
  }
  const stagingResult = await github(
    '/repos/' + OWNER + '/actions/workflows/' + STAGING +
    '/runs?head_sha=' + mainSha + '&per_page=100');
  // Fail closed if pagination could conceal earlier recovery for current SHA.
  assertCompleteRecoveryHistory(stagingResult, 'Staging');
  const observedPush = observedMainPushAt(stagingResult.workflow_runs, mainSha);
  // Missing push evidence must never authorize an unbounded history query.
  if (observedPush === null) {
    console.error('::error::No observed push timestamp for current main; cannot prove production replay history.');
    process.exitCode = 1;
    return;
  }
  const productionResult = await fetchCandidateProductionRuns(since => github(
      '/repos/' + OWNER + '/actions/workflows/' + PRODUCTION +
      '/runs?created=' + encodeURIComponent('>=' + since) + '&per_page=100'), observedPush);
  const stagingRuns = await Promise.all(stagingResult.workflow_runs.map(async (run) => {
    const recoveryAttempt = run.event === 'workflow_dispatch' &&
      run.display_title === 'Production recovery ' + mainSha;
    if (run.event !== 'push' && !recoveryAttempt) {
      return { ...run, fullStage: false, recoveryAttempt: false };
    }
    const jobs = await github('/repos/' + OWNER + '/actions/runs/' + run.id + '/jobs?per_page=100');
    assert.ok(jobs.total_count < 100, 'Unverifiable staging jobs pagination');
    const deploy = jobs.jobs.filter((job) => job.name ===
      'Build, deploy, and verify merged main on website staging');
    assert.ok(deploy.length <= 1, 'Ambiguous staging deploy jobs');
    return {
      ...run,
      recoveryAttempt,
      fullStage: deploy.length === 1 && deploy[0].conclusion === 'success',
    };
  }));
  // Inspect matching production jobs. A green outer run may skip deployment;
  // the workflow_run GITHUB_SHA is main, not the staging candidate.
  const productionRuns = await Promise.all(productionResult.map(async (run) => {
    if (run.display_title !== 'Promote staging ' + mainSha ||
        run.status !== 'completed' || run.conclusion !== 'success') {
      return { ...run, actualDeploy: false };
    }
    const jobs = await github('/repos/' + OWNER + '/actions/runs/' + run.id + '/jobs?per_page=100');
    assert.ok(jobs.total_count < 100, 'Unverifiable production jobs pagination');
    return {
      ...run,
      actualDeploy: jobs.jobs.some((job) =>
        job.name === 'Deploy and verify approved production candidate' &&
        job.conclusion === 'success'
      ),
    };
  }));
  const mainUpdatedAt = observedMainPushAt(stagingRuns, mainSha);
  const plan = decideRecovery({ mainSha, productionSha, stagingRuns, productionRuns, mainUpdatedAt });
  console.log(JSON.stringify({ mainSha, productionSha, ...plan }));
  if (mode === 'plan') {
    const output = process.env.GITHUB_OUTPUT;
    assert.ok(output, 'GITHUB_OUTPUT required for read-only plan');
    const { appendFileSync } = await import('node:fs');
    appendFileSync(output,
      'should_dispatch=' + (plan.dispatch ? 'true' : 'false') + '\n' +
      'main_sha=' + mainSha + '\n' +
      'target=' + (plan.dispatch ? plan.target : 'none') + '\n'
    );
    if (plan.requiresReview) {
      console.error('::error::Production convergence requires review: ' + plan.reason);
      process.exitCode = 1;
    }
    return;
  }
  // The privileged worker independently recomputes all evidence.
  assert.equal(process.env.EXPECTED_MAIN_SHA, mainSha, 'Plan/main SHA changed; defer recovery');
  assert.equal(process.env.EXPECTED_TARGET, plan.dispatch ? plan.target : 'none',
    'Plan/dispatch target changed; defer recovery');
  if (!plan.dispatch) {
    if (plan.requiresReview) {
      console.error('::error::Production convergence blocked: ' + plan.reason);
      process.exitCode = 1;
    }
    return;
  }
  // Recheck main immediately before dispatch to narrow the TOCTOU window.
  const latest = await github('/repos/' + OWNER + '/git/ref/heads/main');
  assert.equal(latest.object?.sha, mainSha, 'main changed; defer recovery');
  if (plan.target === 'production') {
    await github('/repos/' + OWNER + '/actions/workflows/' + PRODUCTION + '/dispatches', {
      method: 'POST',
      body: { ref: 'main', inputs: {
        candidate_sha: mainSha,
        confirmation: 'REPLAY_VERIFIED_STAGING',
        staging_run_id: String(plan.stagingRunId),
        staging_run_attempt: String(plan.stagingRunAttempt),
      } },
    });
    console.log('Verified staging promotion replay dispatched for ' + mainSha);
  } else {
    assert.equal(plan.target, 'staging');
    await github('/repos/' + OWNER + '/actions/workflows/' + STAGING + '/dispatches', {
      method: 'POST',
      body: { ref: 'main', inputs: {
        production_recovery: 'true',
        pro_interest_preview: 'false',
        newsletter_abuse_preview: 'false',
      } },
    });
    console.log('Recovery staging dispatched for ' + mainSha);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main(process.argv[2]);
}
