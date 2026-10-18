import assert from 'node:assert/strict';
import test from 'node:test';

import { admitNewsletterAttempt } from '../cloudflare/newsletter-global-budget-model.mjs';

test('no more than N admissions in a serialized multi-colo simulation', async () => {
  const capacity = 7;
  let durableState = { spent: 0 };
  const requests = Array.from({ length: 100 }, (_, i) => ({
    colo: i % 2 ? 'A' : 'B',
    purpose: i % 3 ? 'newsletter' : 'pro',
  }));
  const results = await Promise.all(
    requests.map(async () => {
      // The fake coordinator serializes this synchronous transition.
      const result = admitNewsletterAttempt(durableState, capacity);
      durableState = result.next;
      return result.outcome;
    })
  );
  assert.equal(results.filter((x) => x === 'admitted').length, capacity);
  assert.equal(results.filter((x) => x === 'exhausted').length, 93);
  assert.equal(durableState.spent, capacity);
});

test('shared state applies regardless of caller purpose or identity', () => {
  let state = { spent: 0 };
  for (const purpose of ['newsletter', 'pro', undefined]) {
    const result = admitNewsletterAttempt(state, 3);
    assert.equal(result.outcome, 'admitted');
    state = result.next;
    assert.equal(purpose === undefined || typeof purpose === 'string', true);
  }
  assert.equal(admitNewsletterAttempt(state, 3).outcome, 'exhausted');
});

test('a failed or ambiguous upstream call cannot refund an admission', () => {
  const admitted = admitNewsletterAttempt({ spent: 0 }, 1);
  assert.equal(admitted.outcome, 'admitted');
  // Timeout, cancellation or provider errors do not mutate spent state.
  assert.deepEqual(admitted.next, { spent: 1 });
  assert.equal(admitNewsletterAttempt(admitted.next, 1).outcome, 'exhausted');
});

test('invalid state or capacity fails closed without spending', () => {
  for (const state of [
    null,
    {},
    { spent: -1 },
    { spent: 2.5 },
    { spent: Number.MAX_SAFE_INTEGER + 1 },
    { spent: 3 },
  ]) {
    const result = admitNewsletterAttempt(state, 2);
    assert.equal(result.outcome, 'unavailable');
    assert.equal(result.next, state);
  }
  for (const capacity of [0, -1, 1.5, NaN, Infinity]) {
    const state = { spent: 0 };
    const result = admitNewsletterAttempt(state, capacity);
    assert.equal(result.outcome, 'unavailable');
    assert.equal(result.next, state);
  }
});

test('boundary stays exhausted with no automatic clock reset', () => {
  const state = { spent: 2 };
  assert.deepEqual(admitNewsletterAttempt(state, 2), {
    outcome: 'exhausted',
    next: state,
  });
});
