import assert from 'node:assert/strict';
import test from 'node:test';

import {
  analyzeJobs,
  classifyFiles,
  evaluateBudget,
  selectBudget,
} from './check-performance-budget.mjs';

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

test('narrow shape using full CI selects the conservative normal budget', () => {
  const selected = selectBudget('docs-only', 'full', budgets);
  assert.equal(selected.fallbackToFull, true);
  assert.equal(selected.effective.targetSeconds, 360);
});

test('unexpected narrowing of a full-path shape is detected', () => {
  const selected = selectBudget('shared', 'affected', budgets);
  assert.equal(selected.unexpectedNarrowing, true);
});

test('one slow runner above the tolerance ceiling does not block', () => {
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

test('sustained regressions above the tolerance ceiling block', () => {
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

test('runner variance inside the documented tolerance is non-blocking', () => {
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

test('job analysis measures feedback wall clock and rejects inventory drift', () => {
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
  assert.equal(analysis.longestRequiredJob.name, 'B');
  assert.deepEqual(analysis.unknownJobs, ['Unregistered']);
});
