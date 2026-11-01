import assert from 'node:assert/strict';
import { appendFile } from 'node:fs/promises';

// Local command receipts are not authoritative Cloudflare deployment IDs.
export async function recordActivationEvidence({
  filePath,
  status,
  candidateSha,
  buildId,
  worker,
  githubRunId,
  githubRunAttempt,
  now = () => new Date(),
  append = appendFile,
}) {
  assert.ok(['attempted', 'wrangler-exited-zero', 'unknown-after-error'].includes(status));
  assert.ok(typeof filePath === 'string' && filePath.length > 0);
  assert.ok(typeof buildId === 'string' && buildId.length > 0);
  assert.ok(typeof worker === 'string' && worker.length > 0);
  const payload = {
    kind: 'cloudflare-worker-activation',
    status,
    candidateSha,
    buildId,
    worker,
    githubRunId,
    githubRunAttempt,
    observedAt: now().toISOString(),
  };
  await append(filePath, JSON.stringify(payload) + '\n');
}

export async function activateWithEvidence({ record, activate }) {
  await record('attempted');
  try {
    await activate();
  } catch (error) {
    try {
      await record('unknown-after-error');
    } catch (recordError) {
      throw new AggregateError([error, recordError], 'Activation failed; failure evidence could not be written');
    }
    throw error;
  }
  await record('wrangler-exited-zero');
}
