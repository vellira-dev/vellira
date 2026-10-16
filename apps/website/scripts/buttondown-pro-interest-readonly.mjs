import { pathToFileURL } from 'node:url';

export const PRO_CAMPAIGN = 'vellira_pro_launch_interest';

const SUBSCRIBERS_ENDPOINT = 'https://api.buttondown.com/v1/subscribers';
const TIMEOUT_MS = 10_000;
const QUERIES = [
  { key: 'all', type: null },
  { key: 'regular', type: 'regular' },
  { key: 'unactivated', type: 'unactivated' },
];

function auditError(message) {
  const error = new Error(message);
  error.name = 'ButtondownReadOnlyAuditError';
  return error;
}

function parseFilteredCount(payload, type) {
  if (
    typeof payload !== 'object' ||
    payload === null ||
    Array.isArray(payload) ||
    !Number.isSafeInteger(payload.count) ||
    payload.count < 0 ||
    !Array.isArray(payload.results) ||
    payload.results.length > payload.count
  ) {
    throw auditError('Invalid subscriber count response');
  }

  // Only inspect the first page in memory. Never log subscriber details.
  for (const subscriber of payload.results) {
    if (
      subscriber?.utm_campaign !== PRO_CAMPAIGN ||
      (type !== null && subscriber.type !== type)
    ) {
      throw auditError('Provider filter did not match the returned subscribers');
    }
  }

  return payload.count;
}

/**
 * Read only. Three GETs with server-side campaign/type filters.
 * Returned subscriber records are never printed, saved, or exported.
 * The caller supplies an existing API key from its local environment.
 */
export async function auditButtondownProInterest({ apiKey, fetcher = fetch }) {
  if (typeof apiKey !== 'string' || !apiKey.trim()) {
    throw auditError('BUTTONDOWN_API_KEY must be set in the local environment');
  }

  const counts = {};
  for (const { key, type } of QUERIES) {
    const url = new URL(SUBSCRIBERS_ENDPOINT);
    url.searchParams.set('utm_campaign', PRO_CAMPAIGN);
    if (type !== null) url.searchParams.set('type', type);

    let response;
    try {
      response = await fetcher(url, {
        method: 'GET',
        headers: {
          Authorization: 'Token ' + apiKey,
          Accept: 'application/json',
        },
        cache: 'no-store',
        redirect: 'error',
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch {
      throw auditError('Buttondown read-only request failed');
    }

    if (!response.ok) {
      // Never echo provider response bodies or request headers.
      throw auditError(
        'Buttondown read-only API returned HTTP ' + String(response.status)
      );
    }

    let payload;
    try {
      payload = await response.json();
    } catch {
      throw auditError('Buttondown returned an invalid JSON response');
    }

    counts[key] = parseFilteredCount(payload, type);
  }

  if (counts.regular + counts.unactivated > counts.all) {
    throw auditError('Provider returned inconsistent filtered counts');
  }

  return {
    schemaVersion: 1,
    source: 'buttondown-subscriber-list',
    campaign: PRO_CAMPAIGN,
    total: counts.all,
    confirmedRegular: counts.regular,
    awaitingConfirmation: counts.unactivated,
    otherStatuses: counts.all - counts.regular - counts.unactivated,
    requests: 3,
    writes: 0,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const result = await auditButtondownProInterest({
      apiKey: process.env.BUTTONDOWN_API_KEY,
    });
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(
      error?.name === 'ButtondownReadOnlyAuditError'
        ? error.message
        : 'Buttondown read-only audit failed'
    );
    process.exitCode = 1;
  }
}
