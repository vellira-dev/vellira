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
  const logoAlignment = await page.evaluate(() => {
    const brand = document.querySelector(
      '[data-product-app-header] a[aria-label="Vellira home"] img'
    );
    const icon = document.querySelector(
      '#app-sidebar-navigation aside[aria-label="Account navigation"] a[href="/app"] svg'
    );
    if (!brand || !icon) throw new Error('Brand or first nav icon missing');
    return {
      brandLeft: brand.getBoundingClientRect().left,
      iconLeft: icon.getBoundingClientRect().left,
    };
  });
  aligned(logoAlignment.brandLeft, logoAlignment.iconLeft, 'brand/nav icon baseline');

  const expandedInsets = await page.evaluate(() => {
    const nav = document.querySelector('#app-sidebar-navigation');
    const item = nav?.querySelector('a[href="/app"]');
    const panel = nav?.closest('aside');
    if (!item || !panel) throw new Error('Expanded account sidebar missing');
    const link = item.getBoundingClientRect();
    const outer = panel.getBoundingClientRect();
    return {
      left: link.left - outer.left,
      right: outer.right - link.right,
    };
  });
  assert.ok(
    expandedInsets.left >= 10 && expandedInsets.left <= 20,
    `Expanded sidebar left inset too large: ${expandedInsets.left}`
  );
  assert.ok(
    expandedInsets.right >= 10 && expandedInsets.right <= 20,
    `Expanded sidebar right inset too large: ${expandedInsets.right}`
  );
  await page.getByRole('button', { name: 'Collapse sidebar' }).click();
  await page.getByRole('button', { name: 'Expand sidebar' }).waitFor();
  await page.waitForFunction(() => {
    const toggle = document.querySelector('button[aria-label="Expand sidebar"]');
    const nav = document.querySelector('#app-sidebar-navigation');
    const icon = nav?.querySelector('a[href="/app"] svg');
    if (!toggle || !icon) return false;
    return Math.abs(toggle.querySelector('svg').getBoundingClientRect().left -
      icon.getBoundingClientRect().left) <= 1;
  });
  assertGeometry(await measure('Expand sidebar'), 'collapsed');

  const groupDivider = await page
    .locator('#app-sidebar-navigation aside[aria-label="Account navigation"] section + section')
    .evaluate((section) => {
      const line = getComputedStyle(section, '::before');
      const parent = section.getBoundingClientRect();
      const width = Number.parseFloat(line.width);
      return {
        width,
        center: parent.left + parent.width / 2,
        lineCenter: parent.left + parent.width / 2,
        display: line.content,
        color: line.backgroundColor,
      };
    });
  assert.ok(
    groupDivider.width >= 18 && groupDivider.width <= 28,
    'Collapsed separator must be a short, icon-width horizontal line'
  );
  assert.notEqual(groupDivider.display, 'none', 'Divider pseudo-element must exist');
  assert.notEqual(
    groupDivider.color,
    'rgba(0, 0, 0, 0)',
    'Collapsed separator must be painted'
  );

  await page.getByRole('button', { name: 'Expand sidebar' }).click();
  await page.getByRole('button', { name: 'Collapse sidebar' }).waitFor();
  await page.waitForFunction(() => {
    const toggle = document.querySelector('button[aria-label="Collapse sidebar"]');
    const icon = document.querySelector('#app-sidebar-navigation a[href="/app"] svg');
    if (!toggle || !icon) return false;
    return Math.abs(toggle.querySelector('svg').getBoundingClientRect().left -
      icon.getBoundingClientRect().left) <= 1;
  });

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

  await page.emulateMedia({ reducedMotion: 'reduce' });
  const reducedMotion = await page.evaluate(() => {
    const node = document.querySelector('[data-sidebar-collapsed] > div');
    if (!node) throw new Error('Sidebar grid missing');
    return getComputedStyle(node).transitionDuration;
  });
  assert.equal(reducedMotion, '0s', 'Reduced-motion users must not see the sidebar animation');
  await page.emulateMedia({ reducedMotion: 'no-preference' });

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
