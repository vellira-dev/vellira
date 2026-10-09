import { probeCloudflareGet } from '../../react-storybook/scripts/cloudflare-edge-recovery.mjs';

// Native-fetch adapter for the same bounded GET contract used by browser gates.
// The caller retains its status/body assertions; this layer never proves success
// for a different build and never retries a static asset HTTP failure.
export async function fetchWithCloudflareEdgeRetry(
  url,
  options = {},
  {
    expectedBuildId,
    maxAttempts = 3,
    delayMs = 1_500,
    fetchImpl = fetch,
    sleepImpl,
  } = {}
) {
  if (!Number.isSafeInteger(maxAttempts) || maxAttempts < 1) {
    throw new Error('maxAttempts must be a positive integer.');
  }
  if (!Number.isFinite(delayMs) || delayMs < 0) {
    throw new Error('delayMs must be nonnegative.');
  }
  const method = String(options.method ?? 'GET').toUpperCase();
  if (method !== 'GET') {
    return { response: await fetchImpl(url, options), attempts: 1 };
  }
  const isStatic = new URL(url).pathname.startsWith('/_next/static/');
  const result = await probeCloudflareGet({
    url,
    method,
    expectedBuildId: isStatic ? undefined : expectedBuildId,
    retryEdge5xx: !isStatic,
    requestHeaders: Object.fromEntries(new Headers(options.headers)),
    maxAttempts,
    delayMs,
    ...(sleepImpl ? { sleep: sleepImpl } : {}),
    requestGet: async (target, probeOptions) => {
      const disposal = new AbortController();
      let response = await fetchImpl(target, {
        ...options,
        method: 'GET',
        headers: probeOptions.headers,
        redirect: 'manual',
        signal: AbortSignal.any([
          disposal.signal,
          AbortSignal.timeout(probeOptions.timeout),
          ...(options.signal ? [options.signal] : []),
        ]),
      });
      // Include streamed 2xx bodies in the bounded request attempt. A body
      // timeout is not successful recovery. HTTP failures remain status evidence.
      if (
        response.ok &&
        (isStatic ||
          response.headers.get('x-vellira-build-id') === expectedBuildId)
      ) {
        const bytes = await response.arrayBuffer();
        response = new Response(
          [204, 205].includes(response.status) ? null : bytes,
          {
            status: response.status,
            headers: response.headers,
          }
        );
      }
      return {
        status: response.status,
        headers: response.headers,
        native: response,
        text: () => response.text(),
        dispose: () => {
          disposal.abort();
          if (!response.body?.locked) return response.body?.cancel();
        },
      };
    },
  });
  if (!result.response) {
    throw new Error(
      `Cloudflare runtime GET failed: ${url} ${JSON.stringify(result)}`
    );
  }
  return { response: result.response.native, attempts: result.attempts };
}
