import { pathToFileURL } from 'node:url';

// Read-only Buttondown API request metadata audit.
// Never print/persist raw API request entries, IPs, key IDs, labels or tokens.
export const API_REQUESTS_ENDPOINT = 'https://api.buttondown.com/v1/api_requests';
export const LOOKBACK_DAYS = 7;
const SUBSCRIBER_PATH = '/v1/subscribers';
const PAGE_LIMIT = 100;
const MAX_PAGES = 5;
const TIMEOUT_MS = 10_000;
const DAY_MS = 86_400_000;
const SOURCES = new Set([
  'api', 'app', 'axios', 'carrd', 'claude', 'cli', 'curl', 'cursor',
  'gemini', 'go', 'llm', 'make', 'netlify', 'node', 'openai',
  'perplexity', 'pipedream', 'powershell', 'python', 'ruby',
  'windsurf', 'wordpress', 'zapier',
]);

function auditError(code) {
  const error = new Error(code);
  error.name = 'ButtondownApiRequestAuditError';
  return error;
}

// Only fixed, non-sensitive status categories can appear in diagnostics.
// Never echo the provider response body, URL, headers, or request metadata.
function readOnlyFailureMessage(status) {
  switch (status) {
    case 400:
      return 'Buttondown read-only API HTTP 400: request or filters rejected';
    case 401:
      return 'Buttondown read-only API HTTP 401: authentication rejected';
    case 403:
      return 'Buttondown read-only API HTTP 403: access denied (check key permissions)';
    case 404:
      return 'Buttondown read-only API HTTP 404: endpoint unavailable';
    case 429:
      return 'Buttondown read-only API HTTP 429: request rate limited';
    case 500:
    case 502:
    case 503:
    case 504:
      return 'Buttondown read-only API HTTP 5xx: provider unavailable';
    default:
      return 'Buttondown read-only API returned unexpected HTTP status';
  }
}

function assertPage(payload, page, totalSoFar, start, end, seenIds) {
  if (
    !payload ||
    typeof payload !== 'object' ||
    Array.isArray(payload) ||
    !Number.isSafeInteger(payload.count) ||
    payload.count < 0 ||
    !Array.isArray(payload.results) ||
    payload.results.length > PAGE_LIMIT ||
    totalSoFar + payload.results.length > payload.count
  ) {
    throw auditError('Invalid or inconsistent API request page');
  }

  const items = [];
  for (const entry of payload.results) {
    if (
      !entry ||
      typeof entry !== 'object' ||
      Array.isArray(entry) ||
      typeof entry.id !== 'string' ||
      !entry.id ||
      seenIds.has(entry.id) ||
      entry.method !== 'POST' ||
      entry.path !== SUBSCRIBER_PATH ||
      !Number.isSafeInteger(entry.status_code) ||
      entry.status_code < 100 ||
      entry.status_code > 599 ||
      typeof entry.creation_date !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(entry.creation_date) ||
      !Number.isFinite(Date.parse(entry.creation_date)) ||
      Date.parse(entry.creation_date) <= start ||
      Date.parse(entry.creation_date) >= end ||
      (entry.api_key_id != null && typeof entry.api_key_id !== 'string')
    ) {
      throw auditError('API request record failed filtered scope validation');
    }
    seenIds.add(entry.id);
    items.push({
      timestamp: Date.parse(entry.creation_date),
      status: entry.status_code,
      source: SOURCES.has(entry.source) ? entry.source : 'unknown',
    });
  }

  const next = payload.next;
  if (next !== null && next !== undefined) {
    if (typeof next !== 'string') {
      throw auditError('Invalid API request pagination');
    }
    let link;
    try {
      link = new URL(next, API_REQUESTS_ENDPOINT);
    } catch {
      throw auditError('Invalid API request pagination');
    }
    // Never follow links supplied by Buttondown or any proxy. Always generate
    // the next URL locally with immutable GET filters.
    if (
      link.origin !== new URL(API_REQUESTS_ENDPOINT).origin ||
      link.pathname !== new URL(API_REQUESTS_ENDPOINT).pathname ||
      link.searchParams.get('page') !== String(page + 1)
    ) {
      throw auditError('Unexpected API request pagination target');
    }
  }
  return { items, count: payload.count, hasNext: next != null };
}

function statusBucket(status) {
  if (status >= 200 && status < 300) return 'success2xx';
  if (status === 400) return 'http400';
  if (status === 429) return 'http429';
  if (status >= 400 && status < 500) return 'other4xx';
  if (status >= 500) return 'server5xx';
  return 'other';
}

function sourceBucket(source) {
  if (source === 'api') return 'api';
  if (source === 'app') return 'app';
  if (source === 'unknown') return 'unknown';
  return 'integrationOrClient';
}

export async function auditButtondownApiRequests({
  apiKey,
  fetcher = fetch,
  now = new Date(),
} = {}) {
  if (typeof apiKey !== 'string' || !apiKey.trim()) {
    throw auditError('Existing BUTTONDOWN_API_KEY is required locally');
  }
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) {
    throw auditError('Invalid audit time');
  }

  const end = now.getTime();
  const start = end - LOOKBACK_DAYS * DAY_MS;
  const after = new Date(start).toISOString();
  const before = new Date(end).toISOString();
  let expectedCount;
  const seenIds = new Set();
  // Maps avoid attacker-influenced dynamic object keys while accumulating
  // metadata; only the fixed aggregates are converted to plain output.
  const statuses = new Map([
    ['success2xx', 0], ['http400', 0], ['http429', 0],
    ['other4xx', 0], ['server5xx', 0], ['other', 0],
  ]);
  const sources = new Map([
    ['api', 0], ['app', 0], ['integrationOrClient', 0], ['unknown', 0],
  ]);
  const dailyUtc = new Map();
  let total = 0;
  let requests = 0;

  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const url = new URL(API_REQUESTS_ENDPOINT);
    url.searchParams.set('method', 'POST');
    url.searchParams.set('path', SUBSCRIBER_PATH);
    url.searchParams.set('creation_date__gt', after);
    url.searchParams.set('creation_date__lt', before);
    url.searchParams.set('limit', String(PAGE_LIMIT));
    url.searchParams.set('page', String(page));
    let response;
    try {
      response = await fetcher(url, {
        method: 'GET',
        headers: {
          Authorization: 'Token ' + apiKey.trim(),
          Accept: 'application/json',
        },
        cache: 'no-store',
        redirect: 'error',
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch {
      throw auditError('Buttondown read-only request failed');
    }
    requests += 1;
    if (response?.status !== 200) {
      // Never expose body, response headers or URL, even when provider fails.
      throw auditError(readOnlyFailureMessage(response?.status));
    }
    let payload;
    try {
      payload = await response.json();
    } catch {
      throw auditError('Invalid Buttondown API response');
    }
    const result = assertPage(payload, page, total, start, end, seenIds);
    if (expectedCount === undefined) expectedCount = result.count;
    if (result.count !== expectedCount) {
      throw auditError('API request total changed during pagination');
    }
    for (const item of result.items) {
      const status = statusBucket(item.status);
      const source = sourceBucket(item.source);
      statuses.set(status, statuses.get(status) + 1);
      sources.set(source, sources.get(source) + 1);
      const date = new Date(item.timestamp).toISOString().slice(0, 10);
      dailyUtc.set(date, (dailyUtc.get(date) ?? 0) + 1);
    }
    total += result.items.length;

    if (!result.hasNext) {
      if (total !== expectedCount) {
        throw auditError('API request pagination is incomplete');
      }
      // A complete filtered API log sample still cannot establish the
      // account's daily POST quota, reset semantics or all writers.
      return {
        schemaVersion: 1,
        source: 'buttondown-api-requests-readonly',
        filter: 'POST /v1/subscribers',
        windowUtc: { afterExclusive: after, beforeExclusive: before },
        lookbackDays: LOOKBACK_DAYS,
        requests,
        reportedMatchingRequests: expectedCount,
        countedMatchingRequests: total,
        completeness: 'filtered-pages-complete',
        byStatus: Object.fromEntries(statuses),
        bySourceCategory: Object.fromEntries(sources),
        byUtcDay: Object.fromEntries(
          [...dailyUtc.entries()].sort(([a], [b]) => a.localeCompare(b))
        ),
        quotaForThisAccount: 'unverified',
        resetRule: 'unverified',
        otherWriters: 'unverified',
        rawEntriesExported: 0,
        writes: 0,
      };
    }
    if (result.items.length === 0 || total >= expectedCount) {
      throw auditError('Invalid API request pagination progress');
    }
  }
  throw auditError('Audit exceeded bounded page limit; no partial report');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const report = await auditButtondownApiRequests({
      apiKey: process.env.BUTTONDOWN_API_KEY,
    });
    console.log(JSON.stringify(report, null, 2));
  } catch (error) {
    console.error(
      error?.name === 'ButtondownApiRequestAuditError'
        ? error.message
        : 'Buttondown read-only audit failed'
    );
    process.exitCode = 1;
  }
}
