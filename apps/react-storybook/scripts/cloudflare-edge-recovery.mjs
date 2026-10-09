const VELLIRA_EXECUTION_HEADERS = [
  'x-vellira-build-id',
  'x-vellira-worker-version',
  'x-vellira-request-id',
];

function normalizeHeaders(headers = {}) {
  return Object.fromEntries(
    Object.entries(headers).map(([name, value]) => [
      name.toLowerCase(),
      String(value),
    ])
  );
}

export function isCloudflareEdgeGeneratedGet5xx({
  status,
  method,
  headers,
}) {
  const normalized = normalizeHeaders(headers);

  return (
    String(method).toUpperCase() === 'GET' &&
    Number(status) >= 500 &&
    Number(status) < 600 &&
    normalized.server?.toLowerCase() === 'cloudflare' &&
    VELLIRA_EXECUTION_HEADERS.every((name) => !normalized[name])
  );
}

export function cloudflareEdgeReplayHeaders(headers = {}) {
  const source = normalizeHeaders(headers);
  const replay = {
    'Cache-Control': 'no-cache',
  };

  for (const name of [
    'accept',
    'rsc',
    'next-router-prefetch',
    'next-router-segment-prefetch',
    'next-router-state-tree',
    'next-url',
  ]) {
    if (source[name]) replay[name] = source[name];
  }

  return replay;
}

export function isBrowserResource5xxConsoleError(text) {
  return /^Failed to load resource: the server responded with a status of 5\d\d(?: \([^)]*\))?$/.test(
    text
  );
}

export function reconcileHandledCloudflareEdgeConsoleDiagnostics(
  diagnostics,
  handledEdgeFailureCount
) {
  if (
    !Number.isSafeInteger(handledEdgeFailureCount) ||
    handledEdgeFailureCount < 0
  ) {
    throw new Error(
      'handledEdgeFailureCount must be a non-negative integer.'
    );
  }

  const expectedCount = Math.min(
    diagnostics.length,
    handledEdgeFailureCount
  );

  return {
    expected: diagnostics.slice(0, expectedCount),
    critical: diagnostics.slice(expectedCount),
  };
}


const defaultSleep = (ms) =>
  new Promise((resolve) => setTimeout(resolve, ms));

function apiResponseStatus(response) {
  return typeof response.status === 'function'
    ? response.status()
    : response.status;
}

function apiResponseHeaders(response) {
  const value =
    typeof response.headers === 'function'
      ? response.headers()
      : response.headers ?? {};
  if (value instanceof Headers) return Object.fromEntries(value);
  return normalizeHeaders(value);
}

export async function recoverCloudflareEdgeGet5xx({
  url,
  requestHeaders = {},
  expectedBuildId,
  requestGet,
  maxAttempts = 3,
  delayMs = 1_500,
  sleep = defaultSleep,
}) {
  if (!url || typeof requestGet !== 'function') {
    throw new Error('Edge recovery requires url and requestGet.');
  }
  if (!expectedBuildId) {
    return { recovered: false, attempts: 0, reason: 'missing-build-id' };
  }
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1) {
    throw new Error('maxAttempts must be a positive integer.');
  }
  if (!Number.isFinite(delayMs) || delayMs < 0) {
    throw new Error('delayMs must be nonnegative.');
  }

  const replayHeaders = cloudflareEdgeReplayHeaders(requestHeaders);

  let lastTransportError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    let response;

    try {
      response = await requestGet(url, {
        failOnStatusCode: false,
        headers: replayHeaders,
        timeout: 10_000,
      });
    } catch (error) {
      lastTransportError =
        error instanceof Error ? error.message : String(error);

      if (attempt < maxAttempts) {
        await sleep(delayMs);
        continue;
      }

      return {
        recovered: false,
        attempts: attempt,
        reason: 'transport-error',
        error: lastTransportError,
      };
    }

    try {
      const status = apiResponseStatus(response);
      const headers = apiResponseHeaders(response);

      if (
        status >= 200 &&
        status < 300 &&
        headers['x-vellira-build-id'] === expectedBuildId
      ) {
        return { recovered: true, attempts: attempt, status };
      }

      if (
        !isCloudflareEdgeGeneratedGet5xx({
          status,
          method: 'GET',
          headers,
        })
      ) {
        return {
          recovered: false,
          attempts: attempt,
          status,
          reason: 'non-edge-or-build-mismatch',
        };
      }
    } finally {
      await response.dispose?.();
    }

    if (attempt < maxAttempts) await sleep(delayMs);
  }

  return {
    recovered: false,
    attempts: maxAttempts,
    reason: lastTransportError ? 'transport-error' : 'edge-5xx-persisted',
    ...(lastTransportError ? { error: lastTransportError } : {}),
  };
}
