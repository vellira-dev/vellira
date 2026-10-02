import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

describe('release candidate artifact wiring', () => {
  it('publishes the validated tarball instead of repacking a package directory', () => {
    const publisher = readFileSync(
      'scripts/semantic-release-packages.cjs',
      'utf8'
    );

    expect(publisher).toContain(
      "require('./release-candidate/package-artifacts.cjs')"
    );
    expect(publisher).toContain('prepareReleaseCandidate(packageInfos');
    expect(publisher).toContain(
      'packageInfo.publishTarget ?? packageInfo.relativeDirectory'
    );
    expect(publisher).toContain('loadReleaseCandidate(preparedPackageInfos');
    expect(publisher).toContain('packageInfo.candidateIntegrity');
    expect(publisher).toContain('npm integrity mismatch');
  });

  it('uses the workspace-aware pnpm packer for candidate tarballs', () => {
    const validator = readFileSync(
      'scripts/release-candidate/package-artifacts.cjs',
      'utf8'
    );

    expect(validator).toContain("'pnpm'");
    expect(validator).toContain("'--filter'");
    expect(validator).toContain("'--pack-destination'");
    expect(validator).not.toContain("run('npm', [\n    'pack'");
    expect(validator).toContain('unresolved workspace dependencies');
  });

  it('keeps release recovery preflight free of candidate-only dependencies', () => {
    const validator = readFileSync(
      'scripts/release-candidate/package-artifacts.cjs',
      'utf8'
    );
    const resolverIndex = validator.indexOf(
      'function verifyTypescriptResolution'
    );
    const typescriptRequireIndex = validator.indexOf(
      "const ts = require('typescript')"
    );

    expect(resolverIndex).toBeGreaterThanOrEqual(0);
    expect(typescriptRequireIndex).toBeGreaterThan(resolverIndex);
  });

  it('retains the exact release candidate even when publication later fails', () => {
    const workflow = readFileSync('.github/workflows/release.yml', 'utf8');

    expect(workflow).toContain('- name: Retain exact npm release candidate');
    expect(workflow).toContain(
      "if: always() && hashFiles('.release-candidate/candidate.json') != ''"
    );
    expect(workflow).toContain('name: npm-release-candidate-${{ github.sha }}');
    expect(workflow).toContain('.release-candidate/*.tgz');
    expect(workflow).toContain('.release-candidate/candidate.json');
    expect(workflow).toContain('include-hidden-files: true');
  });

  it('provides a non-publishing exact candidate proof workflow', () => {
    const workflow = readFileSync(
      '.github/workflows/release-candidate-proof.yml',
      'utf8'
    );

    expect(workflow).toContain('name: Release Candidate Proof');
    expect(workflow).toContain(
      'ref: ${{ github.event.pull_request.head.sha || github.sha }}'
    );
    expect(workflow).toContain('node-version: 24.21.0');
    expect(workflow).toContain('run: node scripts/release-candidate/cli.cjs');
    expect(workflow).toContain(
      'VELLIRA_CANDIDATE_SHA: ${{ github.event.pull_request.head.sha || github.sha }}'
    );
    expect(workflow).not.toContain(
      'GITHUB_SHA: ${{ github.event.pull_request.head.sha || github.sha }}'
    );
    expect(workflow).toContain('Retain exact candidate tarballs');
    expect(workflow).toContain('include-hidden-files: true');
    expect(workflow).not.toContain('npm publish');
    expect(workflow).not.toContain('pnpm exec semantic-release');
  });
});
