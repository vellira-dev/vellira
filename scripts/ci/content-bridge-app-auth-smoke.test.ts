import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const workflow = readFileSync(
  new URL(
    '../../.github/workflows/content-bridge-app-auth-smoke.yml',
    import.meta.url
  ),
  'utf8'
);

describe('Content Bridge GitHub App credential smoke', () => {
  it('is manual, main-only, and uses a protected Environment', () => {
    expect(workflow).toContain('workflow_dispatch:');
    expect(workflow).not.toContain('workflow_run:');
    expect(workflow).not.toContain('repository_dispatch:');
    expect(workflow).not.toContain('schedule:');
    expect(workflow).toContain("if: github.ref == 'refs/heads/main'");
    expect(workflow).toContain('environment: content-production-notification');
    expect(workflow).toContain('permissions:\n  contents: read');
    expect(workflow).toContain(
      'vars.VELLIRA_CONTENT_PRODUCTION_BRIDGE_ENABLED'
    );
    expect(workflow.indexOf('Confirm repository bridge switch')).toBeLessThan(
      workflow.indexOf('Mint short-lived single-repository GitHub App token')
    );
  });

  it('mints only the pre-existing private repo scoped app token', () => {
    expect(workflow).toContain(
      'actions/create-github-app-token@bcd2ba49218906704ab6c1aa796996da409d3eb1'
    );
    expect(workflow).toContain('vars.VELLIRA_CONTENT_BRIDGE_APP_CLIENT_ID');
    expect(workflow).toContain(
      'secrets.VELLIRA_CONTENT_BRIDGE_APP_PRIVATE_KEY'
    );
    expect(workflow).toContain('repositories: vellira-internal');
    expect(workflow).toContain('owner: vellira-dev');
    expect(workflow).toContain('permission-contents: write');
    expect(workflow).toContain(
      'installation/repositories?per_page=100'
    );
    expect(workflow).toContain('.total_count == 1');
    expect(workflow).toContain(
      '.repositories[0].full_name == "vellira-dev/vellira-internal"'
    );
  });

  it('performs only GET reads without dispatch, deploy or publication', () => {
    expect(workflow).toContain('gh api --method GET');
    expect(workflow).toContain(
      'repos/vellira-dev/vellira-internal/contents/.github/workflows/content-distribution.yml'
    );
    expect(workflow).not.toContain('--method POST');
    expect(workflow).not.toContain('gh api --method PUT');
    expect(workflow).not.toContain('repos/vellira-dev/vellira-internal/dispatches');
    expect(workflow).not.toContain('create-pull-request');
    expect(workflow).not.toContain('wrangler');
    expect(workflow).not.toContain('checkout@');
    expect(workflow).not.toMatch(/DEVTO_API_KEY|LINKEDIN_ACCESS_TOKEN/);
    expect(workflow).toContain('Repository dispatch: **NOT SENT**');
  });
});
