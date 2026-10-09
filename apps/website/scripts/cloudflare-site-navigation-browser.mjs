import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { navigateToBlogAcrossSiteSurface } from '../../react-storybook/scripts/cloudflare-client-navigation-recovery.mjs';

// Run against the actual built Next layouts and CSS, never an HTML imitation.
// Only the initial document uses goto; every subsequent hop is the same helper
// used by staging/production soak. No article metrics mutations are involved.
export async function drainSiteNavigationNetwork(page, timeout = 10_000) {
  await page.waitForLoadState('networkidle', { timeout });
}

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
      try {
        const page = await context.newPage();
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
            await action();
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
        // The final marketing/blog surface starts background RSC prefetch and
        // read-only metrics requests. Drain them before closing the context so
        // local workerd never writes a successful response into a socket the
        // browser has already torn down.
        await drainSiteNavigationNetwork(page);
        row.networkDrained = true;
        row.final = await identity();
        evidence.push(row);
      } finally {
        await context.close();
      }
    }
    return evidence;
  } finally {
    await browser.close();
  }
}
