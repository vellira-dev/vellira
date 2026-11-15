import {
  admitFixedUtcNewsletterAttempt,
  UTC_DAY_MS,
} from './newsletter-fixed-utc-day-model.mjs';
import { admitRollingNewsletterAttempt } from './newsletter-rolling-window-model.mjs';

// Offline migration contract only. No deployed Worker imports this module.
// A first-time transition cannot infer previous provider writes or concurrent
// writers from legacy rolling-v1 state. Fence the entire current UTC day.
// The caller must persist "next" atomically BEFORE returning any admission.
export function transitionFixedUtcBudget({
  fixed,
  legacy,
  capacity,
  now,
}) {
  if (
    !Number.isSafeInteger(capacity) ||
    capacity < 1 ||
    !Number.isSafeInteger(now) ||
    now < 0
  ) {
    return { outcome: 'unavailable', next: fixed, persist: false };
  }

  if (fixed !== undefined) {
    const result = admitFixedUtcNewsletterAttempt(fixed, capacity, now);
    return {
      outcome: result.outcome,
      next: result.next,
      persist: result.outcome !== 'unavailable',
    };
  }

  // Missing legacy is not proof that the provider quota is unused.
  // Malformed legacy state fails closed; never silently reset it.
  if (legacy !== undefined) {
    const check = admitRollingNewsletterAttempt(legacy, capacity, now);
    if (check.outcome === 'unavailable') {
      return { outcome: 'unavailable', next: fixed, persist: false };
    }
  }

  const dayStart = Math.floor(now / UTC_DAY_MS) * UTC_DAY_MS;
  return {
    outcome: 'exhausted',
    next: { dayStart, spent: capacity, lastSeen: now },
    persist: true,
  };
}

// Production cutover must prove exclusive coordinator version ownership,
// serialized storage transactions, and all external writer accounting.
// Never release these pure transitions as remotely active admissions.
