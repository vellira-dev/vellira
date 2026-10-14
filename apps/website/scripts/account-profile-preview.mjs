/* global document, window, getComputedStyle */
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';

// Development-only account fixture. Must never communicate with the backend.
const baseUrl = process.env.WEBSITE_URL;
if (!baseUrl) throw new Error('WEBSITE_URL is required.');

const browser = await chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();
page.setDefaultTimeout(15_000);

const backendRequests = [];
page.on('request', (request) => {
  if (/\/v1\//.test(new URL(request.url()).pathname)) {
    backendRequests.push(request.url());
  }
});

try {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(new URL('/app/settings?section=account', baseUrl).toString());
  await page.getByText('Local UI preview', { exact: false }).waitFor();
  await page.getByRole('heading', { name: 'Alex', exact: true }).waitFor();

  const panel = page.locator('[data-profile-settings]');
  const badge = panel.locator('span').filter({ hasText: /^Active$/ }).first();
  await badge.waitFor();
  assert.equal(await badge.locator('svg').count(), 1, 'Active must include a real Check icon');

  const appearance = await badge.evaluate((element) => ({
    border: getComputedStyle(element).borderTopWidth,
    background: getComputedStyle(element).backgroundColor,
    radius: getComputedStyle(element).borderTopLeftRadius,
  }));
  assert.equal(appearance.border, '0px', 'Active must have no border');
  assert.ok(
    appearance.background !== 'transparent' && appearance.background !== 'rgba(0, 0, 0, 0)',
    'Active must use a visible success background'
  );
  assert.notEqual(appearance.radius, '0px', 'Active must be a pill');

  const fullName = page.getByRole('textbox', { name: 'Full name' });
  const displayName = page.getByRole('textbox', { name: 'Display name' });
  const email = page.getByRole('textbox', { name: 'Email address' });
  const language = page.getByRole('combobox', { name: 'Language' });
  const timeZone = page.getByRole('combobox', { name: 'Time zone' });
  for (const input of [fullName, displayName, language, timeZone]) {
    assert.equal(await input.isEnabled(), true, 'Preview controls must be editable');
  }
  assert.equal(await email.inputValue(), 'alex@example.com');
  assert.equal(await email.getAttribute('readonly'), '', 'Email remains read-only');

  const blockSpacing = await panel.evaluate((root) => {
    const personal = root.querySelector('[data-account-block="personal"]');
    const preferences = root.querySelector('[data-account-block="preferences"]');
    const details = root.querySelector('[data-account-block="details"]');
    const form = root.querySelector('form');
    if (!personal || !preferences || !details || !form) {
      throw new Error('Account profile sections are missing');
    }
    return {
      betweenSections: preferences.getBoundingClientRect().top - personal.getBoundingClientRect().bottom,
      beforeDetails: details.getBoundingClientRect().top - form.getBoundingClientRect().bottom,
    };
  });
  assert.ok(
    blockSpacing.betweenSections >= 36,
    'Desktop Personal information → Preferences needs spacious separation'
  );
  assert.ok(
    blockSpacing.beforeDetails >= 36,
    'Desktop form → Account details needs spacious separation'
  );
  assert.equal(await fullName.inputValue(), 'Alex Morgan');
  assert.equal(await displayName.inputValue(), 'Alex');
  const sizes = await Promise.all([fullName, displayName, language, timeZone].map(async (locator) =>
    locator.evaluate((element) => element.getBoundingClientRect().height)
  ));
  assert.ok(sizes.every((height) => height <= 56), 'Form controls must be compact, got ' + sizes.join(', '));

  await fullName.fill('Ada Lovelace');
  await displayName.fill('Ada');
  await page.getByText('Unsaved changes', { exact: true }).waitFor();
  const save = page.getByRole('button', { name: 'Save changes' });
  assert.equal(await save.isEnabled(), true, 'Local preview should allow saving to a local draft');

  // Local-only save is explicitly labelled. It is not a simulated server success.
  await save.click();
  await page.getByText('Preview saved on this page only.', { exact: false }).waitFor();
  assert.equal(await save.isDisabled(), true);

  await language.click();
  await page.getByRole('option', { name: 'Français' }).click();
  await page.getByText('Unsaved changes', { exact: true }).waitFor();

  for (const width of [768, 390, 320]) {
    await page.setViewportSize({ width, height: 850 });
    await page.getByRole('heading', { name: 'Ada', exact: true }).waitFor();
    if (width === 390) {
      const gap = await panel.evaluate((root) => {
        const personal = root.querySelector('[data-account-block="personal"]');
        const preferences = root.querySelector('[data-account-block="preferences"]');
        if (!personal || !preferences) throw new Error('Missing account section');
        return preferences.getBoundingClientRect().top - personal.getBoundingClientRect().bottom;
      });
      assert.ok(gap >= 28, 'Mobile account sections require generous spacing');
    }
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth),
      false,
      'Profile overflow on ' + width + 'px viewport'
    );
  }

  assert.deepEqual(backendRequests, [], 'Local Account preview may not access the real backend');
  console.log('OK compact Account UI: Active pill/check, editable preview, local save, and mobile geometry');
} finally {
  await page.close();
  await context.close();
  await browser.close();
}
