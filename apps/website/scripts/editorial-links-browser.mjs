/* global document */
import assert from 'node:assert/strict';

import { chromium } from '@playwright/test';

// Run against the real Next website with WEBSITE_URL set to its origin.
// This is a browser smoke test, not pixel-diff proof of pre-migration parity.
const baseUrl = process.env.WEBSITE_URL;
if (!baseUrl) throw new Error('WEBSITE_URL is required.');

const browser = await chromium.launch();
try {
  for (const width of [1440, 390]) {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
    });
    try {
      const page = await context.newPage();
      await page.goto(new URL('/', baseUrl).href);

      for (const [selector, name, expectedHref] of [
        ["#why-vellira", 'Explore components', '/components'],
        ["#why-vellira", 'Read about quality gates', '/blog/quality-gates-before-component-growth'],
        ["#why-vellira", 'Why AI changes the problem', '/blog/ai-ui-consistency'],
        ["#why-vellira", 'View public repository', 'https://github.com/vellira-dev/vellira'],
        [
          '#interface',
          'Setup instructions',
          'https://github.com/vellira-dev/vellira/tree/main/examples/workspace-starter/native',
        ],
        ['#interface', 'Explore the Pro roadmap', '#pro'],
      ]) {
        const link = page.locator(selector).getByRole('link', { name: new RegExp(name) });
        assert.equal(await link.count(), 1, `${width}px: unique link ${name}`);
        assert.equal(
          await link.getAttribute('href'),
          expectedHref,
          `${width}px: destination for ${name}`
        );
        await link.scrollIntoViewIfNeeded();
        assert.equal(await link.isVisible(), true);
        const bounds = await link.boundingBox();
        assert.ok(
          bounds && bounds.width > 0 && bounds.height > 0,
          `${width}px: interactive hit target for ${name}`
        );
        await link.focus();
        assert.equal(
          await link.evaluate((element) => document.activeElement === element),
          true,
          `${width}px: keyboard-focusable ${name}`
        );
        await link.hover();
      }
    } finally {
      await context.close();
    }
  }
  console.log('OK: six canonical editorial links verified at desktop and mobile widths');
} finally {
  await browser.close();
}
