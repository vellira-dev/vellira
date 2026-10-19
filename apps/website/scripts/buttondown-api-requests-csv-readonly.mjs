import { lstatSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

// Purely local CSV processing. No Buttondown or Cloudflare network calls.
// Never print or persist request IDs, IP addresses, credentials or row contents.
const MAX_BYTES = 8 * 1024 * 1024;
const MAX_ROWS = 50_000;
const WINDOW_DAYS = 7;
const DAY_MS = 86_400_000;
const SUBSCRIBERS_PATH = '/v1/subscribers';

function fail() {
  throw new Error('Unsupported or incomplete Buttondown API-requests CSV');
}

function parseRows(source) {
  if (typeof source !== 'string' || Buffer.byteLength(source, 'utf8') > MAX_BYTES) {
    fail();
  }
  const rows = [];
  let row = [];
  let field = '';
  let state = 'start';

  function finishField() {
    row.push(field);
    field = '';
    state = 'start';
  }
  function finishRow() {
    finishField();
    if (row.length > 1 || row[0] !== '') {
      rows.push(row);
      if (rows.length > MAX_ROWS + 1) fail();
    }
    row = [];
  }

  const input = source.replace(/^\uFEFF/, '');
  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    if (state === 'quoted') {
      if (char === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          state = 'after-quote';
        }
      } else {
        field += char;
      }
      continue;
    }
    if (char === ',') {
      finishField();
      continue;
    }
    if (char === '\r' || char === '\n') {
      if (char === '\r' && input[i + 1] === '\n') i += 1;
      finishRow();
      continue;
    }
    if (state === 'after-quote') fail();
    if (char === '"') {
      if (state !== 'start') fail();
      state = 'quoted';
    } else {
      field += char;
      state = 'unquoted';
    }
  }
  if (state === 'quoted') fail();
  if (state !== 'start' || row.length > 0) finishRow();
  if (rows.length === 0) fail();
  return rows;
}

function bucket(status) {
  if (status >= 200 && status < 300) return 'success2xx';
  if (status === 400) return 'http400';
  if (status === 429) return 'http429';
  if (status >= 400 && status < 500) return 'other4xx';
  if (status >= 500) return 'server5xx';
  return 'other';
}

export function summarizeButtondownApiRequestsCsv(source, { now = new Date() } = {}) {
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) fail();
  const [header, ...records] = parseRows(source);
  if (records.length === 0) fail();

  const names = header.map((name) => name.trim());
  if (names.length !== new Set(names).size) fail();
  for (const required of ['path', 'creation_date', 'status_code']) {
    if (!names.includes(required)) fail();
  }
  const index = Object.fromEntries(names.map((name, i) => [name, i]));
  const hasMethod = Object.hasOwn(index, 'method');
  const days = new Map();
  const statuses = new Map([
    ['success2xx', 0],
    ['http400', 0],
    ['http429', 0],
    ['other4xx', 0],
    ['server5xx', 0],
    ['other', 0],
  ]);
  const before = now.getTime();
  const after = before - WINDOW_DAYS * DAY_MS;
  let relevant = 0;

  for (const row of records) {
    if (row.length !== names.length) fail();
    const dateText = row[index.creation_date];
    // Require explicit offset; otherwise local timezone affects UTC grouping.
    if (
      !/^\d{4}-\d\d-\d\d[ T]\d\d:\d\d:\d\d/.test(dateText) ||
      !/(?:Z|[+-]\d\d:\d\d)$/i.test(dateText)
    ) fail();
    const timestamp = Date.parse(dateText.replace(' ', 'T'));
    if (!Number.isFinite(timestamp)) fail();
    if (timestamp <= after || timestamp >= before) continue;
    if (row[index.path] !== SUBSCRIBERS_PATH) continue;
    if (hasMethod && row[index.method] !== 'POST') continue;

    const status = Number(row[index.status_code]);
    if (
      !/^\d{3}$/.test(row[index.status_code]) ||
      !Number.isSafeInteger(status) ||
      status < 100 ||
      status > 599
    ) fail();
    relevant += 1;
    const category = bucket(status);
    statuses.set(category, statuses.get(category) + 1);
    const day = new Date(timestamp).toISOString().slice(0, 10);
    days.set(day, (days.get(day) ?? 0) + 1);
  }

  return {
    schemaVersion: 1,
    source: 'buttondown-dashboard-api-requests-csv',
    methodColumnPresent: hasMethod,
    scope: hasMethod
      ? 'POST /v1/subscribers'
      : 'all methods on /v1/subscribers; NOT proven subscriber-create attempts',
    windowUtc: {
      afterExclusive: new Date(after).toISOString(),
      beforeExclusive: now.toISOString(),
    },
    scannedRows: records.length,
    matchingRequests: relevant,
    byUtcDay: Object.fromEntries([...days].sort(([a], [b]) => a.localeCompare(b))),
    byStatus: Object.fromEntries(statuses),
    actualDailyQuota: 'unverified',
    resetRule: 'unverified',
    completenessOfProviderHistory: 'unverified',
    subscriberWrites: 0,
    rawRowsExported: 0,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (process.argv.length !== 3) fail();
    const file = process.argv[2];
    const metadata = lstatSync(file);
    if (!metadata.isFile() || metadata.size > MAX_BYTES) fail();
    const source = readFileSync(file, 'utf8');
    console.log(JSON.stringify(summarizeButtondownApiRequestsCsv(source), null, 2));
  } catch {
    console.error('Cannot analyze the CSV locally; check its format and size. No data was exported.');
    process.exitCode = 1;
  }
}
