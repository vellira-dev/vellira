import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { isReleaseSyncFileSet } from './release-sync-contract.mjs';

const API_ROOT = 'https://api.github.com';
const ARTIFACT_DIR = path.resolve('.artifacts/ci-performance');
const DEFAULT_CONFIG = path.resolve('.github/ci-performance-budget.json');
const FAILURE_CONCLUSIONS = ['failure', 'cancelled', 'timed_out'];
const TERMINAL_CONCLUSIONS = new Set([
  'success',
  'skipped',
  ...FAILURE_CONCLUSIONS,
]);

export function classifyFiles(files, classification) {
  if (files.length === 0) return 'normal';

  if (isReleaseSyncFileSet(files)) return 'release-sync';

  const docsOnly = files.every((file) => {
    const normalized = file.replaceAll('\\', '/');
    const basename = normalized.split('/').at(-1) ?? normalized;
    return (
      classification.docsPrefixes.some((prefix) =>
        normalized.startsWith(prefix)
      ) ||
      classification.docsBasenames.includes(basename) ||
      classification.docsExtensions.some((extension) =>
        normalized.toLowerCase().endsWith(extension.toLowerCase())
      )
    );
  });
  if (docsOnly) return 'docs-only';

  if (
    files.some((file) =>
      classification.sharedPrefixes.some((prefix) => file.startsWith(prefix))
    )
  ) {
    return 'shared';
  }

  const packageMatches = files.map((file) =>
    file.match(/^packages\/([^/]+)\//)
  );
  if (packageMatches.every(Boolean)) {
    const packages = new Set(packageMatches.map((match) => match[1]));
    if (packages.size === 1) return 'package-local';
  }

  return 'normal';
}

export function analyzeJobs(run, jobs, workflowContract) {
  const required = new Set(workflowContract.requiredJobs);
  const allowed = new Set(workflowContract.allowedNonCriticalJobs ?? []);
  const byName = new Map(jobs.map((job) => [job.name, job]));
  const missingJobs = workflowContract.requiredJobs.filter(
    (name) => !byName.has(name)
  );
  const unknownJobs = jobs
    .map((job) => job.name)
    .filter((name) => !required.has(name) && !allowed.has(name));
  const duplicateJobs = jobs
    .map((job) => job.name)
    .filter((name, index, names) => names.indexOf(name) !== index);
  // The observer is still running. Only its completed dependencies determine
  // correctness and timing; its own duration must never measure itself.
  const dependencies = jobs.filter(
    (job) => job.name !== workflowContract.observerJob
  );
  const incompleteJobs = dependencies
    .filter((job) => job.status !== 'completed')
    .map((job) => job.name);
  const invalidConclusionJobs = dependencies
    .filter((job) => !TERMINAL_CONCLUSIONS.has(job.conclusion))
    .map((job) => job.name);
  const failedJobs = dependencies
    .filter((job) => FAILURE_CONCLUSIONS.includes(job.conclusion))
    .map((job) => job.name);

  const requiredJobs = workflowContract.requiredJobs
    .map((name) => byName.get(name))
    .filter(Boolean);
  const activeRequiredJobs = requiredJobs.filter(
    (job) => job.conclusion !== 'skipped'
  );
  const executionPath =
    activeRequiredJobs.length === workflowContract.requiredJobs.length
      ? 'full'
      : 'affected';

  const runCreatedMs = Date.parse(run.created_at);
  const timedJobs = requiredJobs.filter(
    (job) => job.started_at && job.completed_at && job.conclusion !== 'skipped'
  );
  const invalidTimingJobs = activeRequiredJobs
    .filter((job) => {
      const start = Date.parse(job.started_at);
      const end = Date.parse(job.completed_at);
      return !Number.isFinite(start) || !Number.isFinite(end) || end < start;
    })
    .map((job) => job.name);
  const startedMs = timedJobs.map((job) => Date.parse(job.started_at));
  const completedMs = timedJobs.map((job) => Date.parse(job.completed_at));
  const firstStartedMs =
    startedMs.length > 0 ? Math.min(...startedMs) : Number.NaN;
  const lastStartedMs =
    startedMs.length > 0 ? Math.max(...startedMs) : Number.NaN;
  const lastCompletedMs =
    completedMs.length > 0 ? Math.max(...completedMs) : Number.NaN;

  const feedbackSeconds =
    Number.isFinite(runCreatedMs) && Number.isFinite(lastCompletedMs)
      ? Math.ceil((lastCompletedMs - runCreatedMs) / 1000)
      : null;
  const executionFeedbackSeconds =
    Number.isFinite(firstStartedMs) && Number.isFinite(lastCompletedMs)
      ? Math.ceil((lastCompletedMs - firstStartedMs) / 1000)
      : null;
  const queueDelaySeconds =
    Number.isFinite(runCreatedMs) && Number.isFinite(firstStartedMs)
      ? Math.max(0, Math.ceil((firstStartedMs - runCreatedMs) / 1000))
      : null;
  const schedulerSkewSeconds =
    Number.isFinite(firstStartedMs) && Number.isFinite(lastStartedMs)
      ? Math.max(0, Math.ceil((lastStartedMs - firstStartedMs) / 1000))
      : null;

  const jobTimings = timedJobs
    .map((job) => ({
      name: job.name,
      runAttempt: run.run_attempt ?? null,
      conclusion: job.conclusion,
      startedAt: job.started_at,
      completedAt: job.completed_at,
      durationSeconds: Math.ceil(
        (Date.parse(job.completed_at) - Date.parse(job.started_at)) / 1000
      ),
    }))
    .sort((a, b) => b.durationSeconds - a.durationSeconds);
  const longestRequiredJob = jobTimings[0] ?? null;
  const criticalPathSeconds = longestRequiredJob?.durationSeconds ?? null;

  return {
    missingJobs,
    unknownJobs,
    duplicateJobs,
    incompleteJobs,
    invalidConclusionJobs,
    failedJobs,
    invalidTimingJobs,
    executionPath,
    feedbackSeconds,
    executionFeedbackSeconds,
    queueDelaySeconds,
    schedulerSkewSeconds,
    criticalPathSeconds,
    longestRequiredJob,
    jobs: workflowContract.requiredJobs.map((name) => {
      const job = byName.get(name);
      if (!job) return { name, conclusion: 'missing' };
      const timing = jobTimings.find((candidate) => candidate.name === name);
      return (
        timing ?? {
          name,
          runAttempt: run.run_attempt ?? null,
          conclusion: job.conclusion,
          startedAt: job.started_at ?? null,
          completedAt: job.completed_at ?? null,
          durationSeconds: null,
        }
      );
    }),
  };
}

export function selectBudget(shape, executionPath, budgets) {
  const declared = budgets[shape] ?? budgets.normal;
  if (!declared) throw new Error(`Missing budget for shape ${shape}`);

  const unexpectedNarrowing =
    declared.expectedExecutionPath === 'full' && executionPath !== 'full';
  const fallbackToFull =
    declared.expectedExecutionPath === 'affected' && executionPath === 'full';
  const effective = fallbackToFull ? budgets.normal : declared;

  return {
    shape,
    declared,
    effective,
    fallbackToFull,
    unexpectedNarrowing,
  };
}

export function evaluateBudget({
  currentSeconds,
  targetSeconds,
  toleranceSeconds,
  historicalSeconds,
  historyWindow,
  requiredExceedancesForFailure,
}) {
  const ceilingSeconds = targetSeconds + toleranceSeconds;
  if (currentSeconds <= targetSeconds) {
    return {
      status: 'pass',
      blocking: false,
      ceilingSeconds,
      exceedances: 0,
      samples: [currentSeconds],
    };
  }

  const samples = [currentSeconds, ...historicalSeconds].slice(
    0,
    historyWindow
  );
  const exceedances = samples.filter((value) => value > ceilingSeconds).length;

  if (currentSeconds <= ceilingSeconds) {
    return {
      status: 'within-tolerance',
      blocking: false,
      ceilingSeconds,
      exceedances,
      samples,
    };
  }

  const sustained =
    samples.length >= requiredExceedancesForFailure &&
    exceedances >= requiredExceedancesForFailure;
  return {
    status: sustained ? 'fail' : 'anomaly',
    blocking: sustained,
    ceilingSeconds,
    exceedances,
    samples,
  };
}

export function selectDistinctHistoricalSamples(
  samples,
  currentPullRequestNumber,
  limit = Number.POSITIVE_INFINITY
) {
  const selected = [];
  const seenPullRequests = new Set();

  for (const sample of samples) {
    const pullRequestNumber = sample.pullRequestNumber;
    if (pullRequestNumber !== null && pullRequestNumber !== undefined) {
      if (
        pullRequestNumber === currentPullRequestNumber ||
        seenPullRequests.has(pullRequestNumber)
      ) {
        continue;
      }
      seenPullRequests.add(pullRequestNumber);
    }

    selected.push(sample);
    if (selected.length >= limit) break;
  }

  return selected;
}

async function githubJson(endpoint, token) {
  const response = await fetch(`${API_ROOT}${endpoint}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`GitHub API ${response.status} for ${endpoint}: ${body}`);
  }
  return response.json();
}

export function parseDependencyResults(value) {
  const needs = JSON.parse(value ?? '{}');
  if (
    !needs ||
    Array.isArray(needs) ||
    typeof needs !== 'object' ||
    !needs.impact
  ) {
    throw new Error(
      'Completed CI dependencies, including PR Impact, are required'
    );
  }
  const results = Object.fromEntries(
    Object.entries(needs).map(([id, dependency]) => {
      if (
        !['success', 'failure', 'cancelled', 'skipped'].includes(
          dependency?.result
        )
      ) {
        throw new Error(`CI dependency ${id} has no completed result`);
      }
      return [id, dependency.result];
    })
  );
  return results;
}

export function parseChangedFiles(value) {
  const files = JSON.parse(value ?? 'null');
  if (
    !Array.isArray(files) ||
    files.some((file) => typeof file !== 'string' || !file)
  ) {
    throw new Error('PR Impact must provide its exact changed-file JSON array');
  }
  return files;
}

export function validateRunIdentity(run, expected) {
  if (
    !Number.isSafeInteger(expected.runId) ||
    expected.runId < 1 ||
    !Number.isSafeInteger(expected.runAttempt) ||
    expected.runAttempt < 1 ||
    run.id !== expected.runId ||
    run.run_attempt !== expected.runAttempt ||
    run.head_sha !== expected.headSha ||
    run.repository?.full_name !== expected.repository ||
    run.event !== 'pull_request' ||
    run.path?.split('@')[0] !== `.github/workflows/${expected.workflowFile}`
  ) {
    throw new Error(
      'CI run identity does not match the original PR head and exact run attempt'
    );
  }
}

export async function fetchAttemptJobs({
  repository,
  runId,
  runAttempt,
  headSha,
  token,
  request = githubJson,
}) {
  if (typeof headSha !== 'string' || !headSha) {
    throw new Error(
      'An original head SHA is required for attempt job identity'
    );
  }
  const jobs = [];
  for (let page = 1; ; page += 1) {
    const response = await request(
      `/repos/${repository}/actions/runs/${runId}/attempts/${runAttempt}/jobs?per_page=100&page=${page}`,
      token
    );
    for (const job of response.jobs) {
      if (
        job.run_id !== runId ||
        job.run_attempt !== runAttempt ||
        job.head_sha !== headSha
      ) {
        throw new Error(
          `CI job ${job.name ?? job.id} does not belong to the selected run, attempt and original head`
        );
      }
      jobs.push(job);
    }
    if (response.jobs.length < 100) break;
  }
  // Do not combine attempts. A partial rerun without the complete inventory is
  // rejected by the contract, rather than borrowing timing from another attempt.
  return jobs;
}

export async function readCurrentAttempt({
  expected,
  workflowContract,
  token,
  request = githubJson,
  wait = (milliseconds) =>
    new Promise((resolve) => setTimeout(resolve, milliseconds)),
}) {
  // Native needs have completed already. Briefly reread only an eventually
  // consistent API snapshot; never wait for this workflow (which includes us).
  for (let metadataReads = 1; metadataReads <= 6; metadataReads += 1) {
    const ciRun = await request(
      `/repos/${expected.repository}/actions/runs/${expected.runId}/attempts/${expected.runAttempt}`,
      token
    );
    validateRunIdentity(ciRun, expected);
    const jobs = await fetchAttemptJobs({ ...expected, token, request });
    const timing = analyzeJobs(ciRun, jobs, workflowContract);
    const dependencies = jobs.filter(
      (job) => job.name !== workflowContract.observerJob
    );
    const recognizedMetadata = dependencies.every(
      (job) =>
        [
          'completed',
          'queued',
          'in_progress',
          'waiting',
          'pending',
          'requested',
        ].includes(job.status) &&
        (job.conclusion == null || TERMINAL_CONCLUSIONS.has(job.conclusion))
    );
    const invalidCompletedTimings = dependencies.some(
      (job) =>
        job.status === 'completed' &&
        job.conclusion === 'success' &&
        timing.invalidTimingJobs.includes(job.name)
    );
    const transient =
      recognizedMetadata &&
      timing.unknownJobs.length === 0 &&
      timing.duplicateJobs.length === 0 &&
      timing.failedJobs.length === 0 &&
      !invalidCompletedTimings &&
      Number.isFinite(Date.parse(ciRun.created_at)) &&
      (timing.missingJobs.length > 0 ||
        timing.incompleteJobs.length > 0 ||
        dependencies.some((job) => job.conclusion == null));
    if (!transient || metadataReads === 6)
      return { ciRun, jobs, timing, metadataReads };
    await wait(5000);
  }
}

export function historicalShape(jobs, executionPath, budgets) {
  const markerPrefix = 'CI performance shape: ';
  const markers =
    jobs
      .find((job) => job.name === 'PR Impact')
      ?.steps?.filter(
        (step) =>
          step.name.startsWith(markerPrefix) && step.conclusion === 'success'
      ) ?? [];
  if (markers.length === 1) {
    const shape = markers[0].name.slice(markerPrefix.length);
    return Object.hasOwn(budgets, shape) ? shape : null;
  }
  if (markers.length > 0) return null;
  // Legacy full-path runs share the normal budget, including narrow-shape
  // fallbacks. Legacy affected runs without immutable classification are omitted.
  return executionPath === 'full' ? 'normal' : null;
}

function runPullRequestNumber(run) {
  return run.pull_requests?.[0]?.number ?? null;
}

export async function historicalSamples({
  repository,
  currentRun,
  currentPullRequestNumber,
  currentExecutionPath,
  currentBudget,
  workflowFile,
  workflowContract,
  budgets,
  enforcement,
  baseline,
  token,
  request = githubJson,
}) {
  const response = await request(
    `/repos/${repository}/actions/workflows/${encodeURIComponent(
      workflowFile
    )}/runs?event=pull_request&status=completed&per_page=20`,
    token
  );
  const candidates = [];

  for (const run of response.workflow_runs) {
    if (
      run.id === currentRun.id ||
      runPullRequestNumber(run) === currentPullRequestNumber
    )
      continue;
    if (!Number.isSafeInteger(run.run_attempt) || run.run_attempt < 1) continue;

    const jobs = await fetchAttemptJobs({
      repository,
      runId: run.id,
      runAttempt: run.run_attempt,
      headSha: run.head_sha,
      token,
      request,
    });
    const analysis = analyzeJobs(run, jobs, workflowContract);
    if (
      analysis.missingJobs.length > 0 ||
      analysis.unknownJobs.length > 0 ||
      analysis.duplicateJobs.length > 0 ||
      analysis.incompleteJobs.length > 0 ||
      analysis.invalidConclusionJobs.length > 0 ||
      analysis.failedJobs.length > 0 ||
      analysis.invalidTimingJobs.length > 0 ||
      analysis.feedbackSeconds === null ||
      analysis.executionFeedbackSeconds === null ||
      analysis.criticalPathSeconds === null ||
      analysis.executionPath !== currentExecutionPath
    ) {
      continue;
    }

    // A failure of the performance observer must not erase a slow but otherwise
    // correct run from history, or sustained regressions would oscillate green.
    const hasObserver = jobs.some(
      (job) => job.name === workflowContract.observerJob
    );
    if (run.conclusion !== 'success' && !hasObserver) continue;
    const shape = historicalShape(jobs, analysis.executionPath, budgets);
    if (shape === null) continue;
    const prNumber = runPullRequestNumber(run);
    const selected = selectBudget(shape, analysis.executionPath, budgets);
    if (
      selected.unexpectedNarrowing ||
      selected.effective.targetSeconds !== currentBudget.targetSeconds ||
      selected.effective.toleranceSeconds !== currentBudget.toleranceSeconds
    ) {
      continue;
    }

    candidates.push({
      workflowRunId: run.id,
      runAttempt: run.run_attempt,
      headSha: run.head_sha,
      pullRequestNumber: prNumber,
      shape,
      feedbackSeconds: analysis.feedbackSeconds,
      executionFeedbackSeconds: analysis.executionFeedbackSeconds,
      queueDelaySeconds: analysis.queueDelaySeconds,
      schedulerSkewSeconds: analysis.schedulerSkewSeconds,
      criticalPathSeconds: analysis.criticalPathSeconds,
    });
    if (
      selectDistinctHistoricalSamples(candidates, currentPullRequestNumber)
        .length >=
      enforcement.historyWindow - 1
    )
      break;
  }

  const samples = selectDistinctHistoricalSamples(
    candidates,
    currentPullRequestNumber,
    enforcement.historyWindow - 1
  );

  if (
    samples.length < enforcement.historyWindow - 1 &&
    baseline?.longestRequiredJobSeconds &&
    baseline.workflowRunId !== currentRun.id &&
    currentExecutionPath === 'full' &&
    currentBudget.targetSeconds === budgets.normal.targetSeconds
  ) {
    const alreadyPresent = samples.some(
      (sample) => sample.workflowRunId === baseline.workflowRunId
    );
    if (!alreadyPresent) {
      samples.push({
        workflowRunId: baseline.workflowRunId,
        headSha: baseline.commit,
        pullRequestNumber: null,
        shape: 'normal',
        feedbackSeconds: baseline.feedbackSeconds,
        executionFeedbackSeconds: baseline.executionFeedbackSeconds,
        queueDelaySeconds: baseline.queueDelaySeconds ?? null,
        schedulerSkewSeconds: null,
        criticalPathSeconds: baseline.longestRequiredJobSeconds,
        source: 'canonical-baseline',
      });
    }
  }

  return samples.slice(0, enforcement.historyWindow - 1);
}

export function checkAttemptContract({
  timing,
  budget,
  shape,
  dependencyResults,
}) {
  if (
    timing.missingJobs.length > 0 ||
    timing.unknownJobs.length > 0 ||
    timing.duplicateJobs.length > 0 ||
    timing.incompleteJobs.length > 0 ||
    timing.invalidConclusionJobs.length > 0
  ) {
    return {
      status: 'contract-error',
      blocking: true,
      message: `CI attempt job inventory or terminal results are incomplete or changed. Missing: ${timing.missingJobs.join(', ') || 'none'}. Unregistered: ${timing.unknownJobs.join(', ') || 'none'}. Duplicate: ${timing.duplicateJobs.join(', ') || 'none'}. Incomplete: ${timing.incompleteJobs.join(', ') || 'none'}. Invalid conclusions: ${timing.invalidConclusionJobs.join(', ') || 'none'}. All measured jobs must complete with recognized conclusions in this attempt; rerun the full CI workflow if this was a partial rerun. Update inventory changes in the canonical budget contract explicitly.`,
    };
  }
  if (
    Object.values(dependencyResults).some((result) =>
      ['failure', 'cancelled'].includes(result)
    )
  ) {
    return {
      status: 'not-evaluated',
      blocking: false,
      message:
        'CI correctness dependencies failed or were cancelled; timing is preserved but incomplete correctness runs do not change the performance baseline.',
    };
  }
  if (timing.failedJobs.length > 0 || dependencyResults.impact !== 'success') {
    return {
      status: 'contract-error',
      blocking: true,
      message:
        'CI dependency results do not confirm the API correctness failure, or PR Impact did not succeed. Inconsistent evidence cannot bypass performance evaluation.',
    };
  }
  if (budget.unexpectedNarrowing) {
    return {
      status: 'contract-error',
      blocking: true,
      message: `Fail-safe regression: ${shape} changes are configured for the full path but CI executed an affected path.`,
    };
  }
  if (
    timing.invalidTimingJobs.length > 0 ||
    !Number.isFinite(timing.feedbackSeconds) ||
    !Number.isFinite(timing.executionFeedbackSeconds) ||
    !Number.isFinite(timing.criticalPathSeconds)
  ) {
    return {
      status: 'contract-error',
      blocking: true,
      message:
        'Required job timestamps were incomplete; deterministic feedback and critical-path latency could not be calculated.',
    };
  }
  return null;
}

function formatSeconds(seconds) {
  if (seconds === null) return 'n/a';
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}m ${String(remainder).padStart(2, '0')}s`;
}

function makeSummary(evidence) {
  const resultLabel = {
    pass: 'PASS',
    'within-tolerance': 'PASS — critical-path tolerance',
    anomaly: 'WARN — single slow critical-path anomaly',
    fail: 'FAIL — sustained critical-path regression',
    'not-evaluated': 'NOT EVALUATED — CI correctness failure',
    'contract-error': 'FAIL — timing contract drift',
  }[evidence.result.status];

  const lines = [
    '# CI Performance Budget',
    '',
    `**${resultLabel}**`,
    '',
    '| Metric | Value |',
    '| --- | --- |',
    `| PR shape | ${evidence.pullRequest.shape} |`,
    `| Execution path | ${evidence.executionPath} |`,
    `| CI run / attempt | ${evidence.ciRun.id} / ${evidence.ciRun.runAttempt} |`,
    `| Total feedback wall clock | ${formatSeconds(evidence.timings.feedbackSeconds)} |`,
    `| Hosted-runner initial queue | ${formatSeconds(evidence.timings.queueDelaySeconds)} |`,
    `| Hosted-runner scheduler skew | ${formatSeconds(evidence.timings.schedulerSkewSeconds)} |`,
    `| Parallel execution span (telemetry) | ${formatSeconds(evidence.timings.executionFeedbackSeconds)} |`,
    `| Budgeted critical path | ${formatSeconds(evidence.timings.criticalPathSeconds)} |`,
    `| Target | ${formatSeconds(evidence.budget.effective.targetSeconds)} |`,
    `| Critical-path tolerance ceiling | ${formatSeconds(evidence.budget.effective.targetSeconds + evidence.budget.effective.toleranceSeconds)} |`,
    `| Longest required job | ${evidence.timings.longestRequiredJob?.name ?? 'n/a'} (${formatSeconds(evidence.timings.longestRequiredJob?.durationSeconds ?? null)}) |`,
    '',
  ];

  if (evidence.budget.fallbackToFull) {
    lines.push(
      `> Narrow shape **${evidence.pullRequest.shape}** fell back to the conservative full path. Its shape target remains ${formatSeconds(evidence.budget.declared.targetSeconds)}; this fallback is recorded for #822 affected-execution work.`,
      ''
    );
  }

  if (evidence.result.message) lines.push(evidence.result.message, '');

  lines.push(
    '| Required job | Duration | Conclusion |',
    '| --- | ---: | --- |'
  );
  for (const job of evidence.timings.jobs) {
    lines.push(
      `| ${job.name} | ${formatSeconds(job.durationSeconds ?? null)} | ${job.conclusion} |`
    );
  }

  if (evidence.history.samples.length > 0) {
    lines.push('', '## Recent comparable samples', '');
    for (const sample of evidence.history.samples) {
      lines.push(
        `- run ${sample.workflowRunId}${sample.runAttempt ? ` / attempt ${sample.runAttempt}` : ''}: critical path ${formatSeconds(sample.criticalPathSeconds)}, total ${formatSeconds(sample.feedbackSeconds)}, initial queue ${formatSeconds(sample.queueDelaySeconds)}, scheduler skew ${formatSeconds(sample.schedulerSkewSeconds)} (${sample.shape})`
      );
    }
  }

  return `${lines.join('\n')}\n`;
}

async function writeEvidence(evidence) {
  await fs.mkdir(ARTIFACT_DIR, { recursive: true });
  await fs.writeFile(
    path.join(ARTIFACT_DIR, 'timing.json'),
    `${JSON.stringify(evidence, null, 2)}\n`
  );
  await fs.writeFile(
    path.join(ARTIFACT_DIR, 'summary.md'),
    makeSummary(evidence)
  );
}

async function main() {
  const token = process.env.GITHUB_TOKEN;
  const repository = process.env.GITHUB_REPOSITORY;
  const eventPath = process.env.GITHUB_EVENT_PATH;
  const configPath = path.resolve(
    process.env.CI_PERFORMANCE_CONFIG ?? DEFAULT_CONFIG
  );
  if (!token || !repository || !eventPath) {
    throw new Error(
      'GITHUB_TOKEN, GITHUB_REPOSITORY and GITHUB_EVENT_PATH are required'
    );
  }

  const [configText, eventText] = await Promise.all([
    fs.readFile(configPath, 'utf8'),
    fs.readFile(eventPath, 'utf8'),
  ]);
  const config = JSON.parse(configText);
  const event = JSON.parse(eventText);
  const pullRequest = event.pull_request;
  if (!pullRequest?.number || !pullRequest.head?.sha) {
    throw new Error(
      'CI performance budget currently requires a pull_request event'
    );
  }

  const dependencyResults = parseDependencyResults(
    process.env.CI_PERFORMANCE_DEPENDENCIES
  );
  const changedFiles =
    dependencyResults.impact === 'success'
      ? parseChangedFiles(process.env.CI_PERFORMANCE_CHANGED_FILES)
      : [];
  const shape = classifyFiles(changedFiles, config.classification);
  const runId = Number(process.env.GITHUB_RUN_ID);
  const runAttempt = Number(process.env.GITHUB_RUN_ATTEMPT);
  if (
    !Number.isSafeInteger(runId) ||
    runId < 1 ||
    !Number.isSafeInteger(runAttempt) ||
    runAttempt < 1
  ) {
    throw new Error(
      'GITHUB_RUN_ID and GITHUB_RUN_ATTEMPT must identify this CI attempt'
    );
  }
  const { ciRun, timing, metadataReads } = await readCurrentAttempt({
    expected: {
      repository,
      runId,
      runAttempt,
      headSha: pullRequest.head.sha,
      workflowFile: config.workflow.file,
    },
    workflowContract: config.workflow,
    token,
  });
  const budget = selectBudget(shape, timing.executionPath, config.budgets);

  let result = checkAttemptContract({
    timing,
    budget,
    shape,
    dependencyResults,
  });
  let history = [];

  if (result === null) {
    history = await historicalSamples({
      repository,
      currentRun: ciRun,
      currentPullRequestNumber: pullRequest.number,
      currentExecutionPath: timing.executionPath,
      currentBudget: budget.effective,
      workflowFile: config.workflow.file,
      workflowContract: config.workflow,
      budgets: config.budgets,
      enforcement: config.enforcement,
      baseline: config.baseline,
      token,
    });
    const evaluation = evaluateBudget({
      currentSeconds: timing.criticalPathSeconds,
      targetSeconds: budget.effective.targetSeconds,
      toleranceSeconds: budget.effective.toleranceSeconds,
      historicalSeconds: history.map((sample) => sample.criticalPathSeconds),
      historyWindow: config.enforcement.historyWindow,
      requiredExceedancesForFailure:
        config.enforcement.requiredExceedancesForFailure,
    });
    const messages = {
      pass: 'Required-check critical-path duration is within the maintained target.',
      'within-tolerance':
        'The longest required lane exceeded the target but remains inside the documented tolerance. Hosted-runner queue and scheduling skew remain visible separately and are not treated as code regressions.',
      anomaly:
        'The longest required lane exceeded the tolerance ceiling, but recent comparable critical-path history does not show a sustained regression yet.',
      fail: 'The critical-path tolerance ceiling has been exceeded repeatedly in the configured history window. Optimize the CI critical path or explicitly revise the budget contract.',
    };
    result = { ...evaluation, message: messages[evaluation.status] };
  }

  const evidence = {
    schemaVersion: 2,
    generatedAt: new Date().toISOString(),
    repository,
    pullRequest: {
      number: pullRequest.number,
      headSha: pullRequest.head.sha,
      baseSha: pullRequest.base?.sha ?? null,
      shape,
      changedFiles,
    },
    ciRun: {
      id: ciRun.id,
      runNumber: ciRun.run_number,
      runAttempt,
      metadataReads,
      workflowSha: process.env.GITHUB_SHA ?? null,
      url: ciRun.html_url,
      createdAt: ciRun.created_at,
      conclusion: ciRun.conclusion,
      dependencyResults,
    },
    executionPath: timing.executionPath,
    budget,
    timings: {
      feedbackSeconds: timing.feedbackSeconds,
      executionFeedbackSeconds: timing.executionFeedbackSeconds,
      queueDelaySeconds: timing.queueDelaySeconds,
      schedulerSkewSeconds: timing.schedulerSkewSeconds,
      criticalPathSeconds: timing.criticalPathSeconds,
      longestRequiredJob: timing.longestRequiredJob,
      jobs: timing.jobs,
    },
    contract: {
      missingJobs: timing.missingJobs,
      unknownJobs: timing.unknownJobs,
      duplicateJobs: timing.duplicateJobs,
      incompleteJobs: timing.incompleteJobs,
      invalidConclusionJobs: timing.invalidConclusionJobs,
      failedJobs: timing.failedJobs,
      invalidTimingJobs: timing.invalidTimingJobs,
      externalWorkflowsExcludedFromCriticalPath:
        config.externalWorkflowsExcludedFromCriticalPath,
    },
    history: {
      window: config.enforcement.historyWindow,
      requiredExceedancesForFailure:
        config.enforcement.requiredExceedancesForFailure,
      samples: history,
    },
    baseline: config.baseline,
    result,
  };

  await writeEvidence(evidence);
  console.log(JSON.stringify(evidence, null, 2));
  if (result.blocking) process.exitCode = 1;
}

const invokedDirectly =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  main().catch(async (error) => {
    console.error(error);
    await fs.mkdir(ARTIFACT_DIR, { recursive: true });
    await fs.writeFile(
      path.join(ARTIFACT_DIR, 'summary.md'),
      `# CI Performance Budget\n\n**FAIL — runtime error**\n\n${error.stack ?? error}\n`
    );
    process.exitCode = 1;
  });
}
