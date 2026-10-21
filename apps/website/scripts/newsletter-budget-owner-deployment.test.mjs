import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { experimental_readRawConfig } from 'wrangler';

const website = path.resolve(import.meta.dirname, '..');
const read = (name) => fs.readFileSync(path.join(website, name), 'utf8');

test('staging budget is OFF and external-only; production remains unbound', () => {
  const staging = experimental_readRawConfig({
    config: path.join(website, 'wrangler.jsonc'),
  }).rawConfig;
  const production = experimental_readRawConfig({
    config: path.join(website, 'wrangler.production.jsonc'),
  }).rawConfig;
  assert.equal(staging.vars.NEWSLETTER_GLOBAL_BUDGET_ENABLED, '0');
  assert.deepEqual(staging.durable_objects.bindings, [{
    name: 'NEWSLETTER_GLOBAL_BUDGET',
    class_name: 'NewsletterRollingBudgetCoordinator',
    script_name: 'vellira-newsletter-budget-owner',
  }]);
  assert.equal(staging.exports, undefined);
  assert.equal(staging.migrations, undefined);
  assert.doesNotMatch(read('wrangler.jsonc'), /newsletter-budget-owner-worker/);
  assert.equal(production.vars?.NEWSLETTER_GLOBAL_BUDGET_ENABLED, undefined);
  assert.equal(production.durable_objects, undefined);
  assert.doesNotMatch(read('wrangler.production.jsonc'), /NewsletterBudgetCoordinator/);
  assert.doesNotMatch(read('wrangler.production.jsonc'), /newsletter-budget-owner-worker/);
});

test('owner entry remains detached from canonical website worker', () => {
  const source = read('cloudflare-worker.mjs');
  assert.doesNotMatch(source, /newsletter-budget-owner-worker/);
  assert.doesNotMatch(source, /NewsletterBudgetCoordinator/);
});

test('future owner cannot accidentally expose the admission route publicly', () => {
  const source = read('cloudflare/newsletter-budget-owner-worker.mjs');
  assert.match(source, /status:\s*404/);
  assert.match(source, /Cache-Control['"]:\s*['"]no-store/);
  assert.doesNotMatch(source, /BUTTONDOWN_API_KEY|api\.buttondown\.com/);
});

test('no daily-reset guarantee is currently declared', () => {
  const source = read('cloudflare/newsletter-budget-coordinator.mjs');
  assert.match(source, /No reset\/window is implemented/);
});
