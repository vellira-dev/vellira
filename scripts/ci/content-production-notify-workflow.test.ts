import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const workflow = readFileSync(
  new URL(
    '../../.github/workflows/content-production-distribution-notify.yml',
    import.meta.url
  ),
  'utf8'
);

describe('verified production distribution notification', () => {
  it('requires successful main production deployment', () => {
    expect(workflow).toContain(
      "workflows: ['Deploy Website Cloudflare Production']"
    );
    expect(workflow).toContain('types: [completed]');
    expect(workflow).toContain('branches: [main]');
    expect(workflow).toContain(
      "github.event.workflow_run.conclusion == 'success'"
    );
    expect(workflow).toContain(
      "vars.VELLIRA_CONTENT_PRODUCTION_BRIDGE_ENABLED == 'true'"
    );
    expect(workflow).toContain(
      'Deploy and verify approved production candidate'
    );
    expect(workflow).toContain('.run_attempt == $run_attempt');
    expect(workflow).toContain('.status == "completed"');
    expect(workflow).toContain('.conclusion == "success"');
  });

  it('uses the deployed build rather than workflow checkout SHA', () => {
    expect(workflow).toContain('https://vellira.dev/__vellira_runtime');
    expect(workflow).toContain('live-runtime.json');
    expect(workflow).toContain("run_id = os.environ['SOURCE_RUN_ID']");
    expect(workflow).toContain("attempt = os.environ['SOURCE_RUN_ATTEMPT']");
    expect(workflow).toContain('candidate-sha={matched.group(1)}');
    expect(workflow).toContain("output.write(f'build-id={build_id}");
    expect(workflow).toContain(
      'CANDIDATE_SHA: ${{ steps.source.outputs.candidate-sha }}'
    );
    expect(workflow).not.toContain(
      'CANDIDATE_SHA: ${{ github.event.workflow_run.head_sha }}'
    );
  });

  it('keeps authorization and credentials scoped to the notification boundary', () => {
    expect(workflow).toContain(
      'permissions:\n  actions: read\n  contents: read'
    );
    expect(workflow).toContain('environment: content-production-notification');
    expect(workflow).toContain(
      'actions/create-github-app-token@bcd2ba49218906704ab6c1aa796996da409d3eb1'
    );
    expect(workflow).toContain('repositories: vellira-internal');
    expect(workflow).toContain('permission-contents: write');
    expect(workflow).toContain("if: steps.source.outputs.eligible == 'true'");
    expect(workflow).not.toMatch(
      /DEVTO_API_KEY|LINKEDIN_ACCESS_TOKEN|X_ACCESS_TOKEN/
    );
    expect(workflow).not.toMatch(/wrangler deploy|cloudflare-deploy\.mjs/);
  });

  it('sends only immutable source identities, no editorial or publishing approval', () => {
    expect(workflow).toContain('repos/vellira-dev/vellira-internal/dispatches');
    expect(workflow).toContain('vellira-canonical-production-verified-v1');
    for (const field of [
      'schemaVersion',
      'runId',
      'runAttempt',
      'candidateSha',
      'buildId',
    ]) {
      expect(workflow).toContain(`client_payload[${field}]`);
    }
    expect(workflow).not.toMatch(/approved_gate_ids|publication_id|approvedBy/);
  });
});
