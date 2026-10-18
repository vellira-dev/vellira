import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const website = path.resolve(import.meta.dirname, '..');
const repoRoot = path.resolve(website, '../..');
const read = (name) => fs.readFileSync(path.join(website, name), 'utf8');
const plan = JSON.parse(read('cloudflare/newsletter-budget-namespace-plan.json'));
const candidate = JSON.parse(
  read('cloudflare/newsletter-budget-owner.wrangler.candidate.jsonc')
);

test('one offline owner exports only the SQLite rolling coordinator', () => {
  assert.equal(plan.schemaVersion, 1);
  assert.equal(plan.status, 'candidate-only-no-deployment');
  assert.equal(plan.owner.worker, candidate.name);
  assert.equal(candidate.main, './newsletter-budget-owner-worker.mjs');
  assert.equal(candidate.workers_dev, false);
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

test('deployed website configurations and automation remain disconnected', () => {
  for (const name of ['wrangler.jsonc', 'wrangler.production.jsonc']) {
    const config = read(name);
    assert.doesNotMatch(config, /NEWSLETTER_GLOBAL_BUDGET/);
    assert.doesNotMatch(config, /vellira-newsletter-budget-owner/);
    assert.doesNotMatch(config, /newsletter-budget-owner\.wrangler\.candidate/);
  }
  assert.doesNotMatch(read('cloudflare-worker.mjs'), /NewsletterRollingBudgetCoordinator/);

  const workflowDir = path.join(repoRoot, '.github/workflows');
  for (const filename of fs.readdirSync(workflowDir)) {
    if (!/\.ya?ml$/.test(filename)) continue;
    const workflow = fs.readFileSync(path.join(workflowDir, filename), 'utf8');
    assert.doesNotMatch(
      workflow,
      /newsletter-budget-owner\.wrangler\.candidate/,
      filename
    );
  }
});
