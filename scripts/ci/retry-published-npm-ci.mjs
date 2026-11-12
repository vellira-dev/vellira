import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const PUBLIC_PACKAGES = new Set([
  'core',
  'icons',
  'react',
  'react-native',
  'tokens',
  'types',
]);
export const RETRY_DELAYS_MS = Object.freeze([5_000, 15_000, 30_000]);

// Retry authority derives only from exact public npm URLs and SRI in npm lock v3.
export function lockedTarballUrls(lock) {
  assert.equal(lock?.lockfileVersion, 3);
  assert.ok(lock.packages && typeof lock.packages === 'object');
  const urls = new Set();
  for (const [key, entry] of Object.entries(lock.packages)) {
    const match = /^node_modules\/@vellira-ui\/([^/]+)$/.exec(key);
    if (!match) continue;
    const name = match[1];
    assert.ok(PUBLIC_PACKAGES.has(name), 'Unexpected Vellira package: ' + name);
    assert.match(entry.version ?? '', /^\d+\.\d+\.\d+$/);
    assert.match(entry.integrity ?? '', /^sha512-[A-Za-z0-9+/]+={0,2}$/);
    const expected =
      'https://registry.npmjs.org/@vellira-ui/' +
      name +
      '/-/' +
      name +
      '-' +
      entry.version +
      '.tgz';
    assert.equal(entry.resolved, expected);
    urls.add(expected);
  }
  assert.ok(urls.size, 'Missing integrity-locked Vellira packages');
  return urls;
}

export function retryableTarball404(result, urls) {
  if (!result || result.status !== 1 || result.signal) return false;
  const stderr = String(result.stderr ?? '');
  const codes = [...stderr.matchAll(/^npm error code (\S+)\s*$/gm)];
  const missing = [
    ...stderr.matchAll(/^npm error 404 Not Found - GET (\S+) - Not found\s*$/gm),
  ];
  return (
    codes.length === 1 &&
    codes[0][1] === 'E404' &&
    missing.length === 1 &&
    urls.has(missing[0][1])
  );
}

// npm ci must succeed with the original integrity-locked dependency graph.
export async function installWithRegistryRetry({
  lock,
  run,
  wait,
  write = () => {},
  warn = () => {},
}) {
  const urls = lockedTarballUrls(lock);
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    const result = await run();
    write(result);
    if (result.status === 0) return attempt + 1;
    if (!retryableTarball404(result, urls)) {
      throw new Error('Non-retryable npm ci failure at attempt ' + (attempt + 1));
    }
    if (attempt === RETRY_DELAYS_MS.length) break;
    const delay = RETRY_DELAYS_MS[attempt];
    warn('Exact locked npm archive E404; attempt ' + (attempt + 2) + ' of 4');
    await wait(delay);
  }
  throw new Error('Pinned npm archive E404 persisted after 4 attempts');
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const lock = JSON.parse(fs.readFileSync('package-lock.json', 'utf8'));
  installWithRegistryRetry({
    lock,
    run: () =>
      spawnSync('npm', ['ci', '--no-audit', '--no-fund'], {
        encoding: 'utf8',
        maxBuffer: 32 * 1024 * 1024,
      }),
    wait: sleep,
    warn: (message) => process.stderr.write('::warning::' + message + '\n'),
    write: ({ stdout, stderr }) => {
      if (stdout) process.stdout.write(stdout);
      if (stderr) process.stderr.write(stderr);
    },
  }).then(
    (attempt) => console.log('Pinned npm ci PASS on attempt ' + attempt),
    (error) => {
      console.error(error);
      process.exitCode = 1;
    }
  );
}
