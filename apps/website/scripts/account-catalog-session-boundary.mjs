/* global document */
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';

const baseUrl = process.env.WEBSITE_URL;
if (!baseUrl) throw new Error('WEBSITE_URL is required');

const browser = await chromium.launch();
try {
  for (const authenticated of [false, true]) {
    const context = await browser.newContext();
    const calls = [];
    await context.route('**/v1/**', async (route) => {
      const request = route.request();
      const pathname = new URL(request.url()).pathname;
      calls.push(pathname);
      const headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': new URL(baseUrl).origin,
        'Access-Control-Allow-Credentials': 'true',
      };
      if (request.method() !== 'GET') {
        throw new Error(`Unexpected account mutation: ${pathname}`);
      }
      if (!authenticated) {
        await route.fulfill({
          status: 401,
          headers,
          body: '{"error":{"code":"unauthenticated"}}',
        });
        return;
      }
      if (pathname === '/v1/me') {
        await route.fulfill({
          status: 200,
          headers,
          body: JSON.stringify({
            user: { id: 'test-user', status: 'active', emailVerified: true },
          }),
        });
      } else if (pathname === '/v1/workspaces') {
        await route.fulfill({
          status: 200,
          headers,
          body: JSON.stringify({
            workspaces: [{
              id: '00000000-0000-4000-8000-000000000123',
              name: 'Test workspace',
              status: 'active',
              membership: { role: 'owner' },
            }],
          }),
        });
      } else {
        await route.fulfill({
          status: 404,
          headers,
          body: '{"error":{"code":"not_found"}}',
        });
      }
    });

    const page = await context.newPage();
    page.setDefaultTimeout(15_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    try {
      await page.goto(new URL('/components?from=app', baseUrl).toString());
      await page.getByText('Button', { exact: true }).first().waitFor();
      if (authenticated) {
        await page.locator('[data-product-app-header]').waitFor();
        await page.getByRole('link', { name: 'Back to workspace' }).waitFor();
        await page.locator('[data-component-explorer-sidebar]').waitFor();
      } else {
        await page.waitForFunction(() =>
          document.querySelector('[data-product-app-header]') === null &&
          document.querySelectorAll('a[href="/app"]').length === 0
        );
        assert.equal(
          await page.getByRole('link', { name: 'Back to workspace' }).count(),
          0,
          'Unauthenticated catalog must not expose workspace navigation'
        );
      }
      assert.ok(calls.includes('/v1/me'), 'Session must be checked');
      assert.ok(!calls.some((p) => p.includes('/bootstrap')), 'Public catalog must never bootstrap a workspace');
    } finally {
      await page.close();
      await context.close();
    }
  }
  console.log('OK catalog session boundary: anonymous public and authenticated workspace contexts');
} finally {
  await browser.close();
}
