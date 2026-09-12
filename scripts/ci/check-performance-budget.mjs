import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const API_ROOT = 'https://api.github.com';
const ARTIFACT_DIR = path.resolve('.artifacts/ci-performance');
const DEFAULT_CONFIG = path.resolve('.github/ci-performance-budget.json');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function classifyFiles(files, classification) {
  if (files.length === 0) return 'normal';

  const docsOnly = files.every((file) => {
    const normalized = file.replaceAll('\\', '/');
    const basename = normalized.split('/').at(-1) ?? normalized;
    return (
      classification.docsPrefixes.some((prefix) => normalized.startsWith(prefix)) ||
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

  const packageMatches = files.map((file) => file.match(/^packages\/([^/]+)\//));
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
  const missingJobs = workflowContract.requiredJobs.filter((name) => !byName.has(name));
  const unknownJobs = jobs
    .map((job) => job.name)
    .filter((name) => !required.has(name) && !allowed.has(name));

  const requiredJobs = workflowContract.requiredJobs
    .map((name) => byName.get(name))
    .filter(Boolean);
  const activeRequiredJobs = requiredJobs.filter((job) => job.conclusion !== 'skipped');
  const executionPath =
    activeRequiredJobs.length === workflowContract.requiredJobs.length
      ? 'full'
      : 'affected';

  const startMs = Date.parse(run.created_at);
  const timedJobs = requiredJobs.filter(
    (job) => job.started_at && job.completed_at && job.conclusion !== 'skipped'
  );
  const completedMs = timedJobs.map((job) => Date.parse(job.completed_at));
  const feedbackSeconds =
    Number.isFinite(startMs) && completedMs.length > 0
      ? Math.ceil((Math.max(...completedMs) - startMs) / 1000)
      : null;

  const jobTimings = timedJobs
    .map((job) => ({
      name: job.name,
      conclusion: job.conclusion,
      startedAt: job.started_at,
      completedAt: job.completed_at,
      durationSeconds: Math.ceil(
        (Date.parse(job.completed_at) - Date.parse(job.started_at)) / 1000
      ),
    }))
    .sort((a, b) => b.durationSeconds - a.durationSeconds);

  return {
    missingJobs,
    unknownJobs,
    executionPath,
    feedbackSeconds,
    longestRequiredJob: jobTimings[0] ?? null,
    jobs: workflowContract.requiredJobs.map((name) => {
      const job = byName.get(name);
      if (!job) return { name, conclusion: 'missing' };
      const timing = jobTimings.find((candidate) => candidate.name === name);
      return timing ?? {
        name,
        conclusion: job.conclusion,
        startedAt: job.started_at ?? null,
        completedAt: job.completed_at ?? null,
        durationSeconds: null,
      };
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

  const samples = [currentSeconds, ...historicalSeconds].slice(0, historyWindow);
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

async function fetchChangedFiles(repository, pullRequestNumber, token) {
  const files = [];
  for (let page = 1; page <= 20; page += 1) {
    const batch = await githubJson(
      `/repos/${repository}/pulls/${pullRequestNumber}/files?per_page=100&page=${page}`,
      token
    );
    files.push(...batch.map((entry) => entry.filename));
    if (batch.length < 100) break;
  }
  return files;
}

async function fetchRunJobs(repository, runId, token) {
  const response = await githubJson(
    `/repos/${repository}/actions/runs/${runId}/jobs?per_page=100`,
    token
  );
  return response.jobs;
}

async function waitForCiRun({
  repository,
  headSha,
  workflowFile,
  token,
  pollIntervalSeconds,
  pollTimeoutSeconds,
}) {
  const deadline = Date.now() + pollTimeoutSeconds * 1000;
  while (Date.now() < deadline) {
    const response = await githubJson(
      `/repos/${repository}/actions/workflows/${encodeURIComponent(
        workflowFile
      )}/runs?event=pull_request&head_sha=${headSha}&per_page=20`,
      token
    );
    const exactRuns = response.workflow_runs
      .filter((run) => run.head_sha === headSha)
      .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
    const run = exactRuns[0];
    if (run?.status === 'completed') return run;
    await sleep(pollIntervalSeconds * 1000);
  }
  throw new Error(
    `Timed out waiting for ${workflowFile} on exact head ${headSha}`
  );
}

function runPullRequestNumber(run) {
  return run.pull_requests?.[0]?.number ?? null;
}

async function historicalSamples({
  repository,
  currentRun,
  currentPullRequestNumber,
  currentExecutionPath,
  currentBudget,
  workflowFile,
  workflowContract,
  classification,
  budgets,
  enforcement,
  baseline,
  token,
}) {
  const response = await githubJson(
    `/repos/${repository}/actions/workflows/${encodeURIComponent(
      workflowFile
    )}/runs?event=pull_request&status=completed&per_page=20`,
    token
  );
  const candidates = [];

  for (const run of response.workflow_runs) {
    if (run.id === currentRun.id || run.conclusion !== 'success') continue;

    const jobs = await fetchRunJobs(repository, run.id, token);
    const analysis = analyzeJobs(run, jobs, workflowContract);
    if (
      analysis.missingJobs.length > 0 ||
      analysis.unknownJobs.length > 0 ||
      analysis.feedbackSeconds === null ||
      analysis.executionPath !== currentExecutionPath
    ) {
      continue;
    }

    let shape = 'normal';
    const prNumber = runPullRequestNumber(run);
    if (prNumber) {
      try {
        const files = await fetchChangedFiles(repository, prNumber, token);
        shape = classifyFiles(files, classification);
      } catch {
        shape = 'normal';
      }
    }
    const selected = selectBudget(shape, analysis.executionPath, budgets);
    if (
      selected.effective.targetSeconds !== currentBudget.targetSeconds ||
      selected.effective.toleranceSeconds !== currentBudget.toleranceSeconds
    ) {
      continue;
    }

    candidates.push({
      workflowRunId: run.id,
      headSha: run.head_sha,
      pullRequestNumber: prNumber,
      shape,
      feedbackSeconds: analysis.feedbackSeconds,
    });
  }

  const samples = selectDistinctHistoricalSamples(
    candidates,
    currentPullRequestNumber,
    enforcement.historyWindow - 1
  );

  if (
    samples.length < enforcement.historyWindow - 1 &&
    baseline?.feedbackSeconds &&
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
        source: 'canonical-baseline',
      });
    }
  }

  return samples.slice(0, enforcement.historyWindow - 1);
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
    'within-tolerance': 'PASS — runner tolerance',
    anomaly: 'WARN — single slow-run anomaly',
    fail: 'FAIL — sustained regression',
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
    `| Feedback wall clock | ${formatSeconds(evidence.timings.feedbackSeconds)} |`,
    `| Target | ${formatSeconds(evidence.budget.effective.targetSeconds)} |`,
    `| Hosted-runner tolerance ceiling | ${formatSeconds(evidence.budget.effective.targetSeconds + evidence.budget.effective.toleranceSeconds)} |`,
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

  lines.push('| Required job | Duration | Conclusion |', '| --- | ---: | --- |');
  for (const job of evidence.timings.jobs) {
    lines.push(
      `| ${job.name} | ${formatSeconds(job.durationSeconds ?? null)} | ${job.conclusion} |`
    );
  }

  if (evidence.history.samples.length > 0) {
    lines.push('', '## Recent comparable samples', '');
    for (const sample of evidence.history.samples) {
      lines.push(
        `- run ${sample.workflowRunId}: ${formatSeconds(sample.feedbackSeconds)} (${sample.shape})`
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
  await fs.writeFile(path.join(ARTIFACT_DIR, 'summary.md'), makeSummary(evidence));
}

async function main() {
  const token = process.env.GITHUB_TOKEN;
  const repository = process.env.GITHUB_REPOSITORY;
  const eventPath = process.env.GITHUB_EVENT_PATH;
  const configPath = path.resolve(process.env.CI_PERFORMANCE_CONFIG ?? DEFAULT_CONFIG);
  if (!token || !repository || !eventPath) {
    throw new Error('GITHUB_TOKEN, GITHUB_REPOSITORY and GITHUB_EVENT_PATH are required');
  }

  const [configText, eventText] = await Promise.all([
    fs.readFile(configPath, 'utf8'),
    fs.readFile(eventPath, 'utf8'),
  ]);
  const config = JSON.parse(configText);
  const event = JSON.parse(eventText);
  const pullRequest = event.pull_request;
  if (!pullRequest?.number || !pullRequest.head?.sha) {
    throw new Error('CI performance budget currently requires a pull_request event');
  }

  const changedFiles = await fetchChangedFiles(repository, pullRequest.number, token);
  const shape = classifyFiles(changedFiles, config.classification);
  const ciRun = await waitForCiRun({
    repository,
    headSha: pullRequest.head.sha,
    workflowFile: config.workflow.file,
    token,
    ...config.enforcement,
  });
  const jobs = await fetchRunJobs(repository, ciRun.id, token);
  const timing = analyzeJobs(ciRun, jobs, config.workflow);
  const budget = selectBudget(shape, timing.executionPath, config.budgets);

  let result;
  let history = [];

  if (timing.missingJobs.length > 0 || timing.unknownJobs.length > 0) {
    result = {
      status: 'contract-error',
      blocking: true,
      message: `CI job inventory changed. Missing: ${timing.missingJobs.join(', ') || 'none'}. Unregistered: ${timing.unknownJobs.join(', ') || 'none'}. Update the canonical budget contract explicitly.`,
    };
  } else if (budget.unexpectedNarrowing) {
    result = {
      status: 'contract-error',
      blocking: true,
      message: `Fail-safe regression: ${shape} changes are configured for the full path but CI executed an affected path.`,
    };
  } else if (ciRun.conclusion !== 'success') {
    result = {
      status: 'not-evaluated',
      blocking: false,
      message: `CI concluded ${ciRun.conclusion}; timing is preserved but incomplete correctness runs do not change the performance baseline.`,
    };
  } else if (timing.feedbackSeconds === null) {
    result = {
      status: 'contract-error',
      blocking: true,
      message: 'Required job timestamps were incomplete; deterministic feedback latency could not be calculated.',
    };
  } else {
    history = await historicalSamples({
      repository,
      currentRun: ciRun,
      currentPullRequestNumber: pullRequest.number,
      currentExecutionPath: timing.executionPath,
      currentBudget: budget.effective,
      workflowFile: config.workflow.file,
      workflowContract: config.workflow,
      classification: config.classification,
      budgets: config.budgets,
      enforcement: config.enforcement,
      baseline: config.baseline,
      token,
    });
    const evaluation = evaluateBudget({
      currentSeconds: timing.feedbackSeconds,
      targetSeconds: budget.effective.targetSeconds,
      toleranceSeconds: budget.effective.toleranceSeconds,
      historicalSeconds: history.map((sample) => sample.feedbackSeconds),
      historyWindow: config.enforcement.historyWindow,
      requiredExceedancesForFailure:
        config.enforcement.requiredExceedancesForFailure,
    });
    const messages = {
      pass: 'Required-check feedback latency is within the maintained target.',
      'within-tolerance':
        'The run exceeded the target but remains inside the documented GitHub-hosted-runner tolerance.',
      anomaly:
        'The run exceeded the tolerance ceiling, but the recent comparable history does not show a sustained regression yet.',
      fail: 'The tolerance ceiling has been exceeded repeatedly in the configured history window. Optimize the critical path or explicitly revise the budget contract.',
    };
    result = { ...evaluation, message: messages[evaluation.status] };
  }

  const evidence = {
    schemaVersion: 1,
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
      url: ciRun.html_url,
      createdAt: ciRun.created_at,
      conclusion: ciRun.conclusion,
    },
    executionPath: timing.executionPath,
    budget,
    timings: {
      feedbackSeconds: timing.feedbackSeconds,
      longestRequiredJob: timing.longestRequiredJob,
      jobs: timing.jobs,
    },
    contract: {
      missingJobs: timing.missingJobs,
      unknownJobs: timing.unknownJobs,
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