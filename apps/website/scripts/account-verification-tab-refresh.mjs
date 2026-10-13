/* global window */
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';

// Run in ordinary local development (no VELLIRA_LOCAL_PREVIEW flags).
// This is a *mocked* API test: no requests reach the real Vellira backend.
// WEBSITE_URL=http://localhost:3001 pnpm --filter @vellira-ui/website test:account-verification-tab-refresh
const baseUrl = process.env.WEBSITE_URL;
if (!baseUrl) throw new Error('WEBSITE_URL is required.');

const browser = await chromium.launch();
const context = await browser.newContext();
let verified = false;
let meReads = 0;
let workspaceReads = 0;
let mutations = 0;

await context.route('**/v1/**', async (route) => {
  const request = route.request();
  const path = new URL(request.url()).pathname;
  const origin = request.headers().origin || new URL(baseUrl).origin;
  const headers = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Credentials': 'true',
  };

  if (request.method() !== 'GET') {
    mutations += 1;
    await route.fulfill({
      status: 503,
      headers,
      body: '{"error":{"code":"test_mutation_blocked"}}',
    });
    return;
  }
  if (path === '/v1/me') {
    meReads += 1;
    await route.fulfill({
      status: 200,
      headers,
      body: JSON.stringify({
        user: {
          id: 'mock-account',
          status: 'active',
          emailVerified: verified,
        },
      }),
    });
    return;
  }
  if (path === '/v1/workspaces') {
    workspaceReads += 1;
    await route.fulfill({
      status: 200,
      headers,
      body: JSON.stringify({
        workspaces: [{
          id: '00000000-0000-4000-8000-000000000123',
          name: 'Mock workspace',
          status: 'active',
          membership: { role: 'owner' },
        }],
      }),
    });
    return;
  }
  await route.fulfill({ status: 404, headers, body: '{"error":{"code":"not_found"}}' });
});

const page = await context.newPage();
const other = await context.newPage();
page.setDefaultTimeout(15_000);

try {
  await page.goto(new URL('/app/settings', baseUrl).toString());
  await page.getByText('Not verified', { exact: true }).waitFor();
  await page.getByText('Email not verified', { exact: true }).waitFor();
  const previousMeReads = meReads;
  const previousWorkspaceReads = workspaceReads;

  // The signed-in user follows the verification link in another tab.
  // Simulate the authoritative server having changed its email flag.
  await other.bringToFront();
  verified = true;
  await page.bringToFront();
  // Some headless browsers don't dispatch focus on tab activation.
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));

  await page.getByText('Verified', { exact: true }).waitFor();
  assert.equal(
    await page.getByText('Email not verified', { exact: true }).count(),
    0,
    'The banner must disappear after authoritative confirmation'
  );
  assert.ok(meReads > previousMeReads, 'Returning to tab must refetch /v1/me');
  assert.equal(
    workspaceReads,
    previousWorkspaceReads,
    'Verification refresh must never reload or bootstrap workspaces'
  );
  assert.equal(mutations, 0, 'Verification refresh must not mutate user data');
  console.log('OK verification tab-return reconciliation without bootstrap/mutations');
} finally {
  await page.close();
  await other.close();
  await context.close();
  await browser.close();
}
