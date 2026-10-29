import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';

const require = createRequire(import.meta.url);
const {
  evaluateViteRegression,
  formatViteRegression,
} = require('./vite-bundle-regression.cjs');
const baseline = require('./baselines/vite-main-2.188.3.json');

function same() {
  return {
    sha: 'a'.repeat(40),
    baseSha: baseline.main.sha,
    tooling: { ...baseline.tooling },
    bundleSize: {
      schemaVersion: 1,
      metric: baseline.metric,
      scenarios: structuredClone(baseline.scenarios),
    },
  };
}
function git() {
  return {
    mainTreeSha: baseline.main.treeSha,
    descendant: true,
    changedPaths: [],
    fixtureSame: true,
    measurementSame: true,
  };
}

test('identical current consumer and immutable main yield zero signed deltas', () => {
  const result = evaluateViteRegression(baseline, same(), git());
  assert.equal(result.status, 'COMPARABLE');
  assert.equal(result.comparisons.length, 12);
  assert.ok(result.comparisons.every((r) => r.deltaBytes === 0));
  assert.equal(result.observedIncreases, 0);
  assert.equal(result.threshold.state, 'NOT_CALIBRATED');
  assert.match(formatViteRegression(result), /COMPARABLE/);
});

test('main changes, non-descendants, and changed fixtures never emit deltas', () => {
  for (const changed of [
    { ...git(), descendant: false },
    { ...git(), changedPaths: ['packages/react/src/index.ts'] },
  ]) {
    const r = evaluateViteRegression(baseline, same(), changed);
    assert.equal(r.status, 'BASELINE_STALE');
    assert.deepEqual(r.comparisons, []);
  }
  for (const changed of [
    { ...git(), fixtureSame: false },
    { ...git(), measurementSame: false },
  ]) {
    const r = evaluateViteRegression(baseline, same(), changed);
    assert.equal(r.status, 'FIXTURE_MISMATCH');
    assert.deepEqual(r.comparisons, []);
  }
  assert.equal(
    evaluateViteRegression(baseline, same(), { error: 'Git unavailable' })
      .status,
    'BASELINE_INVALID'
  );
});

test('missing, tampered, or unresolved immutable provenance is not trusted', () => {
  const bad = structuredClone(baseline);
  bad.main.treeSha = 'b'.repeat(40);
  assert.equal(evaluateViteRegression(bad, same(), git()).status,
    'BASELINE_INVALID');
  assert.equal(evaluateViteRegression(baseline, same(), {
    ...git(), mainTreeSha: 'c'.repeat(40),
  }).status, 'BASELINE_INVALID');
  assert.equal(evaluateViteRegression(null, same(), git()).status,
    'BASELINE_MISSING');
  const notPR = same();
  delete notPR.baseSha;
  assert.equal(evaluateViteRegression(baseline, notPR, git()).status,
    'NOT_APPLICABLE');
});

test('toolchain/schema/metric drift blocks misleading percent comparisons', () => {
  for (const field of ['node', 'npm', 'vite', 'typescript']) {
    const cur = same();
    cur.tooling[field] = 'drift';
    assert.equal(evaluateViteRegression(baseline, cur, git()).status,
      'TOOLCHAIN_MISMATCH');
  }
  const cur = same();
  cur.bundleSize.metric = 'npm tarball bytes';
  assert.equal(evaluateViteRegression(baseline, cur, git()).status,
    'SCENARIO_MISMATCH');
  delete cur.bundleSize.scenarios.button;
  assert.equal(evaluateViteRegression(baseline, cur, git()).status,
    'SCENARIO_MISMATCH');
});

test('positive, negative, and zero-baseline changes have safe signed results', () => {
  const current = same();
  current.bundleSize.scenarios.button.jsGzipBytes += 1024;
  current.bundleSize.scenarios.buttonInput.jsBytes -= 1000;
  current.bundleSize.scenarios.bare.cssBytes = 100;
  current.bundleSize.scenarios.bare.cssGzipBytes = 60;
  current.bundleSize.scenarios.bare.cssFiles = 1;
  const result = evaluateViteRegression(baseline, current, git());
  assert.equal(result.status, 'COMPARABLE');
  const growing = result.comparisons.find(
    (r) => r.scenario === 'button' && r.metric === 'jsGzipBytes'
  );
  assert.equal(growing.deltaBytes, 1024);
  assert.ok(growing.deltaPercent > 0);
  const shrinking = result.comparisons.find(
    (r) => r.scenario === 'buttonInput' && r.metric === 'jsBytes'
  );
  assert.equal(shrinking.deltaBytes, -1000);
  assert.ok(shrinking.deltaPercent < 0);
  const newlyAdded = result.comparisons.find(
    (r) => r.scenario === 'bare' && r.metric === 'cssBytes'
  );
  assert.equal(newlyAdded.deltaPercent, null);
  assert.match(formatViteRegression(result), /NEW/);
  assert.match(formatViteRegression(result), /NOT_CALIBRATED/);
});

test('zero baseline and unchanged zero avoid NaN/Infinity in summary', () => {
  const r = evaluateViteRegression(baseline, same(), git());
  const css = r.comparisons.find(
    (row) => row.scenario === 'bare' && row.metric === 'cssBytes'
  );
  assert.equal(css.deltaPercent, null);
  assert.equal(css.deltaBytes, 0);
  assert.ok(!/NaN|Infinity/.test(formatViteRegression(r)));
});
