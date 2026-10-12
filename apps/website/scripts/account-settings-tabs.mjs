/* global document, window */
import assert from 'node:assert/strict';

import { chromium } from '@playwright/test';

// Run website with NEXT_PUBLIC_VELLIRA_LOCAL_PREVIEW=1 and supply WEBSITE_URL.
const baseUrl = process.env.WEBSITE_URL;
if (!baseUrl) throw new Error('WEBSITE_URL is required.');

const browser = await chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();
page.setDefaultTimeout(15_000);

async function selectTab(tab, expectedSection) {
  await page.getByRole('tab', { name: tab, exact: true }).click();
  if (expectedSection === 'billing') {
    await page.waitForURL('**/app/settings/billing');
  } else {
    await page.waitForURL(`**/app/settings?section=${expectedSection}`);
  }
  await page.getByRole('tab', { name: tab, exact: true }).waitFor({
    state: 'visible',
  });
  assert.equal(
    await page.getByRole('tab', { name: tab, exact: true }).getAttribute('aria-selected'),
    'true',
    `${tab} must be the active tab`
  );
}

try {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(new URL('/app/settings', baseUrl).toString());
  await page.getByText('Local UI preview', { exact: false }).waitFor();

  const settings = page.locator('[data-account-settings]');
  await settings.waitFor();
  await page.getByRole('heading', { name: 'Settings', exact: true }).waitFor();
  assert.equal(
    await page.getByRole('tablist', { name: 'Account settings sections' }).count(),
    1
  );
  assert.equal(
    await page.getByRole('button', { name: 'Sign out' }).count(),
    0,
    'Sign out belongs in the avatar menu, not in settings'
  );

  await selectTab('Security', 'security');
  await page.getByRole('heading', { name: 'Security & sign-in' }).waitFor();
  await page.getByRole('link', { name: 'Recover password' }).waitFor();

  await selectTab('Workspace', 'workspace');
  await page.getByRole('heading', { name: 'Workspace', exact: true }).waitFor();
  await page.getByText('Preview workspace').waitFor();
  await page.getByText('owner', { exact: true }).waitFor();

  await selectTab('Appearance', 'appearance');
  await page.getByRole('heading', { name: 'Appearance' }).waitFor();
  await page.getByRole('radio', { name: 'Dark', exact: true }).check();
  await page.getByRole('button', { name: 'Theme: Dark' }).waitFor();
  await page.getByRole('radio', { name: 'System', exact: true }).check();
  await page.getByRole('button', { name: 'Theme: System' }).waitFor();
  await page.getByRole('radio', { name: 'High contrast', exact: true }).waitFor();

  await selectTab('Billing', 'billing');
  await page.getByRole('heading', { name: 'Subscription' }).waitFor();
  await page.getByText('Billing information is not connected in local UI preview.', {
    exact: false,
  }).waitFor();

  await page.goBack();
  await page.waitForURL('**/app/settings?section=appearance');
  assert.equal(
    await page.getByRole('tab', { name: 'Appearance' }).getAttribute('aria-selected'),
    'true'
  );

  for (const width of [768, 390, 320]) {
    await page.setViewportSize({ width, height: 850 });
    await page.goto(new URL('/app/settings?section=appearance', baseUrl).toString());
    await page.getByRole('radio', { name: 'System', exact: true }).waitFor();
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth),
      false,
      `Settings must fit viewport ${width}px without horizontal overflow`
    );
  }

  await page.goto(new URL('/app/settings/billing', baseUrl).toString());
  await page.getByRole('tab', { name: 'Billing' }).waitFor();
  await page.getByRole('heading', { name: 'Subscription' }).waitFor();

  console.log('OK tabbed Settings: URL navigation, appearance, billing, mobile and history');
} finally {
  await page.close();
  await context.close();
  await browser.close();
}
