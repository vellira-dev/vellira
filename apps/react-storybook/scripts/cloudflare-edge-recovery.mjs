function normalizeHeaders(headers = {}) {
  return Object.fromEntries(
    Object.entries(headers).map(([name, value]) => [
      name.toLowerCase(),
      String(value),
    ])
  );
}

export function isCloudflareEdgeGeneratedGet5xx({ status, method, headers }) {
  const normalized = normalizeHeaders(headers);

  return (
    String(method).toUpperCase() === 'GET' &&
    Number(status) >= 500 &&
    Number(status) < 600 &&
    normalized.server?.toLowerCase() === 'cloudflare' &&
    !Object.keys(normalized).some((name) => name.startsWith('x-vellira-'))
  );
}

// Platform termination pages have no application execution headers. They are
// Worker failures, even when a later independent request returns exact-build 200.
export async function readCloudflarePlatformFailure(response) {
  const headers = apiResponseHeaders(response);
  if (!headers['content-type']?.toLowerCase().includes('text/html'))
    return null;
  if (typeof response.text !== 'function') return null;
  if (Number(headers['content-length']) > 65_536)
    return {
      reason: 'edge-body-unavailable',
      error: 'Error body exceeds 64 KiB',
    };
  let timer;
  try {
    const text = await Promise.race([
      response.text(),
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(new Error('Error body deadline exceeded')),
          5_000
        );
      }),
    ]);
    if (text.length > 65_536)
      return {
        reason: 'edge-body-unavailable',
        error: 'Error body exceeds 64 KiB',
      };
    const code = text.match(
      /class=["']cf-error-code["'][^>]*>\s*(1101|1102|1019|1021|1024|1027|1042|10162)\s*</
    )?.[1];
    return code ? { reason: 'worker-platform-error', code } : null;
  } catch (error) {
    return { reason: 'edge-body-unavailable', error: String(error) };
  } finally {
    clearTimeout(timer);
  }
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
    throw new Error('handledEdgeFailureCount must be a non-negative integer.');
  }

  const expectedCount = Math.min(diagnostics.length, handledEdgeFailureCount);

  return {
    expected: diagnostics.slice(0, expectedCount),
    critical: diagnostics.slice(expectedCount),
  };
}

const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function apiResponseStatus(response) {
  return typeof response.status === 'function'
    ? response.status()
    : response.status;
}

function apiResponseHeaders(response) {
  const value =
    typeof response.headers === 'function'
      ? response.headers()
      : (response.headers ?? {});
  if (value instanceof Headers) return Object.fromEntries(value);
  return normalizeHeaders(value);
}

// Only errors from the bounded GET itself may be retried. Configuration,
// response inspection, body parsing, disposal and caller errors stay visible.
export function isTransientCloudflareTransportError(error) {
  return (
    error?.name === 'TimeoutError' ||
    (['fetch failed', 'terminated'].includes(error?.message) &&
      isTransientCloudflareTransportError(error.cause)) ||
    [
      'UND_ERR_CONNECT_TIMEOUT',
      'UND_ERR_HEADERS_TIMEOUT',
      'UND_ERR_BODY_TIMEOUT',
      'UND_ERR_SOCKET',
      'ETIMEDOUT',
      'ECONNRESET',
      'ECONNREFUSED',
      'EPIPE',
      'EAI_AGAIN',
      'ENETUNREACH',
      'EHOSTUNREACH',
    ].includes(error?.code) ||
    /^(?:apiRequestContext\.get: )?(?:Timeout \d+ms exceeded|socket hang up|read ECONNRESET|connect (?:ETIMEDOUT|ECONNREFUSED|ENETUNREACH|EHOSTUNREACH)|getaddrinfo EAI_AGAIN)/.test(
      error?.message ?? ''
    )
  );
}

// A fresh cookie jar per attempt prevents ambient browser credentials and
// Set-Cookie from one probe leaking into the next. No redirects or hidden retries.
export async function isolatedCloudflareGet(url, options) {
  const { request } = await import('@playwright/test');
  const context = await request.newContext();
  try {
    const response = await context.get(url, options);
    return {
      status: () => response.status(),
      headers: () => response.headers(),
      ok: () => response.ok(),
      json: () => response.json(),
      text: () => response.text(),
      async dispose() {
        try {
          await response.dispose();
        } finally {
          await context.dispose();
        }
      },
    };
  } catch (error) {
    await context.dispose();
    throw error;
  }
}

// Diagnostic GET transport. A returned response belongs to the caller; every
// retried/rejected response is disposed here. Static/foreign-build diagnostics
// may retry transport failures, but never HTTP failures without exact-build proof.
export async function probeCloudflareGet({
  url,
  method = 'GET',
  requestHeaders = {},
  expectedBuildId,
  retryEdge5xx = false,
  requestGet = isolatedCloudflareGet,
  maxAttempts = 3,
  delayMs = 1_500,
  sleep = defaultSleep,
}) {
  const parsed = new URL(url);
  if (
    !['http:', 'https:'].includes(parsed.protocol) ||
    parsed.username ||
    parsed.password
  ) {
    throw new Error(
      'Cloudflare probes require an HTTP(S) URL without credentials.'
    );
  }
  if (typeof requestGet !== 'function' || typeof sleep !== 'function') {
    throw new Error(
      'Cloudflare probes require requestGet and sleep functions.'
    );
  }
  if (!Number.isSafeInteger(maxAttempts) || maxAttempts < 1) {
    throw new Error('maxAttempts must be a positive integer.');
  }
  if (!Number.isFinite(delayMs) || delayMs < 0) {
    throw new Error('delayMs must be nonnegative.');
  }
  if (String(method).toUpperCase() !== 'GET') {
    return { recovered: false, attempts: 0, reason: 'non-get' };
  }
  if (retryEdge5xx && parsed.pathname.startsWith('/_next/static/')) {
    return { recovered: false, attempts: 0, reason: 'non-replayable' };
  }
  if (retryEdge5xx && !expectedBuildId?.trim()) {
    return { recovered: false, attempts: 0, reason: 'missing-build-id' };
  }
  const replayHeaders = cloudflareEdgeReplayHeaders(requestHeaders);

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    let response;
    try {
      response = await requestGet(url, {
        failOnStatusCode: false,
        headers: replayHeaders,
        timeout: 10_000,
        maxRedirects: 0,
        maxRetries: 0,
      });
    } catch (error) {
      if (!isTransientCloudflareTransportError(error)) throw error;
      if (attempt === maxAttempts) {
        return {
          recovered: false,
          attempts: attempt,
          reason: 'transport-error',
          // Playwright's full message includes request headers; retain only the
          // transport summary in logs/artifacts.
          error: String(error.message).split('\n')[0],
        };
      }
      await sleep(delayMs);
      continue;
    }

    let keepResponse = false;
    try {
      const status = apiResponseStatus(response);
      const headers = apiResponseHeaders(response);
      if (
        status >= 200 &&
        status < 300 &&
        expectedBuildId &&
        headers['x-vellira-build-id'] !== expectedBuildId
      ) {
        return {
          recovered: false,
          attempts: attempt,
          status,
          reason: 'non-edge-or-build-mismatch',
        };
      }
      if (
        !retryEdge5xx ||
        !isCloudflareEdgeGeneratedGet5xx({ status, method, headers })
      ) {
        keepResponse = true;
        return { response, attempts: attempt, status };
      }
      const platformFailure = await readCloudflarePlatformFailure(response);
      if (platformFailure)
        return {
          recovered: false,
          attempts: attempt,
          status,
          ...platformFailure,
        };
      if (attempt === maxAttempts) {
        return {
          recovered: false,
          attempts: attempt,
          status,
          reason: 'edge-5xx-persisted',
        };
      }
    } finally {
      if (!keepResponse) await response.dispose?.();
    }
    await sleep(delayMs);
  }
  throw new Error('Unreachable Cloudflare probe state.');
}

export async function recoverCloudflareEdgeGet5xx(options) {
  if (options.originalResponse) {
    const failure = await readCloudflarePlatformFailure(
      options.originalResponse
    );
    if (failure) return { recovered: false, attempts: 0, ...failure };
  }
  const result = await probeCloudflareGet({ ...options, retryEdge5xx: true });
  if (!result.response) return result;
  const { response, attempts, status } = result;
  try {
    // probeCloudflareGet has already checked the exact expected build on 2xx.
    return status >= 200 && status < 300
      ? { recovered: true, attempts, status }
      : {
          recovered: false,
          attempts,
          status,
          reason: 'non-edge-or-build-mismatch',
        };
  } finally {
    await response.dispose?.();
  }
}

export async function recoverCloudflareEdgeFailure(failure, options) {
  // A final failed proof cannot become successful through repeated cleanup calls.
  if (failure.recovery) return failure.recovery;
  if (
    new URL(failure.url).pathname.startsWith('/_next/static/') ||
    !isCloudflareEdgeGeneratedGet5xx(failure)
  ) {
    return { recovered: false, attempts: 0, reason: 'non-replayable' };
  }
  const platformFailure = await failure.platformFailure;
  if (platformFailure) {
    failure.recovery = { recovered: false, attempts: 0, ...platformFailure };
    return failure.recovery;
  }
  const result = await recoverCloudflareEdgeGet5xx({
    ...options,
    url: failure.url,
    method: failure.method,
    requestHeaders: failure.requestHeaders,
  });
  failure.recovery = result;
  if (result.recovered) failure.handled = true;
  return result;
}

// Body/status policy belongs to the diagnostic caller, not to recovery.
export async function readCloudflareDiagnosticGet(options, read) {
  const { response, ...result } = await probeCloudflareGet(options);
  if (!response) {
    throw new Error(
      `Cloudflare diagnostic GET failed: ${options.url} ${JSON.stringify(result)}`
    );
  }
  try {
    return await read(response);
  } finally {
    await response.dispose?.();
  }
}
