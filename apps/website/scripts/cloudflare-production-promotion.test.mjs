import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';
import './cloudflare-production-admission.test.mjs';

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

test('staging skips only semantically verified release-sync pushes and prioritizes the latest runtime candidate', () => {
  const workflowHeader = stagingWorkflow.split('\njobs:\n')[0];
  assert.doesNotMatch(workflowHeader, /\nconcurrency:\n/);

  const classify = jobBlock(stagingWorkflow, 'classify', 'migration');
  const migration = jobBlock(stagingWorkflow, 'migration', 'deploy');
  const deploy = jobBlock(stagingWorkflow, 'deploy');

  assert.match(classify, /release-sync-contract\.mjs/);
  assert.match(classify, /--verify-merged/);
  assert.match(classify, /VELLIRA_PUSH_ACTOR:/);
  assert.match(classify, /github\.event\.before/);
  assert.match(
    classify,
    /github\.actor == 'vellira-release-sync\[bot\]'/
  );

  assert.match(migration, /needs: classify/);
  assert.match(
    migration,
    /if: needs\.classify\.outputs\.release_sync != 'true'/
  );
  assert.match(
    migration,
    /group: deploy-worker-vellira-website-staging-prepare\n {6}cancel-in-progress: true/
  );

  assert.match(deploy, /needs: \[classify, migration\]/);
  assert.match(
    deploy,
    /needs\.classify\.outputs\.release_sync != 'true' && needs\.migration\.result == 'success'/
  );
  assert.match(
    deploy,
    /group: deploy-worker-vellira-website-staging\n {6}cancel-in-progress: false/
  );

  assert.match(
    migration,
    /image: mcr\.microsoft\.com\/playwright:v1\.61\.1-noble/
  );
  assert.match(migration, /pnpm test:cloudflare-migration/);
  assert.doesNotMatch(migration, /playwright install(?: --with-deps)?/);
  assert.doesNotMatch(migration, /cloudflare-archive-preflight\.mjs/);
  assert.doesNotMatch(migration, /CLOUDFLARE_API_TOKEN/);

  assert.match(deploy, /cloudflare-archive-preflight\.mjs wrangler\.jsonc/);
  assert.doesNotMatch(deploy, /Install migration regression browsers/);
  assert.doesNotMatch(deploy, /pnpm test:cloudflare-migration/);

  const productionClassify = jobBlock(productionWorkflow, 'classify', 'candidate');
  const candidate = jobBlock(productionWorkflow, 'candidate', 'admission');
  assert.match(productionClassify, /release-sync-contract\.mjs/);
  assert.match(productionClassify, /--verify-merged/);
  assert.match(productionClassify, /VELLIRA_PUSH_ACTOR:/);
  assert.match(candidate, /needs: classify/);
  assert.match(
    candidate,
    /needs\.classify\.outputs\.release_sync != 'true'/
  );
  assert.doesNotMatch(
    candidate,
    /actor\.login != 'vellira-release-sync\[bot\]'/
  );
});

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
  assert.match(candidate, /needs: classify/);
  assert.match(candidate, /needs\.classify\.result == 'success'/);
  assert.match(candidate, /needs\.classify\.outputs\.release_sync != 'true'/);
  assert.match(candidate, /workflow_run\.conclusion == 'success'/);
  assert.match(candidate, /workflow_run\.event == 'push'/);
  assert.match(candidate, /workflow_run\.head_branch == 'main'/);
  assert.match(candidate, /actions\/download-artifact@3e5f45b2cfb9172054b4087a40e8e0b5a5461e7c/);
  assert.match(candidate, /run-id: \$\{\{ github\.event\.workflow_run\.id \}\}/);
  assert.match(candidate, /cloudflare-staging-evidence-/);
  assert.match(candidate, /cloudflare-staging-evidence\.mjs/);
});

test('production admission remains read-only before protected approval', () => {
  const workflowHeader = productionWorkflow.split('\njobs:\n')[0];
  assert.doesNotMatch(workflowHeader, /\nconcurrency:\n/);

  const admission = jobBlock(productionWorkflow, 'admission', 'approval');
  assert.match(admission, /actions: read/);
  assert.doesNotMatch(admission, /actions: write|deployments: write/);
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
    /cloudflare-production-admission\.mjs/
  );
});

test('production approval waits outside the serialized deploy mutex', () => {
  const approval = jobBlock(productionWorkflow, 'approval', 'deploy');
  const deploy = jobBlock(productionWorkflow, 'deploy', 'indexnow');

  assert.match(approval, /needs: \[candidate, admission\]/);
  assert.match(
    approval,
    /needs\.admission\.outputs\.admitted == 'true'/
  );
  assert.match(approval, /environment:\n {6}name: production/);
  assert.doesNotMatch(approval, /concurrency:|secrets\./);

  assert.match(
    deploy,
    /needs: \[candidate, admission, approval\]/
  );
  assert.match(deploy, /needs\.approval\.result == 'success'/);
  assert.match(
    deploy,
    /needs\.admission\.outputs\.admitted == 'true'/
  );
  assert.match(
    deploy,
    /group: deploy-worker-vellira-website\n {6}cancel-in-progress: false/
  );
  assert.doesNotMatch(deploy, /^    environment:/m);
  assert.match(
    deploy,
    /CANDIDATE_SHA: \$\{\{ needs\.candidate\.outputs\.candidate_sha \}\}/
  );
  assert.match(deploy, /ref: \$\{\{ env\.CANDIDATE_SHA \}\}/);
  assert.match(deploy, /Verify exact production candidate checkout/);
  assert.match(deploy, /Verify immutable production candidate before mutation/);
  assert.match(
    deploy,
    /cloudflare-production-freshness\.mjs apps\/website\/wrangler\.production\.jsonc/
  );
  assert.doesNotMatch(deploy, /test "\$current_main" = "\$CANDIDATE_SHA"/);
  assert.match(deploy, /GITHUB_TOKEN: \$\{\{ github\.token \}\}/);
  assert.match(deploy, /Deploy production website to Cloudflare Workers/);
  assert.match(
    deploy,
    /node apps\/website\/scripts\/cloudflare-deploy\.mjs wrangler\.production\.jsonc/
  );
  assert.ok(
    deploy.lastIndexOf('cloudflare-production-freshness.mjs') <
      deploy.lastIndexOf('cloudflare-deploy.mjs wrangler.production.jsonc')
  );
});

test('manual recovery bypasses normal admission but still crosses protected approval', () => {
  const admission = jobBlock(productionWorkflow, 'admission', 'approval');
  const approval = jobBlock(productionWorkflow, 'approval', 'deploy');
  const deploy = jobBlock(productionWorkflow, 'deploy', 'indexnow');
  assert.match(admission, /github\.event_name == 'workflow_run'/);
  assert.match(approval, /github\.event_name == 'workflow_dispatch'/);
  assert.match(approval, /environment:\n {6}name: production/);
  assert.match(deploy, /github\.event_name == 'workflow_dispatch'/);
  assert.match(deploy, /needs\.approval\.result == 'success'/);
});

test('manual dispatch is an explicit break-glass recovery path', () => {
  assert.match(productionWorkflow, /candidate_sha:/);
  assert.match(productionWorkflow, /EMERGENCY_DEPLOY_PRODUCTION/);
  assert.doesNotMatch(productionWorkflow, /^\s+- DEPLOY_PRODUCTION$/m);
  assert.match(productionWorkflow, /source=emergency-recovery/);
});
