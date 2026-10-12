import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';

// Start the website with NEXT_PUBLIC_VELLIRA_LOCAL_PREVIEW=1.
// This smoke checks product UI without authenticating against production.
const baseUrl = process.env.WEBSITE_URL;
if (!baseUrl) throw new Error('WEBSITE_URL is required.');

const browser = await chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();
page.setDefaultTimeout(10_000);

try {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(new URL('/app', baseUrl).toString());
  await page.getByText('Local UI preview', { exact: false }).waitFor();

  const header = page.locator('[data-product-app-header]');
  await header.waitFor();
  assert.equal(
    await header.getByText('Preview workspace').count(),
    0,
    'Local workspace fixture must not be displayed as user identity in header'
  );

  await header.getByRole('button', { name: 'Account menu' }).click();
  for (const name of ['Profile', 'Account settings', 'Billing', 'Sign out']) {
    const item = page.getByRole('menuitem', { name, exact: true });
    await item.waitFor();
    assert.equal(
      await item.locator('svg').count(),
      1,
      `Account action ${name} should use one canonical icon`
    );
  }

  await page.getByRole('menuitem', { name: 'Billing' }).click();
  await page.waitForURL('**/app/settings/billing');
  await page.getByRole('heading', { name: 'Billing' }).waitFor();
  await page.getByText('Billing information is not connected in local UI preview.', {
    exact: false,
  }).waitFor();

  await page.getByRole('link', { name: 'Back to account settings' }).click();
  await page.waitForURL('**/app/settings');
  await page.locator('[data-product-app-header]').getByRole('button', { name: 'Account menu' }).click();
  await page.getByRole('menuitem', { name: 'Profile' }).click();
  await page.waitForURL('**/app/settings#account-state');
  await page.getByRole('heading', { name: 'Account', exact: true }).waitFor();

  await page.goto(new URL('/components?from=app', baseUrl).toString());
  const catalogHeader = page.locator('[data-product-app-header]');
  await catalogHeader.waitFor();
  assert.equal(
    await catalogHeader.getByText('Preview workspace').count(),
    0,
    'Workspace-origin Components should use the same uncluttered header'
  );
  await catalogHeader.getByRole('button', { name: 'Account menu' }).click();
  await page.getByRole('menuitem', { name: 'Billing' }).waitFor();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(new URL('/app', baseUrl).toString());
  await page.locator('[data-product-app-header]').getByRole('button', { name: 'Account menu' }).click();
  await page.getByRole('menuitem', { name: 'Profile' }).waitFor();
  console.log('OK account header/menu: icon actions, billing preview, profile and responsive context');
} finally {
  await page.close();
  await context.close();
  await browser.close();
}
