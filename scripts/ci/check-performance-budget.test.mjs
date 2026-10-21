import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  analyzeJobs,
  checkAttemptContract,
  classifyFiles,
  evaluateBudget,
  fetchAttemptJobs,
  historicalSamples,
  historicalShape,
  parseChangedFiles,
  parseDependencyResults,
  readCurrentAttempt,
  selectBudget,
  selectDistinctHistoricalSamples,
  validateRunIdentity,
} from './check-performance-budget.mjs';
import {
  classifyFiles as classifyAffectedFiles,
  packageNameForFiles,
  planAffectedExecution,
  resolveWorkspaceImpact,
} from './affected-execution.mjs';
import {
  buildTurboArgs,
  parseAffectedWorkspaces,
} from './run-affected-workspaces.mjs';
import {
  RELEASE_SYNC_MANIFESTS,
  classifyMergedReleaseSyncShape,
  isReleaseSyncFileSet,
  verifyMergedReleaseSyncDocuments,
  verifyReleaseSyncDocuments,
} from './release-sync-contract.mjs';

const ciWorkflow = await fs.readFile('.github/workflows/ci.yml', 'utf8');
const lighthouseWorkflow = await fs.readFile(
  '.github/workflows/lighthouse.yml',
  'utf8'
);

function jobBlock(jobId, nextJobId) {
  const start = ciWorkflow.indexOf(`\n  ${jobId}:\n`);
  assert.notEqual(start, -1, `Missing CI job: ${jobId}`);
  const end = nextJobId
    ? ciWorkflow.indexOf(`\n  ${nextJobId}:\n`, start + 1)
    : ciWorkflow.length;
  assert.notEqual(end, -1, `Missing following CI job: ${nextJobId}`);
  return ciWorkflow.slice(start, end);
}

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
  'release-sync': {
    targetSeconds: 120,
    toleranceSeconds: 45,
    expectedExecutionPath: 'affected',
  },
  shared: {
    targetSeconds: 360,
    toleranceSeconds: 75,
    expectedExecutionPath: 'full',
  },
};

test('classifies the exact release-managed manifest set as release-sync', () => {
  assert.equal(isReleaseSyncFileSet(RELEASE_SYNC_MANIFESTS), true);
  assert.equal(
    classifyAffectedFiles(RELEASE_SYNC_MANIFESTS, classification),
    'release-sync'
  );
  assert.equal(
    classifyFiles(RELEASE_SYNC_MANIFESTS, classification),
    'release-sync'
  );

  assert.equal(
    isReleaseSyncFileSet([
      ...RELEASE_SYNC_MANIFESTS,
      'packages/react/src/Button.tsx',
    ]),
    false
  );
});

test('release-sync semantic contract permits version-only bot changes', () => {
  const baseDocuments = Object.fromEntries(
    RELEASE_SYNC_MANIFESTS.map((manifestPath) => [
      manifestPath,
      { name: manifestPath, version: '2.126.3', private: false },
    ])
  );
  const headDocuments = Object.fromEntries(
    RELEASE_SYNC_MANIFESTS.map((manifestPath) => [
      manifestPath,
      { name: manifestPath, version: '2.126.4', private: false },
    ])
  );

  assert.deepEqual(
    verifyReleaseSyncDocuments({
      files: RELEASE_SYNC_MANIFESTS,
      baseDocuments,
      headDocuments,
      title: 'chore(release): sync package versions',
      headRef: 'chore/sync-release-2.126.4',
      author: 'vellira-release-sync[bot]',
    }),
    {
      baseVersion: '2.126.3',
      headVersion: '2.126.4',
      files: [...RELEASE_SYNC_MANIFESTS].sort((left, right) =>
        left.localeCompare(right)
      ),
    }
  );

  headDocuments['packages/react/package.json'] = {
    ...headDocuments['packages/react/package.json'],
    scripts: { postinstall: 'unexpected' },
  };

  assert.throws(
    () =>
      verifyReleaseSyncDocuments({
        files: RELEASE_SYNC_MANIFESTS,
        baseDocuments,
        headDocuments,
        title: 'chore(release): sync package versions',
        headRef: 'chore/sync-release-2.126.4',
        author: 'vellira-release-sync[bot]',
      }),
    /only permits the version field/
  );
});

test('merged release-sync classifier falls back to full deployment for security merge commits', () => {
  const baseSha = '1'.repeat(40);
  const releaseParent = '2'.repeat(40);

  assert.deepEqual(
    classifyMergedReleaseSyncShape({
      baseSha,
      parents: [baseSha, releaseParent],
      files: ['pnpm-lock.yaml', 'pnpm-workspace.yaml'],
    }),
    {
      releaseSync: false,
      reason: 'non-linear-or-base-mismatch',
      files: ['pnpm-lock.yaml', 'pnpm-workspace.yaml'],
    }
  );
});

test('merged release-sync classifier admits only the exact linear manifest set', () => {
  const baseSha = '1'.repeat(40);

  assert.deepEqual(
    classifyMergedReleaseSyncShape({
      baseSha,
      parents: [baseSha],
      files: RELEASE_SYNC_MANIFESTS,
    }),
    {
      releaseSync: true,
      reason: 'candidate',
      files: [...RELEASE_SYNC_MANIFESTS].sort((left, right) =>
        left.localeCompare(right)
      ),
    }
  );

  assert.deepEqual(
    classifyMergedReleaseSyncShape({
      baseSha,
      parents: [baseSha],
      files: ['pnpm-lock.yaml'],
    }),
    {
      releaseSync: false,
      reason: 'file-set-mismatch',
      files: ['pnpm-lock.yaml'],
    }
  );
});

test('merged release-sync verification fails closed unless the exact bot version-only contract holds', () => {
  const baseDocuments = Object.fromEntries(
    RELEASE_SYNC_MANIFESTS.map((manifestPath) => [
      manifestPath,
      { name: manifestPath, version: '2.126.6', private: false },
    ])
  );
  const headDocuments = Object.fromEntries(
    RELEASE_SYNC_MANIFESTS.map((manifestPath) => [
      manifestPath,
      { name: manifestPath, version: '2.126.7', private: false },
    ])
  );

  assert.deepEqual(
    verifyMergedReleaseSyncDocuments({
      files: RELEASE_SYNC_MANIFESTS,
      baseDocuments,
      headDocuments,
      actor: 'vellira-release-sync[bot]',
      commitSubject: 'chore(release): sync package versions (#1437)',
    }),
    {
      baseVersion: '2.126.6',
      headVersion: '2.126.7',
      files: [...RELEASE_SYNC_MANIFESTS].sort((left, right) =>
        left.localeCompare(right)
      ),
    }
  );

  assert.throws(
    () =>
      verifyMergedReleaseSyncDocuments({
        files: RELEASE_SYNC_MANIFESTS,
        baseDocuments,
        headDocuments,
        actor: 'romanbakurov',
        commitSubject: 'chore(release): sync package versions (#1437)',
      }),
    /GitHub App actor/
  );

  assert.throws(
    () =>
      verifyMergedReleaseSyncDocuments({
        files: RELEASE_SYNC_MANIFESTS,
        baseDocuments,
        headDocuments,
        actor: 'vellira-release-sync[bot]',
        commitSubject: 'chore(release): sync package versions',
      }),
    /canonical squash-merge commit subject/
  );

  assert.throws(
    () =>
      verifyMergedReleaseSyncDocuments({
        files: [...RELEASE_SYNC_MANIFESTS, 'apps/website/src/app/page.tsx'],
        baseDocuments,
        headDocuments,
        actor: 'vellira-release-sync[bot]',
        commitSubject: 'chore(release): sync package versions (#1437)',
      }),
    /exactly the seven release-managed package manifests/
  );

  const mutatedHead = structuredClone(headDocuments);
  mutatedHead['packages/react/package.json'].scripts = {
    postinstall: 'unexpected',
  };
  assert.throws(
    () =>
      verifyMergedReleaseSyncDocuments({
        files: RELEASE_SYNC_MANIFESTS,
        baseDocuments,
        headDocuments: mutatedHead,
        actor: 'vellira-release-sync[bot]',
        commitSubject: 'chore(release): sync package versions (#1437)',
      }),
    /only permits the version field/
  );
});

test('classifies documentation-only changes conservatively', () => {
  assert.equal(
    classifyFiles(
      ['README.md', 'docs/ci.md', 'packages/react/README.md'],
      classification
    ),
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
    RELEASE_SYNC_MANIFESTS,
    [],
  ];

  for (const files of cases) {
    assert.equal(
      classifyAffectedFiles(files, classification),
      classifyFiles(files, classification)
    );
  }
});

test('affected execution narrows docs immediately but package-local only after graph resolution', () => {
  assert.deepEqual(planAffectedExecution(['docs/ci.md'], classification), {
    shape: 'docs-only',
    executionPath: 'affected',
    packageName: null,
    graphStatus: 'not-applicable',
    graphReason: '',
    affectedWorkspaces: [],
    affectedWorkspacePaths: [],
    changedFiles: ['docs/ci.md'],
  });

  assert.deepEqual(
    planAffectedExecution(['packages/react/src/Button.tsx'], classification),
    {
      shape: 'package-local',
      executionPath: 'full',
      packageName: 'react',
      graphStatus: 'fallback',
      graphReason: 'workspace graph was not resolved',
      affectedWorkspaces: [],
      affectedWorkspacePaths: [],
      changedFiles: ['packages/react/src/Button.tsx'],
    }
  );

  assert.deepEqual(
    planAffectedExecution(['packages/react/src/Button.tsx'], classification, {
      resolved: true,
      workspaceNames: ['@vellira-ui/react', '@vellira-ui/website'],
      workspacePaths: ['packages/react', 'apps/website'],
    }),
    {
      shape: 'package-local',
      executionPath: 'affected',
      packageName: 'react',
      graphStatus: 'resolved',
      graphReason: '',
      affectedWorkspaces: ['@vellira-ui/react', '@vellira-ui/website'],
      affectedWorkspacePaths: ['packages/react', 'apps/website'],
      changedFiles: ['packages/react/src/Button.tsx'],
    }
  );

  assert.equal(
    planAffectedExecution(['packages/tokens/src/light.ts'], classification)
      .executionPath,
    'full'
  );
  assert.equal(
    planAffectedExecution(['.github/workflows/ci.yml'], classification)
      .executionPath,
    'full'
  );
});

test('release-sync uses the affected execution path without workspace fan-out', () => {
  assert.deepEqual(
    planAffectedExecution(RELEASE_SYNC_MANIFESTS, classification),
    {
      shape: 'release-sync',
      executionPath: 'affected',
      packageName: null,
      graphStatus: 'not-applicable',
      graphReason: '',
      affectedWorkspaces: [],
      affectedWorkspacePaths: [],
      changedFiles: [...RELEASE_SYNC_MANIFESTS],
    }
  );
});

test('workspace impact follows transitive internal dependents and excludes unrelated workspaces', () => {
  const workspaces = [
    { name: '@vellira-ui/react', path: 'packages/react', dependencies: [] },
    {
      name: '@vellira-ui/react-storybook',
      path: 'apps/react-storybook',
      dependencies: ['@vellira-ui/react'],
    },
    {
      name: '@vellira-ui/website',
      path: 'apps/website',
      dependencies: ['@vellira-ui/react-storybook'],
    },
    {
      name: 'native-playground',
      path: 'apps/native-playground',
      dependencies: [],
    },
  ];

  assert.deepEqual(resolveWorkspaceImpact(workspaces, 'react'), {
    workspaceNames: [
      '@vellira-ui/react-storybook',
      '@vellira-ui/website',
      '@vellira-ui/react',
    ],
    workspacePaths: ['apps/react-storybook', 'apps/website', 'packages/react'],
  });
});

test('workspace impact fails closed when the changed package is absent from the graph', () => {
  assert.throws(
    () =>
      resolveWorkspaceImpact(
        [
          {
            name: '@vellira-ui/icons',
            path: 'packages/icons',
            dependencies: [],
          },
        ],
        'react'
      ),
    /Workspace graph does not contain packages\/react/
  );
});

test('affected workspace runner builds shell-free Turbo arguments', () => {
  const workspaces = parseAffectedWorkspaces(
    JSON.stringify([
      '@vellira-ui/react',
      '@vellira-ui/website',
      '@vellira-ui/react',
    ])
  );
  assert.deepEqual(workspaces, ['@vellira-ui/react', '@vellira-ui/website']);
  assert.deepEqual(buildTurboArgs(['build', 'typecheck'], workspaces), [
    'exec',
    'turbo',
    'run',
    'build',
    'typecheck',
    '--filter=@vellira-ui/react',
    '--filter=@vellira-ui/website',
  ]);
});

test('affected workspace runner rejects malformed inputs', () => {
  assert.throws(
    () => parseAffectedWorkspaces('not-json'),
    /must be valid JSON/
  );
  assert.throws(() => parseAffectedWorkspaces('[]'), /non-empty array/);
  assert.throws(
    () => buildTurboArgs(['build;rm'], ['@vellira-ui/react']),
    /invalid Turbo task/
  );
});

test('docs-only CI builds docs workspace dependencies before VitePress', () => {
  const buildValidate = jobBlock('ci');
  const prerequisites =
    "pnpm exec turbo run build --filter='@vellira-ui/docs^...'";
  const prerequisitesIndex = buildValidate.indexOf(prerequisites);
  const docsBuildIndex = buildValidate.indexOf('pnpm docs:build');

  assert.ok(prerequisitesIndex >= 0, 'Missing docs workspace dependency build');
  assert.ok(
    docsBuildIndex > prerequisitesIndex,
    'Docs build must run after workspace dependencies are built'
  );

  const marker = '      - name: Build docs workspace dependencies\n';
  const step = buildValidate.split(marker)[1];
  assert.ok(step, 'Missing docs workspace dependency step');
  assert.match(
    step.slice(0, 220),
    /if: needs\.impact\.outputs\.shape == 'docs-only'/
  );
});

test('docs-only affected path does not invoke an empty workspace build', () => {
  const buildValidate = jobBlock('ci');

  const marker = '      - name: Build affected workspaces\n';
  const step = buildValidate.split(marker)[1];
  assert.ok(step, 'Missing affected workspace build step');
  assert.match(
    step.slice(0, 260),
    /if: \$\{\{ needs\.impact\.outputs\.execution_path == 'affected' && needs\.impact\.outputs\.affected_workspaces != '\[\]' \}\}/
  );
});

test('release-sync keeps required CI contexts while replacing heavy work with semantic verification', () => {
  const quality = jobBlock('quality', 'cloudflare-runtime-contracts');
  const typecheck = jobBlock('typecheck', 'tooling');
  const tooling = jobBlock('tooling', 'unit-coverage');
  assert.match(
    tooling,
    /shape == 'release-sync' \|\| \(needs\.impact\.outputs\.shape != 'docs-only'/
  );
  const unitCoverage = jobBlock('unit-coverage', 'generator-blog');
  const buildValidate = jobBlock('ci');

  assert.match(quality, /if: needs\.impact\.outputs\.shape != 'release-sync'/);
  assert.match(unitCoverage, /needs\.impact\.outputs\.shape != 'release-sync'/);

  for (const block of [typecheck, tooling, buildValidate]) {
    assert.match(block, /Trust checked-out repository in container/);
    assert.match(
      block,
      /git config --global --add safe\.directory "\$GITHUB_WORKSPACE"/
    );
    assert.ok(
      block.indexOf('Trust checked-out repository in container') <
        block.indexOf('Verify canonical release-sync fast path')
    );
    assert.match(block, /Verify canonical release-sync fast path/);
    assert.match(block, /release-sync-contract\.mjs/);
    assert.match(block, /--verify/);
    assert.match(block, /if: needs\.impact\.outputs\.shape != 'release-sync'/);
  }

  assert.match(
    typecheck,
    /needs\.impact\.outputs\.shape != 'release-sync'.*execution_path == 'affected'/s
  );
});

test('release-sync skips expensive Lighthouse jobs after exact file-set detection', () => {
  assert.match(lighthouseWorkflow, /Lighthouse release-sync impact/);
  assert.match(lighthouseWorkflow, /release-sync-contract\.mjs/);
  assert.match(lighthouseWorkflow, /--detect/);
  assert.match(
    lighthouseWorkflow,
    /docs:\s+name: Lighthouse \/ Docs\s+needs: release-sync-impact\s+if: needs\.release-sync-impact\.outputs\.release_sync != 'true'/s
  );
  assert.match(
    lighthouseWorkflow,
    /website:\s+name: Lighthouse \/ Website\s+needs: release-sync-impact\s+if: needs\.release-sync-impact\.outputs\.release_sync != 'true'/s
  );
});

test('affected Storybook tests provision matching Chromium before execution', () => {
  const unitCoverage = jobBlock('unit-coverage', 'generator-blog');
  const browserInstall =
    'pnpm --filter @vellira-ui/react-storybook exec playwright install --with-deps chromium';
  const browserInstallIndex = unitCoverage.indexOf(browserInstall);
  const affectedTestsIndex = unitCoverage.indexOf(
    'node scripts/ci/run-affected-workspaces.mjs test test:coverage'
  );

  assert.match(
    unitCoverage,
    /if: needs\.impact\.outputs\.execution_path == 'affected' && contains\(fromJSON\(needs\.impact\.outputs\.affected_workspaces\), '@vellira-ui\/react-storybook'\)/
  );
  assert.match(
    unitCoverage,
    new RegExp(browserInstall.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  );
  assert.doesNotMatch(
    unitCoverage,
    /playwright install --with-deps chromium firefox webkit/
  );
  assert.ok(browserInstallIndex >= 0);
  assert.ok(affectedTestsIndex > browserInstallIndex);
  assert.match(
    unitCoverage,
    /if: needs\.impact\.outputs\.execution_path == 'affected'\s+env:\s+VELLIRA_AFFECTED_WORKSPACES:/
  );
});

test('package-local identification rejects cross-package and non-package changes', () => {
  assert.equal(
    packageNameForFiles([
      'packages/react/src/Button.tsx',
      'packages/react/src/Input.tsx',
    ]),
    'react'
  );
  assert.equal(
    packageNameForFiles([
      'packages/react/src/Button.tsx',
      'packages/icons/src/index.ts',
    ]),
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

test('one slow critical path above the tolerance ceiling does not block', () => {
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

test('sustained critical-path regressions above the tolerance ceiling block', () => {
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

test('critical-path variance inside the documented tolerance is non-blocking', () => {
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
      { workflowRunId: 10, pullRequestNumber: 1036, criticalPathSeconds: 500 },
      { workflowRunId: 9, pullRequestNumber: 1034, criticalPathSeconds: 410 },
      { workflowRunId: 8, pullRequestNumber: 1034, criticalPathSeconds: 405 },
      { workflowRunId: 7, pullRequestNumber: null, criticalPathSeconds: 390 },
      { workflowRunId: 6, pullRequestNumber: 1033, criticalPathSeconds: 380 },
    ],
    1036,
    4
  );

  assert.deepEqual(
    samples.map((sample) => sample.workflowRunId),
    [9, 7, 6]
  );
});

test('job analysis separates runner scheduling from the parallel critical path and rejects inventory drift', () => {
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
  assert.equal(analysis.schedulerSkewSeconds, 30);
  assert.equal(analysis.criticalPathSeconds, 356);
  assert.equal(analysis.longestRequiredJob.name, 'B');
  assert.deepEqual(analysis.unknownJobs, ['Unregistered']);
});

test('hosted-runner queue and scheduler skew alone cannot create a blocking critical-path regression', () => {
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
      started_at: '2026-09-13T10:08:00Z',
      completed_at: '2026-09-13T10:13:30Z',
    },
  ];
  const analysis = analyzeJobs(run, jobs, {
    requiredJobs: ['A', 'B'],
    allowedNonCriticalJobs: [],
  });

  assert.equal(analysis.feedbackSeconds, 810);
  assert.equal(analysis.executionFeedbackSeconds, 630);
  assert.equal(analysis.queueDelaySeconds, 180);
  assert.equal(analysis.schedulerSkewSeconds, 300);
  assert.equal(analysis.criticalPathSeconds, 330);

  const result = evaluateBudget({
    currentSeconds: analysis.criticalPathSeconds,
    targetSeconds: 360,
    toleranceSeconds: 75,
    historicalSeconds: [470, 465, 460, 455],
    historyWindow: 5,
    requiredExceedancesForFailure: 3,
  });
  assert.equal(result.status, 'pass');
  assert.equal(result.blocking, false);
});

test('native performance check waits for every CI dependency without a polling workflow', async () => {
  const config = JSON.parse(
    await fs.readFile('.github/ci-performance-budget.json', 'utf8')
  );
  const entries = [...ciWorkflow.matchAll(/^  ([\w-]+):\n    name: (.+)$/gm)];
  const observer = jobBlock('performance-budget');
  const needs = observer
    .match(/    needs:\n([\s\S]*?)    if:/)[1]
    .trim()
    .split('\n')
    .map((line) => line.trim().slice(2));
  assert.deepEqual(
    needs.sort(),
    entries
      .map((entry) => entry[1])
      .filter((id) => id !== 'performance-budget')
      .sort()
  );
  assert.equal(config.workflow.observerJob, 'CI Performance Budget');
  assert.ok(
    config.workflow.allowedNonCriticalJobs.includes(config.workflow.observerJob)
  );
  assert.ok(
    !config.workflow.requiredJobs.includes(config.workflow.observerJob)
  );
  assert.deepEqual(
    entries.map((entry) => entry[2]).sort(),
    [
      ...config.workflow.requiredJobs,
      ...config.workflow.allowedNonCriticalJobs,
    ].sort()
  );
  assert.match(observer, /if: \$\{\{ always\(\) \}\}/);
  assert.match(
    observer,
    /permissions:\n      actions: read\n      contents: read/
  );
  assert.doesNotMatch(observer, /: write|workflow_run|pull_request_target/);
  assert.match(observer, /ref: \$\{\{ github\.sha \}\}/);
  assert.doesNotMatch(
    observer,
    /ref: \$\{\{ github\.event\.pull_request\.head\.sha \}\}/
  );
  assert.match(observer, /persist-credentials: false/);
  assert.match(
    observer,
    /CI_PERFORMANCE_DEPENDENCIES: \$\{\{ toJSON\(needs\) \}\}/
  );
  assert.match(
    observer,
    /CI_PERFORMANCE_CHANGED_FILES: \$\{\{ needs\.impact\.outputs\.changed_files \}\}/
  );
  assert.match(
    observer,
    /ci-performance-.*github\.run_id.*github\.run_attempt/
  );
  assert.match(
    jobBlock('impact', 'quality'),
    /CI performance shape: \$\{\{ steps\.classify\.outputs\.shape \}\}/
  );
  for (const action of observer.matchAll(/uses: (\S+)/g)) {
    assert.match(action[1], /@[a-f0-9]{40}$/);
  }
  assert.equal(config.enforcement.pollIntervalSeconds, undefined);
  assert.equal(config.enforcement.pollTimeoutSeconds, undefined);
  await assert.rejects(
    fs.access('.github/workflows/ci-performance-budget.yml'),
    { code: 'ENOENT' }
  );
});

test('workflow-owned changed-file export works with an older immutable candidate classifier', async (t) => {
  const impact = jobBlock('impact', 'quality');
  assert.match(
    impact,
    /changed_files: \$\{\{ steps\.changed-files\.outputs\.changed_files \}\}/
  );
  const exportStep = impact
    .match(
      /      - name: Record exact PR changed files[\s\S]*?        run: \|\n([\s\S]*?)\n      - name: Classify exact PR impact/
    )[1]
    .replace(/^ {10}/gm, '');
  assert.doesNotMatch(exportStep, /scripts\/ci\//);
  const classifyStep = impact
    .match(
      /      - name: Classify exact PR impact[\s\S]*?        run: \|\n([\s\S]*?)\n      # Immutable/
    )[1]
    .replace(/^ {10}/gm, '');
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), 'vellira-legacy-impact-')
  );
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  for (const filename of [
    'scripts/ci/affected-execution.mjs',
    'scripts/ci/release-sync-contract.mjs',
    '.github/ci-performance-budget.json',
  ]) {
    const destination = path.join(directory, filename);
    await fs.mkdir(path.dirname(destination), { recursive: true });
    // The fixture deliberately has no changed_files output, even if a later
    // classifier version adds one. This models an unchanged, older PR head.
    const contents = (await fs.readFile(filename, 'utf8')).replace(
      /^.*`changed_files=.*\n/gm,
      ''
    );
    await fs.writeFile(destination, contents);
  }
  const git = (...args) =>
    execFileSync('git', args, {
      cwd: directory,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  git('init', '--quiet');
  git('add', '.');
  const commit = () =>
    git(
      '-c',
      'user.name=CI fixture',
      '-c',
      'user.email=ci-fixture@example.invalid',
      'commit',
      '--quiet',
      '-m',
      'fixture'
    );
  commit();
  const baseSha = git('rev-parse', 'HEAD');
  await fs.mkdir(path.join(directory, 'docs'), { recursive: true });
  await fs.writeFile(
    path.join(directory, 'docs/guide.md'),
    '# Older candidate\n'
  );
  git('add', '.');
  commit();
  const headSha = git('rev-parse', 'HEAD');
  const exportOutput = path.join(directory, 'export-output');
  const classifierOutput = path.join(directory, 'classifier-output');
  const environment = {
    ...process.env,
    BASE_SHA: baseSha,
    HEAD_SHA: headSha,
    RUNNER_TEMP: directory,
  };
  for (const [script, output] of [
    [exportStep, exportOutput],
    [classifyStep, classifierOutput],
  ]) {
    execFileSync('bash', ['-e', '-o', 'pipefail', '-c', script], {
      cwd: directory,
      encoding: 'utf8',
      env: { ...environment, GITHUB_OUTPUT: output },
    });
  }
  const originalOutput = await fs.readFile(exportOutput, 'utf8');
  assert.deepEqual(
    parseChangedFiles(originalOutput.trim().slice('changed_files='.length)),
    ['docs/guide.md']
  );
  assert.match(
    await fs.readFile(classifierOutput, 'utf8'),
    /^shape=docs-only$/m
  );
  assert.doesNotMatch(
    await fs.readFile(classifierOutput, 'utf8'),
    /^changed_files=/m
  );
  // Later candidate-owned step output cannot replace the workflow-owned output.
  await fs.appendFile(classifierOutput, 'changed_files=["different-file"]\n');
  assert.equal(await fs.readFile(exportOutput, 'utf8'), originalOutput);
});

test('completed dependency results and exact impact files are required inputs', () => {
  assert.deepEqual(
    parseDependencyResults(
      JSON.stringify({
        impact: { result: 'success', outputs: { shape: 'normal' } },
        quality: { result: 'failure' },
        docs: { result: 'skipped' },
      })
    ),
    { impact: 'success', quality: 'failure', docs: 'skipped' }
  );
  for (const value of [
    '{}',
    'null',
    '[]',
    '{"impact":{"result":"in_progress"}}',
  ]) {
    assert.throws(() => parseDependencyResults(value));
  }
  assert.deepEqual(parseChangedFiles('["docs/a.md","packages/core/a.ts"]'), [
    'docs/a.md',
    'packages/core/a.ts',
  ]);
  for (const value of [undefined, '{}', '[1]', '[""]']) {
    assert.throws(() => parseChangedFiles(value));
  }
});

test('current timing is pinned to its own repository, original head, run and attempt', () => {
  const expected = {
    repository: 'vellira-dev/vellira',
    runId: 123,
    runAttempt: 2,
    headSha: 'original-head',
    workflowFile: 'ci.yml',
  };
  const run = {
    id: 123,
    run_attempt: 2,
    head_sha: 'original-head',
    repository: { full_name: 'vellira-dev/vellira' },
    event: 'pull_request',
    path: '.github/workflows/ci.yml',
    status: 'in_progress',
    conclusion: null,
  };
  assert.doesNotThrow(() => validateRunIdentity(run, expected));
  for (const change of [
    { id: 124 },
    { run_attempt: 3 },
    { head_sha: 'new-head' },
    { repository: { full_name: 'elsewhere/fork' } },
    { event: 'workflow_run' },
    { path: '.github/workflows/other.yml' },
  ]) {
    assert.throws(() => validateRunIdentity({ ...run, ...change }, expected));
  }
});

test('job pagination reads only the selected attempt and never borrows earlier attempts', async () => {
  const calls = [];
  const jobs = await fetchAttemptJobs({
    repository: 'vellira-dev/vellira',
    runId: 123,
    runAttempt: 2,
    headSha: 'original-head',
    token: 'test',
    request: async (endpoint) => {
      calls.push(endpoint);
      return {
        jobs: (calls.length === 1
          ? Array.from({ length: 100 }, (_, id) => ({ id }))
          : [{ id: 100 }]
        ).map((job) => ({
          ...job,
          run_id: 123,
          run_attempt: 2,
          head_sha: 'original-head',
        })),
      };
    },
  });
  assert.equal(jobs.length, 101);
  assert.deepEqual(calls, [
    '/repos/vellira-dev/vellira/actions/runs/123/attempts/2/jobs?per_page=100&page=1',
    '/repos/vellira-dev/vellira/actions/runs/123/attempts/2/jobs?per_page=100&page=2',
  ]);
});

const observerContract = {
  requiredJobs: ['A', 'B'],
  allowedNonCriticalJobs: ['PR Impact', 'CI Performance Budget'],
  observerJob: 'CI Performance Budget',
};
const observerRun = { created_at: '2026-10-20T10:00:00Z', run_attempt: 2 };
function completedJob(name, overrides = {}) {
  return {
    name,
    status: 'completed',
    conclusion: 'success',
    started_at: '2026-10-20T10:00:10Z',
    completed_at: '2026-10-20T10:01:10Z',
    ...overrides,
  };
}
function attemptContract(
  jobs,
  dependencyResults = { impact: 'success', a: 'success', b: 'success' }
) {
  const timing = analyzeJobs(observerRun, jobs, observerContract);
  return checkAttemptContract({
    timing,
    budget: selectBudget('normal', timing.executionPath, budgets),
    shape: 'normal',
    dependencyResults,
  });
}

const currentExpected = {
  repository: 'vellira-dev/vellira',
  runId: 123,
  runAttempt: 2,
  headSha: 'original-head',
  workflowFile: 'ci.yml',
};
function metadataFixture(snapshots, runOverride = {}) {
  const waits = [];
  let reads = 0;
  return {
    waits,
    request: async (endpoint) => {
      if (endpoint.includes('/jobs?')) {
        return {
          jobs: snapshots[Math.min(reads - 1, snapshots.length - 1)].map(
            (job) => ({
              run_id: 123,
              run_attempt: 2,
              head_sha: 'original-head',
              ...job,
            })
          ),
        };
      }
      reads += 1;
      return {
        ...observerRun,
        id: 123,
        head_sha: 'original-head',
        repository: { full_name: currentExpected.repository },
        event: 'pull_request',
        path: '.github/workflows/ci.yml',
        status: 'in_progress',
        conclusion: null,
        ...runOverride,
      };
    },
    wait: async (milliseconds) => {
      waits.push(milliseconds);
    },
    get reads() {
      return reads;
    },
  };
}

test('brief stale current-attempt metadata is reread without waiting for the observer itself', async () => {
  const fixture = metadataFixture([
    [
      completedJob('A', {
        status: 'queued',
        conclusion: null,
        completed_at: null,
      }),
    ],
    [
      completedJob('A', { completed_at: '2026-10-20T10:08:10Z' }),
      completedJob('B'),
      completedJob('CI Performance Budget', {
        status: 'in_progress',
        conclusion: null,
        completed_at: null,
      }),
    ],
  ]);
  const snapshot = await readCurrentAttempt({
    expected: currentExpected,
    workflowContract: observerContract,
    ...fixture,
  });
  assert.equal(snapshot.metadataReads, 2);
  assert.deepEqual(fixture.waits, [5000]);
  assert.equal(snapshot.ciRun.status, 'in_progress');
  assert.equal(attemptContract(snapshot.jobs), null);
  assert.equal(snapshot.timing.criticalPathSeconds, 480);
  assert.equal(
    evaluateBudget({
      currentSeconds: snapshot.timing.criticalPathSeconds,
      targetSeconds: 360,
      toleranceSeconds: 75,
      historicalSeconds: [470, 470],
      historyWindow: 5,
      requiredExceedancesForFailure: 3,
    }).status,
    'fail'
  );
});

test('persistent stale metadata stops after six reads and remains blocking', async () => {
  const fixture = metadataFixture([
    [completedJob('A'), completedJob('B', { conclusion: null })],
  ]);
  const snapshot = await readCurrentAttempt({
    expected: currentExpected,
    workflowContract: observerContract,
    ...fixture,
  });
  assert.equal(snapshot.metadataReads, 6);
  assert.deepEqual(fixture.waits, [5000, 5000, 5000, 5000, 5000]);
  assert.equal(attemptContract(snapshot.jobs).status, 'contract-error');
  assert.equal(attemptContract(snapshot.jobs).blocking, true);
});

test('identity mismatches and permanent contract errors never retry into a passing snapshot', async () => {
  const ready = [completedJob('A'), completedJob('B')];
  for (const override of [
    { id: 456 },
    { run_attempt: 3 },
    { head_sha: 'another-head' },
  ]) {
    const fixture = metadataFixture([ready], override);
    await assert.rejects(
      readCurrentAttempt({
        expected: currentExpected,
        workflowContract: observerContract,
        ...fixture,
      }),
      /run identity/
    );
    assert.equal(fixture.reads, 1);
    assert.deepEqual(fixture.waits, []);
  }
  for (const override of [
    { run_id: 456 },
    { run_attempt: 1 },
    { head_sha: 'another-head' },
  ]) {
    const fixture = metadataFixture([
      [completedJob('A', override), completedJob('B')],
      ready,
    ]);
    await assert.rejects(
      readCurrentAttempt({
        expected: currentExpected,
        workflowContract: observerContract,
        ...fixture,
      }),
      /does not belong/
    );
    assert.equal(fixture.reads, 1);
    assert.deepEqual(fixture.waits, []);
  }
  for (const invalid of [
    [completedJob('A'), completedJob('B', { conclusion: 'unknown' })],
    [...ready, completedJob('A')],
    [...ready, completedJob('Unregistered')],
    [
      completedJob('A', { conclusion: 'failure' }),
      completedJob('B', { status: 'in_progress', conclusion: null }),
    ],
    [completedJob('A', { conclusion: 'cancelled' })],
    [
      completedJob('A', { conclusion: 'timed_out' }),
      completedJob('B', { conclusion: null }),
    ],
    [
      completedJob('A', { completed_at: null }),
      completedJob('B', { status: 'queued', conclusion: null }),
    ],
    [completedJob('A', { started_at: 'invalid' })],
  ]) {
    const fixture = metadataFixture([invalid, ready]);
    const snapshot = await readCurrentAttempt({
      expected: currentExpected,
      workflowContract: observerContract,
      ...fixture,
    });
    assert.equal(snapshot.metadataReads, 1);
    assert.deepEqual(fixture.waits, []);
    assert.equal(attemptContract(snapshot.jobs).blocking, true);
  }
});

test('running observer is excluded while completed correctness failures remain visible', () => {
  const jobs = [
    completedJob('PR Impact'),
    completedJob('A'),
    completedJob('B'),
    completedJob('CI Performance Budget', {
      status: 'in_progress',
      conclusion: null,
      completed_at: null,
    }),
  ];
  const timing = analyzeJobs(observerRun, jobs, observerContract);
  assert.equal(timing.criticalPathSeconds, 60);
  assert.equal(timing.jobs.length, 2);
  assert.equal(timing.jobs[0].runAttempt, 2);
  assert.equal(attemptContract(jobs), null);
  const failed = jobs.map((job) =>
    job.name === 'A' ? { ...job, conclusion: 'failure' } : job
  );
  const failureResults = { impact: 'success', a: 'failure', b: 'success' };
  assert.equal(attemptContract(failed, failureResults).status, 'not-evaluated');
  assert.equal(attemptContract(failed, failureResults).blocking, false);
  assert.equal(attemptContract(failed).status, 'contract-error');
  assert.equal(attemptContract(failed).blocking, true);
  assert.equal(
    attemptContract(jobs, { impact: 'skipped', a: 'skipped', b: 'skipped' })
      .blocking,
    true
  );
  assert.equal(
    attemptContract(jobs, { impact: 'success', a: 'cancelled' }).status,
    'not-evaluated'
  );
});

test('completed jobs with missing or unrecognized conclusions cannot bypass the budget', () => {
  for (const conclusion of [null, undefined, '', 'neutral', 'unknown']) {
    const jobs = [
      completedJob('PR Impact'),
      completedJob('A'),
      completedJob('B', { conclusion, completed_at: '2026-10-20T10:08:10Z' }),
      completedJob('CI Performance Budget', {
        status: 'in_progress',
        conclusion: null,
        completed_at: null,
      }),
    ];
    const timing = analyzeJobs(observerRun, jobs, observerContract);
    assert.equal(timing.criticalPathSeconds, 480);
    assert.deepEqual(timing.invalidConclusionJobs, ['B']);
    const result = attemptContract(jobs);
    assert.equal(result.status, 'contract-error');
    assert.equal(result.blocking, true);
    // An unrelated confirmed failure cannot make unknown evidence acceptable.
    assert.equal(
      attemptContract(jobs, { impact: 'success', a: 'failure', b: 'success' })
        .blocking,
      true
    );
  }
});

test('missing partial-rerun jobs, unknown jobs and unfinished dependencies fail closed', () => {
  for (const jobs of [
    [completedJob('A')],
    [completedJob('A'), completedJob('B'), completedJob('Surprise')],
    [completedJob('A'), completedJob('B'), completedJob('A')],
    [
      completedJob('A'),
      completedJob('B', { status: 'in_progress', conclusion: null }),
    ],
    [completedJob('A'), completedJob('B', { completed_at: null })],
  ]) {
    const result = attemptContract(jobs);
    assert.equal(result.status, 'contract-error');
    assert.equal(result.blocking, true);
  }
});

test('historical shapes use immutable attempt step metadata with conservative legacy fallback', () => {
  const jobs = (shape) => [
    completedJob('PR Impact', {
      steps: [
        {
          name: `CI performance shape: ${shape}`,
          conclusion: 'success',
        },
      ],
    }),
  ];
  assert.equal(
    historicalShape(jobs('docs-only'), 'affected', budgets),
    'docs-only'
  );
  assert.equal(
    historicalShape(jobs('release-sync'), 'affected', budgets),
    'release-sync'
  );
  assert.equal(historicalShape(jobs('unrecognized'), 'full', budgets), null);
  assert.equal(historicalShape([], 'full', budgets), 'normal');
  assert.equal(historicalShape([], 'affected', budgets), null);
});

test('history retains slow correctness-success runs even when their observer failed', async () => {
  const runs = [9, 8, 7, 6, 5].map((id) => ({
    ...observerRun,
    id,
    run_attempt: 1,
    head_sha: `head-${id}`,
    conclusion: id >= 8 ? 'failure' : 'success',
    pull_requests: [{ number: id }],
  }));
  const goodJobs = [
    completedJob('PR Impact'),
    completedJob('A'),
    completedJob('B', {
      completed_at: '2026-10-20T10:08:00Z',
    }),
  ];
  const jobsByRun = {
    9: [
      ...goodJobs,
      completedJob('CI Performance Budget', { conclusion: 'failure' }),
    ],
    8: [
      completedJob('A', { conclusion: 'failure' }),
      completedJob('B'),
      completedJob('CI Performance Budget'),
    ],
    6: goodJobs,
    5: [completedJob('A'), completedJob('B', { conclusion: 'skipped' })],
  };
  const calls = [];
  const samples = await historicalSamples({
    repository: 'vellira-dev/vellira',
    currentRun: { id: 10 },
    currentPullRequestNumber: 7,
    currentExecutionPath: 'full',
    currentBudget: budgets.normal,
    workflowFile: 'ci.yml',
    workflowContract: observerContract,
    budgets,
    enforcement: { historyWindow: 5, requiredExceedancesForFailure: 3 },
    token: 'test',
    request: async (endpoint) => {
      calls.push(endpoint);
      if (endpoint.includes('/workflows/')) return { workflow_runs: runs };
      const id = Number(endpoint.match(/\/runs\/(\d+)\/attempts\/1\/jobs/)[1]);
      return {
        jobs: jobsByRun[id].map((job) => ({
          ...job,
          run_id: id,
          run_attempt: 1,
          head_sha: `head-${id}`,
        })),
      };
    },
  });
  assert.deepEqual(
    samples.map((sample) => sample.workflowRunId),
    [9, 6]
  );
  assert.deepEqual(
    samples.map((sample) => sample.runAttempt),
    [1, 1]
  );
  assert.equal(samples[0].criticalPathSeconds, 470);
  assert.ok(!calls.some((endpoint) => endpoint.includes('/runs/7/')));
  assert.ok(!calls.some((endpoint) => endpoint.includes('/pulls/')));
  const result = evaluateBudget({
    currentSeconds: 470,
    targetSeconds: 360,
    toleranceSeconds: 75,
    historicalSeconds: samples.map((sample) => sample.criticalPathSeconds),
    historyWindow: 5,
    requiredExceedancesForFailure: 3,
  });
  assert.equal(result.status, 'fail');
});
