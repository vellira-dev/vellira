import assert from 'node:assert/strict';

export function assertCssHoldDelay(ms) {
  assert.ok(
    Number.isSafeInteger(ms) && ms >= 0 && ms <= 5_000,
    'CSS diagnostic hold must be 0..5000ms'
  );
  return ms;
}

// Only opt-in, generation B, Next's immutable CSS asset. No broad network
// delay, Playwright route interception or browser cache modification.
export function isMigrationCssRequest(request, url, generation) {
  return (
    generation === 'B' &&
    request.method === 'GET' &&
    request.headers.get('rsc') !== '1' &&
    /^\/_next\/static\/css\/[^/]+\.css$/.test(url.pathname)
  );
}

export async function observeHeldCss({
  request,
  url,
  generation,
  delayMs,
  outgoing,
  observations,
  wait,
  clock = Date.now,
}) {
  assertCssHoldDelay(delayMs);
  if (!delayMs || !isMigrationCssRequest(request, url, generation)) return true;
  const evidence = {
    generation,
    pathname: url.pathname,
    at: clock(),
    settledAt: null,
    delayMs,
    closedBeforeResponse: false,
  };
  observations.push(evidence);
  await wait(delayMs);
  evidence.settledAt = clock();
  evidence.closedBeforeResponse = outgoing.destroyed === true;
  return !evidence.closedBeforeResponse;
}

export function cssPendingAtHardNavigation(holds, documentRequestAt) {
  assert.ok(Array.isArray(holds));
  if (!Number.isFinite(documentRequestAt)) return false;
  return holds.some(
    (hold) =>
      hold.generation === 'B' &&
      Number.isFinite(hold.at) &&
      hold.at <= documentRequestAt &&
      (hold.settledAt === null || hold.settledAt > documentRequestAt)
  );
}
