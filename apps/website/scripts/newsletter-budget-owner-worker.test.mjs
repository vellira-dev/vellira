import assert from 'node:assert/strict';
import test from 'node:test';

import worker, {
  NewsletterBudgetCoordinator,
} from '../cloudflare/newsletter-budget-owner-worker.mjs';

test('unbound global budget owner has no public routes', async () => {
  const response = await worker.fetch(
    new Request('https://budget-owner.example/admit', { method: 'POST' })
  );
  assert.equal(response.status, 404);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(await response.text(), '');
});

test('owner exports the existing tested coordinator class', () => {
  assert.equal(typeof NewsletterBudgetCoordinator, 'function');
});
