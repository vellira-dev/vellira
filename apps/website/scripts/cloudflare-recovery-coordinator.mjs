import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

const SHA = /^[0-9a-f]{40}$/;
const STAGING = 'deploy-website-cloudflare-staging.yml';
const PRODUCTION = 'deploy-website-cloudflare-production.yml';
const OWNER = 'vellira-dev/vellira';
const RUNTIME_URL = 'https://vellira.dev/__vellira_runtime';
const MAIN_QUIET_PERIOD_MS = 2 * 60_000;
const MAX_RECOVERY_DISPATCHES_PER_SHA = 1;

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
  // A newly merged main SHA is moving-target territory. Defer expensive
  // recovery staging until a short quiet window has elapsed; normal push
  // staging and already-verified candidates retain priority.
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

async function github(path, { method = 'GET', body } = {}) {
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

async function main() {
  assert.equal(process.env.GITHUB_REPOSITORY, OWNER);
  const [ref, productionSha, productionResult] = await Promise.all([
    github('/repos/' + OWNER + '/git/ref/heads/main'),
    runtimeSha(),
    github('/repos/' + OWNER + '/actions/workflows/' + PRODUCTION + '/runs?per_page=100'),
  ]);
  const mainSha = ref.object?.sha;
  assert.match(mainSha, SHA);
  assert.ok(productionResult.total_count < 100,
    'Production history requires pagination before safe replay');
  const [stagingResult, mainCommit] = await Promise.all([
    github('/repos/' + OWNER + '/actions/workflows/' + STAGING + '/runs?head_sha=' + mainSha + '&per_page=100'),
    github('/repos/' + OWNER + '/commits/' + mainSha),
  ]);
  const mainUpdatedAt = mainCommit.commit?.committer?.date;
  assert.equal(typeof mainUpdatedAt, 'string', 'Missing immutable main commit timestamp');
  // Fail closed if pagination could conceal earlier recovery for current SHA.
  assert.ok(stagingResult.total_count < 100, 'Staging history requires pagination before safe dispatch');
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
  const productionRuns = await Promise.all(productionResult.workflow_runs.map(async (run) => {
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
  const plan = decideRecovery({ mainSha, productionSha, stagingRuns, productionRuns, mainUpdatedAt });
  console.log(JSON.stringify({ mainSha, productionSha, ...plan }));
  if (!plan.dispatch) {
    if (plan.requiresReview) {
      console.error('::error::Production convergence is blocked: ' + plan.reason +
        ' for ' + mainSha + '. Manual review required; no automatic retry.');
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
  await main();
}
