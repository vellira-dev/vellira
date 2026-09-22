import { appendFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const SHA_PATTERN = /^[0-9a-f]{40}$/;
const PROMOTION_TITLE_PATTERN = /^Promote staging ([0-9a-f]{40})$/;
const PROTECTED_DEPLOY_STATUSES = new Set(['queued', 'in_progress', 'completed']);

function assertSha(value, label) {
  if (!SHA_PATTERN.test(value ?? '')) {
    throw new Error(`${label} must be an exact 40-character lowercase SHA`);
  }

  return value;
}

export function promotionCandidateSha(displayTitle) {
  const match = PROMOTION_TITLE_PATTERN.exec(displayTitle ?? '');
  return match?.[1] ?? null;
}

export function planProductionPromotionSupersession({ currentMainSha, runs }) {
  assertSha(currentMainSha, 'currentMainSha');

  const promotions = runs
    .map((run) => ({
      ...run,
      candidateSha: promotionCandidateSha(run.displayTitle),
      protectedDeploy: PROTECTED_DEPLOY_STATUSES.has(run.deployStatus),
    }))
    .filter((run) => run.candidateSha && run.status !== 'completed');

  const keep = new Set();

  for (const run of promotions) {
    if (run.protectedDeploy) {
      keep.add(run.id);
    }
  }

  const currentMainPromotions = promotions
    .filter((run) => run.candidateSha === currentMainSha && !run.protectedDeploy)
    .sort((left, right) => right.runNumber - left.runNumber);

  const hasApprovedCurrentMain = promotions.some(
    (run) => run.candidateSha === currentMainSha && run.protectedDeploy
  );

  if (!hasApprovedCurrentMain && currentMainPromotions[0]) {
    keep.add(currentMainPromotions[0].id);
  }

  const cancel = promotions
    .filter((run) => !keep.has(run.id) && !run.protectedDeploy)
    .map((run) => run.id);

  return {
    keep: [...keep],
    cancel,
  };
}

function assertRunId(value, label) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${label} must be a positive integer run ID`);
  }

  return value;
}

export function planCurrentProductionAdmission({
  currentMainSha,
  currentRunId,
  runs,
}) {
  assertSha(currentMainSha, 'currentMainSha');
  assertRunId(currentRunId, 'currentRunId');

  const plan = planProductionPromotionSupersession({
    currentMainSha,
    runs,
  });
  const currentRun = runs.find((run) => run.id === currentRunId);
  const currentCandidateSha = currentRun
    ? promotionCandidateSha(currentRun.displayTitle)
    : null;
  const currentIsActive =
    currentRun !== undefined &&
    currentRun.status !== 'completed' &&
    currentCandidateSha !== null;
  const admitted = currentIsActive && plan.keep.includes(currentRunId);

  return {
    keep: plan.keep,
    cancel: plan.cancel.filter((runId) => runId !== currentRunId),
    admitCurrent: admitted,
    reason: admitted
      ? 'admitted'
      : currentCandidateSha && currentCandidateSha !== currentMainSha
        ? 'stale_candidate'
        : currentIsActive
          ? 'superseded_or_protected'
          : 'current_run_missing',
  };
}

async function githubRequest(path, options = {}) {
  const token = process.env.GITHUB_TOKEN;

  if (!token) {
    throw new Error('GITHUB_TOKEN is required');
  }

  const response = await fetch(`https://api.github.com${path}`, {
    ...options,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(options.headers ?? {}),
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `GitHub API ${options.method ?? 'GET'} ${path} failed: ${response.status} ${body}`
    );
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

async function listProductionRuns(repository) {
  const data = await githubRequest(
    `/repos/${repository}/actions/workflows/deploy-website-cloudflare-production.yml/runs?per_page=100`
  );

  return data.workflow_runs ?? [];
}

async function deployJobStatus(repository, runId) {
  const data = await githubRequest(
    `/repos/${repository}/actions/runs/${runId}/jobs?filter=latest&per_page=100`
  );
  const deploy = (data.jobs ?? []).find(
    (job) => job.name === 'Approve, deploy, and verify production candidate'
  );

  return deploy?.status ?? null;
}

async function currentMainSha(repository) {
  const data = await githubRequest(`/repos/${repository}/git/ref/heads/main`);
  return assertSha(data.object?.sha, 'main ref SHA');
}

async function cancelRun(repository, runId) {
  await githubRequest(`/repos/${repository}/actions/runs/${runId}/cancel`, {
    method: 'POST',
  });
}

export async function supersedeStaleProductionPromotions({
  currentRunId = process.env.CURRENT_PRODUCTION_RUN_ID
    ? Number(process.env.CURRENT_PRODUCTION_RUN_ID)
    : null,
  expectedCandidateSha = process.env.EXPECTED_CANDIDATE_SHA || null,
  githubOutput = process.env.GITHUB_OUTPUT || null,
} = {}) {
  const repository = process.env.GITHUB_REPOSITORY;

  if (!repository || !repository.includes('/')) {
    throw new Error('GITHUB_REPOSITORY must be owner/name');
  }

  const mainSha = await currentMainSha(repository);
  const rawRuns = await listProductionRuns(repository);
  const activePromotionRuns = rawRuns.filter(
    (run) =>
      run.status !== 'completed' && promotionCandidateSha(run.display_title) !== null
  );
  const runs = [];

  for (const run of activePromotionRuns) {
    runs.push({
      id: run.id,
      runNumber: run.run_number,
      status: run.status,
      displayTitle: run.display_title,
      deployStatus:
        currentRunId !== null && run.id === currentRunId
          ? null
          : await deployJobStatus(repository, run.id),
    });
  }

  if (currentRunId !== null) {
    assertRunId(currentRunId, 'currentRunId');
    if (expectedCandidateSha !== null) {
      assertSha(expectedCandidateSha, 'expectedCandidateSha');
    }
  }

  const plan =
    currentRunId === null
      ? planProductionPromotionSupersession({
          currentMainSha: mainSha,
          runs,
        })
      : planCurrentProductionAdmission({
          currentMainSha: mainSha,
          currentRunId,
          runs,
        });

  if (currentRunId !== null && expectedCandidateSha !== null) {
    const currentRun = runs.find((run) => run.id === currentRunId);
    const observedCandidateSha = currentRun
      ? promotionCandidateSha(currentRun.displayTitle)
      : null;

    if (observedCandidateSha !== expectedCandidateSha) {
      throw new Error(
        `Current production run candidate mismatch: expected ${expectedCandidateSha}, observed ${observedCandidateSha ?? 'missing'}`
      );
    }
  }

  for (const runId of plan.cancel) {
    console.log(`Cancelling superseded production promotion run ${runId}`);
    await cancelRun(repository, runId);
  }

  if (currentRunId !== null) {
    if (!githubOutput) {
      throw new Error('GITHUB_OUTPUT is required for production admission');
    }

    await appendFile(
      githubOutput,
      `admitted=${plan.admitCurrent ? 'true' : 'false'}\nreason=${plan.reason}\n`
    );
  }

  console.log(
    JSON.stringify({
      currentMainSha: mainSha,
      activePromotionRuns: runs,
      ...plan,
    })
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  await supersedeStaleProductionPromotions();
}
