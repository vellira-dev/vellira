import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const remediationWorkflowPath = resolve(
  process.cwd(),
  '.github/workflows/dependabot-security-remediation.yml'
);
const metadataWorkflowPath = resolve(
  process.cwd(),
  '.github/workflows/dependabot-auto-merge-metadata.yml'
);

describe('Dependabot security remediation workflow policy', () => {
  it('runs daily for high severity and weekly for all severities', async () => {
    const source = await readFile(remediationWorkflowPath, 'utf8');

    expect(source).toContain("cron: '15 8 * * *'");
    expect(source).toContain("cron: '45 8 * * 0'");
    expect(source).toContain('audit_level:');
    expect(source).toContain('high|low');
  });

  it('keeps mutation bounded to pnpm security authority', async () => {
    const source = await readFile(remediationWorkflowPath, 'utf8');
    const fixIndex = source.indexOf(
      'pnpm audit --fix --dev --ignore-unfixable --audit-level'
    );
    const diffIndex = source.indexOf('validate-working-tree');
    const auditIndex = source.indexOf(
      'Prove no in-scope registry advisory remains'
    );
    const tokenIndex = source.indexOf(
      'Create short-lived remediation GitHub App token'
    );
    const artifactIndex = source.indexOf(
      'Publish immutable remediation candidate'
    );
    const provenanceIndex = source.indexOf(
      'Prepare canonical remediation pull request provenance'
    );
    const branchIndex = source.indexOf('Publish canonical remediation branch');

    expect(fixIndex).toBeGreaterThan(-1);
    expect(diffIndex).toBeGreaterThan(fixIndex);
    expect(auditIndex).toBeGreaterThan(diffIndex);
    expect(artifactIndex).toBeGreaterThan(auditIndex);
    expect(tokenIndex).toBeGreaterThan(artifactIndex);
    expect(provenanceIndex).toBeGreaterThan(tokenIndex);
    expect(branchIndex).toBeGreaterThan(provenanceIndex);
    expect(source).toContain('gh pr ready "$EXISTING_PR_NUMBER"');
    expect(source).toContain('--undo');
    expect(source).toContain('git add pnpm-workspace.yaml pnpm-lock.yaml');
    expect(source).toContain('.dependency.scope == "development"');
    expect(source).toContain(
      'pnpm audit --fix=update --dev --ignore-unfixable --audit-level'
    );
    expect(source).toContain(
      'Runtime alerts remain outside this bounded fallback.'
    );
    expect(source).not.toContain('gh pr merge');
  });

  it('uses a short-lived app token only for branch and PR writes', async () => {
    const source = await readFile(remediationWorkflowPath, 'utf8');

    expect(source).toContain('contents: read');
    expect(source).toContain('pull-requests: read');
    expect(source).toContain('security-events: read');
    expect(source).toContain('permission-contents: write');
    expect(source).toContain('permission-pull-requests: write');
    expect(source).toContain('persist-credentials: false');
    expect(source).toContain('ref: ${{ github.sha }}');
    expect(source).toContain('test "$(git rev-parse HEAD)" = "$GITHUB_SHA"');
    expect(source).toContain('test "$base_ref" = \'main\'');
  });

  it('authenticates remediation PRs before auto-merge metadata', async () => {
    const remediationSource = await readFile(remediationWorkflowPath, 'utf8');
    const metadataSource = await readFile(metadataWorkflowPath, 'utf8');

    expect(remediationSource).toContain(
      'Publish immutable remediation candidate'
    );
    expect(remediationSource).toContain('source-attempt=');

    expect(metadataSource).toContain(
      "github.event.pull_request.user.login == 'vellira-release-sync[bot]'"
    );
    expect(metadataSource).toContain(
      "github.event.pull_request.head.ref == 'automation/dependabot-security-remediation'"
    );
    expect(metadataSource).toContain(
      'test "$PR_TITLE" = \'chore(security): remediate dependency alerts\''
    );
    expect(metadataSource).toContain('actions: read');
    expect(metadataSource).toContain(
      'Download immutable remediation candidate'
    );
    expect(metadataSource).toContain('Validate trusted remediation source run');
    expect(metadataSource).toContain(
      'Security remediation source run does not match the exact candidate base'
    );
    expect(metadataSource).toContain('run.head_sha !== expectedBaseSha');
    expect(metadataSource).toContain('run.path !==');
    expect(metadataSource).toContain(
      "'.github/workflows/dependabot-security-remediation.yml'"
    );
    expect(metadataSource).toContain(
      'Security remediation candidate artifact does not authenticate this PR head'
    );
    expect(metadataSource).toContain('scope=(development)');
    expect(metadataSource).toContain(
      "expected.dependencyScope !== 'development'"
    );
    expect(metadataSource).toContain('validate-pr');
    expect(metadataSource).toContain(
      'pnpm audit --dev --ignore-unfixable --audit-level ${{ steps.envelope.outputs.audit_level }}'
    );
    expect(metadataSource).toContain("kind: 'security-remediation'");
  });
});
