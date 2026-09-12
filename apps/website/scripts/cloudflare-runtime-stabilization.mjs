import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const RUNTIME_STABILIZATION = Object.freeze({
  consecutiveSuccesses: 5,
  timeoutMs: 60_000,
  intervalMs: 2_000,
  requestTimeoutMs: 10_000,
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function waitForRuntimeStability({
  base = process.env.WEBSITE_URL,
  expectedBuildId = process.env.VELLIRA_BUILD_ID,
  consecutiveSuccesses = RUNTIME_STABILIZATION.consecutiveSuccesses,
  timeoutMs = RUNTIME_STABILIZATION.timeoutMs,
  intervalMs = RUNTIME_STABILIZATION.intervalMs,
  requestTimeoutMs = RUNTIME_STABILIZATION.requestTimeoutMs,
  fetchImpl = fetch,
  sleepImpl = sleep,
  now = Date.now,
  uuid = randomUUID,
  log = console.log,
} = {}) {
  assert.ok(base, 'WEBSITE_URL is required for runtime stabilization');
  assert.ok(expectedBuildId, 'VELLIRA_BUILD_ID is required for runtime stabilization');
  assert.ok(Number.isInteger(consecutiveSuccesses) && consecutiveSuccesses > 0);
  assert.ok(Number.isInteger(timeoutMs) && timeoutMs > 0);
  assert.ok(Number.isInteger(intervalMs) && intervalMs >= 0);
  assert.ok(Number.isInteger(requestTimeoutMs) && requestTimeoutMs > 0);

  const origin = new URL(base);
  assert.equal(origin.protocol, 'https:', 'Runtime stabilization requires HTTPS');
  const deadline = now() + timeoutMs;
  let attempts = 0;
  let streak = 0;
  let stableWorkerVersion = null;
  let requestIds = new Set();
  let lastFailure = 'no successful probe';

  while (true) {
    attempts += 1;
    const probe = new URL('/__vellira_runtime', origin);
    probe.searchParams.set('stabilization', uuid());

    try {
      const response = await fetchImpl(probe, {
        cache: 'no-store',
        redirect: 'error',
        headers: {
          Accept: 'application/json',
          'Cache-Control': 'no-cache',
        },
        signal: AbortSignal.timeout(requestTimeoutMs),
      });
      assert.equal(response.status, 200, `runtime HTTP ${response.status}`);
      const runtime = await response.json();
      assert.equal(runtime.buildId, expectedBuildId, 'runtime BUILD_ID mismatch');
      assert.ok(runtime.workerVersion, 'runtime Worker version missing');
      assert.ok(runtime.requestId, 'runtime request ID missing');
      assert.equal(
        response.headers.get('x-vellira-build-id'),
        expectedBuildId,
        'runtime build header mismatch'
      );
      assert.equal(
        response.headers.get('x-vellira-worker-version'),
        runtime.workerVersion,
        'runtime Worker version header mismatch'
      );
      assert.equal(
        response.headers.get('x-vellira-request-id'),
        runtime.requestId,
        'runtime request ID header mismatch'
      );

      if (stableWorkerVersion !== runtime.workerVersion) {
        stableWorkerVersion = runtime.workerVersion;
        streak = 0;
        requestIds = new Set();
      }
      assert.equal(
        requestIds.has(runtime.requestId),
        false,
        'runtime request ID was reused'
      );
      requestIds.add(runtime.requestId);
      streak += 1;
      lastFailure = '';
      log(
        JSON.stringify({
          event: 'runtime-stabilization-probe-passed',
          attempt: attempts,
          streak,
          required: consecutiveSuccesses,
          buildId: expectedBuildId,
          workerVersion: stableWorkerVersion,
          requestId: runtime.requestId,
        })
      );

      if (streak >= consecutiveSuccesses) {
        const result = {
          buildId: expectedBuildId,
          workerVersion: stableWorkerVersion,
          attempts,
          consecutiveSuccesses: streak,
        };
        log(JSON.stringify({ event: 'runtime-stabilization-passed', ...result }));
        return result;
      }
    } catch (error) {
      lastFailure = error instanceof Error ? error.message : String(error);
      streak = 0;
      stableWorkerVersion = null;
      requestIds = new Set();
      log(
        JSON.stringify({
          event: 'runtime-stabilization-retry',
          attempt: attempts,
          reason: lastFailure,
        })
      );
    }

    const remaining = deadline - now();
    if (remaining <= 0) break;
    await sleepImpl(Math.min(intervalMs, remaining));
  }

  throw new Error(
    `Runtime did not stabilize after ${attempts} probes within ${timeoutMs}ms; last failure: ${lastFailure}`
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
)
  await waitForRuntimeStability();
