/* global document, window, getComputedStyle */
import assert from 'node:assert/strict';

import { chromium } from '@playwright/test';

// Start the website in the development-only preview mode, then set WEBSITE_URL
// to that local origin. Real sessions and production API calls are not needed.
const baseUrl = process.env.WEBSITE_URL;
if (!baseUrl) throw new Error('WEBSITE_URL is required.');

const browser = await chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();
page.setDefaultTimeout(10_000);

async function measure(label) {
  return page.evaluate((buttonLabel) => {
    const toggle = document.querySelector(
      `button[aria-label="${buttonLabel}"]`
    );
    const navIcon = document.querySelector(
      '#app-sidebar-navigation aside[aria-label="Account navigation"] a[href="/app"] svg'
    );
    const footer = toggle?.parentElement;
    const sidebar = toggle?.closest('aside');
    const buttonIcon = toggle?.querySelector('svg');
    if (!navIcon || !footer || !sidebar || !buttonIcon) {
      throw new Error('Sidebar navigation, icon or footer is missing');
    }
    const box = (element) => element.getBoundingClientRect();
    return {
      navLeft: box(navIcon).left,
      toggleLeft: box(buttonIcon).left,
      footerRight: box(footer).right,
      sidebarRight: box(sidebar).right,
      footerBottom: box(footer).bottom,
      viewportBottom: window.innerHeight,
    };
  }, label);
}

function aligned(actual, expected, label) {
  assert.ok(
    Math.abs(actual - expected) <= 1,
    `${label}: expected ${expected}, received ${actual}`
  );
}

function assertGeometry(geometry, state) {
  aligned(geometry.toggleLeft, geometry.navLeft, `${state}: icon left`);
  aligned(geometry.footerRight, geometry.sidebarRight, `${state}: full divider width`);
  aligned(geometry.footerBottom, geometry.viewportBottom, `${state}: fixed footer bottom`);
}

try {
  await page.setViewportSize({ width: 1440, height: 800 });
  await page.goto(new URL('/app', baseUrl).toString(), {
    waitUntil: 'domcontentloaded',
  });
  await page.getByText('Local UI preview', { exact: false }).waitFor();
  await page.getByRole('button', { name: 'Collapse sidebar' }).waitFor();

  assertGeometry(await measure('Collapse sidebar'), 'expanded');
  await page.getByRole('button', { name: 'Collapse sidebar' }).click();
  await page.getByRole('button', { name: 'Expand sidebar' }).waitFor();
  assertGeometry(await measure('Expand sidebar'), 'collapsed');

  const groupDivider = await page
    .locator('#app-sidebar-navigation aside[aria-label="Account navigation"] section + section')
    .evaluate((section) => ({
      width: Number.parseFloat(getComputedStyle(section).borderTopWidth),
      style: getComputedStyle(section).borderTopStyle,
    }));
  assert.equal(groupDivider.style, 'solid', 'Collapsed groups must have a divider');
  assert.ok(groupDivider.width >= 1, 'Collapsed group divider must remain visible');

  await page.getByRole('button', { name: 'Expand sidebar' }).click();
  await page.getByRole('button', { name: 'Collapse sidebar' }).waitFor();

  const scroll = await page.evaluate(() => {
    const navigation = document.querySelector('#app-sidebar-navigation');
    if (!navigation) throw new Error('Sidebar scroll container is missing');
    const filler = document.createElement('div');
    filler.style.height = '2200px';
    filler.setAttribute('aria-hidden', 'true');
    navigation.appendChild(filler);
    navigation.scrollTop = navigation.scrollHeight;
    return navigation.scrollTop;
  });
  assert.ok(scroll > 0, 'Long navigation must scroll independently');
  assertGeometry(await measure('Collapse sidebar'), 'expanded after scroll');

  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(
    await page.getByRole('button', { name: 'Collapse sidebar', includeHidden: true }).isVisible(),
    false,
    'Desktop collapse action must be hidden in the mobile layout'
  );
  console.log('OK account sidebar: expanded/collapsed, alignment, footer and scroll');
} finally {
  await page.close();
  await context.close();
  await browser.close();
}
