import { isCloudflareEdgeGeneratedGet5xx } from '../../react-storybook/scripts/cloudflare-edge-recovery.mjs';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function fetchWithCloudflareEdgeRetry(
  url,
  options = {},
  {
    maxAttempts = 3,
    delayMs = 1_500,
    fetchImpl = fetch,
    sleepImpl = sleep,
  } = {}
) {
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1) {
    throw new Error('maxAttempts must be a positive integer.');
  }
  if (!Number.isFinite(delayMs) || delayMs < 0) {
    throw new Error('delayMs must be nonnegative.');
  }

  const method = String(options.method ?? 'GET').toUpperCase();

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const response = await fetchImpl(url, options);
    const headers = Object.fromEntries(response.headers);

    if (
      !isCloudflareEdgeGeneratedGet5xx({
        status: response.status,
        method,
        headers,
      }) ||
      attempt === maxAttempts
    ) {
      return { response, attempts: attempt };
    }

    await response.body?.cancel().catch(() => {});
    await sleepImpl(delayMs);
  }

  throw new Error('Unreachable Cloudflare edge retry state.');
}
