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
const alertWatchWorkflowPath = resolve(
  process.cwd(),
  '.github/workflows/dependabot-alert-watch.yml'
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
    const fixIndex = source.indexOf('Generate bounded pnpm security override');
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
    expect(source).not.toContain('pnpm audit --fix=update');
    expect(source).not.toContain('pnpm audit --fix --dev');
    expect(source).toContain('--fix=override');
    expect(source).toContain('--ignore-unfixable');
    expect(source).toContain(
      'Runtime alerts remain outside this bounded fallback.'
    );
    expect(source).toContain('--audit .security-remediation/audit-before.json');
    expect(source).toContain('--plan .security-remediation/plan.json');
    expect(source).toContain('runtime-ignores');
    expect(source).toContain('runtime-audit-ignores.json');
    expect(source).toContain('steps.plan.outputs.fixable_packages');
    expect(source).toContain(
      'Package authority: exact fixable development-scope Dependabot plan'
    );
    expect(source).toContain('registry audit is confirming evidence only');
    expect(source).toContain("<<'BODY'");
    expect(source).not.toContain('<<BODY');
    expect(source).toContain(
      "printf '\\n<!-- vellira-security-remediation-v1 base-sha=%s"
    );
    expect(source).toContain('Record generated workspace evidence');
    expect(source).toContain(
      'authorizedPackages: validation.authorizedPackages'
    );
    expect(source).toContain('changedPackages: validation.changedPackages');
    expect(source).toContain('include-hidden-files: true');
    expect(source).toContain('if-no-files-found: error');
    expect(source).not.toContain('gh pr merge');
  });

  it('rejects non-main sources before any remediation work', async () => {
    const source = await readFile(remediationWorkflowPath, 'utf8');
    const jobGuardIndex = source.indexOf("if: github.ref == 'refs/heads/main'");
    const checkoutIndex = source.indexOf('Checkout exact main baseline');

    expect(jobGuardIndex).toBeGreaterThan(-1);
    expect(checkoutIndex).toBeGreaterThan(jobGuardIndex);
  });

  it('revalidates main before write authority', async () => {
    const source = await readFile(remediationWorkflowPath, 'utf8');
    const freshnessIndex = source.indexOf(
      'Revalidate current main before mutation'
    );
    const commitIndex = source.indexOf(
      'Prepare exact dependency-only remediation commit'
    );
    const artifactIndex = source.indexOf(
      'Publish immutable remediation candidate'
    );
    const tokenIndex = source.indexOf(
      'Create short-lived remediation GitHub App token'
    );

    expect(freshnessIndex).toBeGreaterThan(-1);
    expect(commitIndex).toBeGreaterThan(freshnessIndex);
    expect(artifactIndex).toBeGreaterThan(commitIndex);
    expect(tokenIndex).toBeGreaterThan(artifactIndex);
    expect(source).toContain('EXPECTED_MAIN_SHA: ${{ github.sha }}');
    expect(source).toContain(
      'Security remediation baseline is stale: expected main'
    );
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
      '--candidate /tmp/security-remediation-source/candidate.json'
    );
    expect(metadataSource).toContain('path: /tmp/security-remediation-source');
    expect(metadataSource).toContain('candidate.authorizedPackages');
    expect(metadataSource).toContain('candidate.changedPackages');
    expect(metadataSource).toContain('candidate.ignoredRuntimeGhsas');
    expect(metadataSource).toContain("jq -r '.ignoredRuntimeGhsas[]'");
    expect(metadataSource).toContain(
      'Prove in-scope registry advisories are closed by the candidate'
    );
    expect(metadataSource).toContain('--ignore-unfixable');
    expect(metadataSource).toContain(
      '--audit-level ${{ steps.envelope.outputs.audit_level }}'
    );
    expect(metadataSource).toContain("kind: 'security-remediation'");
    expect(metadataSource).toContain('include-hidden-files: true');
  });

  it(
    'reconciles the alert tracker immediately after dependency authority changes',
    async () => {
      const source = await readFile(alertWatchWorkflowPath, 'utf8');

      expect(source).toContain('push:');
      expect(source).toContain('- main');
      expect(source).toContain("'pnpm-lock.yaml'");
      expect(source).toContain("'pnpm-workspace.yaml'");
      expect(source).toContain("'**/package.json'");
      expect(source).toContain("if: github.ref == 'refs/heads/main'");
      expect(source).toContain('group: dependabot-alert-watch');
      expect(source).toContain('cancel-in-progress: true');
      expect(source).toContain('max_reads=4');
      expect(source).toContain('sleep 30');
      expect(source).toContain('Dependency graph reads: $read_number');
      expect(source).toContain('Observed main SHA: $main_sha');
      expect(source).toContain('gh api "repos/$GH_REPO/branches/main" --jq');
    }
  );

  it(
    'surfaces alert scope and manifest evidence in the canonical tracker',
    async () => {
      const source = await readFile(alertWatchWorkflowPath, 'utf8');

      expect(source).toContain(
        '| Severity | Scope | Package | Manifest | Alert |'
      );
      expect(source).toContain('.dependency.scope // "unknown"');
      expect(source).toContain('.dependency.manifest_path // "unknown"');
      expect(source).toContain('Development-scope alerts: $development_count');
      expect(source).toContain('Runtime-scope alerts: $runtime_count');
      expect(source).toContain('against observed main \\`${main_sha}\\`');
    }
  );
});
