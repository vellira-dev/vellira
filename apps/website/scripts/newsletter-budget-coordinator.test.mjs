import assert from 'node:assert/strict';
import test from 'node:test';

import { NewsletterBudgetCoordinator } from '../cloudflare/newsletter-budget-coordinator.mjs';

function harness(capacity = '3') {
  let spent = 0;
  let chain = Promise.resolve();
  let failPut = false;
  const ctx = {
    storage: {
      transaction(fn) {
        const operation = chain.then(async () => {
          let pending = spent;
          const txn = {
            async get() {
              return pending;
            },
            async put(_key, value) {
              if (failPut) throw new Error('storage unavailable');
              pending = value;
            },
          };
          const result = await fn(txn);
          spent = pending;
          return result;
        });
        chain = operation.catch(() => {});
        return operation;
      },
    },
  };
  const coordinator = new NewsletterBudgetCoordinator(ctx, {
    NEWSLETTER_GLOBAL_BUDGET_CAPACITY: capacity,
  });
  const admit = () =>
    coordinator.fetch(new Request('https://internal.example/admit', { method: 'POST' }));
  return { admit, coordinator, getSpent: () => spent, failWrites: () => (failPut = true) };
}

test('serialized transaction admits at most capacity across simultaneous callers', async () => {
  const h = harness('7');
  const responses = await Promise.all(Array.from({ length: 100 }, () => h.admit()));
  assert.equal(responses.filter((r) => r.status === 200).length, 7);
  assert.equal(responses.filter((r) => r.status === 429).length, 93);
  assert.equal(h.getSpent(), 7);
  assert.ok(responses.every((r) => r.headers.get('cache-control') === 'no-store'));
});

test('durable state survives coordinator object re-instantiation', async () => {
  const h = harness('1');
  assert.equal((await h.admit()).status, 200);
  assert.equal((await h.admit()).status, 429);
  assert.equal(h.getSpent(), 1);
});

test('coordinator fails closed when persistence fails', async () => {
  const h = harness('2');
  h.failWrites();
  const response = await h.admit();
  assert.equal(response.status, 503);
  assert.equal((await response.json()).code, 'unavailable');
  assert.equal(h.getSpent(), 0);
});

test('invalid capacity and non-admission routes never spend', async () => {
  const h = harness('invalid');
  assert.equal((await h.admit()).status, 503);
  assert.equal(h.getSpent(), 0);
  const other = await h.coordinator.fetch(
    new Request('https://internal.example/status', { method: 'POST' })
  );
  assert.equal(other.status, 404);
});
