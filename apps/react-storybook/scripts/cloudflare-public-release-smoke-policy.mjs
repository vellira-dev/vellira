// This is an explicitly non-critical, read-only public metadata endpoint.
// A 503 is expected ONLY when the Worker itself confirms that there is no
// trustworthy published npm version. Other errors stay fatal in browser gates.
const expectedReasons = new Set([
  'registry_unavailable',
  'registry_metadata_invalid',
  'packages_not_converged',
]);

export function isExpectedPublicReleaseUnavailableResponse({
  requestUrl,
  baseOrigin,
  method,
  resourceType,
  document,
  fromServiceWorker,
  status,
  requestHeaders = {},
  responseHeaders = {},
  expectedBuildId,
}) {
  try {
    const url = new URL(requestUrl);
    const origin = new URL(baseOrigin).origin;
    const request = Object.fromEntries(
      Object.entries(requestHeaders).map(([name, value]) => [
        name.toLowerCase(),
        value,
      ])
    );
    const headers = Object.fromEntries(
      Object.entries(responseHeaders).map(([name, value]) => [
        name.toLowerCase(),
        value,
      ])
    );

    return (
      url.origin === origin &&
      url.pathname === '/api/public-release' &&
      !url.search &&
      !url.hash &&
      method === 'GET' &&
      resourceType === 'fetch' &&
      document === false &&
      fromServiceWorker === false &&
      status === 503 &&
      ![
        'rsc',
        'next-router-prefetch',
        'next-router-segment-prefetch',
        'next-router-state-tree',
      ].some((name) => Object.hasOwn(request, name)) &&
      /^application\/json(?:;|$)/i.test(headers['content-type'] ?? '') &&
      headers['cache-control'] === 'no-store' &&
      headers['access-control-allow-origin'] === '*' &&
      headers['x-vellira-public-release-state'] === 'unavailable' &&
      expectedReasons.has(headers['x-vellira-public-release-reason']) &&
      (!expectedBuildId ||
        headers['x-vellira-build-id'] === expectedBuildId)
    );
  } catch {
    return false;
  }
}
