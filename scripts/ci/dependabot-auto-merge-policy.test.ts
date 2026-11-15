import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

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
    expect(source).toContain('decision.sourceCandidateBaseSha');
    expect(source).toContain('decision.sourceCandidateHeadSha');
    expect(source).toContain(
      'Security remediation source run is no longer an exact successful authority'
    );
    expect(source).toContain(
      'run.head_sha !== decision.sourceCandidateBaseSha'
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

describe('immutable Dependabot decision execution', () => {
  // Execute the exact inline validator from the workflow, not a reimplementation.
  // No GitHub API, artifacts, credentials or dependency installation are needed.
  it.each([
    ['patch passes', 'version-update:semver-patch', true, true],
    ['minor is a no-op', 'version-update:semver-minor', false, true],
    ['major is a no-op', 'version-update:semver-major', false, true],
    ['minor falsely eligible fails closed', 'version-update:semver-minor', true, false],
    ['patch falsely denied fails closed', 'version-update:semver-patch', false, false],
    ['unknown update fails closed', 'version-update:semver-unknown', false, false],
  ])('%s', async (_case, updateType, eligible, shouldPass) => {
    const source = await workflowSource();
    const startMarker =
      "      - name: Validate immutable auto-merge decision";
    const start = source.indexOf(startMarker);
    const scriptStart = source.indexOf("          node <<'NODE'\\n", start);
    const scriptEnd = source.indexOf('\\n          NODE', scriptStart);
    expect(start).toBeGreaterThan(-1);
    expect(scriptStart).toBeGreaterThan(start);
    expect(scriptEnd).toBeGreaterThan(scriptStart);
    const script = source.slice(scriptStart + "          node <<'NODE'\\n".length, scriptEnd)
      .split('\\n').map((line) => line.replace(/^          /, '')).join('\\n');
    const dir = mkdtempSync(join(tmpdir(), 'vellira-dependabot-policy-'));
    const sha = 'a'.repeat(40);
    try {
      mkdirSync(join(dir, '.dependabot-auto-merge'));
      writeFileSync(join(dir, '.dependabot-auto-merge/decision.json'),
        JSON.stringify({
          schemaVersion: 1,
          repository: 'vellira-dev/vellira',
          pullRequestNumber: 2135,
          author: 'dependabot[bot]',
          headSha: sha,
          baseRef: 'main',
          updateType,
          eligible,
        }));
      const output = join(dir, 'outputs');
      const result = spawnSync(process.execPath, ['-e', script], {
        cwd: dir,
        encoding: 'utf8',
        env: { ...process.env, REPOSITORY: 'vellira-dev/vellira',
          CI_HEAD_SHA: sha, GITHUB_OUTPUT: output },
      });
      expect(result.status, result.stderr).toBe(shouldPass ? 0 : 1);
      const actual = readFileSync(output, 'utf8');
      if (updateType === 'version-update:semver-patch' && eligible) {
        expect(actual).toContain('eligible=true');
      } else if (shouldPass) {
        expect(actual).toBe('eligible=false\\n');
        expect(actual).not.toContain('eligible=true');
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
