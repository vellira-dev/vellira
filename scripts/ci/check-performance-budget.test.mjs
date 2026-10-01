import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
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
  resolveWorkspaceImpact,
} from './affected-execution.mjs';
import {
  buildTurboArgs,
  parseAffectedWorkspaces,
} from './run-affected-workspaces.mjs';
import {
  RELEASE_SYNC_MANIFESTS,
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
  assert.equal(classifyFiles(RELEASE_SYNC_MANIFESTS, classification), 'release-sync');

  assert.equal(
    isReleaseSyncFileSet([...RELEASE_SYNC_MANIFESTS, 'packages/react/src/Button.tsx']),
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
    /canonical commit subject/
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
    RELEASE_SYNC_MANIFESTS,
    [],
  ];

  for (const files of cases) {
    assert.equal(classifyAffectedFiles(files, classification), classifyFiles(files, classification));
  }
});

test('affected execution narrows docs immediately but package-local only after graph resolution', () => {
  assert.deepEqual(
    planAffectedExecution(['docs/ci.md'], classification),
    {
      shape: 'docs-only',
      executionPath: 'affected',
      packageName: null,
      graphStatus: 'not-applicable',
      graphReason: '',
      affectedWorkspaces: [],
      affectedWorkspacePaths: [],
      changedFiles: ['docs/ci.md'],
    }
  );

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
    planAffectedExecution(['packages/tokens/src/light.ts'], classification).executionPath,
    'full'
  );
  assert.equal(
    planAffectedExecution(['.github/workflows/ci.yml'], classification).executionPath,
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
        [{ name: '@vellira-ui/icons', path: 'packages/icons', dependencies: [] }],
        'react'
      ),
    /Workspace graph does not contain packages\/react/
  );
});

test('affected workspace runner builds shell-free Turbo arguments', () => {
  const workspaces = parseAffectedWorkspaces(
    JSON.stringify(['@vellira-ui/react', '@vellira-ui/website', '@vellira-ui/react'])
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
  assert.throws(() => parseAffectedWorkspaces('not-json'), /must be valid JSON/);
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
  assert.match(
    unitCoverage,
    /needs\.impact\.outputs\.shape != 'release-sync'/
  );

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
    assert.match(
      block,
      /if: needs\.impact\.outputs\.shape != 'release-sync'/
    );
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
