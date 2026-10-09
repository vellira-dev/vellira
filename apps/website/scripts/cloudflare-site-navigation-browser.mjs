import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { navigateToBlogAcrossSiteSurface } from '../../react-storybook/scripts/cloudflare-client-navigation-recovery.mjs';

const SITE_NAVIGATION_DRAIN_TIMEOUT_MS = 10_000;
const SITE_NAVIGATION_DRAIN_QUIET_MS = 150;
const SITE_NAVIGATION_DRAIN_POLL_MS = 25;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createSiteNavigationNetworkDrain(
  page,
  baseUrl,
  {
    quietMs = SITE_NAVIGATION_DRAIN_QUIET_MS,
    pollMs = SITE_NAVIGATION_DRAIN_POLL_MS,
  } = {}
) {
  const origin = new URL(baseUrl).origin;
  const pending = new Map();
  const failures = [];
  let lastActivity = Date.now();

  const localRequestUrl = (request) => {
    try {
      const url = new URL(request.url());
      return url.origin === origin ? url.href : null;
    } catch {
      return null;
    }
  };

  const onRequest = (request) => {
    const url = localRequestUrl(request);
    if (!url) return;
    pending.set(request, url);
    lastActivity = Date.now();
  };

  const settle = (request, failed) => {
    const url = pending.get(request);
    if (!url) return;
    pending.delete(request);
    lastActivity = Date.now();
    if (failed) {
      failures.push({
        url,
        errorText: request.failure()?.errorText ?? 'unknown',
      });
    }
  };

  const onRequestFinished = (request) => settle(request, false);
  const onRequestFailed = (request) => settle(request, true);

  page.on('request', onRequest);
  page.on('requestfinished', onRequestFinished);
  page.on('requestfailed', onRequestFailed);

  return {
    async drain(timeout = SITE_NAVIGATION_DRAIN_TIMEOUT_MS) {
      const deadline = Date.now() + timeout;
      while (Date.now() <= deadline) {
        if (
          pending.size === 0 &&
          Date.now() - lastActivity >= quietMs
        ) {
          return;
        }
        await sleep(pollMs);
      }

      assert.fail(
        `Timed out draining local site-navigation requests: ${[
          ...new Set(pending.values()),
        ].join(', ')}`
      );
    },

    failures() {
      return failures.map((failure) => ({ ...failure }));
    },

    dispose() {
      page.off('request', onRequest);
      page.off('requestfinished', onRequestFinished);
      page.off('requestfailed', onRequestFailed);
    },
  };
}

export async function runSiteNavigationActionAfterDrain(
  networkDrain,
  action,
  timeout = SITE_NAVIGATION_DRAIN_TIMEOUT_MS
) {
  await networkDrain.drain(timeout);
  await action();
}

// Run against the actual built Next layouts and CSS, never an HTML imitation.
// Only the initial document uses goto; every subsequent hop is the same helper
// used by staging/production soak. No article metrics mutations are involved.
export async function verifySiteNavigationSurfaces(baseUrl) {
  const browser = await chromium.launch();
  const evidence = [];
  try {
    for (const { width, start, hops } of [
      { width: 1440, start: '/', hops: ['/blog'] },
      { width: 1280, start: '/', hops: ['/blog'] },
      { width: 390, start: '/', hops: ['/blog'] },
      { width: 1280, start: '/components/tooltip', hops: ['/', '/blog'] },
    ]) {
      const context = await browser.newContext({
        viewport: { width, height: 900 },
      });
      let networkDrain;
      try {
        const page = await context.newPage();
        networkDrain = createSiteNavigationNetworkDrain(page, baseUrl);
        const cdp = await context.newCDPSession(page);
        await cdp.send('Page.enable');
        let generation = 0;
        cdp.on('Page.frameNavigated', ({ frame }) => {
          if (!frame.parentId) generation++;
        });
        const identity = async () => ({
          loaderId: (await cdp.send('Page.getFrameTree')).frameTree.frame
            .loaderId,
          generation,
        });
        const initial = await page.goto(new URL(start, baseUrl).href);
        assert.equal(initial.status(), 200);
        await page.getByRole('heading', { level: 1 }).waitFor();
        const original = await identity();
        const row = { width, start, original, hops: [], snapshots: [] };
        row.snapshots.push(await page.locator('header').first().ariaSnapshot());
        if (start.startsWith('/components')) {
          assert.equal(
            await page
              .getByRole('button', { name: 'Open navigation', exact: true })
              .count(),
            0
          );
          assert.equal(
            await page
              .getByRole('button', { name: 'Main navigation', exact: true })
              .isVisible(),
            false
          );
        }
        await navigateToBlogAcrossSiteSurface({
          page,
          navigate: async ({ href, title, prepareAttempt, action }) => {
            await prepareAttempt(1);
            assert.deepEqual(
              await identity(),
              original,
              'menu preparation replaced the document'
            );
            row.snapshots.push(
              await page.locator('header').first().ariaSnapshot()
            );
            // Drain only this local runtime's HTTP requests. Global
            // networkidle also observes unrelated/background browser traffic
            // and can stay busy indefinitely on an otherwise settled page.
            await runSiteNavigationActionAfterDrain(networkDrain, action);
            await page.waitForURL(new URL(href, baseUrl).href);
            await page
              .getByRole('heading', { name: title, level: 1, exact: true })
              .waitFor();
            assert.deepEqual(
              await identity(),
              original,
              `${start} -> ${href} replaced the document`
            );
            row.hops.push(href);
          },
        });
        assert.deepEqual(row.hops, hops);
        // Read the complete local response bodies before tearing down the
        // browser context. External/background traffic is intentionally not a
        // teardown dependency for this local Workers contract.
        await networkDrain.drain();
        row.networkDrained = true;
        row.requestFailures = networkDrain.failures();
        if (row.requestFailures.length > 0) {
          console.log(
            `Local site-navigation request failures: ${JSON.stringify(
              row.requestFailures
            )}`
          );
        }
        row.final = await identity();
        evidence.push(row);
      } finally {
        networkDrain?.dispose();
        await context.close();
      }
    }
    return evidence;
  } finally {
    await browser.close();
  }
}
