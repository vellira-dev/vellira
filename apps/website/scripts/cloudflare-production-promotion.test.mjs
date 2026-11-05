import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import test from 'node:test';
import './cloudflare-production-admission.test.mjs';
import './pro-interest-live-smoke.test.mjs';

const stagingWorkflow = await fs.readFile(
  '.github/workflows/deploy-website-cloudflare-staging.yml',
  'utf8'
);
const productionWorkflow = await fs.readFile(
  '.github/workflows/deploy-website-cloudflare-production.yml',
  'utf8'
);

test('read-only recovery planning gates a separately privileged revalidated dispatch', async () => {
  const workflow = await fs.readFile(
    '.github/workflows/coordinate-website-production-recovery.yml',
    'utf8'
  );
  const header = workflow.split('\njobs:\n')[0];
  assert.match(header, /permissions:\n {2}contents: read\n {2}actions: read/);
  assert.doesNotMatch(header, /actions: write/);

  const plan = jobBlock(workflow, 'plan', 'coordinate');
  assert.match(plan, /permissions:\n {6}contents: read\n {6}actions: read/);
  assert.doesNotMatch(plan, /actions: write|secrets\./);
  assert.match(plan, /cloudflare-recovery-coordinator\.mjs plan/);
  assert.match(plan, /persist-credentials: false/);
  assert.match(plan, /ref: main/);
  assert.match(plan, /should_dispatch:/);

  const dispatcher = jobBlock(workflow, 'coordinate');
  assert.match(dispatcher, /needs: plan/);
  assert.match(dispatcher, /if: needs\.plan\.outputs\.should_dispatch == 'true'/);
  assert.match(dispatcher, /permissions:\n {6}contents: read\n {6}actions: write/);
  assert.match(dispatcher, /EXPECTED_MAIN_SHA:/);
  assert.match(dispatcher, /EXPECTED_TARGET:/);
  assert.match(dispatcher, /cloudflare-recovery-coordinator\.mjs dispatch/);
  assert.match(dispatcher, /ref: main/);
  assert.match(dispatcher, /persist-credentials: false/);

  const source = await fs.readFile(
    'apps/website/scripts/cloudflare-recovery-coordinator.mjs',
    'utf8'
  );
  assert.match(source, /mode === 'plan'/);
  assert.match(source, /mode === 'dispatch'/);
  assert.match(source, /Plan\/main SHA changed/);
  assert.match(source, /Plan\/dispatch target changed/);
  assert.ok(
    source.indexOf("if (mode === 'plan')") <
      source.indexOf("method: 'POST'")
  );
});

function jobBlock(workflow, jobId, nextJobId) {
  const start = workflow.indexOf(`\n  ${jobId}:\n`);
  assert.notEqual(start, -1, `Missing workflow job: ${jobId}`);
  const end = nextJobId
    ? workflow.indexOf(`\n  ${nextJobId}:\n`, start + 1)
    : workflow.length;
  assert.notEqual(end, -1, `Missing following workflow job: ${nextJobId}`);
  return workflow.slice(start, end);
}

test('Pro interest is an explicit manual staging preview and stays OFF on all production paths', async () => {
  const header = stagingWorkflow.split('\njobs:\n')[0];
  assert.match(header, /workflow_dispatch:\n {4}inputs:[\s\S]*?\n {6}pro_interest_preview:/);
  assert.match(header, /default: false/);

  const preview = jobBlock(stagingWorkflow, 'deploy');
  assert.ok(
    preview.includes(
      "NEXT_PUBLIC_VELLIRA_PRO_INTEREST_ENABLED: ${{ github.event_name == 'workflow_dispatch' && inputs.pro_interest_preview == true && '1' || '0' }}"
    )
  );
  assert.match(
    preview,
    /if: github\.event_name == 'workflow_dispatch' && inputs\.pro_interest_preview == true/
  );
  assert.match(preview, /test "\$GITHUB_REF" = "refs\/heads\/main"/);
  assert.match(preview, /pro-interest-live-smoke\.mjs/);
  assert.ok(
    preview.indexOf('cloudflare-runtime-contract.mjs') <
      preview.indexOf('pro-interest-live-smoke.mjs')
  );

  const candidate = jobBlock(productionWorkflow, 'candidate', 'admission');
  assert.match(candidate, /workflow_run\.event == 'push'/);
  const production = jobBlock(productionWorkflow, 'deploy', 'indexnow');
  assert.match(production, /NEXT_PUBLIC_VELLIRA_PRO_INTEREST_ENABLED: '0'/);
  assert.match(production, /pro-interest-live-smoke\.mjs/);
  assert.ok(
    production.indexOf('cloudflare-runtime-contract.mjs') <
      production.indexOf('pro-interest-live-smoke.mjs')
  );

  const websiteIgnore = await fs.readFile('apps/website/.gitignore', 'utf8');
  assert.match(websiteIgnore, /^\.dev\.vars\*$/m);

  const legacyWorkflow = await fs.readFile(
    '.github/workflows/adopt-website-cloudflare-legacy.yml',
    'utf8'
  );
  assert.match(
    legacyWorkflow,
    /NEXT_PUBLIC_VELLIRA_PRO_INTEREST_ENABLED: '0'/
  );
  assert.match(legacyWorkflow, /pro-interest-live-smoke\.mjs/);
  assert.ok(
    legacyWorkflow.indexOf('cloudflare-runtime-contract.mjs') <
      legacyWorkflow.indexOf('pro-interest-live-smoke.mjs')
  );
});

test('static chunk smoke script remains syntactically valid', () => {
  assert.doesNotThrow(() =>
    execFileSync(
      process.execPath,
      [
        '--check',
        'apps/react-storybook/scripts/cloudflare-static-chunk-smoke.mjs',
      ],
      { stdio: 'pipe' }
    )
  );
});

test('staging skips only semantically verified release-sync pushes and prioritizes the latest runtime candidate', () => {
  const workflowHeader = stagingWorkflow.split('\njobs:\n')[0];
  assert.doesNotMatch(workflowHeader, /\nconcurrency:\n/);

  const classify = jobBlock(stagingWorkflow, 'classify', 'migration');
  const migration = jobBlock(stagingWorkflow, 'migration', 'deploy');
  const deploy = jobBlock(stagingWorkflow, 'deploy', 'immediate-promotion');

  assert.match(classify, /release-sync-contract\.mjs/);
  assert.match(classify, /--classify-merged/);
  assert.match(classify, /VELLIRA_PUSH_ACTOR:/);
  assert.match(classify, /github\.event\.before/);
  assert.match(classify, /github\.actor == 'vellira-release-sync\[bot\]'/);

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

  const productionClassify = jobBlock(
    productionWorkflow,
    'classify',
    'candidate'
  );
  const candidate = jobBlock(productionWorkflow, 'candidate', 'admission');
  assert.match(productionClassify, /release-sync-contract\.mjs/);
  assert.match(productionClassify, /--classify-merged/);
  assert.match(productionClassify, /VELLIRA_PUSH_ACTOR:/);
  assert.match(candidate, /needs: classify/);
  assert.match(candidate, /needs\.classify\.outputs\.release_sync != 'true'/);
  assert.doesNotMatch(
    candidate,
    /actor\.login != 'vellira-release-sync\[bot\]'/
  );
});

test('manual recovery rejects feature preview and non-main dispatch before expensive staging', () => {
  const classify = jobBlock(stagingWorkflow, 'classify', 'migration');
  assert.ok(classify.includes('Reject unsafe production recovery inputs before staging work'));
  assert.ok(classify.includes('inputs.production_recovery == true'));
  assert.ok(classify.includes('test "$GITHUB_REF" = "refs/heads/main"'));
  assert.ok(classify.includes('test "$PRO_INTEREST_PREVIEW" != "true"'));
  assert.ok(classify.includes('test "$NEWSLETTER_ABUSE_PREVIEW" != "true"'));
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

test('manual recovery staging dispatches production immediately with bounded authority', () => {
  const handoff = jobBlock(stagingWorkflow, 'immediate-promotion');
  assert.match(handoff, /needs: \[classify, migration, deploy\]/);
  assert.match(handoff, /github\.event_name == 'workflow_dispatch'/);
  assert.match(handoff, /inputs\.production_recovery == true/);
  assert.match(handoff, /inputs\.pro_interest_preview != true/);
  assert.match(handoff, /inputs\.newsletter_abuse_preview != true/);
  assert.match(handoff, /needs\.deploy\.result == 'success'/);
  assert.match(handoff, /actions: write/);
  assert.match(handoff, /GITHUB_REF.*refs\/heads\/main/);
  assert.match(handoff, /REPLAY_VERIFIED_STAGING/);
  assert.match(handoff, /inputs\[candidate_sha\]/);
  assert.match(handoff, /inputs\[staging_run_id\]/);
  assert.match(handoff, /inputs\[staging_run_attempt\]/);
  assert.doesNotMatch(handoff, /EMERGENCY_DEPLOY_PRODUCTION/);
  const deploy = jobBlock(stagingWorkflow, 'deploy', 'immediate-promotion');
  assert.doesNotMatch(deploy, /actions: write/);
  assert.ok(
    stagingWorkflow.indexOf('Publish production promotion evidence') <
      stagingWorkflow.indexOf('\n  immediate-promotion:')
  );
});

test('production eligibility requires successful push staging or explicit verified manual recovery', () => {
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
  assert.match(candidate, /workflow_run\.event == 'workflow_dispatch'/);
  assert.match(candidate, /workflow_run\.head_branch == 'main'/);
  assert.ok(candidate.includes("github.event.workflow_run.event || steps.verified-replay.outputs.event_name"));
  assert.match(stagingWorkflow, /production_recovery:/);
  assert.match(stagingWorkflow, /productionRecovery:/);
  assert.match(
    candidate,
    /actions\/download-artifact@9000827ccba6bdab643e8b6fd33ac0654aef8333/
  );
  assert.match(candidate, /run-id:.*inputs\.staging_run_id/);
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
  assert.match(admission, /cloudflare-production-admission\.mjs/);
});

test('production approval waits outside the serialized deploy mutex', () => {
  const approval = jobBlock(productionWorkflow, 'approval', 'deploy');
  const deploy = jobBlock(productionWorkflow, 'deploy', 'indexnow');

  assert.match(approval, /needs: \[candidate, admission\]/);
  assert.match(approval, /needs\.admission\.outputs\.admitted == 'true'/);
  assert.match(approval, /environment:\n {6}name: production/);
  assert.doesNotMatch(approval, /concurrency:|secrets\./);

  assert.match(deploy, /needs: \[candidate, admission, approval\]/);
  assert.match(deploy, /needs\.approval\.result == 'success'/);
  assert.match(deploy, /needs\.admission\.outputs\.admitted == 'true'/);
  assert.match(
    deploy,
    /group: deploy-worker-vellira-website\n {6}cancel-in-progress: false/
  );
  assert.doesNotMatch(deploy, /^ {4}environment:/m);
  assert.match(
    deploy,
    /CANDIDATE_SHA: \$\{\{ needs\.candidate\.outputs\.candidate_sha \}\}/
  );
  assert.match(deploy, /ref: \$\{\{ env\.CANDIDATE_SHA \}\}/);
  assert.match(deploy, /Verify exact production candidate checkout/);
  assert.match(deploy, /Verify immutable production candidate before mutation/);
  assert.ok(deploy.includes('cloudflare-production-supersession.mjs'));
  assert.doesNotMatch(deploy, /test "\$current_main" = "\$CANDIDATE_SHA"/);
  assert.match(deploy, /GITHUB_TOKEN: \$\{\{ github\.token \}\}/);
  assert.match(deploy, /Deploy production website to Cloudflare Workers/);
  assert.match(
    deploy,
    /node apps\/website\/scripts\/cloudflare-deploy\.mjs wrangler\.production\.jsonc/
  );
  assert.ok(
    deploy.lastIndexOf('cloudflare-production-supersession.mjs') <
      deploy.lastIndexOf('cloudflare-deploy.mjs wrangler.production.jsonc')
  );
});

test('only emergency break-glass may bypass admission; verified replay may not', () => {
  const admission = jobBlock(productionWorkflow, 'admission', 'approval');
  const approval = jobBlock(productionWorkflow, 'approval', 'deploy');
  const deploy = jobBlock(productionWorkflow, 'deploy', 'indexnow');
  assert.match(admission, /github\.event_name == 'workflow_run'/);
  assert.match(admission, /REPLAY_VERIFIED_STAGING/);
  assert.match(approval, /inputs\.confirmation == 'EMERGENCY_DEPLOY_PRODUCTION'/);
  assert.match(approval, /environment:\n {6}name: production/);
  assert.match(deploy, /inputs\.confirmation == 'EMERGENCY_DEPLOY_PRODUCTION'/);
  assert.match(deploy, /needs\.approval\.result == 'success'/);
});

test('verified staging replay preserves evidence, admission and protected approval', () => {
  const candidate = jobBlock(productionWorkflow, 'candidate', 'admission');
  const admission = jobBlock(productionWorkflow, 'admission', 'approval');
  const approval = jobBlock(productionWorkflow, 'approval', 'deploy');
  const deploy = jobBlock(productionWorkflow, 'deploy', 'indexnow');
  assert.match(productionWorkflow, /REPLAY_VERIFIED_STAGING/);
  assert.match(candidate, /Verify successful staging before accepting replay/);
  assert.match(candidate, /cloudflare-verified-promotion-replay\.mjs/);
  assert.match(candidate, /cloudflare-staging-evidence\.mjs/);
  assert.match(candidate, /EXPECTED_EVENT_NAME:.*verified-replay\.outputs\.event_name/);
  assert.match(candidate, /source=staging/);
  assert.match(admission, /REPLAY_VERIFIED_STAGING/);
  assert.match(approval, /needs\.admission\.outputs\.admitted == 'true'/);
  assert.match(deploy, /needs\.admission\.outputs\.admitted == 'true'/);
  assert.doesNotMatch(approval, /github\.event_name == 'workflow_dispatch' \|\|/);
  assert.doesNotMatch(deploy, /github\.event_name == 'workflow_dispatch' \|\|/);
});

test('manual dispatch is an explicit break-glass recovery path', () => {
  assert.match(productionWorkflow, /candidate_sha:/);
  assert.match(productionWorkflow, /EMERGENCY_DEPLOY_PRODUCTION/);
  assert.doesNotMatch(productionWorkflow, /^\s+- DEPLOY_PRODUCTION$/m);
  assert.match(productionWorkflow, /source=emergency-recovery/);
});

test('staging, production and legacy adoption share browser recovery gates and retain smoke evidence', async () => {
  const legacyWorkflow = await fs.readFile(
    '.github/workflows/adopt-website-cloudflare-legacy.yml',
    'utf8'
  );
  for (const workflow of [
    stagingWorkflow,
    productionWorkflow,
    legacyWorkflow,
  ]) {
    assert.ok(
      workflow.indexOf('Install Chromium for browser smoke') <
        workflow.indexOf(
          'node apps/website/scripts/cloudflare-local-runtime.mjs'
        ),
      'real layout regression requires Chromium before the local runtime gate'
    );
    for (const gate of [
      'website-smoke',
      'navigation-soak',
      'static-chunk-smoke',
    ]) {
      assert.match(workflow, new RegExp(`scripts/cloudflare-${gate}\\.mjs`));
    }
    assert.match(workflow, /scripts\/cloudflare-edge-recovery\.test\.mjs/);
    assert.match(
      workflow,
      /Retain asset and browser forensic evidence\n\s+if: always\(\)/
    );
    assert.match(workflow, /test-results\/cloudflare-website-smoke\//);
    assert.match(workflow, /test-results\/cloudflare-soak\//);
  }
  for (const name of [
    'website-smoke',
    'browser-diagnostics',
    'navigation-soak',
    'static-chunk-smoke',
  ]) {
    const source = await fs.readFile(
      `apps/react-storybook/scripts/cloudflare-${name}.mjs`,
      'utf8'
    );
    assert.doesNotMatch(
      source,
      /context\.request\.get\(/,
      `${name} bypasses shared bounded transport`
    );
    assert.match(source, /from '\.\/cloudflare-edge-recovery\.mjs'/);
  }
  const soak = await fs.readFile(
    'apps/react-storybook/scripts/cloudflare-navigation-soak.mjs',
    'utf8'
  );
  assert.match(soak, /SOAK_ROUTER_STALE_TIME_MS \?\? 300_000/);
  assert.match(soak, /continuousDocumentMs <= routerStaleTimeMs/);
  assert.match(soak, /isSafeClientNavigationReplay\(/);
  assert.match(soak, /isRecoveredDocumentFallback\(/);
  assert.match(soak, /headers\['x-vellira-build-id'\] !== expectedBuildId/);
  assert.match(soak, /async function navigateToBlogIndex\(\)/);
  assert.match(soak, /await navigateToBlogAcrossSiteSurface\(/);
  assert.match(soak, /navigate: runRecoverableSoakNavigation/);
  assert.match(soak, /await prepareAttempt\?\.\(attempt\)/);
  assert.doesNotMatch(
    soak,
    /page\.locator\('header a\[href="\/blog"\]'\)\.first\(\)/
  );
});
