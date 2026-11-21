import assert from 'node:assert/strict';

// Optional, deliberately delayed *origin-side* HTTP prefetch. Never intercept
// browser requests, mock a response, or change the default migration matrix.
export function assertMigrationPrefetchDelay(ms) {
  assert.ok(
    Number.isSafeInteger(ms) && ms >= 0 && ms <= 5_000,
    'Migration diagnostic delay must be 0..5000 ms'
  );
  return ms;
}

export function isMigrationPrefetch(request, url) {
  return (
    request.method === 'GET' &&
    url.pathname === '/target/prefetched' &&
    request.headers.get('rsc') === '1' &&
    request.headers.get('next-router-prefetch') === '1'
  );
}

export async function observeHeldPrefetch({
  request,
  url,
  generation,
  delayMs,
  outgoing,
  observations,
  wait,
}) {
  assertMigrationPrefetchDelay(delayMs);
  if (!delayMs || !isMigrationPrefetch(request, url)) return true;
  const evidence = {
    at: Date.now(),
    generation,
    pathname: url.pathname,
    rsc: request.headers.get('rsc'),
    prefetch: request.headers.get('next-router-prefetch'),
    requestedDelayMs: delayMs,
    settled: false,
    closedBeforeResponse: false,
  };
  observations.push(evidence);
  await wait(delayMs);
  evidence.settled = true;
  evidence.closedBeforeResponse = Boolean(outgoing.destroyed);
  return !evidence.closedBeforeResponse;
}

// Not an allowlist: an observed console/page/window error always fails, even
// when its URL looks like a prefetch canceled during document teardown.
export function assertRapidUnloadResult(result) {
  assert.equal(result.destination, 'Target fresh B');
  assert.ok(
    result.heldAtNavigation,
    'No genuinely in-flight prefetch at hard navigation'
  );
  const errors = result.events.filter((event) =>
    ['pageerror', 'console-error', 'window-error', 'unhandledrejection'].includes(
      event.kind
    )
  );
  assert.deepEqual(errors, [], 'Real browser errors remain blocking');
}
