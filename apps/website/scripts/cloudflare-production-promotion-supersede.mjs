import { appendFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const SHA_PATTERN = /^[0-9a-f]{40}$/;
const PROMOTION_TITLE_PATTERN = /^Promote staging ([0-9a-f]{40})$/;
const PROTECTED_DEPLOY_STATUSES = new Set(['queued', 'in_progress', 'completed']);
const ADMISSION_STABILITY_ATTEMPTS = 4;
const CANCELLATION_SETTLE_ATTEMPTS = 12;
const CANCELLATION_SETTLE_DELAY_MS = 1000;

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

async function workflowRunState(repository, runId) {
  const data = await githubRequest(
    `/repos/${repository}/actions/runs/${runId}`
  );

  return {
    status: data.status ?? null,
    conclusion: data.conclusion ?? null,
  };
}

async function sleep(milliseconds) {
  await new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function waitForRunCompletion(
  repository,
  runId,
  {
    attempts = CANCELLATION_SETTLE_ATTEMPTS,
    delayMs = CANCELLATION_SETTLE_DELAY_MS,
  } = {}
) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const state = await workflowRunState(repository, runId);
    if (state.status === 'completed') {
      return state;
    }

    if (attempt < attempts) {
      await sleep(delayMs);
    }
  }

  return null;
}

async function cancelRun(repository, runId) {
  await githubRequest(`/repos/${repository}/actions/runs/${runId}/cancel`, {
    method: 'POST',
  });
}

export async function settleCancellationTargets({
  runIds,
  currentRunId = null,
  inspectTarget,
  cancelTarget,
  waitForCompletion,
}) {
  const cancelled = [];

  for (const runId of runIds) {
    if (runId === currentRunId) continue;

    const before = await inspectTarget(runId);
    if (before.runStatus === 'completed') {
      continue;
    }

    if (PROTECTED_DEPLOY_STATUSES.has(before.deployStatus)) {
      return {
        ok: false,
        reason: 'target_became_protected',
        targetRunId: runId,
        cancelled,
      };
    }

    await cancelTarget(runId);

    const settled = await waitForCompletion(runId);
    if (!settled || settled.status !== 'completed') {
      return {
        ok: false,
        reason: 'cancellation_not_settled',
        targetRunId: runId,
        cancelled,
      };
    }

    cancelled.push(runId);
  }

  return {
    ok: true,
    reason: 'settled',
    targetRunId: null,
    cancelled,
  };
}

async function collectActiveProductionRuns(repository, currentRunId) {
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

  return runs;
}

function assertExpectedCurrentCandidate(runs, currentRunId, expectedCandidateSha) {
  if (expectedCandidateSha === null) return;

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

async function writeAdmissionOutput(githubOutput, admitted, reason) {
  if (!githubOutput) {
    throw new Error('GITHUB_OUTPUT is required for production admission');
  }

  await appendFile(
    githubOutput,
    `admitted=${admitted ? 'true' : 'false'}\nreason=${reason}\n`
  );
}

async function settlePlan(repository, plan, currentRunId) {
  return settleCancellationTargets({
    runIds: plan.cancel,
    currentRunId,
    inspectTarget: async (runId) => {
      const [runState, latestDeployStatus] = await Promise.all([
        workflowRunState(repository, runId),
        deployJobStatus(repository, runId),
      ]);

      return {
        runStatus: runState.status,
        deployStatus: latestDeployStatus,
      };
    },
    cancelTarget: async (runId) => {
      console.log(
        `Cancelling revalidated superseded production promotion run ${runId}`
      );
      await cancelRun(repository, runId);
    },
    waitForCompletion: (runId) => waitForRunCompletion(repository, runId),
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

  if (currentRunId !== null) {
    assertRunId(currentRunId, 'currentRunId');
    if (expectedCandidateSha !== null) {
      assertSha(expectedCandidateSha, 'expectedCandidateSha');
    }

    for (
      let attempt = 1;
      attempt <= ADMISSION_STABILITY_ATTEMPTS;
      attempt += 1
    ) {
      const mainSha = await currentMainSha(repository);
      const runs = await collectActiveProductionRuns(repository, currentRunId);
      assertExpectedCurrentCandidate(
        runs,
        currentRunId,
        expectedCandidateSha
      );

      const plan = planCurrentProductionAdmission({
        currentMainSha: mainSha,
        currentRunId,
        runs,
      });

      if (!plan.admitCurrent) {
        await writeAdmissionOutput(githubOutput, false, plan.reason);
        console.log(
          JSON.stringify({
            currentMainSha: mainSha,
            activePromotionRuns: runs,
            admissionAttempt: attempt,
            ...plan,
          })
        );
        return;
      }

      const settlement = await settlePlan(repository, plan, currentRunId);
      if (!settlement.ok) {
        await writeAdmissionOutput(githubOutput, false, settlement.reason);
        console.log(
          JSON.stringify({
            currentMainSha: mainSha,
            activePromotionRuns: runs,
            admissionAttempt: attempt,
            ...plan,
            settlement,
          })
        );
        return;
      }

      const finalMainSha = await currentMainSha(repository);
      const finalRuns = await collectActiveProductionRuns(
        repository,
        currentRunId
      );
      assertExpectedCurrentCandidate(
        finalRuns,
        currentRunId,
        expectedCandidateSha
      );
      const finalPlan = planCurrentProductionAdmission({
        currentMainSha: finalMainSha,
        currentRunId,
        runs: finalRuns,
      });

      if (finalPlan.admitCurrent && finalPlan.cancel.length === 0) {
        await writeAdmissionOutput(githubOutput, true, 'admitted');
        console.log(
          JSON.stringify({
            currentMainSha: finalMainSha,
            activePromotionRuns: finalRuns,
            admissionAttempt: attempt,
            ...finalPlan,
            settlement,
          })
        );
        return;
      }

      if (!finalPlan.admitCurrent) {
        await writeAdmissionOutput(githubOutput, false, finalPlan.reason);
        console.log(
          JSON.stringify({
            currentMainSha: finalMainSha,
            activePromotionRuns: finalRuns,
            admissionAttempt: attempt,
            ...finalPlan,
            settlement,
          })
        );
        return;
      }
    }

    await writeAdmissionOutput(githubOutput, false, 'admission_unstable');
    console.log(
      JSON.stringify({
        currentRunId,
        expectedCandidateSha,
        reason: 'admission_unstable',
      })
    );
    return;
  }

  const mainSha = await currentMainSha(repository);
  const runs = await collectActiveProductionRuns(repository, null);
  const plan = planProductionPromotionSupersession({
    currentMainSha: mainSha,
    runs,
  });
  const settlement = await settlePlan(repository, plan, null);

  console.log(
    JSON.stringify({
      currentMainSha: mainSha,
      activePromotionRuns: runs,
      ...plan,
      settlement,
    })
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  await supersedeStaleProductionPromotions();
}
