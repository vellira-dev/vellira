import assert from 'node:assert/strict';
import test from 'node:test';

import {
  transitionFixedUtcBudget,
} from '../cloudflare/newsletter-fixed-utc-migration.mjs';
import { UTC_DAY_MS } from '../cloudflare/newsletter-fixed-utc-day-model.mjs';

const emptyLegacy = { attempts: [], lastSeen: 0 };
const transition = (overrides = {}) =>
  transitionFixedUtcBudget({
    fixed: undefined,
    legacy: emptyLegacy,
    capacity: 3,
    now: 1_000,
    ...overrides,
  });

test('first cutover fences the whole UTC day even with empty legacy', () => {
  const result = transition();
  assert.equal(result.outcome, 'exhausted');
  assert.equal(result.persist, true);
  assert.deepEqual(result.next, {
    dayStart: 0,
    spent: 3,
    lastSeen: 1_000,
  });
  assert.equal(
    transition({ fixed: result.next, now: UTC_DAY_MS - 1 }).outcome,
    'exhausted'
  );
  const midnight = transition({ fixed: result.next, now: UTC_DAY_MS });
  assert.equal(midnight.outcome, 'admitted');
  assert.equal(midnight.next.spent, 1);
  assert.equal(midnight.next.dayStart, UTC_DAY_MS);
});

test('missing legacy is not evidence of unused provider quota', () => {
  const result = transition({ legacy: undefined });
  assert.equal(result.outcome, 'exhausted');
  assert.equal(result.next.spent, 3);
});

test('invalid legacy and persisted fixed states fail closed without writes', () => {
  const invalid = [
    { legacy: null },
    { legacy: { attempts: [5, 4], lastSeen: 5 } },
    { legacy: { attempts: [9_000], lastSeen: 9_000 } },
    { fixed: null },
    { fixed: { dayStart: 0, spent: -1, lastSeen: 1_000 } },
    { fixed: { dayStart: 0, spent: 4, lastSeen: 1_000 } },
  ];
  for (const input of invalid) {
    const result = transition(input);
    assert.equal(result.outcome, 'unavailable');
    assert.equal(result.persist, false);
  }
});

test('clock rollback and reduced capacity deny persisted reservations', () => {
  const fenced = transition().next;
  assert.equal(
    transition({ fixed: fenced, now: 999 }).outcome,
    'unavailable'
  );
  assert.equal(
    transition({ fixed: fenced, capacity: 2 }).outcome,
    'unavailable'
  );
});

test('serialized synthetic cutover admits zero callers until next UTC day', async () => {
  let fixed;
  let pending = Promise.resolve();
  const request = (now) => {
    const next = pending.then(() => {
      const result = transition({ fixed, now, capacity: 2 });
      if (result.persist) fixed = result.next;
      return result.outcome;
    });
    pending = next.then(() => undefined);
    return next;
  };
  const firstDay = await Promise.all(
    Array.from({ length: 20 }, () => request(5_000))
  );
  assert.deepEqual(firstDay, Array(20).fill('exhausted'));
  const secondDay = await Promise.all(
    Array.from({ length: 12 }, () => request(UTC_DAY_MS))
  );
  assert.equal(secondDay.filter((value) => value === 'admitted').length, 2);
  assert.equal(secondDay.filter((value) => value === 'exhausted').length, 10);
  assert.equal(fixed.spent, 2);
});

test('corrupted fixed state cannot be reset by crossing UTC midnight', () => {
  const corrupt = { dayStart: 0, spent: 99, lastSeen: 1_000 };
  for (const now of [1_001, UTC_DAY_MS, UTC_DAY_MS + 1_000]) {
    const result = transition({ fixed: corrupt, now });
    assert.equal(result.outcome, 'unavailable');
    assert.equal(result.persist, false);
    assert.equal(result.next, corrupt);
  }
});
