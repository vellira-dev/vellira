import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REDIRECT_FILE = 'apps/docs/src/public/_redirects';
const DOCS_ORIGIN = 'https://docs.vellira.dev';

export function parseDocsRedirects(text) {
  const rules = new Map();
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const parts = line.split(/\s+/);
    if (
      parts.length !== 3 ||
      parts[2] !== '301' ||
      !parts[0].startsWith('/') ||
      !parts[1].startsWith('/') ||
      parts[0].startsWith('//') ||
      parts[1].startsWith('//')
    ) {
      throw new Error('Invalid permanent documentation redirect: ' + line);
    }
    if (rules.has(parts[0])) {
      throw new Error('Duplicate documentation redirect: ' + parts[0]);
    }
    rules.set(parts[0], parts[1]);
  }
  if (rules.size === 0) throw new Error('No documentation redirects found');
  return rules;
}

async function mapBounded(items, callback, concurrency = 8) {
  const results = [];
  for (let index = 0; index < items.length; index += concurrency) {
    results.push(
      ...(await Promise.all(items.slice(index, index + concurrency).map(callback)))
    );
  }
  return results;
}

export async function inspectLiveDocsRedirects(
  rules,
  { origin = DOCS_ORIGIN, fetchImpl = fetch } = {}
) {
  const failures = [];
  const validTargets = new Set();

  const checks = await mapBounded([...rules.entries()], async ([source, target]) => {
    try {
      const response = await fetchImpl(new URL(source, origin), {
        method: 'GET',
        redirect: 'manual',
        signal: AbortSignal.timeout(8000),
      });
      await response.body?.cancel();
      const actualLocation = response.headers.get('location');
      const expectedLocation = new URL(target, origin).href;
      const resolvedLocation = actualLocation
        ? new URL(actualLocation, origin).href
        : null;

      if (response.status !== 301 || resolvedLocation !== expectedLocation) {
        return {
          source,
          target,
          error:
            'expected 301 to ' +
            expectedLocation +
            ', got ' +
            response.status +
            ' to ' +
            (resolvedLocation ?? '<no Location>'),
        };
      }
      validTargets.add(target);
      return null;
    } catch (error) {
      return { source, target, error: String(error) };
    }
  });

  failures.push(...checks.filter(Boolean));

  const targets = await mapBounded([...validTargets], async (target) => {
    try {
      const response = await fetchImpl(new URL(target, origin), {
        method: 'GET',
        redirect: 'manual',
        signal: AbortSignal.timeout(8000),
      });
      await response.body?.cancel();
      if (response.status !== 200) {
        return {
          source: target,
          error: 'canonical destination must return 200; got ' + response.status,
        };
      }
      return null;
    } catch (error) {
      return { source: target, error: String(error) };
    }
  });

  failures.push(...targets.filter(Boolean));
  return {
    checkedSources: rules.size,
    checkedDestinations: validTargets.size,
    failures,
  };
}

export async function verifyLiveDocsRedirects(
  rules,
  {
    attempts = 3,
    sleep = (ms) => new Promise((done) => setTimeout(done, ms)),
    ...options
  } = {}
) {
  if (!Number.isInteger(attempts) || attempts < 1 || attempts > 5) {
    throw new Error('attempts must be between 1 and 5');
  }
  let result;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    result = await inspectLiveDocsRedirects(rules, options);
    if (result.failures.length === 0) return result;
    if (attempt < attempts) await sleep(2500);
  }
  const details = result.failures
    .slice(0, 15)
    .map((entry) => entry.source + ': ' + entry.error)
    .join('\n');
  throw new Error(
    'Documentation redirect smoke failed (' +
      result.failures.length +
      ' cases):\n' +
      details
  );
}

const isMain =
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  try {
    const rules = parseDocsRedirects(await readFile(REDIRECT_FILE, 'utf8'));
    const report = await verifyLiveDocsRedirects(rules);
    console.log(
      'Production docs redirect proof GREEN: ' +
        report.checkedSources +
        ' permanent redirects and ' +
        report.checkedDestinations +
        ' canonical destinations'
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
