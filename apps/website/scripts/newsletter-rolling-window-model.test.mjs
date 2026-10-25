import assert from 'node:assert/strict';
import test from 'node:test';

import {
  admitRollingNewsletterAttempt,
  WINDOW_MS,
} from '../cloudflare/newsletter-rolling-window-model.mjs';

const empty = () => ({ attempts: [], lastSeen: 0 });

test('one rolling window admits exactly the configured attempt budget', () => {
  let state = empty();
  for (let i = 0; i < 7; i++) {
    const result = admitRollingNewsletterAttempt(state, 7, 1_000);
    assert.equal(result.outcome, 'admitted');
    state = result.next;
  }
  assert.equal(state.attempts.length, 7);
  assert.equal(admitRollingNewsletterAttempt(state, 7, 1_001).outcome, 'exhausted');
});

test('budget does not reset at a UTC calendar boundary', () => {
  const beforeMidnight = Date.UTC(2026, 9, 18, 23, 59, 59);
  const admitted = admitRollingNewsletterAttempt(empty(), 1, beforeMidnight);
  assert.equal(admitted.outcome, 'admitted');
  const midnight = Date.UTC(2026, 9, 19, 0, 0, 1);
  assert.equal(
    admitRollingNewsletterAttempt(admitted.next, 1, midnight).outcome,
    'exhausted'
  );
});

test('the slot expires at exactly 24 hours, not a second before', () => {
  const start = 100_000;
  const admitted = admitRollingNewsletterAttempt(empty(), 1, start);
  assert.equal(
    admitRollingNewsletterAttempt(admitted.next, 1, start + WINDOW_MS - 1)
      .outcome,
    'exhausted'
  );
  const renewed = admitRollingNewsletterAttempt(
    admitted.next,
    1,
    start + WINDOW_MS
  );
  assert.equal(renewed.outcome, 'admitted');
  assert.deepEqual(renewed.next.attempts, [start + WINDOW_MS]);
});

test('backwards clocks and corrupted persisted state fail closed', () => {
  const admitted = admitRollingNewsletterAttempt(empty(), 2, 1_000);
  for (const [state, now] of [
    [admitted.next, 999],
    [{ attempts: [500, 400], lastSeen: 1_000 }, 1_001],
    [{ attempts: [-1], lastSeen: 1_000 }, 1_001],
    [{ attempts: [2_000], lastSeen: 1_000 }, 2_000],
    [{ attempts: [1, 2, 3], lastSeen: 1_000 }, 1_001],
  ]) {
    assert.equal(admitRollingNewsletterAttempt(state, 2, now).outcome, 'unavailable');
  }
});

test('invalid capacity and timestamp cannot admit a subscriber attempt', () => {
  for (const capacity of [0, -1, 1.5, Infinity, NaN]) {
    assert.equal(
      admitRollingNewsletterAttempt(empty(), capacity, 1_000).outcome,
      'unavailable'
    );
  }
  for (const now of [-1, 1.5, Infinity, NaN]) {
    assert.equal(
      admitRollingNewsletterAttempt(empty(), 1, now).outcome,
      'unavailable'
    );
  }
});

test('ambiguous provider outcome never refunds spent capacity', () => {
  const admitted = admitRollingNewsletterAttempt(empty(), 1, 1_000);
  assert.equal(admitted.outcome, 'admitted');
  assert.equal(
    admitRollingNewsletterAttempt(admitted.next, 1, 2_000).outcome,
    'exhausted'
  );
  assert.deepEqual(admitted.next.attempts, [1_000]);
});

import {
  admitFixedUtcNewsletterAttempt,
  UTC_DAY_MS,
} from '../cloudflare/newsletter-fixed-utc-day-model.mjs';

const fixedEmpty = () => ({ dayStart: 0, spent: 0, lastSeen: 0 });

test('fixed UTC budget resets at midnight rather than after rolling 24 hours', () => {
  const before = UTC_DAY_MS - 1;
  const first = admitFixedUtcNewsletterAttempt(fixedEmpty(), 1, before);
  assert.equal(first.outcome, 'admitted');
  assert.equal(
    admitFixedUtcNewsletterAttempt(first.next, 1, before).outcome,
    'exhausted'
  );
  const after = admitFixedUtcNewsletterAttempt(first.next, 1, UTC_DAY_MS);
  assert.equal(after.outcome, 'admitted');
  assert.deepEqual(after.next, {
    dayStart: UTC_DAY_MS,
    spent: 1,
    lastSeen: UTC_DAY_MS,
  });
});

test('fixed UTC budget never refunds ambiguous upstream outcomes', () => {
  const first = admitFixedUtcNewsletterAttempt(fixedEmpty(), 1, 1_000);
  assert.equal(first.outcome, 'admitted');
  const retry = admitFixedUtcNewsletterAttempt(first.next, 1, 2_000);
  assert.equal(retry.outcome, 'exhausted');
  assert.equal(retry.next.spent, 1);
});

test('fixed UTC budget rejects bad state, lowered capacity and clock rollback', () => {
  const first = admitFixedUtcNewsletterAttempt(fixedEmpty(), 2, 2_000);
  assert.equal(first.outcome, 'admitted');
  const invalid = [
    [first.next, 0, 2_001],
    [first.next, 1, 1_999],
    [{ dayStart: 1, spent: 0, lastSeen: 2_000 }, 2, 2_001],
    [{ dayStart: 0, spent: -1, lastSeen: 2_000 }, 2, 2_001],
    [{ dayStart: 0, spent: 3, lastSeen: 2_000 }, 2, 2_001],
    [{ dayStart: 0, spent: 0, lastSeen: UTC_DAY_MS }, 2, UTC_DAY_MS],
  ];
  for (const [state, capacity, now] of invalid) {
    assert.equal(
      admitFixedUtcNewsletterAttempt(state, capacity, now).outcome,
      'unavailable'
    );
  }
});

test('fixed UTC budget has one conservative spent counter per day', () => {
  let state = fixedEmpty();
  for (let i = 0; i < 5; i += 1) {
    const result = admitFixedUtcNewsletterAttempt(state, 5, i + 1);
    assert.equal(result.outcome, 'admitted');
    state = result.next;
  }
  assert.equal(state.spent, 5);
  assert.equal(
    admitFixedUtcNewsletterAttempt(state, 5, 100).outcome,
    'exhausted'
  );
});
