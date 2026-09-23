import { appendFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const SHA_PATTERN = /^[0-9a-f]{40}$/;
const PROMOTION_TITLE_PATTERN = /^Promote staging ([0-9a-f]{40})$/;

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
}) {
  assertSha(currentMainSha, 'currentMainSha');
  assertRunId(currentRunId, 'currentRunId');

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

  if (currentRun.candidateSha !== currentMainSha) {
    return {
      ownerRunId: null,
      admitCurrent: false,
      reason: 'stale_candidate',
    };
  }

  const currentMainPromotions = promotions
    .filter((run) => run.candidateSha === currentMainSha)
    .sort((left, right) => left.runNumber - right.runNumber);
  const owner = currentMainPromotions[0];

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

async function githubRequest(path) {
  const token = process.env.GITHUB_TOKEN;

  if (!token) {
    throw new Error('GITHUB_TOKEN is required');
  }

  const response = await fetch(`https://api.github.com${path}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `GitHub API GET ${path} failed: ${response.status} ${body}`
    );
  }

  return response.json();
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

  const plan = planCurrentProductionAdmission({
    currentMainSha: mainSha,
    currentRunId,
    runs,
  });

  await writeAdmissionOutput(githubOutput, plan);
  console.log(
    JSON.stringify({
      currentMainSha: mainSha,
      currentRunId,
      expectedCandidateSha,
      activeProductionRuns: runs.filter((run) => run.status !== 'completed'),
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
