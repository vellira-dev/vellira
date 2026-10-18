// Pure candidate model only. No runtime wiring or provider calls.
// The Durable Object must serialize and durably persist the entire transition.
export const WINDOW_MS = 24 * 60 * 60 * 1000;

export function admitRollingNewsletterAttempt(state, capacity, now) {
  if (
    !Number.isSafeInteger(capacity) ||
    capacity < 1 ||
    !Number.isSafeInteger(now) ||
    now < 0 ||
    !state ||
    !Array.isArray(state.attempts) ||
    !Number.isSafeInteger(state.lastSeen) ||
    state.lastSeen < 0 ||
    now < state.lastSeen ||
    state.attempts.length > capacity ||
    !state.attempts.every(
      (at, index) =>
        Number.isSafeInteger(at) &&
        at >= 0 &&
        at <= state.lastSeen &&
        (index === 0 || at >= state.attempts[index - 1])
    )
  ) {
    return { outcome: 'unavailable', next: state };
  }

  // Exactly 24 hours after admission, that attempt no longer occupies a slot.
  const recent = state.attempts.filter((at) => now - at < WINDOW_MS);
  const next = { attempts: recent, lastSeen: now };
  if (recent.length >= capacity) {
    return { outcome: 'exhausted', next };
  }
  return {
    outcome: 'admitted',
    next: { attempts: [...recent, now], lastSeen: now },
  };
}

// Rejections, timeouts and provider failures never refund an admission.
// This conservative rolling-window model is NOT the provider's verified reset
// rule, and must not replace the deployed monotonic coordinator yet.
