// Executable admission contract only. No Cloudflare binding or provider call.
// The durable coordinator must persist and serialize this transition atomically.
export function admitNewsletterAttempt(state, capacity) {
  if (
    !Number.isSafeInteger(capacity) ||
    capacity < 1 ||
    !state ||
    !Number.isSafeInteger(state.spent) ||
    state.spent < 0 ||
    state.spent > capacity
  ) {
    return { outcome: 'unavailable', next: state };
  }

  if (state.spent === capacity) {
    return { outcome: 'exhausted', next: state };
  }

  return {
    outcome: 'admitted',
    next: { ...state, spent: state.spent + 1 },
  };
}

// No refunds, automatic resets or idempotency claims are provided here.
// Epoch/reset semantics are deliberately deferred pending provider evidence.
