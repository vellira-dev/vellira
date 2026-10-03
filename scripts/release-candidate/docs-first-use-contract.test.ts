import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

describe('documentation first-use candidate proof', () => {
  it('runs only after the full exact-candidate consumer matrix', () => {
    const workflow = readFileSync(
      '.github/workflows/release-candidate-proof.yml',
      'utf8'
    );

    expect(workflow).toContain('docs-first-use:');
    expect(workflow).toContain(
      'needs: [candidate, vite-consumer, next-consumer, expo-consumer]'
    );
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
      'run: node scripts/release-candidate/docs-first-use.cjs'
    );
    expect(workflow).toContain(
      'name: docs-first-use-evidence-${{ needs.candidate.outputs.candidate_sha }}'
    );
  });

  it('reruns when public first-use documentation changes', () => {
    const workflow = readFileSync(
      '.github/workflows/release-candidate-proof.yml',
      'utf8'
    );

    for (const publicPath of [
      "'README.md'",
      "'packages/react/README.md'",
      "'packages/react-native/README.md'",
      "'apps/docs/src/**'",
      "'scripts/docs/**'",
    ]) {
      expect(workflow).toContain(publicPath);
    }
  });

  it('compiles real public examples against retained tarballs', () => {
    const proof = readFileSync(
      'scripts/release-candidate/docs-first-use.cjs',
      'utf8'
    );

    for (const publicPath of [
      'README.md',
      'packages/react/README.md',
      'packages/react-native/README.md',
      'apps/docs/src/start/getting-started.md',
      'apps/docs/src/react/index.md',
      'apps/docs/src/react-native/index.md',
    ]) {
      expect(proof).toContain(publicPath);
    }

    expect(proof).toContain('validateCandidateArtifactDirectory');
    expect(proof).toContain('assertInstalledCandidatePackages');
    expect(proof).toContain('WEB_PACKAGE_NAMES');
    expect(proof).toContain('NATIVE_PACKAGE_NAMES');
    expect(proof).toContain("'npm'");
    expect(proof).toContain("'install'");
    expect(proof).toContain("'typecheck'");
    expect(proof).toContain('verifyWebsiteDocsLinks');
    expect(proof).toContain('exactPackageVersion');
    expect(proof).toContain('referencedApisResolveFromPackedDeclarations');
    expect(proof).toContain('noWorkspaceResolution');
  });
});
