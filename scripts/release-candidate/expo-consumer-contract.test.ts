import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

describe('clean Expo consumer workflow contract', () => {
  it('downloads the exact retained candidate from the shared producer job', () => {
    const workflow = readFileSync(
      '.github/workflows/release-candidate-proof.yml',
      'utf8'
    );

    expect(workflow).toContain('  expo-consumer:');
    expect(workflow).toContain('name: Clean Expo consumer');
    expect(workflow).toContain('needs: candidate');
    expect(workflow).toContain(
      'ref: ${{ needs.candidate.outputs.candidate_sha }}'
    );
    expect(workflow).toContain(
      'name: npm-release-candidate-${{ needs.candidate.outputs.candidate_sha }}'
    );
    expect(workflow).toContain(
      'VELLIRA_CANDIDATE_SHA: ${{ needs.candidate.outputs.candidate_sha }}'
    );
    expect(workflow).toContain(
      'run: node scripts/release-candidate/expo-consumer.cjs'
    );
    expect(workflow).toContain(
      'name: expo-consumer-evidence-${{ needs.candidate.outputs.candidate_sha }}'
    );
  });

  it('keeps the Expo proof outside monorepo package builds', () => {
    const workflow = readFileSync(
      '.github/workflows/release-candidate-proof.yml',
      'utf8'
    );
    const start = workflow.indexOf('  expo-consumer:');
    expect(start).toBeGreaterThanOrEqual(0);

    const expoJob = workflow.slice(start);
    expect(expoJob).not.toContain('pnpm install');
    expect(expoJob).not.toContain('pnpm build');
    expect(expoJob).not.toContain('npm pack');
    expect(expoJob).not.toContain('pnpm pack');
    expect(expoJob).toContain('Retain Expo consumer evidence');
  });

  it('verifies native entry points, compatibility, startup bundles, and production exports', () => {
    const script = readFileSync(
      'scripts/release-candidate/expo-consumer.cjs',
      'utf8'
    );

    expect(script).toContain('NATIVE_PACKAGE_NAMES');
    expect(script).toContain("from '@vellira-ui/react-native'");
    expect(script).toContain('Candidate Native Button');
    expect(script).toContain('Candidate Native Checkbox');
    expect(script).toContain("expoBin, 'install', '--check'");
    expect(script).toContain("run('npm', ['run', 'typecheck']");
    expect(script).toContain('?platform=ios');
    expect(script).toContain('?platform=android');
    expect(script).toContain("'export',");
    expect(script).toContain("'--platform'");
    expect(script).toContain("'all'");
    expect(script).toContain('noWorkspaceResolution: true');
  });

  it('builds real iOS and Android development bundles through Expo Metro', () => {
    const script = readFileSync(
      'scripts/release-candidate/expo-consumer.cjs',
      'utf8'
    );

    expect(script).toContain("'export:embed'");
    expect(script).toContain("'--dev'");
    expect(script).toContain("'true'");
    expect(script).toContain("name: 'ios'");
    expect(script).toContain("name: 'android'");
    expect(script).toContain('Candidate Native Button');
    expect(script).toContain('Candidate Native Checkbox');
  });
});
