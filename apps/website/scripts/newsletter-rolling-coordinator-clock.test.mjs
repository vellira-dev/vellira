import assert from 'node:assert/strict';
import test from 'node:test';

import { NewsletterRollingBudgetCoordinator } from '../cloudflare/newsletter-rolling-budget-coordinator.mjs';

test('rolling coordinator samples time after the transaction reads state', async () => {
  const events = [];
  const originalNow = Date.now;
  const storage = {
    transaction: async (callback) => {
      events.push('transaction');
      return callback({
        get: async () => {
          events.push('get');
          return undefined;
        },
        put: async (key, state) => {
          events.push('put');
          assert.equal(key, 'rolling-v1');
          assert.deepEqual(state.attempts, [1_000]);
          assert.equal(state.lastSeen, 1_000);
        },
      });
    },
  };
  try {
    Date.now = () => {
      events.push('now');
      return 1_000;
    };
    const coordinator = new NewsletterRollingBudgetCoordinator(
      { storage },
      { NEWSLETTER_GLOBAL_BUDGET_CAPACITY: '1' }
    );
    const response = await coordinator.fetch(
      new Request('https://budget.internal/admit', { method: 'POST' })
    );
    assert.equal(response.status, 200);
    assert.deepEqual(events, ['transaction', 'get', 'now', 'put']);
  } finally {
    Date.now = originalNow;
  }
});
