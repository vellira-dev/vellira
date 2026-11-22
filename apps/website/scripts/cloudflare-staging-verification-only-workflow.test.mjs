import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const workflow = readFileSync(
  '.github/workflows/verify-failed-website-staging-readonly.yml', 'utf8'
);

test('auto verification listens to failed main staging only', () => {
  assert.match(workflow, /workflows: \['Deploy Website Cloudflare Staging'\]/);
  assert.match(workflow, /types: \[completed\]/);
  assert.match(workflow, /branches: \[main\]/);
  assert.match(workflow, /workflow_run\.conclusion == 'failure'/);
  assert.match(workflow, /workflow_run\.event == 'push'/);
});

test('read-only job has no Cloudflare or GitHub mutation permissions', () => {
  assert.match(workflow, /permissions:\s+contents: read\s+actions: read/);
  assert.doesNotMatch(workflow, /actions: write|contents: write|wrangler deploy|CLOUDFLARE_API_TOKEN|POST |dispatches|deploy-website-cloudflare-staging\.yml/);
  assert.match(workflow, /persist-credentials: false/);
  assert.match(workflow, /ref: main/);
});

test('Cloudflare secrets and verifier run only after exact Wrangler admission', () => {
  assert.match(workflow, /cloudflare-staging-verification-only-admission\.mjs/);
  assert.match(workflow, /steps\.admission\.outputs\.eligible == 'true'/);
  assert.match(workflow, /CLOUDFLARE_WORKERS_READ_TOKEN/);
  assert.match(workflow, /cloudflare-deployment-readproof\.mjs/);
  assert.match(workflow, /workflow_run\.head_sha/);
  assert.match(workflow, /workflow_run\.run_attempt/);
});

test('read-only route diagnostics run only after deployment attestation and never promote', () => {
  const proof = workflow.indexOf('Reverify existing staging deployment via Cloudflare read-only API');
  const smoke = workflow.indexOf('Retry only the previously failed route smoke');
  const reproof = workflow.indexOf('Reconfirm Cloudflare deployment identity after route diagnostics');
  assert.ok(proof > 0 && smoke > proof && reproof > smoke);
  assert.match(workflow, /steps\.smoke\.outcome == 'success'/);
  assert.match(workflow, /cloudflare-route-smoke-readonly-retry\.mjs/);
  assert.doesNotMatch(workflow, /actions: write|contents: write|wrangler deploy|CLOUDFLARE_API_TOKEN|dispatches/);
});
