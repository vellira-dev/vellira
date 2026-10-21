import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { experimental_readRawConfig } from 'wrangler';

const website = path.resolve(import.meta.dirname, '..');
const repoRoot = path.resolve(website, '../..');
const read = (name) => fs.readFileSync(path.join(website, name), 'utf8');
const plan = JSON.parse(read('cloudflare/newsletter-budget-namespace-plan.json'));
const candidate = JSON.parse(
  read('cloudflare/newsletter-budget-owner.wrangler.candidate.jsonc')
);

test('one offline owner exports only the SQLite rolling coordinator', () => {
  assert.equal(plan.schemaVersion, 1);
  assert.equal(plan.status, 'private-owner-provisioned-staging-off-config-proposed');
  assert.equal(plan.owner.worker, candidate.name);
  assert.equal(candidate.main, './newsletter-budget-owner-worker.mjs');
  assert.equal(candidate.workers_dev, false);
  assert.equal(candidate.preview_urls, false);
  assert.deepEqual(Object.keys(candidate.exports), [plan.owner.className]);
  assert.deepEqual(candidate.exports[plan.owner.className], {
    type: 'durable-object',
    storage: 'sqlite',
  });

  // No public entry route, secret, activation or capacity is provisioned here.
  for (const key of [
    'routes',
    'route',
    'triggers',
    'secrets',
    'vars',
    'durable_objects',
    'migrations',
    'env',
  ]) {
    assert.equal(candidate[key], undefined, key);
  }
  const entry = read(plan.owner.entrypoint);
  assert.match(entry, /export \{ NewsletterRollingBudgetCoordinator \}/);
  assert.doesNotMatch(entry, /BUTTONDOWN_API_KEY|api\.buttondown\.com/);
});

test('staging and production must have one owner, class and object name', () => {
  assert.deepEqual(plan.targets.map((target) => target.role), [
    'staging',
    'production',
  ]);
  assert.deepEqual(plan.targets.map((target) => target.websiteWorker), [
    'vellira-website-staging',
    'vellira-website',
  ]);
  assert.equal(plan.owner.objectName, 'one-buttondown-account');
  for (const target of plan.targets) {
    assert.deepEqual(target.binding, {
      name: 'NEWSLETTER_GLOBAL_BUDGET',
      class_name: plan.owner.className,
      script_name: candidate.name,
    });
    assert.equal(target.objectName, plan.owner.objectName);
    assert.equal(target.mode, '0');
  }

  // The adapter's idFromName() key must address the exact same DO instance.
  const adapter = read('src/server/newsletter/global-budget-admission.ts');
  assert.match(adapter, /ACCOUNT_KEY = 'one-buttondown-account'/);
});

test('Buttondown account-specific quota evidence is not falsely approved', () => {
  assert.equal(plan.providerEvidence.documentedDefaultSubscriberCreatePerDay, 100);
  for (const key of [
    'actualAccountDailyQuota',
    'actualResetSemantics',
    'otherAccountWriters',
    'stagingAndProductionCredentialScope',
  ]) {
    assert.equal(plan.providerEvidence[key], 'unverified', key);
  }
  assert.equal(plan.providerEvidence.ownerApproval, 'not-granted');
});

test('staging binding targets the existing owner while budget is OFF', () => {
  const staging = experimental_readRawConfig({
    config: path.join(website, 'wrangler.jsonc'),
  }).rawConfig;
  const production = experimental_readRawConfig({
    config: path.join(website, 'wrangler.production.jsonc'),
  }).rawConfig;
  assert.equal(staging.name, plan.targets[0].websiteWorker);
  assert.equal(staging.vars.NEWSLETTER_GLOBAL_BUDGET_ENABLED, '0');
  assert.deepEqual(staging.durable_objects?.bindings, [plan.targets[0].binding]);
  assert.equal(staging.exports, undefined);
  assert.equal(staging.migrations, undefined);
  assert.equal(production.name, plan.targets[1].websiteWorker);
  assert.equal(production.vars?.NEWSLETTER_GLOBAL_BUDGET_ENABLED, undefined);
  assert.equal(production.durable_objects, undefined);
  assert.equal(production.exports, undefined);
  assert.equal(production.migrations, undefined);
});

test('website runtime has no owner class and workflows cannot auto-reprovision', () => {
  assert.doesNotMatch(read('wrangler.production.jsonc'), /NEWSLETTER_GLOBAL_BUDGET/);
  assert.doesNotMatch(read('wrangler.production.jsonc'), /vellira-newsletter-budget-owner/);
  assert.doesNotMatch(read('wrangler.jsonc'), /newsletter-budget-owner[.]wrangler[.]candidate/);
  assert.doesNotMatch(read('cloudflare-worker.mjs'), /NewsletterRollingBudgetCoordinator/);

  const workflowDir = path.join(repoRoot, '.github/workflows');
  for (const filename of fs.readdirSync(workflowDir)) {
    if (!/\.ya?ml$/.test(filename)) continue;
    // The only permitted deployment-capable reference is a manually dispatched,
    // explicit human-approved private owner provisioning workflow.
    if (filename === 'provision-newsletter-budget-owner.yml') continue;
    const workflow = fs.readFileSync(path.join(workflowDir, filename), 'utf8');
    assert.doesNotMatch(
      workflow,
      /newsletter-budget-owner\.wrangler\.candidate/,
      filename
    );
  }
});

function validateOwnerProvisioningWorkflow(source) {
  assert.match(source, /^on:\n {2}workflow_dispatch:\n/m);
  assert.doesNotMatch(source, /^\s{2}(?:push|pull_request|workflow_run|schedule):/m);
  assert.match(source, /^permissions:\n {2}contents: read\n/m);
  assert.match(source, /default: preflight/);
  assert.match(source, /expected_sha:/);
  assert.match(source, /PROVISION_PRIVATE_BUDGET_OWNER/);
  const preflight = source.split(/^ {2}preflight:\n/m)[1]?.split(/^ {2}approval:\n/m)[0];
  const approval = source.split(/^ {2}approval:\n/m)[1]?.split(/^ {2}provision:\n/m)[0];
  const provision = source.split(/^ {2}provision:\n/m)[1];
  assert.ok(preflight && approval && provision);
  assert.match(preflight, /if: github\.ref == 'refs\/heads\/main'/);
  assert.match(preflight, /test "\$EXPECTED_SHA" = "\$GITHUB_SHA"/);
  assert.match(preflight, /test "\$CONFIRMATION" = "PROVISION_PRIVATE_BUDGET_OWNER"/);
  assert.match(preflight, /newsletter-owner-wrangler-dry-run\.test\.mjs/);
  assert.doesNotMatch(preflight, /secrets\./);
  assert.match(approval, /environment:\n {6}name: production/);
  assert.doesNotMatch(approval, /secrets\./);
  assert.match(provision, /needs: \[preflight, approval\]/);
  assert.match(provision, /needs\.approval\.result == 'success'/);
  assert.match(provision, /main advanced since manual approval/);
  assert.match(provision, /workerPresence\['vellira-newsletter-budget-owner'\], 'absent'/);
  assert.match(provision, /wrangler deploy --config cloudflare\/newsletter-budget-owner\.wrangler\.candidate\.jsonc/);
  assert.match(provision, /workerPresence\['vellira-newsletter-budget-owner'\], 'present'/);
  assert.match(provision, /owner\.previewsEnabled, false/);
  assert.match(provision, /globalBudgetBindingInServingVersions, false/);
  assert.equal((source.match(/wrangler deploy --config/g) ?? []).length, 1);
  assert.doesNotMatch(source, /BUTTONDOWN_API_KEY|api\.buttondown\.com/);
  assert.doesNotMatch(source, /NEWSLETTER_GLOBAL_BUDGET_ENABLED/);
}

test('private owner workflow requires manual approved provision and no site activation', () => {
  const source = fs.readFileSync(
    path.join(repoRoot, '.github/workflows/provision-newsletter-budget-owner.yml'),
    'utf8'
  );
  validateOwnerProvisioningWorkflow(source);
  for (const changed of [
    source.replace('  workflow_dispatch:', '  push:'),
    source.replace('default: preflight', 'default: provision'),
    source.replace('      name: production', '      name: staging'),
    source.replace('needs: [preflight, approval]', 'needs: preflight'),
    source.replace(
      'test "$CONFIRMATION" = "PROVISION_PRIVATE_BUDGET_OWNER"',
      'test "$CONFIRMATION" = "BYPASS_CONFIRMATION"'
    ),
  ]) {
    assert.throws(() => validateOwnerProvisioningWorkflow(changed));
  }
});
