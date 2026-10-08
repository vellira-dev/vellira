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
