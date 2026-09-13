import assert from 'node:assert/strict';
import test from 'node:test';

import {
  analyzeJobs,
  classifyFiles,
  evaluateBudget,
  selectBudget,
  selectDistinctHistoricalSamples,
} from './check-performance-budget.mjs';
import {
  classifyFiles as classifyAffectedFiles,
  packageNameForFiles,
  planAffectedExecution,
} from './affected-execution.mjs';

const classification = {
  sharedPrefixes: ['packages/tokens/', 'packages/types/', 'packages/core/'],
  docsPrefixes: ['docs/'],
  docsBasenames: ['README.md', 'CONTRIBUTING.md'],
  docsExtensions: ['.md', '.mdx'],
};

const budgets = {
  normal: {
    targetSeconds: 360,
    toleranceSeconds: 75,
    expectedExecutionPath: 'full',
  },
  'package-local': {
    targetSeconds: 300,
    toleranceSeconds: 60,
    expectedExecutionPath: 'affected',
  },
  'docs-only': {
    targetSeconds: 240,
    toleranceSeconds: 60,
    expectedExecutionPath: 'affected',
  },
  shared: {
    targetSeconds: 360,
    toleranceSeconds: 75,
    expectedExecutionPath: 'full',
  },
};

test('classifies documentation-only changes conservatively', () => {
  assert.equal(
    classifyFiles(['README.md', 'docs/ci.md', 'packages/react/README.md'], classification),
    'docs-only'
  );
});

test('classifies a single package as package-local', () => {
  assert.equal(
    classifyFiles(
      ['packages/react/src/Button.tsx', 'packages/react/src/Button.test.tsx'],
      classification
    ),
    'package-local'
  );
});

test('shared packages force the shared full-path shape', () => {
  assert.equal(
    classifyFiles(['packages/tokens/src/light.ts'], classification),
    'shared'
  );
});

test('cross-boundary changes fall back to normal', () => {
  assert.equal(
    classifyFiles(
      ['packages/react/src/Button.tsx', 'apps/website/src/app/page.tsx'],
      classification
    ),
    'normal'
  );
});

test('affected execution classifier stays aligned with the performance budget classifier', () => {
  const cases = [
    ['README.md', 'docs/ci.md', 'packages/react/README.md'],
    ['packages/react/src/Button.tsx', 'packages/react/src/Button.test.tsx'],
    ['packages/tokens/src/light.ts'],
    ['packages/react/src/Button.tsx', 'apps/website/src/app/page.tsx'],
    ['.github/workflows/ci.yml'],
    [],
  ];

  for (const files of cases) {
    assert.equal(classifyAffectedFiles(files, classification), classifyFiles(files, classification));
  }
});

test('affected execution maps only narrow proven shapes to the affected path', () => {
  assert.deepEqual(
    planAffectedExecution(['docs/ci.md'], classification),
    {
      shape: 'docs-only',
      executionPath: 'affected',
      packageName: null,
      changedFiles: ['docs/ci.md'],
    }
  );

  assert.deepEqual(
    planAffectedExecution(['packages/react/src/Button.tsx'], classification),
    {
      shape: 'package-local',
      executionPath: 'affected',
      packageName: 'react',
      changedFiles: ['packages/react/src/Button.tsx'],
    }
  );

  assert.equal(
    planAffectedExecution(['packages/tokens/src/light.ts'], classification).executionPath,
    'full'
  );
  assert.equal(
    planAffectedExecution(['.github/workflows/ci.yml'], classification).executionPath,
    'full'
  );
});

test('package-local identification rejects cross-package and non-package changes', () => {
  assert.equal(
    packageNameForFiles(['packages/react/src/Button.tsx', 'packages/react/src/Input.tsx']),
    'react'
  );
  assert.equal(
    packageNameForFiles(['packages/react/src/Button.tsx', 'packages/icons/src/index.ts']),
    null
  );
  assert.equal(packageNameForFiles(['apps/website/src/app/page.tsx']), null);
});

test('narrow shape using full CI selects the conservative normal budget', () => {
  const selected = selectBudget('docs-only', 'full', budgets);
  assert.equal(selected.fallbackToFull, true);
  assert.equal(selected.effective.targetSeconds, 360);
});

test('unexpected narrowing of a full-path shape is detected', () => {
  const selected = selectBudget('shared', 'affected', budgets);
  assert.equal(selected.unexpectedNarrowing, true);
});

test('one slow execution above the tolerance ceiling does not block', () => {
  const result = evaluateBudget({
    currentSeconds: 470,
    targetSeconds: 360,
    toleranceSeconds: 75,
    historicalSeconds: [399, 410, 401, 405],
    historyWindow: 5,
    requiredExceedancesForFailure: 3,
  });
  assert.equal(result.status, 'anomaly');
  assert.equal(result.blocking, false);
});

test('sustained execution regressions above the tolerance ceiling block', () => {
  const result = evaluateBudget({
    currentSeconds: 470,
    targetSeconds: 360,
    toleranceSeconds: 75,
    historicalSeconds: [460, 455, 400, 398],
    historyWindow: 5,
    requiredExceedancesForFailure: 3,
  });
  assert.equal(result.status, 'fail');
  assert.equal(result.blocking, true);
});

test('execution variance inside the documented tolerance is non-blocking', () => {
  const result = evaluateBudget({
    currentSeconds: 399,
    targetSeconds: 360,
    toleranceSeconds: 75,
    historicalSeconds: [],
    historyWindow: 5,
    requiredExceedancesForFailure: 3,
  });
  assert.equal(result.status, 'within-tolerance');
  assert.equal(result.blocking, false);
});

test('history excludes current PR reruns and deduplicates other PRs', () => {
  const samples = selectDistinctHistoricalSamples(
    [
      { workflowRunId: 10, pullRequestNumber: 1036, executionFeedbackSeconds: 500 },
      { workflowRunId: 9, pullRequestNumber: 1034, executionFeedbackSeconds: 410 },
      { workflowRunId: 8, pullRequestNumber: 1034, executionFeedbackSeconds: 405 },
      { workflowRunId: 7, pullRequestNumber: null, executionFeedbackSeconds: 390 },
      { workflowRunId: 6, pullRequestNumber: 1033, executionFeedbackSeconds: 380 },
    ],
    1036,
    4
  );

  assert.deepEqual(
    samples.map((sample) => sample.workflowRunId),
    [9, 7, 6]
  );
});

test('job analysis separates hosted-runner queue from budgeted execution wall clock and rejects inventory drift', () => {
  const run = { created_at: '2026-09-12T19:34:57Z' };
  const jobs = [
    {
      name: 'A',
      conclusion: 'success',
      started_at: '2026-09-12T19:35:10Z',
      completed_at: '2026-09-12T19:36:10Z',
    },
    {
      name: 'B',
      conclusion: 'success',
      started_at: '2026-09-12T19:35:40Z',
      completed_at: '2026-09-12T19:41:36Z',
    },
    {
      name: 'Unregistered',
      conclusion: 'success',
      started_at: '2026-09-12T19:35:20Z',
      completed_at: '2026-09-12T19:35:25Z',
    },
  ];
  const analysis = analyzeJobs(run, jobs, {
    requiredJobs: ['A', 'B'],
    allowedNonCriticalJobs: [],
  });
  assert.equal(analysis.feedbackSeconds, 399);
  assert.equal(analysis.executionFeedbackSeconds, 386);
  assert.equal(analysis.queueDelaySeconds, 13);
  assert.equal(analysis.longestRequiredJob.name, 'B');
  assert.deepEqual(analysis.unknownJobs, ['Unregistered']);
});

test('hosted-runner queue alone cannot create a blocking execution regression', () => {
  const run = { created_at: '2026-09-13T10:00:00Z' };
  const jobs = [
    {
      name: 'A',
      conclusion: 'success',
      started_at: '2026-09-13T10:03:00Z',
      completed_at: '2026-09-13T10:08:00Z',
    },
    {
      name: 'B',
      conclusion: 'success',
      started_at: '2026-09-13T10:03:30Z',
      completed_at: '2026-09-13T10:09:00Z',
    },
  ];
  const analysis = analyzeJobs(run, jobs, {
    requiredJobs: ['A', 'B'],
    allowedNonCriticalJobs: [],
  });

  assert.equal(analysis.feedbackSeconds, 540);
  assert.equal(analysis.executionFeedbackSeconds, 360);
  assert.equal(analysis.queueDelaySeconds, 180);

  const result = evaluateBudget({
    currentSeconds: analysis.executionFeedbackSeconds,
    targetSeconds: 360,
    toleranceSeconds: 75,
    historicalSeconds: [470, 465, 460, 455],
    historyWindow: 5,
    requiredExceedancesForFailure: 3,
  });
  assert.equal(result.status, 'pass');
  assert.equal(result.blocking, false);
});
