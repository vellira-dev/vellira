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

  const verification = page.getByText('Verified', { exact: true });
  await verification.waitFor();
  assert.equal(
    await verification.locator('..').locator('svg').count(),
    1,
    'Verified must be paired with the canonical check-in-circle icon'
  );
  await page.getByText('Time zone (device)', { exact: true }).waitFor();
  const detectedTimeZone = await page.evaluate(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone
  );
  await page.getByText(detectedTimeZone, { exact: true }).waitFor();

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
  const themeLayout = await page.evaluate(() => {
    const group = document.querySelector('[role="radiogroup"]');
    const cards = group?.querySelectorAll('input[type="radio"]');
    if (!group || !cards || cards.length !== 4) {
      throw new Error('Expected all four canonical theme radio choices');
    }

    const items = Array.from(cards, (radio) => {
      const wrapper = radio.closest('label');
      const control = wrapper?.querySelector('input + span');
      const icon = wrapper?.querySelector('svg');
      const text = icon?.nextElementSibling;
      const card = wrapper?.getBoundingClientRect();
      const circle = control?.getBoundingClientRect();
      const iconBox = icon?.getBoundingClientRect();
      const textBox = text?.getBoundingClientRect();
      if (!card || !circle || !iconBox || !textBox) {
        throw new Error('Theme choice, radio circle, icon or label is missing');
      }
      return {
        left: card.left,
        top: card.top,
        width: card.width,
        circleInset: circle.left - card.left,
        iconInset: iconBox.left - card.left,
        radioToIconGap: iconBox.left - circle.right,
        cardCenterY: card.top + card.height / 2,
        circleCenterY: circle.top + circle.height / 2,
        iconCenterY: iconBox.top + iconBox.height / 2,
        textCenterY: textBox.top + textBox.height / 2,
      };
    });
    return {
      items,
      groupLeft: group.getBoundingClientRect().left,
    };
  });

  assert.ok(
    Math.abs(themeLayout.items[0].left - themeLayout.groupLeft) <= 1,
    'Theme cards must begin at the left edge of the Theme group'
  );
  assert.ok(
    themeLayout.items.every(
      (item) => Math.abs(item.top - themeLayout.items[0].top) <= 1
    ),
    'All four themes must stay in one row'
  );
  assert.ok(
    themeLayout.items.every(
      (item) => Math.abs(item.width - themeLayout.items[0].width) <= 1
    ),
    'All four theme cards must have equal widths'
  );
  assert.ok(
    themeLayout.items.every(
      (item) =>
        Math.abs(item.circleInset - themeLayout.items[0].circleInset) <= 1 &&
        Math.abs(item.iconInset - themeLayout.items[0].iconInset) <= 1
    ),
    'Radio circles and icons must align in consistent slots within every card'
  );
  assert.ok(
    themeLayout.items.every(
      (item) => Math.abs(item.radioToIconGap - 16) <= 1
    ),
    'Radio to theme-icon spacing must be exactly 16px'
  );
  assert.ok(
    themeLayout.items.every(
      (item) =>
        Math.abs(item.circleCenterY - item.iconCenterY) <= 2 &&
        Math.abs(item.iconCenterY - item.textCenterY) <= 2 &&
        Math.abs(item.cardCenterY - item.iconCenterY) <= 2
    ),
    'Radio circle, theme icon and text must share the vertical center of every card'
  );

  await page.getByText('Dark', { exact: true }).click();
  assert.equal(
    await page.getByRole('radio', { name: 'Dark', exact: true }).isChecked(),
    true
  );
  await page.getByRole('button', { name: 'Theme: Dark' }).waitFor();
  await page.getByText('System', { exact: true }).click();
  assert.equal(
    await page.getByRole('radio', { name: 'System', exact: true }).isChecked(),
    true
  );
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
