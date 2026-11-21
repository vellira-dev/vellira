import assert from 'node:assert/strict';

const routes = ['/target/prefetched', '/target/expired'];
const blockingKinds = new Set([
  'pageerror',
  'console-error',
  'window-error',
  'unhandledrejection',
]);

function pathnameOf(url) {
  try {
    return new URL(url).pathname;
  } catch {
    return null;
  }
}

function isRscPrefetchRequest(event, route) {
  if (
    event.kind !== 'request' ||
    event.rsc !== '1' ||
    event.prefetch !== '1'
  ) return false;
  try {
    const url = new URL(event.url);
    return url.pathname === route && url.searchParams.has('_rsc');
  } catch {
    return false;
  }
}

function isWebKitPrefetchPageError(event, route) {
  return (
    event.kind === 'pageerror' &&
    String(event.error ?? '').includes(`${route}?_rsc=`)
  );
}

// Observation-only. In particular, no error is classified as an acceptable
// cancellation: a real pageerror must remain a blocking test failure.
export function classifyTeardownPrefetchTrace({
  events,
  originRequests,
  oldDocument,
  navigationStartedAt,
}) {
  assert.ok(Array.isArray(events));
  assert.ok(Array.isArray(originRequests));
  assert.equal(pathnameOf(oldDocument), '/target/prefetched');
  assert.ok(Number.isFinite(navigationStartedAt));
  const documentRequest = events.find(
    (event) =>
      event.kind === 'request' &&
      event.document === true &&
      pathnameOf(event.url) === '/target/fresh' &&
      event.at >= navigationStartedAt
  );
  const hardNavigationAt = documentRequest?.at ?? null;
  const duringFallback = (event) =>
    Number.isFinite(event.at) &&
    event.at >= navigationStartedAt &&
    hardNavigationAt !== null &&
    event.at <= hardNavigationAt + 20 &&
    pathnameOf(event.pageUrl) === '/target/prefetched';
  const paths = Object.fromEntries(
    routes.map((route) => {
      const requests = events.filter(
        (event) =>
          duringFallback(event) && isRscPrefetchRequest(event, route)
      );
      const pageErrors = events.filter(
        (event) =>
          duringFallback(event) && isWebKitPrefetchPageError(event, route)
      );
      const acceptedByOrigin = originRequests.filter((request) => {
        if (!request.rsc || request.generation !== 'B') return false;
        if (
          request.at < navigationStartedAt ||
          hardNavigationAt === null ||
          request.at > hardNavigationAt + 20 ||
          request.requestHeaders?.['next-router-prefetch'] !== '1'
        ) return false;
        try {
          const url = new URL(request.url, 'http://localhost');
          return url.pathname === route && url.searchParams.has('_rsc');
        } catch {
          return false;
        }
      }).length;
      return [
        route,
        {
          status: pageErrors.length
            ? 'pageerror-before-or-during-network'
            : requests.length
              ? 'dispatched'
              : 'not-observed',
          requests: requests.length,
          pageErrors: pageErrors.length,
          acceptedByOrigin,
        },
      ];
    })
  );
  return {
    oldDocument,
    navigationStartedAt,
    hardNavigationAt,
    paths,
    bothObserved: routes.every(
      (route) => paths[route].status !== 'not-observed'
    ),
  };
}

export function assertTeardownFallbackResult(result) {
  assert.equal(result.destination, 'Target fresh B');
  assert.equal(pathnameOf(result.oldDocument), '/target/prefetched');
  assert.ok(result.teardown?.hardNavigationAt, 'No real hard navigation');
  assert.ok(result.bFlightFromGenerationB, 'Missing B RSC from Next');
  assert.ok(result.teardown.bothObserved, 'Both native prefetches not observed');
  assert.deepEqual(
    result.events.filter((event) => blockingKinds.has(event.kind)),
    [],
    'A genuine browser or script error must never be ignored'
  );
}

export function hasBlockingBrowserError(events) {
  return events.some((event) => blockingKinds.has(event.kind));
}
