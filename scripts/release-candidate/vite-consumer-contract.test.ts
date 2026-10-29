import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

describe('clean Vite consumer workflow contract', () => {
  it('downloads the exact retained candidate from the producer job', () => {
    const workflow = readFileSync(
      '.github/workflows/release-candidate-proof.yml',
      'utf8'
    );

    expect(workflow).toContain(
      'candidate_sha: ${{ steps.candidate.outputs.candidate_sha }}'
    );
    expect(workflow).toContain('vite-consumer:');
    expect(workflow).toContain('needs: candidate');
    expect(workflow).toContain('ref: ${{ github.sha }}');
    expect(workflow).toContain(
      'name: npm-release-candidate-${{ needs.candidate.outputs.candidate_sha }}'
    );
    expect(workflow).toContain('path: .candidate-artifacts');
    expect(workflow).toContain(
      'VELLIRA_CANDIDATE_SHA: ${{ needs.candidate.outputs.candidate_sha }}'
    );
    expect(workflow).toContain(
      'run: node scripts/release-candidate/vite-consumer.cjs'
    );
  });

  it('keeps the Vite proof outside monorepo package builds', () => {
    const workflow = readFileSync(
      '.github/workflows/release-candidate-proof.yml',
      'utf8'
    );
    const start = workflow.indexOf('  vite-consumer:');
    expect(start).toBeGreaterThanOrEqual(0);

    const viteJob = workflow.slice(start);
    expect(viteJob).not.toContain('pnpm install');
    expect(viteJob).not.toContain('pnpm build');
    expect(viteJob).not.toContain('npm pack');
    expect(viteJob).not.toContain('pnpm pack');
    expect(viteJob).toContain('Retain Vite consumer evidence');
  });

  it('reports size deltas for clean Vite consumers', () => {
    const script = readFileSync(
      'scripts/release-candidate/vite-consumer.cjs',
      'utf8'
    );
    expect(script).toContain('measureViteBundleVariants(fixtureDir');
    expect(script).toContain('sizeReportMarkdown(bundleSize)');
    expect(script).toContain('GITHUB_STEP_SUMMARY');
    expect(script).toContain('      bundleSize,');
    expect(script).toContain("run('npm', ['run', 'build']");
  });

  it('reports exact main vs PR regressions without duplicate installs', () => {
    const script = readFileSync(
      'scripts/release-candidate/vite-consumer.cjs',
      'utf8'
    );
    const workflow = readFileSync(
      '.github/workflows/release-candidate-proof.yml',
      'utf8'
    );
    expect(script).toContain('collectGitEvidence(');
    expect(script).toContain('evaluateViteRegression(');
    expect(script).toContain('formatViteRegression(regression)');
    expect(script).toContain('evidence.bundleRegression = regression;');
    expect(workflow).toContain(
      'VELLIRA_PR_BASE_SHA: ${{ github.event.pull_request.base.sha }}'
    );
    expect(workflow).not.toContain('vite-baseline-consumer:');
  });

  it('measures a wider published-root Web surface separately from the baseline', () => {
    const script = readFileSync(
      'scripts/release-candidate/vite-consumer.cjs',
      'utf8'
    );
    expect(script).toContain('measureRepresentativeWeb(');
    expect(script).toContain('formatRepresentativeWeb(representativeWeb)');
    expect(script).toContain('representativeWeb,');
    expect(script).toContain('bundleSize.scenarios.buttonInput');
    expect(script).toContain("run('npm', ['run', 'typecheck']");
  });

  it('uses reviewed 2.188.5 main baseline and provisional size warnings', () => {
    const script = readFileSync(
      'scripts/release-candidate/vite-consumer.cjs',
      'utf8'
    );
    const regression = readFileSync(
      'scripts/performance/vite-bundle-regression.cjs',
      'utf8'
    );
    expect(script).toContain('vite-main-2.188.5.json');
    expect(regression).toContain('observedWarningThreshold');
    expect(regression).toContain("warningStatus: result.threshold.state");
    expect(regression).toContain("report.threshold.state === 'PROVISIONAL'");
  });

  it('verifies the public styles, render, dev, typecheck, build, and export paths', () => {
    const script = readFileSync(
      'scripts/release-candidate/vite-consumer.cjs',
      'utf8'
    );

    expect(script).toContain("import '@vellira-ui/tokens/css'");
    expect(script).toContain("import '@vellira-ui/react/styles'");
    expect(script).toContain(
      "import { Button, Input } from '@vellira-ui/react'"
    );
    expect(script).toContain("run('npm', ['run', 'typecheck']");
    expect(script).toContain('verifyRuntimeRender(fixtureDir)');
    expect(script).toContain('verifyPackageExports(fixtureDir)');
    expect(script).toContain('verifyDevelopmentMode(fixtureDir)');
    expect(script).toContain("'vite.js'");
    expect(script).toContain('spawn(\n    process.execPath');
    expect(script).toContain('verifyProductionBuild(fixtureDir)');
    expect(script).toContain('noWorkspaceResolution: true');
  });
});
