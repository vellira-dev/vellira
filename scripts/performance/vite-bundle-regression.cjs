// #470: report-only PR-to-main comparison of measured Vite application assets.
// Never compute a delta from a stale or unverified main baseline.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const SHA = /^[a-f0-9]{40}$/;
const FIELDS = ['jsBytes', 'jsGzipBytes', 'cssBytes', 'cssGzipBytes'];
const SCENARIOS = ['bare', 'button', 'buttonInput'];
const TOOLING = ['node', 'npm', 'vite', 'typescript'];
const MEASUREMENT_PATHS = [
  'packages/',
  'apps/react-playground/package.json',
  'package.json',
  'pnpm-lock.yaml',
  'scripts/release-candidate/package-artifacts.cjs',
  'scripts/release-candidate/cli.cjs',
  'scripts/release-candidate/consumer-artifacts.cjs',
  'scripts/semantic-release-packages.cjs',
];
const CHECKED_SECTIONS = [
  ['function createFixture(candidate) {', 'function verifyRuntimeRender(fixtureDir) {'],
  ['function verifyProductionBuild(fixtureDir) {', 'async function main() {'],
];

function runGit(root, args, expectedStatuses = [0]) {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  if (result.error || !expectedStatuses.includes(result.status)) {
    throw new Error(
      'Git evidence unavailable for ' + args[0] + ' (status ' +
      String(result.status) + '): ' + (result.stderr || result.error?.message || '')
    );
  }
  return { stdout: result.stdout.trim(), status: result.status };
}

function extractSection(source, start, end) {
  const first = source.indexOf(start);
  const last = source.indexOf(end, first + start.length);
  if (first < 0 || last <= first) {
    throw new Error('Measured Vite fixture contract cannot be located.');
  }
  return source.slice(first, last);
}

function collectGitEvidence(root, mainSha, baseSha) {
  try {
    if (!SHA.test(mainSha) || !SHA.test(baseSha)) {
      throw new Error('Main/base identities must be immutable SHAs.');
    }
    const mainTreeSha = runGit(root, [
      'rev-parse', '--verify', mainSha + '^{tree}',
    ]).stdout;
    const descendant = runGit(root, [
      'merge-base', '--is-ancestor', mainSha, baseSha,
    ], [0, 1]).status === 0;
    const changed = runGit(root, [
      'diff', '--name-only', mainSha, baseSha, '--', ...MEASUREMENT_PATHS,
    ]).stdout;
    const priorFixture = runGit(root, [
      'show', mainSha + ':scripts/release-candidate/vite-consumer.cjs',
    ]).stdout;
    const actualFixture = fs.readFileSync(
      path.join(root, 'scripts/release-candidate/vite-consumer.cjs'), 'utf8'
    );
    const fixtureSame = CHECKED_SECTIONS.every(([start, end]) =>
      extractSection(priorFixture, start, end) ===
      extractSection(actualFixture, start, end)
    );
    const priorMetric = runGit(root, [
      'show', mainSha + ':scripts/performance/vite-bundle-size-report.cjs',
    ]).stdout;
    const actualMetric = fs.readFileSync(
      path.join(root, 'scripts/performance/vite-bundle-size-report.cjs'),
      'utf8'
    ).trim();
    return {
      mainTreeSha,
      descendant,
      changedPaths: changed ? changed.split('\n') : [],
      fixtureSame,
      measurementSame: priorMetric === actualMetric,
    };
  } catch (error) {
    return { error: String(error.message || error) };
  }
}

function validScenarios(rows) {
  if (!rows || typeof rows !== 'object' ||
      Object.keys(rows).sort().join(',') !== [...SCENARIOS].sort().join(',')) {
    return false;
  }
  return SCENARIOS.every((name) => {
    const row = rows[name];
    return row && [...FIELDS, 'jsFiles', 'cssFiles'].every((field) =>
      Number.isSafeInteger(row[field]) && row[field] >= 0
    ) && row.jsFiles > 0 && row.jsBytes > 100 &&
      row.jsGzipBytes <= row.jsBytes && row.cssGzipBytes <= row.cssBytes &&
      (row.cssFiles > 0 || row.cssBytes === 0);
  });
}

function evaluateViteRegression(baseline, candidate, gitEvidence) {
  const result = {
    schemaVersion: 1,
    status: 'BASELINE_MISSING',
    reason: '',
    baselineMainSha: baseline?.main?.sha ?? null,
    candidateSha: candidate?.sha ?? null,
    candidateBaseSha: candidate?.baseSha ?? null,
    threshold: {
      state: 'NOT_CALIBRATED',
      identicalSourceSamples: 1,
      blocking: false,
      note: 'One baseline sample does not establish normal build variance.',
    },
    comparisons: [],
  };
  const fail = (status, reason) => ({ ...result, status, reason });
  if (!baseline) return fail('BASELINE_MISSING', 'No verified main snapshot.');
  if (baseline.schemaVersion !== 1 ||
      baseline.profile !== 'vite-full-styles-v1' ||
      !SHA.test(baseline.main?.sha ?? '') ||
      !SHA.test(baseline.main?.treeSha ?? '') ||
      !SHA.test(baseline.sourceEvidence?.measuredCandidateSha ?? '') ||
      baseline.sourceEvidence?.measuredTreeSha !== baseline.main.treeSha ||
      !/^[a-f0-9]{64}$/.test(
        baseline.sourceEvidence?.candidateManifestSha256 ?? ''
      ) ||
      !validScenarios(baseline.scenarios)) {
    return fail('BASELINE_INVALID', 'Invalid main tree, provenance or metrics.');
  }
  if (!SHA.test(candidate?.sha ?? '') || !SHA.test(candidate?.baseSha ?? '')) {
    return fail('NOT_APPLICABLE', 'Missing exact pull-request base/HEAD.');
  }
  if (!gitEvidence || gitEvidence.error ||
      gitEvidence.mainTreeSha !== baseline.main.treeSha) {
    return fail('BASELINE_INVALID',
      'Main tree could not be verified: ' +
      (gitEvidence?.error ?? 'tree mismatch'));
  }
  if (!gitEvidence.descendant || gitEvidence.changedPaths.length) {
    return fail('BASELINE_STALE',
      'The PR base differs from canonical main in relevant inputs: ' +
      (gitEvidence.changedPaths.join(', ') || 'not descended from baseline'));
  }
  if (!gitEvidence.fixtureSame || !gitEvidence.measurementSame) {
    return fail('FIXTURE_MISMATCH',
      'Vite fixture/size methodology differs from measured baseline.');
  }
  if (TOOLING.some((key) =>
    candidate.tooling?.[key] !== baseline.tooling?.[key])) {
    return fail('TOOLCHAIN_MISMATCH',
      'Node/npm/Vite/TypeScript versions differ from baseline.');
  }
  if (candidate.bundleSize?.schemaVersion !== 1 ||
      candidate.bundleSize?.metric !== baseline.metric ||
      !validScenarios(candidate.bundleSize.scenarios)) {
    return fail('SCENARIO_MISMATCH',
      'Scenario/metric schema is incomplete or has changed.');
  }
  const comparisons = [];
  for (const scenario of SCENARIOS) {
    for (const metric of FIELDS) {
      const baselineBytes = baseline.scenarios[scenario][metric];
      const currentBytes = candidate.bundleSize.scenarios[scenario][metric];
      const deltaBytes = currentBytes - baselineBytes;
      comparisons.push({
        scenario, metric, baselineBytes, currentBytes, deltaBytes,
        deltaPercent: baselineBytes === 0 ? null
          : Number((100 * deltaBytes / baselineBytes).toFixed(3)),
        trend: deltaBytes > 0 ? 'INCREASE' :
          deltaBytes < 0 ? 'DECREASE' : 'UNCHANGED',
      });
    }
  }
  return {
    ...result,
    status: 'COMPARABLE',
    reason: 'Same versioned fixture, metric, tooling and canonical main.',
    comparisons,
    observedIncreases: comparisons.filter((r) => r.deltaBytes > 0).length,
  };
}

function formatViteRegression(report) {
  const lines = [
    '### PR vs main Vite bundle sizes (#470, report-only)', '',
    'Status: **' + report.status + '**', '',
    'Main baseline: ' + (report.baselineMainSha ?? 'missing') +
      '. PR candidate: ' + (report.candidateSha ?? 'missing') + '.', '',
  ];
  if (report.status !== 'COMPARABLE') {
    lines.push('No trusted size deltas: ' + report.reason, '');
    return lines.join('\n');
  }
  lines.push(
    '| Scenario | Metric | Main bytes | PR bytes | Δ bytes | Δ % |',
    '| --- | --- | ---: | ---: | ---: | ---: |'
  );
  for (const r of report.comparisons) {
    const percent = r.deltaPercent === null
      ? (r.deltaBytes > 0 ? 'NEW' : '—')
      : r.deltaPercent.toFixed(2) + '%';
    lines.push('| ' + r.scenario + ' | ' + r.metric + ' | ' +
      r.baselineBytes + ' | ' + r.currentBytes + ' | ' +
      (r.deltaBytes > 0 ? '+' : '') + r.deltaBytes + ' | ' + percent + ' |');
  }
  lines.push('', 'Observed increases: **' + report.observedIncreases +
    '**; threshold **NOT_CALIBRATED**. No size gate, no inferred network ' +
    'transfer. Refresh baseline after relevant main/toolchain changes.', '');
  return lines.join('\n');
}

module.exports = {
  MEASUREMENT_PATHS,
  collectGitEvidence,
  evaluateViteRegression,
  formatViteRegression,
};
