import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

describe('clean Next.js consumer workflow contract', () => {
  it('downloads the exact retained candidate from the shared producer job', () => {
    const workflow = readFileSync(
      '.github/workflows/release-candidate-proof.yml',
      'utf8'
    );

    expect(workflow).toContain('  next-consumer:');
    expect(workflow).toContain('name: Clean Next.js consumer');
    expect(workflow).toContain('needs: candidate');
    expect(workflow).toContain('ref: ${{ github.sha }}');
    expect(workflow).toContain(
      'name: npm-release-candidate-${{ needs.candidate.outputs.candidate_sha }}'
    );
    expect(workflow).toContain(
      'VELLIRA_CANDIDATE_SHA: ${{ needs.candidate.outputs.candidate_sha }}'
    );
    expect(workflow).toContain(
      'run: node scripts/release-candidate/next-consumer.cjs'
    );
    expect(workflow).toContain(
      'name: next-consumer-evidence-${{ needs.candidate.outputs.candidate_sha }}'
    );
  });

  it('keeps the Next.js proof outside monorepo package builds', () => {
    const workflow = readFileSync(
      '.github/workflows/release-candidate-proof.yml',
      'utf8'
    );
    const start = workflow.indexOf('  next-consumer:');
    expect(start).toBeGreaterThanOrEqual(0);

    const nextJob = workflow.slice(start);
    expect(nextJob).not.toContain('pnpm install');
    expect(nextJob).not.toContain('pnpm build');
    expect(nextJob).not.toContain('npm pack');
    expect(nextJob).not.toContain('pnpm pack');
    expect(nextJob).toContain('Retain Next.js consumer evidence');
  });

  it('verifies the complete clean Next.js consumer path', () => {
    const script = readFileSync(
      'scripts/release-candidate/next-consumer.cjs',
      'utf8'
    );

    expect(script).toContain("import '@vellira-ui/tokens/css'");
    expect(script).toContain("import '@vellira-ui/react/styles'");
    expect(script).toContain("'use client';");
    expect(script).toContain(
      "import { Button, Input } from '@vellira-ui/react'"
    );
    expect(script).toContain('serverPageIsServerComponent: true');
    expect(script).toContain('clientPanelIsClientComponent: true');
    expect(script).toContain("run('npm', ['run', 'typecheck']");
    expect(script).toContain('verifyPackageExports(fixtureDir)');
    expect(script).toContain('verifyDevelopmentMode(fixtureDir)');
    expect(script).toContain('verifyProductionBuild(fixtureDir)');
    expect(script).toContain('noWorkspaceResolution: true');
  });

  it('runs Next directly and owns the dev-server lifecycle', () => {
    const script = readFileSync(
      'scripts/release-candidate/next-consumer.cjs',
      'utf8'
    );

    expect(script).toContain('const nextBin = path.join(');
    expect(script).toContain('spawn(\n    process.execPath,');
    expect(script).toContain("child.kill('SIGTERM')");
    expect(script).toContain("child.kill('SIGKILL')");
    expect(script).not.toContain("spawn(\n    'npm'");
  });
});
