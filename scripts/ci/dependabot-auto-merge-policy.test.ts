import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const workflowPath = resolve(
  process.cwd(),
  '.github/workflows/dependabot-auto-merge.yml'
);

async function workflowSource() {
  return readFile(workflowPath, 'utf8');
}

describe('Dependabot auto-merge workflow policy', () => {
  it('requires successful full CI', async () => {
    const source = await workflowSource();

    expect(source).toContain("workflows: ['CI']");
    expect(source).not.toContain(
      "workflows: ['Dependabot Auto Merge Metadata']"
    );
    expect(source).toContain(
      "github.event.workflow_run.conclusion == 'success'"
    );
  });

  it('binds metadata to the CI head', async () => {
    const source = await workflowSource();

    expect(source).toContain('head_sha="$EXPECTED_HEAD_SHA"');
    expect(source).toContain('commits/$EXPECTED_HEAD_SHA/pulls');
    expect(source).toContain('deadline=$((SECONDS + 900))');
    expect(source).toContain('latest_run="$(');
    expect(source).toContain('sort_by(.id)');
    expect(source).toContain('last // empty');
    expect(source).toContain(
      'Authenticated latest metadata run: $latest_run_id attempt $latest_run_attempt'
    );
    expect(source).toContain('run_attempt=$latest_run_attempt');
    expect(source).toContain(
      'dependabot-auto-merge-decision-${{ steps.metadata.outputs.run_id }}-${{ steps.metadata.outputs.run_attempt }}'
    );
    expect(source).not.toContain('successful_run_id=');
    expect(source).toContain(
      'Timed out waiting for successful exact-head dependency metadata.'
    );
    expect(source).toContain('Exact CI head is not an eligible dependency PR.');
    expect(source).toContain('decision.headSha !== ciHeadSha');
    expect(source).toContain(
      'Dependency auto-merge decision does not match successful CI head'
    );
  });

  it('orders checks before write credentials', async () => {
    const source = await workflowSource();
    const waitIndex = source.indexOf('Wait for required pull request checks');
    const revalidateIndex = source.indexOf(
      'Revalidate dependency pull request after checks'
    );
    const sourceRunIndex = source.indexOf(
      'Revalidate completed remediation source run'
    );
    const runtimeScopeIndex = source.indexOf(
      'Revalidate live runtime dependency scope'
    );
    const tokenIndex = source.indexOf(
      'Create short-lived merge GitHub App token'
    );
    const mergeIndex = source.indexOf(
      'Merge eligible dependency update after full CI'
    );

    expect(waitIndex).toBeGreaterThan(-1);
    expect(revalidateIndex).toBeGreaterThan(waitIndex);
    expect(sourceRunIndex).toBeGreaterThan(revalidateIndex);
    expect(runtimeScopeIndex).toBeGreaterThan(sourceRunIndex);
    expect(tokenIndex).toBeGreaterThan(runtimeScopeIndex);
    expect(mergeIndex).toBeGreaterThan(tokenIndex);
    expect(source).toContain('--required');
    expect(source).toContain('--watch');
    expect(source).toContain('--fail-fast');
  });

  it('accepts only bounded security remediation candidates', async () => {
    const source = await workflowSource();

    expect(source).toContain("decision.kind === 'security-remediation'");
    expect(source).toContain("expectedAuthor = 'vellira-release-sync[bot]'");
    expect(source).toContain("'automation/dependabot-security-remediation'");
    expect(source).toContain("'pnpm-lock.yaml'");
    expect(source).toContain("'pnpm-workspace.yaml'");
    expect(source).toContain(
      'Security remediation changed files outside dependency authority'
    );
    expect(source).toContain(
      'Security remediation decision source identity is invalid'
    );
    expect(source).toContain(
      'Security remediation decision dependency scope is invalid'
    );
    expect(source).toContain("decision.dependencyScope !== 'development'");
    expect(source).toContain(
      'Security remediation decision package authority is invalid'
    );
    expect(source).toContain('decision.authorizedPackages');
    expect(source).toContain('decision.changedPackages');
    expect(source).toContain('decision.ignoredRuntimeGhsas');
    expect(source).toContain('decision.auditGapMaterializations');
    expect(source).toContain(
      'Security remediation source run is no longer an exact successful authority'
    );
    expect(source).toContain('scripts/ci/dependabot-auto-merge-policy.test.ts');
    expect(source).toContain("run.conclusion !== 'success'");
    expect(source).toContain('DEPENDABOT_ALERTS_TOKEN');
    expect(source).toContain(
      'Security remediation package authority gained a live runtime conflict before merge'
    );
    expect(source).toContain(
      'Dependabot audit-gap authority changed before merge'
    );
    expect(source).toContain(
      'Security remediation base moved after authenticated generation'
    );
    expect(source).toContain(
      'Security remediation pull request title changed after authentication'
    );
  });

  it('merges immediately with exact head', async () => {
    const source = await workflowSource();
    const mergeFlagIndex = source.indexOf('--merge');
    const exactHeadIndex = source.indexOf(
      '--match-head-commit "$EXPECTED_HEAD_SHA"'
    );

    expect(mergeFlagIndex).toBeGreaterThan(-1);
    expect(exactHeadIndex).toBeGreaterThan(mergeFlagIndex);
    expect(source).not.toMatch(/^\s+--auto\b/m);
  });

  it('keeps the default token read-only', async () => {
    const source = await workflowSource();

    expect(source).toContain('actions: read');
    expect(source).toContain('checks: read');
    expect(source).toContain('contents: read');
    expect(source).toContain('pull-requests: read');
    expect(source).toContain('statuses: read');
    expect(source).toContain('permission-contents: write');
    expect(source).toContain('permission-pull-requests: write');
  });
});
