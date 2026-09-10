import assert from 'node:assert/strict';
import { once } from 'node:events';
import {
  Worker,
  isMainThread,
  parentPort,
  workerData,
} from 'node:worker_threads';

// Miniflare binding proxies can synchronously wait for RPC. Hosting the remote
// HTTP proxy in that same Node event loop can deadlock it (Atomics.wait).
// Keep the proxy server on an independent event loop, not the archive caller's.
export async function startArchiveSession(
  configPath,
  { workerUrl = new URL(import.meta.url), timeoutMs = 60_000 } = {}
) {
  const worker = new Worker(workerUrl, { workerData: configPath });
  const message = () =>
    once(worker, 'message', { signal: AbortSignal.timeout(timeoutMs) });
  try {
    const [ready] = await message();
    assert.equal(ready.type, 'ready');
    // This URL contains session credentials. Transfer it only in memory, never
    // print it or persist it in build/archive evidence.
    const connection = new URL(ready.connection);
    return {
      connection,
      async dispose() {
        try {
          const closed = message();
          worker.postMessage('dispose');
          const [result] = await closed;
          assert.equal(result.type, 'disposed');
        } finally {
          await worker.terminate();
        }
      },
    };
  } catch (error) {
    await worker.terminate();
    throw error;
  }
}

if (!isMainThread) {
  const { maybeStartOrUpdateRemoteProxySession } = await import('wrangler');
  const { session } = await maybeStartOrUpdateRemoteProxySession({
    path: workerData,
  });
  parentPort.postMessage({
    type: 'ready',
    connection: session.remoteProxyConnectionString.toString(),
  });
  parentPort.once('message', async (command) => {
    assert.equal(command, 'dispose');
    await session.dispose();
    parentPort.postMessage({ type: 'disposed' });
    parentPort.close();
  });
}
