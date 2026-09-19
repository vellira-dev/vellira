/* global document, getComputedStyle, window */
import assert from 'node:assert/strict';

import { chromium } from '@playwright/test';

const baseUrl = process.env.WEBSITE_URL;

if (!baseUrl) {
  throw new Error('WEBSITE_URL is required.');
}

const browser = await chromium.launch();
const context = await browser.newContext();

function approximately(actual, expected, tolerance, label) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${label}: expected ${expected} +/- ${tolerance}, received ${actual}`
  );
}

async function openPage(viewport, slug = 'button') {
  const page = await context.newPage();
  page.setDefaultTimeout(10_000);
  await page.setViewportSize(viewport);
  await page.goto(new URL(`/components/${slug}`, baseUrl).toString(), {
    waitUntil: 'domcontentloaded',
    timeout: 30_000,
  });
  await page.locator('[data-component-explorer]').waitFor({
    state: 'visible',
    timeout: 15_000,
  });
  return page;
}

async function assertDesktopGeometry(width) {
  const page = await openPage({ width, height: 1080 });
  try {
    const geometry = await page.evaluate(() => {
      const explorer = document.querySelector('[data-component-explorer]');
      const sidebar = document.querySelector(
        '[data-component-explorer-sidebar]'
      );
      const main = document.querySelector('[data-component-explorer-main]');
      if (!(explorer && sidebar && main))
        throw new Error('Explorer markup missing');

      const explorerStyle = getComputedStyle(explorer);
      const box = (element) => element.getBoundingClientRect().toJSON();

      return {
        explorer: box(explorer),
        sidebar: box(sidebar),
        main: box(main),
        viewportWidth: window.innerWidth,
        maxWidth: explorerStyle.maxWidth,
        marginLeft: explorerStyle.marginLeft,
        marginRight: explorerStyle.marginRight,
        paddingLeft: explorerStyle.paddingLeft,
        siteGutter: Number.parseFloat(explorerStyle.paddingLeft),
        sidebarWidth: sidebar.getBoundingClientRect().width,
      };
    });

    approximately(geometry.explorer.x, 0, 1, `${width}px explorer left`);
    approximately(
      geometry.explorer.width,
      geometry.viewportWidth,
      1,
      `${width}px explorer width`
    );
    assert.notEqual(
      geometry.maxWidth,
      '1280px',
      `${width}px explorer must not inherit the marketing wide container`
    );
    approximately(
      Number.parseFloat(geometry.marginLeft),
      0,
      1,
      `${width}px explorer margin-left`
    );
    approximately(
      Number.parseFloat(geometry.marginRight),
      0,
      1,
      `${width}px explorer margin-right`
    );
    approximately(
      geometry.sidebar.x,
      geometry.siteGutter,
      1,
      `${width}px sidebar left`
    );
    approximately(
      geometry.sidebar.width,
      geometry.sidebarWidth,
      1,
      `${width}px sidebar width`
    );
    approximately(
      geometry.main.x,
      geometry.siteGutter + geometry.sidebarWidth,
      1,
      `${width}px main left`
    );
    console.log(`OK component explorer desktop geometry at ${width}px`);
  } finally {
    await page.close();
  }
}

await assertDesktopGeometry(1920);
await assertDesktopGeometry(1440);
await assertDesktopGeometry(1101);

for (const slug of ['checkbox', 'switch']) {
  const page = await openPage({ width: 1440, height: 900 }, slug);
  await page.close();
  console.log(`OK component explorer route smoke /components/${slug}`);
}

const compact = await openPage({ width: 1100, height: 900 });
try {
  await assert.rejects(
    compact.locator('[data-component-explorer-sidebar]').waitFor({
      state: 'visible',
      timeout: 500,
    })
  );
  await assert.doesNotReject(
    compact.getByRole('button', { name: 'Open component navigation' }).waitFor({
      state: 'visible',
    })
  );
  console.log('OK component explorer switches to mobile navigation at 1100px');
} finally {
  await compact.close();
}

const mobile = await openPage({ width: 390, height: 844 });
try {
  const trigger = mobile.getByRole('button', {
    name: 'Open component navigation',
  });
  await trigger.click();
  const navigation = mobile.locator('#component-navigation');
  await navigation.waitFor({ state: 'visible' });
  await mobile
    .getByRole('link', { name: 'Checkbox', exact: true })
    .click({ noWaitAfter: true });
  await mobile.waitForURL('**/components/checkbox', { timeout: 10_000 });
  await mobile
    .getByRole('button', { name: 'Open component navigation' })
    .click();
  await mobile.keyboard.press('Escape');
  await navigation.waitFor({ state: 'hidden' });
  assert.equal(
    await mobile.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth
    ),
    false,
    'Mobile component navigation must not introduce horizontal overflow'
  );
  console.log(
    'OK component explorer mobile navigation opens, navigates, closes, and fits'
  );
} finally {
  await mobile.close();
  await context.close();
  await browser.close();
}
