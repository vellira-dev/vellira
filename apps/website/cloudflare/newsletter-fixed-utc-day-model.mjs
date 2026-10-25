// Candidate-only fixed UTC-day quota model. No deployed Worker imports this file.
// Buttondown support confirmed daily reset at 00:00 UTC for this newsletter.
export const UTC_DAY_MS = 86_400_000;

export function admitFixedUtcNewsletterAttempt(state, capacity, now) {
  if (
    !Number.isSafeInteger(capacity) ||
    capacity < 1 ||
    !Number.isSafeInteger(now) ||
    now < 0 ||
    !state ||
    !Number.isSafeInteger(state.dayStart) ||
    !Number.isSafeInteger(state.spent) ||
    !Number.isSafeInteger(state.lastSeen) ||
    state.dayStart < 0 ||
    state.dayStart % UTC_DAY_MS !== 0 ||
    state.spent < 0 ||
    state.lastSeen < 0 ||
    now < state.lastSeen ||
    state.dayStart > state.lastSeen ||
    state.dayStart !== Math.floor(state.lastSeen / UTC_DAY_MS) * UTC_DAY_MS ||
    state.spent > capacity
  ) {
    return { outcome: 'unavailable', next: state };
  }

  const dayStart = Math.floor(now / UTC_DAY_MS) * UTC_DAY_MS;
  const spent = dayStart === state.dayStart ? state.spent : 0;
  const next = { dayStart, spent, lastSeen: now };
  if (spent >= capacity) {
    return { outcome: 'exhausted', next };
  }
  return {
    outcome: 'admitted',
    next: { dayStart, spent: spent + 1, lastSeen: now },
  };
}

// Admissions are spent before provider POST; no refund on ambiguous responses.
// This model is NOT wired to staging or production, and does not determine
// the owner-approved capacity/reserve or account-wide external-writer usage.
