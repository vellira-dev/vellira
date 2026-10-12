/* global document, getComputedStyle */
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';

// Run against a development-only account preview:
// NEXT_PUBLIC_VELLIRA_LOCAL_PREVIEW=1 pnpm --filter @vellira-ui/website exec next dev -p 3001
// WEBSITE_URL=http://localhost:3001 pnpm --filter @vellira-ui/website test:account-components-navigation
const baseUrl = process.env.WEBSITE_URL;
if (!baseUrl) throw new Error('WEBSITE_URL is required.');

const browser = await chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();
page.setDefaultTimeout(15_000);

try {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(new URL('/app', baseUrl).toString());
  await page.getByText('Local UI preview', { exact: false }).waitFor();

  const nav = page.locator('#app-sidebar-navigation');
  const overview = nav.getByRole('link', { name: 'Overview' });
  const components = nav.getByRole('link', { name: 'Components' });
  assert.ok(
    (await overview.boundingBox()).y < (await components.boundingBox()).y,
    'Components must appear directly below Overview in primary app navigation'
  );
  const appIconBaseline = (await overview.locator('svg').boundingBox()).x;
  await components.click();
  await page.waitForURL('**/components?from=app');
  await page.locator('[data-component-explorer-sidebar]').waitFor();
  const componentGutters = await page.evaluate(() => {
    const panel = document.querySelector('[data-component-explorer-sidebar]');
    const heading = panel?.querySelector(
      'aside[aria-label="Component navigation"] h2'
    );
    const buttonLink = panel?.querySelector('a[href*="/components/button"]');
    const buttonName = buttonLink?.querySelector('span');
    if (!panel || !heading || !buttonLink || !buttonName) {
      throw new Error('Component sidebar label or Button link missing');
    }
    const text = document.createRange();
    text.selectNodeContents(heading);
    return {
      headingLeft: text.getBoundingClientRect().left,
      itemLeft: buttonName.getBoundingClientRect().left,
      rightInset:
        panel.getBoundingClientRect().right -
        buttonLink.getBoundingClientRect().right,
      labelColor: getComputedStyle(heading).color,
      itemColor: getComputedStyle(buttonLink).color,
    };
  });
  assert.ok(
    Math.abs(componentGutters.headingLeft - componentGutters.itemLeft) <= 1,
    'Component group headings must align with component names'
  );
  assert.ok(
    Math.abs(componentGutters.itemLeft - appIconBaseline) <= 1,
    'App and component catalogs must share the same navigation baseline'
  );
  assert.ok(
    Math.abs(componentGutters.rightInset - 16) <= 1,
    'Component sidebar must share the 16px trailing inset'
  );
  assert.notEqual(
    componentGutters.labelColor,
    componentGutters.itemColor,
    'Component group heading must be muted relative to menu items'
  );
  const back = page.getByRole('link', { name: 'Back to workspace' });
  await back.waitFor();

  // Workspace context must preserve the same real product header + avatar menu.
  await page.locator('[data-product-app-header]').waitFor();
  await page.getByRole('button', { name: 'Account menu' }).waitFor();

  // Catalog content owns a nested scroll container. The filter bar must pin
  // directly beneath the product header, not 68px lower over the cards.
  await page.locator('[data-component-explorer-main]').evaluate((element) => {
    element.scrollTop = 550;
  });
  await page.waitForFunction(() => {
    const toolbar = document.querySelector('[data-component-catalog-toolbar]');
    const header = document.querySelector('[data-product-app-header]');
    const main = document.querySelector('[data-component-explorer-main]');
    if (!toolbar || !header || !main || main.scrollTop < 400) return false;
    const toolbarTop = toolbar.getBoundingClientRect().top;
    const headerBottom = header.getBoundingClientRect().bottom;
    return Math.abs(toolbarTop - headerBottom) <= 2;
  });

  await page
    .locator('[data-component-explorer-sidebar]')
    .getByRole('link', { name: 'Button', exact: true })
    .click();
  await page.waitForURL('**/components/button?from=app');
  await back.waitFor();
  await page.locator('[data-product-app-header]').waitFor();
  await page.getByRole('button', { name: 'Account menu' }).waitFor();

  // Back stays above the independently scrollable component list.
  const topBefore = (await back.boundingBox()).y;
  await page.evaluate(() => {
    const nav = document.querySelector('[data-component-explorer-sidebar]');
    const list = nav?.querySelector('[class*="desktopList"]');
    if (!list) throw new Error('Component sidebar scroll list is missing');
    const filler = document.createElement('div');
    filler.style.height = '3000px';
    filler.setAttribute('aria-hidden', 'true');
    list.appendChild(filler);
    list.scrollTop = list.scrollHeight;
  });
  const topAfter = (await back.boundingBox()).y;
  assert.ok(Math.abs(topBefore - topAfter) <= 1, 'Back must not scroll with the list');

  await back.click();
  await page.waitForURL('**/app');
  await page.getByRole('heading', { name: 'Start building with Vellira' }).waitFor();

  // No account-only affordances on directly opened public routes.
  const publicPage = await context.newPage();
  await publicPage.setViewportSize({ width: 1440, height: 900 });
  await publicPage.goto(new URL('/components/button', baseUrl).toString());
  await publicPage.locator('[data-component-explorer-sidebar]').waitFor();
  assert.equal(
    await publicPage.locator('[data-product-app-header]').count(),
    0,
    'Direct public component pages must retain the marketing header'
  );
  assert.equal(
    await publicPage.getByRole('link', { name: 'Back to workspace' }).count(),
    0,
    'Public deep link must remain independent from the account'
  );
  await publicPage.goto(new URL('/components', baseUrl).toString());
  assert.equal(
    await publicPage.locator('[data-component-explorer]').count(),
    0,
    'Direct catalog landing page must keep its existing public layout'
  );
  await publicPage.close();

  // At mobile widths the return is available inside the existing component menu.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(new URL('/components/button?from=app', baseUrl).toString());
  await page.locator('[data-product-app-header]').waitFor();
  await page.getByRole('button', { name: 'Account menu' }).waitFor();
  await page.getByRole('button', { name: 'Open component navigation' }).click();
  const mobileReturn = page.getByRole('link', { name: 'Back to workspace' });
  await mobileReturn.waitFor();
  await mobileReturn.click();
  await page.waitForURL('**/app');

  console.log('OK Core Components drill-down, direct public routes, desktop/mobile return');
} finally {
  await page.close();
  await context.close();
  await browser.close();
}
