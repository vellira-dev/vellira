import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';

import {
  authorizedAffectedSkips,
  isReleaseDocumentationPath,
  latestCheckState,
} from './release-affected-skips.mjs';
import {
  classifyFiles,
  loadClassificationConfig,
  loadWorkspaceGraph,
  planAffectedExecution,
  resolveWorkspaceImpact,
} from './affected-execution.mjs';

const FILES = [
  'packages/react-native/package.json',
  'packages/react-native/test/probes/native-subpath-context-identity.test.mjs',
];

function check(name, conclusion, id = 1) {
  return {
    name,
    status: 'completed',
    conclusion,
    id,
    completed_at: '2026-10-28T18:00:00Z',
  };
}

const CHECKS = [
  check('PR Impact', 'success'),
  check('Tooling & IndexNow Tests', 'skipped'),
  check('Storybook & Browser Tests', 'skipped'),
  check('Typecheck & API Contracts', 'success'),
  check('Unit & Coverage Tests', 'success'),
];

function plan(overrides = {}) {
  return {
    shape: 'package-local',
    executionPath: 'affected',
    graphStatus: 'resolved',
    packageName: 'react-native',
    changedFiles: FILES,
    affectedWorkspaces: ['@vellira-ui/react-native'],
    affectedWorkspacePaths: ['packages/react-native'],
    ...overrides,
  };
}

test('accepts only CI-intentional package-local skips with passing PR Impact', () => {
  assert.deepEqual(
    authorizedAffectedSkips({ files: FILES, plan: plan(), checkRuns: CHECKS }),
    ['Tooling & IndexNow Tests', 'Storybook & Browser Tests']
  );
});

test('does not authorize a skipped Storybook job when Storybook is affected', () => {
  assert.deepEqual(
    authorizedAffectedSkips({
      files: FILES,
      plan: plan({
        affectedWorkspaces: [
          '@vellira-ui/react-native',
          '@vellira-ui/react-storybook',
        ],
      }),
      checkRuns: CHECKS,
    }),
    ['Tooling & IndexNow Tests']
  );
});

test('fails closed for other package shapes, graph fallbacks, and altered files', () => {
  for (const invalid of [
    plan({ shape: 'shared' }),
    plan({ executionPath: 'full' }),
    plan({ graphStatus: 'fallback' }),
    plan({ changedFiles: ['packages/react-native/unrelated.ts'] }),
    plan({ affectedWorkspacePaths: [] }),
  ]) {
    assert.deepEqual(
      authorizedAffectedSkips({ files: FILES, plan: invalid, checkRuns: CHECKS }),
      []
    );
  }
  assert.deepEqual(
    authorizedAffectedSkips({
      files: [...FILES, 'scripts/ci/affected-execution.mjs'],
      plan: plan(),
      checkRuns: CHECKS,
    }),
    []
  );
});

test('requires actual PR Impact success and exact skipped check results', () => {
  for (const impactConclusion of ['skipped', 'failure', null]) {
    const checks = CHECKS.filter((item) => item.name !== 'PR Impact');
    if (impactConclusion !== null) {
      checks.push(check('PR Impact', impactConclusion));
    }
    assert.deepEqual(
      authorizedAffectedSkips({ files: FILES, plan: plan(), checkRuns: checks }),
      []
    );
  }
  assert.deepEqual(
    authorizedAffectedSkips({
      files: FILES,
      plan: plan(),
      checkRuns: CHECKS.map((item) =>
        item.name === 'Tooling & IndexNow Tests'
          ? { ...item, conclusion: 'failure' }
          : item
      ),
    }),
    ['Storybook & Browser Tests']
  );
});

test('latest check-run state is authoritative, not an earlier green run', () => {
  const checks = [
    check('PR Impact', 'success', 1),
    check('PR Impact', 'failure', 2),
  ];
  assert.equal(latestCheckState(checks, 'PR Impact'), 'completed:failure');
  assert.deepEqual(
    authorizedAffectedSkips({ files: FILES, plan: plan(), checkRuns: [...CHECKS, ...checks] }),
    []
  );
});

test('the actual workspace graph authorizes a react-native package-only PR', async () => {
  const classification = await loadClassificationConfig();
  const workspaces = await loadWorkspaceGraph();
  const impact = resolveWorkspaceImpact(workspaces, 'react-native');
  const actualPlan = planAffectedExecution(FILES, classification, {
    resolved: true,
    ...impact,
  });
  assert.equal(classifyFiles(FILES, classification), 'package-local');
  assert.equal(actualPlan.executionPath, 'affected');
  assert.equal(actualPlan.graphStatus, 'resolved');
  assert.deepEqual(
    authorizedAffectedSkips({
      files: FILES,
      plan: actualPlan,
      checkRuns: CHECKS,
    }),
    ['Tooling & IndexNow Tests', 'Storybook & Browser Tests']
  );
});

test('release gate still rejects unapproved skipped required checks', () => {
  const workflow = fs.readFileSync(
    new URL('../../.github/workflows/release.yml', import.meta.url),
    'utf8'
  );
  assert.match(workflow, /node scripts\/ci\/release-affected-skips\.mjs/);
  assert.match(workflow, /check_state" != "completed:success"/);
  assert.match(workflow, /\.allowedSkips \| index\(\$name\) != null/);
  assert.match(workflow, /refusing to duplicate or bypass PR validation/);
});

const GOVERNANCE_DOC_FILES = [
  '.github/PULL_REQUEST_TEMPLATE.md',
  'AGENTS.md',
];
const DOCUMENTATION_SKIPPED_CHECKS = [
  'Typecheck & API Contracts',
  'Tooling & IndexNow Tests',
  'Storybook & Browser Tests',
  'Unit & Coverage Tests',
];
const DOCUMENTATION_CHECKS = [
  check('PR Impact', 'success'),
  check('Build, Test & Validate', 'success'),
  check('Quality & Component Quality', 'success'),
  check('CodeQL', 'success'),
  check('chromatic', 'success'),
  ...DOCUMENTATION_SKIPPED_CHECKS.map((name) => check(name, 'skipped')),
];
function documentationPlan(files = GOVERNANCE_DOC_FILES, overrides = {}) {
  return {
    shape: 'docs-only',
    executionPath: 'affected',
    graphStatus: 'not-applicable',
    packageName: null,
    changedFiles: files,
    affectedWorkspaces: [],
    affectedWorkspacePaths: [],
    ...overrides,
  };
}
function docsAuthorized(files = GOVERNANCE_DOC_FILES, overrides = {}, checks = DOCUMENTATION_CHECKS) {
  return authorizedAffectedSkips({
    files,
    plan: documentationPlan(files, overrides),
    checkRuns: checks,
  });
}

test('accepts governance docs-only skips after verified CI impact', () => {
  assert.deepEqual(docsAuthorized(), DOCUMENTATION_SKIPPED_CHECKS);
  for (const file of [
    'apps/docs/src/getting-started.md',
    'docs/architecture/component-contract.mdx',
    'README.md',
  ]) {
    assert.equal(isReleaseDocumentationPath(file), true);
    assert.deepEqual(docsAuthorized([file]), DOCUMENTATION_SKIPPED_CHECKS);
  }
});

test('rejects release-sensitive, non-doc and unsafe path variants', () => {
  for (const file of [
    '.github/workflows/release.yml',
    '.github/workflows/release.md',
    'scripts/ci/release-affected-skips.mjs',
    'packages/react/README.md',
    'packages/core/src/index.ts',
    'apps/website/content/blog/entry.mdx',
    'docs/../packages/core/README.md',
    'docs//README.md',
    '/docs/README.md',
    'docs\\README.md',
    '../README.md',
    'docs/README.md\npackages/core/src/index.ts',
    'docs/README.json',
  ]) {
    assert.equal(isReleaseDocumentationPath(file), false, file);
    assert.deepEqual(docsAuthorized([file]), [], file);
    assert.deepEqual(docsAuthorized([...GOVERNANCE_DOC_FILES, file]), [], file);
  }
});

test('docs-only admission requires exact affected CI plan and nonempty unique paths', () => {
  for (const changed of [
    { shape: 'normal' },
    { shape: 'shared' },
    { executionPath: 'full' },
    { graphStatus: 'fallback' },
    { packageName: 'react' },
    { affectedWorkspaces: ['@vellira-ui/react'] },
    { affectedWorkspacePaths: ['packages/react'] },
    { changedFiles: ['AGENTS.md'] },
    { changedFiles: [...GOVERNANCE_DOC_FILES].reverse() },
    { changedFiles: null },
  ]) {
    assert.deepEqual(docsAuthorized(GOVERNANCE_DOC_FILES, changed), []);
  }
  assert.deepEqual(docsAuthorized([]), []);
  assert.deepEqual(docsAuthorized(['AGENTS.md', 'AGENTS.md']), []);
});

test('docs-only admission requires newest successful PR Impact', () => {
  const without = DOCUMENTATION_CHECKS.filter((item) => item.name !== 'PR Impact');
  assert.deepEqual(docsAuthorized(GOVERNANCE_DOC_FILES, {}, without), []);
  for (const result of ['failure', 'skipped', 'cancelled']) {
    assert.deepEqual(
      docsAuthorized(GOVERNANCE_DOC_FILES, {}, [...without, check('PR Impact', result)]),
      []
    );
  }
  assert.deepEqual(
    docsAuthorized(GOVERNANCE_DOC_FILES, {}, [
      ...DOCUMENTATION_CHECKS,
      { ...check('PR Impact', 'failure', 2), completed_at: '2026-11-01T19:00:00Z' },
    ]),
    []
  );
});

test('docs-only admission authorizes no failed, missing, or extra skipped check', () => {
  for (const name of DOCUMENTATION_SKIPPED_CHECKS) {
    for (const conclusion of [null, 'failure', 'success']) {
      const others = DOCUMENTATION_CHECKS.filter((item) => item.name !== name);
      const checks = conclusion === null ? others : [...others, check(name, conclusion)];
      assert.deepEqual(
        docsAuthorized(GOVERNANCE_DOC_FILES, {}, checks),
        DOCUMENTATION_SKIPPED_CHECKS.filter((item) => item !== name)
      );
    }
  }
  assert.equal(DOCUMENTATION_SKIPPED_CHECKS.includes('CodeQL'), false);
});

test('release workflow uses only independently computed skip authority', () => {
  const workflow = fs.readFileSync(
    new URL('../../.github/workflows/release.yml', import.meta.url),
    'utf8'
  );
  assert.match(workflow, /node scripts\/ci\/release-affected-skips\.mjs/);
  assert.match(workflow, /\.allowedSkips \| index\(\$name\) != null/);
  assert.doesNotMatch(workflow, /docs_skippable_checks|\$docs_only/);
});
