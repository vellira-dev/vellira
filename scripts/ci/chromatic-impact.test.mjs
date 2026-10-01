import assert from 'node:assert/strict';
import test from 'node:test';

import {
  classifyChromaticImpact,
  isVersionOnlyManifestChange,
} from './chromatic-impact.mjs';

function manifest(version, extra = {}) {
  return JSON.stringify({
    name: '@vellira-ui/example',
    version,
    private: false,
    scripts: { test: 'vitest run' },
    ...extra,
  });
}

test('version-only package manifest changes are visual no-ops', () => {
  const paths = [
    'package.json',
    'packages/core/package.json',
    'packages/icons/package.json',
    'packages/react-native/package.json',
    'packages/react/package.json',
    'packages/tokens/package.json',
    'packages/types/package.json',
  ];
  const changes = paths.map((path) => ({
    path,
    before: manifest('2.125.2'),
    after: manifest('2.125.3'),
  }));

  assert.ok(changes.every(isVersionOnlyManifestChange));
  assert.deepEqual(classifyChromaticImpact(changes), {
    schemaVersion: 1,
    shouldRun: false,
    reason: 'version-only-manifest-sync',
    changedFiles: [...paths].sort(),
  });
});

test('manifest dependency or script changes keep Chromatic enabled', () => {
  for (const after of [
    manifest('2.125.3', { dependencies: { react: '19.3.0' } }),
    JSON.stringify({
      name: '@vellira-ui/example',
      version: '2.125.3',
      private: false,
      scripts: { test: 'vitest run', build: 'vite build' },
    }),
  ]) {
    const plan = classifyChromaticImpact([
      {
        path: 'packages/react/package.json',
        before: manifest('2.125.2'),
        after,
      },
    ]);
    assert.equal(plan.shouldRun, true);
    assert.equal(plan.reason, 'visual-impact-not-proven-absent');
  }
});

test('non-release manifests and inconsistent version transitions fail closed', () => {
  const appPlan = classifyChromaticImpact([
    {
      path: 'apps/website/package.json',
      before: manifest('1.0.0'),
      after: manifest('1.0.1'),
    },
  ]);
  assert.equal(appPlan.shouldRun, true);

  const inconsistentPlan = classifyChromaticImpact([
    {
      path: 'packages/react/package.json',
      before: manifest('2.125.2'),
      after: manifest('2.125.3'),
    },
    {
      path: 'packages/core/package.json',
      before: manifest('2.125.2'),
      after: manifest('2.126.0'),
    },
  ]);
  assert.equal(inconsistentPlan.shouldRun, true);
  assert.equal(inconsistentPlan.reason, 'visual-impact-not-proven-absent');
});

test('any non-manifest change keeps Chromatic enabled', () => {
  const plan = classifyChromaticImpact([
    {
      path: 'packages/react/package.json',
      before: manifest('2.125.2'),
      after: manifest('2.125.3'),
    },
    {
      path: 'packages/react/src/Button.tsx',
      before: 'export const Button = 1;',
      after: 'export const Button = 2;',
    },
  ]);

  assert.equal(plan.shouldRun, true);
  assert.equal(plan.reason, 'visual-impact-not-proven-absent');
});

test('added, removed, malformed, or unchanged manifests fail closed', () => {
  for (const change of [
    {
      path: 'packages/react/package.json',
      before: null,
      after: manifest('2.125.3'),
    },
    {
      path: 'packages/react/package.json',
      before: manifest('2.125.2'),
      after: null,
    },
    {
      path: 'packages/react/package.json',
      before: '{',
      after: manifest('2.125.3'),
    },
    {
      path: 'packages/react/package.json',
      before: manifest('2.125.3'),
      after: manifest('2.125.3'),
    },
  ]) {
    assert.equal(isVersionOnlyManifestChange(change), false);
    assert.equal(classifyChromaticImpact([change]).shouldRun, true);
  }
});

test('empty change sets fail closed', () => {
  assert.deepEqual(classifyChromaticImpact([]), {
    schemaVersion: 1,
    shouldRun: true,
    reason: 'empty-change-set',
    changedFiles: [],
  });
});
