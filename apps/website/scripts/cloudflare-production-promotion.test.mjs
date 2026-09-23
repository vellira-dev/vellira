import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';
import './cloudflare-production-promotion-supersede.test.mjs';

const stagingWorkflow = await fs.readFile(
  '.github/workflows/deploy-website-cloudflare-staging.yml',
  'utf8'
);
const productionWorkflow = await fs.readFile(
  '.github/workflows/deploy-website-cloudflare-production.yml',
  'utf8'
);

function jobBlock(workflow, jobId, nextJobId) {
  const start = workflow.indexOf(`\n  ${jobId}:\n`);
  assert.notEqual(start, -1, `Missing workflow job: ${jobId}`);
  const end = nextJobId
    ? workflow.indexOf(`\n  ${nextJobId}:\n`, start + 1)
    : workflow.length;
  assert.notEqual(end, -1, `Missing following workflow job: ${nextJobId}`);
  return workflow.slice(start, end);
}

test('staging publishes a dedicated machine-readable promotion artifact', () => {
  assert.match(stagingWorkflow, /name: Publish production promotion evidence/);
  assert.match(
    stagingWorkflow,
    /name: cloudflare-staging-evidence-\$\{\{ github\.run_id \}\}-\$\{\{ github\.run_attempt \}\}/
  );
  assert.match(
    stagingWorkflow,
    /path: apps\/website\/\.open-next\/staging-evidence\.json/
  );
  assert.match(stagingWorkflow, /if-no-files-found: error/);
});

test('normal production eligibility comes only from a successful push-to-main staging run', () => {
  assert.match(productionWorkflow, /workflow_run:/);
  assert.match(
    productionWorkflow,
    /workflows: \['Deploy Website Cloudflare Staging'\]/
  );
  assert.match(productionWorkflow, /types: \[completed\]/);
  assert.match(productionWorkflow, /branches: \[main\]/);

  const candidate = jobBlock(productionWorkflow, 'candidate', 'admission');
  assert.match(candidate, /workflow_run\.conclusion == 'success'/);
  assert.match(candidate, /workflow_run\.event == 'push'/);
  assert.match(candidate, /workflow_run\.head_branch == 'main'/);
  assert.match(candidate, /actions\/download-artifact@3e5f45b2cfb9172054b4087a40e8e0b5a5461e7c/);
  assert.match(candidate, /run-id: \$\{\{ github\.event\.workflow_run\.id \}\}/);
  assert.match(candidate, /cloudflare-staging-evidence-/);
  assert.match(candidate, /cloudflare-staging-evidence\.mjs/);
});

test('production admission owns duplicate/stale cleanup before serialized deploy', () => {
  const workflowHeader = productionWorkflow.split('\njobs:\n')[0];
  assert.doesNotMatch(workflowHeader, /\nconcurrency:\n/);

  const admission = jobBlock(productionWorkflow, 'admission', 'deploy');
  assert.match(admission, /actions: read/);
  assert.match(admission, /deployments: write/);
  assert.doesNotMatch(admission, /actions: write/);
  assert.match(admission, /cache-mode: none/);
  assert.match(
    admission,
    /group: deploy-worker-vellira-website-admission\n {6}cancel-in-progress: false/
  );
  assert.match(admission, /ref: main/);
  assert.match(
    admission,
    /CURRENT_PRODUCTION_RUN_ID: \$\{\{ github\.run_id \}\}/
  );
  assert.match(
    admission,
    /EXPECTED_CANDIDATE_SHA: \$\{\{ needs\.candidate\.outputs\.candidate_sha \}\}/
  );
  assert.match(
    admission,
    /cloudflare-production-promotion-supersede\.mjs/
  );
});

test('production mutation is approval-gated and pinned to the eligible SHA', () => {
  const deploy = jobBlock(productionWorkflow, 'deploy', 'indexnow');
  assert.match(
    deploy,
    /needs: \[candidate, admission\]/
  );
  assert.match(
    deploy,
    /needs\.admission\.outputs\.admitted == 'true'/
  );
  assert.match(
    deploy,
    /group: deploy-worker-vellira-website\n {6}cancel-in-progress: false/
  );
  assert.match(deploy, /environment:\n {6}name: production/);
  assert.match(
    deploy,
    /CANDIDATE_SHA: \$\{\{ needs\.candidate\.outputs\.candidate_sha \}\}/
  );
  assert.match(deploy, /ref: \$\{\{ env\.CANDIDATE_SHA \}\}/);
  assert.match(deploy, /Verify exact production candidate checkout/);
  assert.match(deploy, /Verify immutable production candidate before mutation/);
  assert.match(deploy, /git ls-remote origin refs\/heads\/main/);
  assert.match(deploy, /test "\$current_main" = "\$CANDIDATE_SHA"/);
  assert.match(deploy, /Deploy production website to Cloudflare Workers/);
  assert.match(
    deploy,
    /node apps\/website\/scripts\/cloudflare-deploy\.mjs wrangler\.production\.jsonc/
  );
  assert.ok(
    deploy.lastIndexOf('git ls-remote origin refs/heads/main') <
      deploy.lastIndexOf('cloudflare-deploy.mjs wrangler.production.jsonc')
  );
});

test('manual recovery bypasses normal admission but keeps serialized deployment', () => {
  const admission = jobBlock(productionWorkflow, 'admission', 'deploy');
  const deploy = jobBlock(productionWorkflow, 'deploy', 'indexnow');
  assert.match(admission, /github\.event_name == 'workflow_run'/);
  assert.match(deploy, /github\.event_name == 'workflow_dispatch'/);
});

test('manual dispatch is an explicit break-glass recovery path', () => {
  assert.match(productionWorkflow, /candidate_sha:/);
  assert.match(productionWorkflow, /EMERGENCY_DEPLOY_PRODUCTION/);
  assert.doesNotMatch(productionWorkflow, /^\s+- DEPLOY_PRODUCTION$/m);
  assert.match(productionWorkflow, /source=emergency-recovery/);
});
