import { appendFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

import { assessFreshProductionCandidate } from './cloudflare-production-freshness.mjs';

const SHA_PATTERN = /^[0-9a-f]{40}$/;
const PROMOTION_TITLE_PATTERN = /^Promote staging ([0-9a-f]{40})$/;
const FORCE_CANCELLABLE_STATUSES = new Set(['pending', 'waiting']);

function assertSha(value, label) {
  if (!SHA_PATTERN.test(value ?? '')) {
    throw new Error(`${label} must be an exact 40-character lowercase SHA`);
  }

  return value;
}

function assertRunId(value, label) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${label} must be a positive integer run ID`);
  }

  return value;
}

export function promotionCandidateSha(displayTitle) {
  const match = PROMOTION_TITLE_PATTERN.exec(displayTitle ?? '');
  return match?.[1] ?? null;
}

export function planCurrentProductionAdmission({
  currentMainSha,
  currentRunId,
  runs,
  currentCandidateEligible,
}) {
  assertSha(currentMainSha, 'currentMainSha');
  assertRunId(currentRunId, 'currentRunId');
  if (typeof currentCandidateEligible !== 'boolean') {
    throw new Error('currentCandidateEligible must be boolean');
  }

  const promotions = runs
    .map((run) => ({
      ...run,
      candidateSha: promotionCandidateSha(run.displayTitle),
    }))
    .filter(
      (run) =>
        run.candidateSha !== null &&
        run.status !== 'completed'
    );
  const currentRun = promotions.find((run) => run.id === currentRunId);

  if (!currentRun) {
    return {
      ownerRunId: null,
      admitCurrent: false,
      reason: 'current_run_missing',
    };
  }

  if (!currentCandidateEligible) {
    return {
      ownerRunId: null,
      admitCurrent: false,
      reason: 'stale_candidate',
    };
  }

  const exactMainPromotions = promotions
    .filter((run) => run.candidateSha === currentMainSha)
    .sort((left, right) => left.runNumber - right.runNumber);
  const sameCandidatePromotions = promotions
    .filter((run) => run.candidateSha === currentRun.candidateSha)
    .sort((left, right) => left.runNumber - right.runNumber);
  const owner = exactMainPromotions[0] ?? sameCandidatePromotions[0];

  if (!owner || owner.id !== currentRunId) {
    return {
      ownerRunId: owner?.id ?? null,
      admitCurrent: false,
      reason: 'existing_current_candidate',
    };
  }

  return {
    ownerRunId: currentRunId,
    admitCurrent: true,
    reason: 'admitted',
  };
}

async function githubRequest(path, { method = 'GET' } = {}) {
  const token = process.env.GITHUB_TOKEN;

  if (!token) {
    throw new Error('GITHUB_TOKEN is required');
  }

  const response = await fetch(`https://api.github.com${path}`, {
    method,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
  const body = await response.text();

  if (!response.ok) {
    throw new Error(
      `GitHub API ${method} ${path} failed: ${response.status} ${body}`
    );
  }

  return body ? JSON.parse(body) : null;
}

export function supersededProductionRunIds({
  currentRunId,
  runs,
  admitCurrent,
}) {
  assertRunId(currentRunId, 'currentRunId');
  if (typeof admitCurrent !== 'boolean') {
    throw new Error('admitCurrent must be boolean');
  }
  if (!admitCurrent) {
    return [];
  }

  const normalized = runs.map((run) => ({
    ...run,
    candidateSha: promotionCandidateSha(run.displayTitle),
  }));
  const currentRun = normalized.find((run) => run.id === currentRunId);
  if (!currentRun) {
    throw new Error('Admitted production run is missing from the active run set');
  }

  return normalized
    .filter(
      (run) =>
        run.id !== currentRunId &&
        run.runNumber < currentRun.runNumber &&
        run.candidateSha !== null &&
        run.candidateSha !== currentRun.candidateSha &&
        FORCE_CANCELLABLE_STATUSES.has(run.status)
    )
    .sort((left, right) => left.runNumber - right.runNumber)
    .map((run) => run.id);
}

async function forceCancelSupersededProductionRun({
  repository,
  currentRunId,
  currentRunNumber,
  currentCandidateSha,
  targetRunId,
}) {
  const raw = await githubRequest(
    `/repos/${repository}/actions/runs/${targetRunId}`
  );
  const observed = {
    id: raw?.id,
    runNumber: raw?.run_number,
    status: raw?.status,
    displayTitle: raw?.display_title,
    candidateSha: promotionCandidateSha(raw?.display_title),
  };

  const stillSuperseded =
    observed.id === targetRunId &&
    observed.id !== currentRunId &&
    observed.runNumber < currentRunNumber &&
    observed.candidateSha !== null &&
    observed.candidateSha !== currentCandidateSha &&
    FORCE_CANCELLABLE_STATUSES.has(observed.status);

  if (!stillSuperseded) {
    return {
      runId: targetRunId,
      forceCancelled: false,
      observedStatus: observed.status ?? 'missing',
    };
  }

  await githubRequest(
    `/repos/${repository}/actions/runs/${targetRunId}/force-cancel`,
    { method: 'POST' }
  );
  return {
    runId: targetRunId,
    forceCancelled: true,
    observedStatus: observed.status,
  };
}

async function currentMainSha(repository) {
  const data = await githubRequest(`/repos/${repository}/git/ref/heads/main`);
  return assertSha(data.object?.sha, 'main ref SHA');
}

async function listProductionRuns(repository) {
  const data = await githubRequest(
    `/repos/${repository}/actions/workflows/deploy-website-cloudflare-production.yml/runs?per_page=100`
  );

  return data.workflow_runs ?? [];
}

async function writeAdmissionOutput(githubOutput, plan) {
  if (!githubOutput) {
    throw new Error('GITHUB_OUTPUT is required for production admission');
  }

  await appendFile(
    githubOutput,
    `admitted=${plan.admitCurrent ? 'true' : 'false'}\nreason=${plan.reason}\n`
  );
}

export async function admitCurrentProductionPromotion({
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

  assertRunId(currentRunId, 'currentRunId');
  assertSha(expectedCandidateSha, 'expectedCandidateSha');

  const [mainSha, rawRuns] = await Promise.all([
    currentMainSha(repository),
    listProductionRuns(repository),
  ]);
  const runs = rawRuns.map((run) => ({
    id: run.id,
    runNumber: run.run_number,
    status: run.status,
    displayTitle: run.display_title,
  }));
  const currentRun = runs.find((run) => run.id === currentRunId);
  const observedCandidateSha = currentRun
    ? promotionCandidateSha(currentRun.displayTitle)
    : null;

  if (observedCandidateSha !== expectedCandidateSha) {
    throw new Error(
      `Current production run candidate mismatch: expected ${expectedCandidateSha}, observed ${observedCandidateSha ?? 'missing'}`
    );
  }

  const freshness = await assessFreshProductionCandidate({
    configPath: 'wrangler.production.jsonc',
    candidateSource: 'staging',
    candidateSha: expectedCandidateSha,
    repository,
    mainSha,
    githubToken: process.env.GITHUB_TOKEN,
  });
  const plan = planCurrentProductionAdmission({
    currentMainSha: mainSha,
    currentRunId,
    runs,
    currentCandidateEligible: freshness.deploymentEquivalent === true,
  });
  const supersededRunIds = supersededProductionRunIds({
    currentRunId,
    runs,
    admitCurrent: plan.admitCurrent,
  });
  const currentRunNumber = currentRun?.runNumber;
  const supersedeResults = [];

  if (plan.admitCurrent) {
    if (!Number.isInteger(currentRunNumber) || currentRunNumber <= 0) {
      throw new Error('Admitted production run number is invalid');
    }

    for (const targetRunId of supersededRunIds) {
      supersedeResults.push(
        await forceCancelSupersededProductionRun({
          repository,
          currentRunId,
          currentRunNumber,
          currentCandidateSha: expectedCandidateSha,
          targetRunId,
        })
      );
    }
  }

  await writeAdmissionOutput(githubOutput, plan);
  console.log(
    JSON.stringify({
      currentMainSha: mainSha,
      currentRunId,
      expectedCandidateSha,
      freshness,
      activeProductionRuns: runs.filter((run) => run.status !== 'completed'),
      supersededRunIds,
      supersedeResults,
      ...plan,
    })
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  await admitCurrentProductionPromotion();
}
