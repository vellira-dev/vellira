import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';

import {
  authorizedAffectedSkips,
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
