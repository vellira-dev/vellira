import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const workflow = fs.readFileSync(
  new URL('../../.github/workflows/content-production-distribution-notify.yml', import.meta.url),
  'utf8'
);

test('notifier waits for an already completed successful production workflow', () => {
  assert.match(workflow, /workflows: \['Deploy Website Cloudflare Production'\]/);
  assert.match(workflow, /types: \[completed\]/);
  assert.match(workflow, /branches: \[main\]/);
  assert.match(workflow, /github\.event\.workflow_run\.conclusion == 'success'/);
  assert.match(workflow, /vars\.VELLIRA_CONTENT_PRODUCTION_BRIDGE_ENABLED == 'true'/);
  assert.match(workflow, /Deploy and verify approved production candidate/);
  assert.match(workflow, /\.run_attempt == \$run_attempt/);
  assert.match(workflow, /\.status == "completed"/);
  assert.match(workflow, /\.conclusion == "success"/);
  assert.match(workflow, /https:\/\/vellira\.dev\/__vellira_runtime/);
  assert.match(workflow, /live-runtime\.json/);
  assert.match(workflow, /run_id = os\.environ\['SOURCE_RUN_ID'\]/);
  assert.match(workflow, /attempt = os\.environ\['SOURCE_RUN_ATTEMPT'\]/);
  assert.match(workflow, /candidate-sha=\{matched\.group\(1\)\}/);
  assert.doesNotMatch(
    workflow,
    /CANDIDATE_SHA: \$\{\{ github\.event\.workflow_run\.head_sha \}\}/
  );
});

test('notifier has isolated short-lived private-repo credentials', () => {
  assert.match(workflow, /permissions:\n  actions: read\n  contents: read/);
  assert.match(workflow, /environment: content-production-notification/);
  assert.match(
    workflow,
    /actions\/create-github-app-token@bcd2ba49218906704ab6c1aa796996da409d3eb1/
  );
  assert.match(workflow, /repositories: vellira-internal/);
  assert.match(workflow, /permission-contents: write/);
  assert.match(workflow, /if: steps\.source\.outputs\.eligible == 'true'/);
  assert.doesNotMatch(workflow, /DEVTO_API_KEY|LINKEDIN_ACCESS_TOKEN|X_ACCESS_TOKEN/);
  assert.doesNotMatch(workflow, /wrangler deploy|cloudflare-deploy\.mjs/);
});

test('notifier only sends immutable provenance, not publication authority', () => {
  assert.match(workflow, /repos\/vellira-dev\/vellira-internal\/dispatches/);
  assert.match(workflow, /vellira-canonical-production-verified-v1/);
  for (const field of [
    'schemaVersion',
    'runId',
    'runAttempt',
    'candidateSha',
    'buildId',
  ]) {
    assert.ok(workflow.includes(`client_payload[${field}]`));
  }
  assert.doesNotMatch(workflow, /approved_gate_ids|publication_id|approvedBy/);
});
