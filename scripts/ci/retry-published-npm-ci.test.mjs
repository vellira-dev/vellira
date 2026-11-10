import assert from 'node:assert/strict';
import test from 'node:test';
import {
  installWithRegistryRetry,
  lockedTarballUrls,
  retryableTarball404,
  RETRY_DELAYS_MS,
} from './retry-published-npm-ci.mjs';

const url =
  'https://registry.npmjs.org/@vellira-ui/react/-/react-2.191.5.tgz';
const lock = {
  lockfileVersion: 3,
  packages: {
    'node_modules/@vellira-ui/react': {
      version: '2.191.5',
      resolved: url,
      integrity: 'sha512-ValidBase64TestValue=',
    },
  },
};
const e404 = {
  status: 1,
  stderr:
    'npm error code E404\nnpm error 404 Not Found - GET ' +
    url +
    ' - Not found\n',
};
const success = { status: 0, stderr: '' };
const harness = (results) => {
  const delays = [];
  let calls = 0;
  return {
    get calls() { return calls; },
    delays,
    run: () => results[calls++],
    wait: (ms) => delays.push(ms),
  };
};

test('requires the exact public npm tarball, version and SHA-512 lock', () => {
  assert.deepEqual([...lockedTarballUrls(lock)], [url]);
  for (const change of [
    { version: 'latest' },
    { resolved: 'https://example.com/other.tgz' },
    { integrity: null },
  ]) {
    const invalid = structuredClone(lock);
    Object.assign(invalid.packages['node_modules/@vellira-ui/react'], change);
    assert.throws(() => lockedTarballUrls(invalid));
  }
  assert.throws(() => lockedTarballUrls({ lockfileVersion: 3, packages: {} }));
});

test('succeeds without retry for a normal npm ci', async () => {
  const runner = harness([success]);
  const attempts = await installWithRegistryRetry({ lock, ...runner });
  assert.equal(attempts, 1);
  assert.equal(runner.calls, 1);
  assert.deepEqual(runner.delays, []);
});

test('retries only the exact locked npm tarball E404', async () => {
  const runner = harness([e404, e404, success]);
  const attempts = await installWithRegistryRetry({ lock, ...runner });
  assert.equal(attempts, 3);
  assert.equal(runner.calls, 3);
  assert.deepEqual(runner.delays, RETRY_DELAYS_MS.slice(0, 2));
});

test('persistent E404 fails after three finite backoffs', async () => {
  const runner = harness([e404, e404, e404, e404]);
  await assert.rejects(
    () => installWithRegistryRetry({ lock, ...runner }),
    /persisted after 4 attempts/
  );
  assert.equal(runner.calls, 4);
  assert.deepEqual(runner.delays, RETRY_DELAYS_MS);
});

test('other 404s, integrity failures, and signals never retry', async () => {
  for (const failure of [
    {
      ...e404,
      stderr: e404.stderr.replace(url, url.replace('2.191.5', '2.191.4')),
    },
    {
      ...e404,
      stderr: e404.stderr.replace(
        url,
        'https://registry.npmjs.org/other'
      ),
    },
    { status: 1, stderr: 'npm error code EINTEGRITY\n' },
    { status: null, signal: 'SIGKILL', stderr: e404.stderr },
    { status: 1, stderr: e404.stderr + 'npm error code EACCES\n' },
  ]) {
    const runner = harness([failure]);
    await assert.rejects(
      () => installWithRegistryRetry({ lock, ...runner }),
      /Non-retryable/
    );
    assert.equal(runner.calls, 1);
  }
});

test('ambiguous error evidence cannot authorize an E404 retry', () => {
  const urls = lockedTarballUrls(lock);
  assert.equal(retryableTarball404(e404, urls), true);
  assert.equal(retryableTarball404({ ...e404, status: 0 }, urls), false);
  assert.equal(
    retryableTarball404({ ...e404, stderr: e404.stderr + e404.stderr }, urls),
    false
  );
  assert.equal(
    retryableTarball404(
      { ...e404, stderr: e404.stderr.replace('Not Found', 'Forbidden') },
      urls
    ),
    false
  );
});
