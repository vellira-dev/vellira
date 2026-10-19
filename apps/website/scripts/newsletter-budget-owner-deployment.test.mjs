import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const website = path.resolve(import.meta.dirname, '..');
const read = (name) => fs.readFileSync(path.join(website, name), 'utf8');

test('canonical website deployments have no global budget DO bindings or activation', () => {
  for (const name of ['wrangler.jsonc', 'wrangler.production.jsonc']) {
    const source = read(name);
    assert.doesNotMatch(source, /NEWSLETTER_GLOBAL_BUDGET(?:_ENABLED)?/);
    assert.doesNotMatch(source, /NewsletterBudgetCoordinator/);
    assert.doesNotMatch(source, /newsletter-budget-owner-worker/);
  }
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
