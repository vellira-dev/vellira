/* global window, addEventListener */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { webkit, expect } from '@playwright/test';
import { buildGenerations, startMigrationOrigin } from './cloudflare-migration-origin.mjs';
import { assertRapidUnloadResult } from './cloudflare-migration-prefetch-delay.mjs';
import {
  assertTeardownFallbackResult,
  classifyTeardownPrefetchTrace,
  hasBlockingBrowserError,
} from './cloudflare-migration-teardown-trace.mjs';

// Explicit S5 diagnostic, NOT the normal migration gate or real Safari proof.
// Delays only the real origin's response to an actual native Next Link RSC
// prefetch; no Playwright request interception, mocks, or disabled browser cache.
const iterations = Number(process.env.MIGRATION_S5_ITERATIONS ?? 3);
assert.ok(Number.isInteger(iterations) && iterations >= 1 && iterations <= 20);
const variant = process.env.MIGRATION_S5_VARIANT ?? 'inflight';
assert.ok(
  variant === 'inflight' || variant === 'teardown',
  'Expected MIGRATION_S5_VARIANT=inflight|teardown'
);
const delayedMs = 4_000;
const directory = path.resolve(
  process.env.MIGRATION_RESULTS ??
    'apps/react-storybook/test-results/cloudflare-migration-s5'
);
await fs.mkdir(directory, { recursive: true });
const generations = await buildGenerations(directory);
const git = spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' });
assert.equal(git.status, 0, 'Missing Git source provenance');
const sha = git.stdout.trim();
assert.match(sha, /^[a-f0-9]{40}$/);
const reports = [];

for (let attempt = 1; attempt <= iterations; attempt++) {
  const attemptDirectory = path.join(directory, 'webkit-' + attempt);
  await fs.mkdir(attemptDirectory, { recursive: true });
  const origin = await startMigrationOrigin(generations, attemptDirectory, {
    prefetchDelayMs: variant === 'inflight' ? delayedMs : 0,
  });
  const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'vellira-s5-webkit-'));
  let context;
  const result = {
    attempt,
    sha,
    browser: 'webkit',
    diagnostic:
      variant === 'inflight'
        ? 'origin-held-native-Next-prefetch-hard-navigation'
        : 'old-A-prefetched-page-native-Next-dispatch-during-hard-navigation',
    variant,
    delayMs: delayedMs,
    events: [],
    destination: null,
    heldAtNavigation: false,
    oldDocument: null,
    navigationStartedAt: null,
    teardown: null,
    bFlightFromGenerationB: false,
    status: 'inconclusive',
  };
  try {
    context = await webkit.launchPersistentContext(profile, {
      headless: true,
      ignoreDefaultArgs: ['--disable-back-forward-cache'],
    });
    const page = context.pages()[0];
    const record = (kind, fields) =>
      result.events.push({ kind, at: Date.now(), ...fields });
    page.on('pageerror', (err) =>
      record('pageerror', { error: String(err), url: page.url() })
    );
    page.on('console', (msg) => {
      if (msg.type() === 'error')
        record('console-error', { text: msg.text(), url: page.url() });
    });
    page.on('request', (req) => {
      const headers = req.headers();
      record('request', {
        url: req.url(),
        pageUrl: page.url(),
        document: req.isNavigationRequest(),
        rsc: headers.rsc ?? null,
        prefetch: headers['next-router-prefetch'] ?? null,
      });
    });
    page.on('response', (response) =>
      record('response', {
        url: response.url(),
        pageUrl: page.url(),
        document: response.request().isNavigationRequest(),
        status: response.status(),
      })
    );
    page.on('requestfailed', (req) =>
      record('requestfailed', {
        url: req.url(),
        error: req.failure()?.errorText,
      })
    );
    page.on('framenavigated', (frame) => {
      if (frame === page.mainFrame())
        record('document-navigation', { url: frame.url() });
    });
    await page.exposeBinding('__velliraS5Event', (_source, fields) => {
      record(fields.kind, fields);
    });
    await page.addInitScript(() => {
      for (const type of ['pagehide', 'pageshow', 'error', 'unhandledrejection']) {
        addEventListener(type, (event) => {
          const kind = type === 'error' ? 'window-error' : type;
          // Observation only; callback may be lost if the old document unloads.
          void window
            .__velliraS5Event({
              kind,
              url: window.location.href,
              message: type === 'error' ? event.message : undefined,
              reason:
                type === 'unhandledrejection' ? String(event.reason) : undefined,
              persisted:
                type === 'pagehide' || type === 'pageshow'
                  ? event.persisted
                  : undefined,
            })
            .catch(() => {});
        });
      }
    });

    await page.goto(origin.url);
    await page.waitForFunction(() => typeof window.__migrationTransport === 'function');
    await expect(page.locator('h1')).toHaveText('Generation A');
    // Preserve the previous 20-run, already-accepted-request control.
    // The opt-in teardown variant reproduces the original #2128 document:
    // A /target/prefetched -> B /target/fresh with native Link prefetch.
    let held;
    if (variant === 'teardown') {
      await page.locator('#prefetched').hover();
      await expect
        .poll(
          () =>
            origin.requests.filter(
              (request) =>
                request.generation === 'A' &&
                request.rsc &&
                request.url.startsWith('/target/prefetched?')
            ).length,
          { timeout: 8_000 }
        )
        .toBeGreaterThan(0);
      await page.waitForTimeout(250);
      await page.locator('#prefetched').click();
      await expect(page.locator('h1')).toHaveText('Target prefetched A');
      result.oldDocument = page.url();
      assert.equal(new URL(result.oldDocument).pathname, '/target/prefetched');
    } else {
      await expect
        .poll(() => origin.heldPrefetches.length, { timeout: 8_000 })
        .toBeGreaterThan(0);
      held = origin.heldPrefetches.find(
        (entry) => entry.generation === 'A'
      );
      assert.ok(held, 'No genuine A Next Link RSC prefetch');
    }
    await origin.activate('B');
    if (variant === 'inflight') {
      result.heldAtNavigation = !held.settled;
      assert.ok(
        result.heldAtNavigation,
        'Prefetch completed before hard navigation (INCONCLUSIVE)'
      );
    }
    result.navigationStartedAt = Date.now();
    await page.locator('#fresh').click();
    await expect(page.locator('h1')).toHaveText('Target fresh B', {
      timeout: 15_000,
    });
    result.destination = await page.locator('h1').textContent();
    // Retain events after commit; no route interception or error suppression.
    await page.waitForTimeout(
      variant === 'inflight' ? delayedMs + 250 : 500
    );
    result.bFlightFromGenerationB = origin.requests.some(
      (request) =>
        request.generation === 'B' &&
        request.rsc &&
        request.url.startsWith('/target/fresh') &&
        request.at >= result.navigationStartedAt
    );
    if (variant === 'teardown') {
      result.teardown = classifyTeardownPrefetchTrace({
        events: result.events,
        originRequests: origin.requests,
        oldDocument: result.oldDocument,
        navigationStartedAt: result.navigationStartedAt,
      });
      if (hasBlockingBrowserError(result.events)) {
        // A genuine exception is always FAILED, even when a prefetch signal
        // is missing. Do not use an inconclusive classification to hide it.
        assertTeardownFallbackResult(result);
      } else if (!result.teardown.bothObserved) {
        result.status = 'inconclusive';
        result.error =
          'Both old-document native prefetch dispatches were not observed';
      } else {
        assertTeardownFallbackResult(result);
        result.status = 'passed';
      }
    } else {
      assertRapidUnloadResult(result);
      result.status = 'passed';
    }
  } catch (error) {
    result.error = error.stack ?? String(error);
    result.status =
      hasBlockingBrowserError(result.events) ||
      (variant === 'teardown' && result.oldDocument && result.navigationStartedAt)
        ? 'failed'
        : result.heldAtNavigation
          ? 'failed'
          : 'inconclusive';
    console.error(
      'S5 attempt ' + attempt + ': ' + result.status + ': ' + result.error
    );
  } finally {
    await context?.close();
    result.heldPrefetches = origin.heldPrefetches;
    result.originRequests = origin.requests;
    await fs.writeFile(
      path.join(attemptDirectory, 'evidence.json'),
      JSON.stringify(result, null, 2)
    );
    await origin.close();
    await fs.rm(profile, { recursive: true, force: true });
    reports.push({
      attempt,
      status: result.status,
      error: result.error ?? null,
    });
  }
}
await fs.writeFile(
  path.join(directory, 'summary.json'),
  JSON.stringify({ sha, variant, reports }, null, 2)
);
assert.ok(
  reports.every((report) => report.status === 'passed'),
  'S5 does not pass: investigate per-attempt evidence without suppressing browser errors'
);
