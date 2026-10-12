/* global document */
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
  await components.click();
  await page.waitForURL('**/components?from=app');
  await page.locator('[data-component-explorer-sidebar]').waitFor();
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
