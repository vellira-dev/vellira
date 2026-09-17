import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const workflowPath = resolve(
  process.cwd(),
  '.github/workflows/dependabot-auto-merge.yml'
);
const metadataWorkflowPath = resolve(
  process.cwd(),
  '.github/workflows/dependabot-auto-merge-metadata.yml'
);

async function workflowSource() {
  return readFile(workflowPath, 'utf8');
}

async function metadataWorkflowSource() {
  return readFile(metadataWorkflowPath, 'utf8');
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
    expect(source).toContain('run.head_sha === expectedHeadSha');
    expect(source).toContain('decision.headSha !== ciHeadSha');
    expect(source).toContain(
      'Dependabot auto-merge decision does not match successful CI head'
    );
  });

  it('orders checks before write credentials', async () => {
    const source = await workflowSource();
    const waitIndex = source.indexOf('Wait for required pull request checks');
    const revalidateIndex = source.indexOf(
      'Revalidate Dependabot pull request after checks'
    );
    const tokenIndex = source.indexOf(
      'Create short-lived merge GitHub App token'
    );
    const mergeIndex = source.indexOf('Merge patch update after full CI');

    expect(waitIndex).toBeGreaterThan(-1);
    expect(revalidateIndex).toBeGreaterThan(waitIndex);
    expect(tokenIndex).toBeGreaterThan(revalidateIndex);
    expect(mergeIndex).toBeGreaterThan(tokenIndex);
    expect(source).toContain('--required');
    expect(source).toContain('--watch');
    expect(source).toContain('--fail-fast');
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

describe('Dependabot auto-merge metadata workflow policy', () => {
  it('disarms persistent auto-merge before inspecting eligibility', async () => {
    const source = await metadataWorkflowSource();
    const disarmIndex = source.indexOf('  disarm:');
    const inspectIndex = source.indexOf('  inspect:');

    expect(source).toContain('- converted_to_draft');
    expect(disarmIndex).toBeGreaterThan(-1);
    expect(inspectIndex).toBeGreaterThan(disarmIndex);
    expect(source).toContain('needs: disarm');
    expect(source).toContain('Inspect legacy auto-merge request');
    expect(source).toContain('.auto_merge == null');
    expect(source).toContain('--disable-auto');
    expect(source).toContain(
      'Verify no persistent auto-merge request remains'
    );
  });

  it('keeps cleanup write credentials short-lived and conditional', async () => {
    const source = await metadataWorkflowSource();
    const inspectIndex = source.indexOf('Inspect legacy auto-merge request');
    const tokenIndex = source.indexOf(
      'Create short-lived cleanup GitHub App token'
    );
    const disableIndex = source.indexOf('Disable legacy auto-merge request');
    const verifyIndex = source.indexOf(
      'Verify no persistent auto-merge request remains'
    );

    expect(inspectIndex).toBeGreaterThan(-1);
    expect(tokenIndex).toBeGreaterThan(inspectIndex);
    expect(disableIndex).toBeGreaterThan(tokenIndex);
    expect(verifyIndex).toBeGreaterThan(disableIndex);
    expect(source).toContain("if: steps.legacy.outputs.enabled == 'true'");
    expect(source).toContain('permission-pull-requests: write');
    expect(source).not.toContain('permission-contents: write');
    expect(source).toContain('contents: read');
    expect(source).toContain('pull-requests: read');
  });
});
