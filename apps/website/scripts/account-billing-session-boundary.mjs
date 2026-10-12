import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';

const baseUrl = process.env.WEBSITE_URL;
if (!baseUrl) throw new Error('WEBSITE_URL is required');

const browser = await chromium.launch();
try {
  for (const role of ['member', 'owner']) {
    const context = await browser.newContext();
    let billingReads = 0;
    let retryRequested = false;
    let mutations = 0;

    await context.route('**/v1/**', async (route) => {
      const request = route.request();
      const pathname = new URL(request.url()).pathname;
      const headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': new URL(baseUrl).origin,
        'Access-Control-Allow-Credentials': 'true',
      };

      if (request.method() !== 'GET') {
        mutations += 1;
        await route.fulfill({ status: 403, headers, body: '{"error":{"code":"blocked"}}' });
        return;
      }
      if (pathname === '/v1/me') {
        await route.fulfill({
          status: 200, headers,
          body: JSON.stringify({ user: { id: 'test-user', status: 'active', emailVerified: true } }),
        });
      } else if (pathname === '/v1/workspaces') {
        await route.fulfill({
          status: 200, headers,
          body: JSON.stringify({
            workspaces: [{
              id: '00000000-0000-4000-8000-000000000123',
              name: 'Test workspace', status: 'active',
              membership: { role },
            }],
          }),
        });
      } else if (/^\/v1\/workspaces\/[^/]+\/billing$/.test(pathname)) {
        billingReads += 1;
        if (!retryRequested) {
          await route.fulfill({ status: 503, headers, body: '{"error":{"code":"unavailable"}}' });
        } else {
          // Verify the previous error state is invalidated while a new read is pending.
          await new Promise((resolve) => setTimeout(resolve, 600));
          await route.fulfill({ status: 200, headers, body: '{"subscription":null}' });
        }
      } else {
        await route.fulfill({ status: 404, headers, body: '{"error":{"code":"not_found"}}' });
      }
    });

    const page = await context.newPage();
    page.setDefaultTimeout(15_000);
    try {
      await page.goto(new URL('/app/settings/billing', baseUrl).toString());
      if (role === 'member') {
        await page.getByText('Billing information is available to authorized workspace owners only.').waitFor();
        assert.equal(await page.getByRole('tab', { name: 'Billing' }).count(), 0);
        assert.equal(billingReads, 0, 'Members must not issue billing reads');
      } else {
        await page.getByText('Billing information is temporarily unavailable.').waitFor();
        retryRequested = true;
        await page.getByRole('button', { name: 'Try again' }).click();
        await page.getByText('Loading billing information…').waitFor();
        assert.equal(await page.getByText('Billing information is temporarily unavailable.').count(), 0);
        await page.getByText('No subscription').waitFor();
        assert.ok(billingReads >= 2, 'Owner retry must issue a new read');
      }
      assert.equal(mutations, 0, 'Read-only settings must never mutate account or billing');
    } finally {
      await page.close();
      await context.close();
    }
  }
  console.log('OK billing session boundary: member denial and owner retry invalidation');
} finally {
  await browser.close();
}
