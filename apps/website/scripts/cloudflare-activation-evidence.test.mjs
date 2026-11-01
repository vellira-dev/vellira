import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { activateWithEvidence, recordActivationEvidence } from './cloudflare-activation-evidence.mjs';

const metadata = {
  candidateSha: 'a'.repeat(40),
  buildId: 'a'.repeat(40) + '-1-1',
  worker: 'vellira-website-staging',
  githubRunId: '123',
  githubRunAttempt: '1',
  now: () => new Date('2026-11-01T12:00:00.000Z'),
};

async function fixture(fn) {
  const dir = await mkdtemp(path.join(tmpdir(), 'activation-evidence-'));
  const filePath = path.join(dir, 'events.jsonl');
  const record = (status) => recordActivationEvidence({ filePath, status, ...metadata });
  try {
    await fn({ filePath, record });
  } finally {
    await rm(dir, { force: true, recursive: true });
  }
}

async function statuses(filePath) {
  return (await readFile(filePath, 'utf8')).trim().split('\n').map((line) => JSON.parse(line));
}

test('records invocation before Wrangler and only records success after zero exit', async () => {
  await fixture(async ({ filePath, record }) => {
    await activateWithEvidence({
      record,
      activate: async () => {
        assert.deepEqual((await statuses(filePath)).map((row) => row.status), ['attempted']);
      },
    });
    const rows = await statuses(filePath);
    assert.deepEqual(rows.map((row) => row.status), ['attempted', 'wrangler-exited-zero']);
    assert.equal(rows[0].buildId, metadata.buildId);
    assert.equal(rows[0].observedAt, '2026-11-01T12:00:00.000Z');
    assert.equal(rows[0].worker, metadata.worker);
    assert.doesNotMatch(JSON.stringify(rows), /CLOUDFLARE_API_TOKEN|secret|password/i);
    assert.deepEqual(Object.keys(rows[0]), [
      'kind', 'status', 'candidateSha', 'buildId', 'worker',
      'githubRunId', 'githubRunAttempt', 'observedAt',
    ]);
  });
});

test('records unknown-after-error, never success, and propagates original Wrangler failure', async () => {
  await fixture(async ({ filePath, record }) => {
    const failure = new Error('Wrangler exited nonzero');
    await assert.rejects(activateWithEvidence({
      record,
      activate: () => { throw failure; },
    }), (error) => error === failure);
    assert.deepEqual((await statuses(filePath)).map((row) => row.status), [
      'attempted', 'unknown-after-error',
    ]);
  });
});

test('failure to write attempted evidence blocks activation', async () => {
  let activated = false;
  await assert.rejects(activateWithEvidence({
    record: async () => { throw new Error('disk unavailable'); },
    activate: () => { activated = true; },
  }), /disk unavailable/);
  assert.equal(activated, false);
});

test('failure to write success receipt remains an error', async () => {
  let called = false;
  await assert.rejects(activateWithEvidence({
    record: async (status) => {
      if (status === 'wrangler-exited-zero') throw new Error('receipt unavailable');
    },
    activate: () => { called = true; },
  }), /receipt unavailable/);
  assert.equal(called, true);
});

test('activation and failed error-receipt writes both remain visible', async () => {
  await assert.rejects(activateWithEvidence({
    record: async (status) => {
      if (status === 'unknown-after-error') throw new Error('receipt failure');
    },
    activate: () => { throw new Error('Cloudflare failure'); },
  }), (error) => error instanceof AggregateError &&
    error.errors.some((item) => item.message === 'Cloudflare failure') &&
    error.errors.some((item) => item.message === 'receipt failure'));
});
