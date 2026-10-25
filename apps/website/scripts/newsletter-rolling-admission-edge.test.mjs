import assert from 'node:assert/strict';
import test from 'node:test';

import {
  WINDOW_MS,
  admitRollingNewsletterAttempt,
} from '../cloudflare/newsletter-rolling-window-model.mjs';

// Synthetic, provider-write-free regression scenarios. This model is not
// authoritative for Buttondown's unverified account reset semantics.
test('ambiguous upstream result does not refund a durable admission', () => {
  const first = admitRollingNewsletterAttempt(
    { attempts: [], lastSeen: 0 }, 1, 1_000
  );
  assert.equal(first.outcome, 'admitted');
  // Caller loses the provider response; it must NOT release the reservation.
  const retry = admitRollingNewsletterAttempt(first.next, 1, 1_001);
  assert.equal(retry.outcome, 'exhausted');
  assert.deepEqual(retry.next.attempts, [1_000]);
});

test('duplicate attempts consume permits rather than bypassing the quota', () => {
  let state = { attempts: [], lastSeen: 0 };
  for (let i = 0; i < 3; i++) {
    const result = admitRollingNewsletterAttempt(state, 3, 5_000 + i);
    assert.equal(result.outcome, 'admitted');
    state = result.next;
  }
  const duplicate = admitRollingNewsletterAttempt(state, 3, 5_004);
  assert.equal(duplicate.outcome, 'exhausted');
  assert.equal(duplicate.next.attempts.length, 3);
});

test('rolling boundary frees a permit only at the exact 24-hour threshold', () => {
  const state = { attempts: [1_000], lastSeen: 1_000 };
  const before = admitRollingNewsletterAttempt(state, 1, 1_000 + WINDOW_MS - 1);
  assert.equal(before.outcome, 'exhausted');
  const at = admitRollingNewsletterAttempt(before.next, 1, 1_000 + WINDOW_MS);
  assert.equal(at.outcome, 'admitted');
  assert.deepEqual(at.next.attempts, [1_000 + WINDOW_MS]);
});

test('clock rollback, malformed storage and cap reduction fail closed', () => {
  const valid = { attempts: [2_000, 2_001], lastSeen: 2_001 };
  const samples = [
    [valid, 2, 2_000],
    [valid, 1, 2_002],
    [{ attempts: [3_000, 2_000], lastSeen: 3_000 }, 3, 3_001],
    [{ attempts: null, lastSeen: 2_001 }, 3, 2_002],
    [{ attempts: [2_000], lastSeen: -1 }, 3, 2_002],
  ];
  for (const [state, capacity, now] of samples) {
    const result = admitRollingNewsletterAttempt(state, capacity, now);
    assert.equal(result.outcome, 'unavailable');
    assert.equal(result.next, state);
  }
});

test('untrusted purpose and account hints cannot select a different model budget', () => {
  let state = { attempts: [], lastSeen: 0 };
  for (const hint of ['newsletter', 'pro_launch', 'forged-account']) {
    // There is deliberately no caller-selected account/purpose argument.
    const result = admitRollingNewsletterAttempt(state, 2, 8_000);
    if (hint !== 'forged-account') {
      assert.equal(result.outcome, 'admitted');
      state = result.next;
    } else {
      assert.equal(result.outcome, 'exhausted');
    }
  }
});
