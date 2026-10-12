/* global document, window */
import assert from 'node:assert/strict';

import { chromium } from '@playwright/test';

// Run using the existing development-only account preview:
// NEXT_PUBLIC_VELLIRA_LOCAL_PREVIEW=1 pnpm --filter @vellira-ui/website exec next dev -p 3001
// WEBSITE_URL=http://localhost:3001 pnpm --filter @vellira-ui/website test:account-mobile-navigation
const baseUrl = process.env.WEBSITE_URL;
if (!baseUrl) throw new Error('WEBSITE_URL is required.');

const browser = await chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();
page.setDefaultTimeout(15_000);

try {
  for (const width of [1100, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 850 });
    await page.goto(new URL('/app', baseUrl).toString());
    await page.getByText('Local UI preview', { exact: false }).waitFor();

    const open = page.getByRole('button', { name: 'Open workspace navigation' });
    await open.waitFor();
    assert.equal(await open.isVisible(), true, `Menu trigger missing at ${width}px`);
    const productHeader = page.locator('[data-product-app-header]');
    assert.equal(
      await productHeader.getByRole('button', { name: 'Account menu' }).count(),
      0,
      'Account avatar must not occupy the mobile header'
    );
    assert.equal(
      await productHeader.getByRole('button', { name: /^Theme:/ }).count(),
      0,
      'Theme selector belongs inside the mobile menu'
    );
    assert.equal(
      await page.getByRole('button', { name: 'Collapse sidebar', includeHidden: true }).isVisible(),
      false,
      `Desktop-only collapse button visible at ${width}px`
    );

    await open.click();
    const dialog = page.getByRole('dialog', { name: 'Workspace navigation' });
    await dialog.waitFor();
    await page.getByRole('button', { name: 'Close workspace navigation' }).first().waitFor();

    for (const name of ['Overview', 'Components', 'Docs', 'Account settings', 'Billing']) {
      await dialog.getByRole('link', { name: new RegExp(name) }).waitFor();
    }
    await dialog.getByRole('button', { name: 'Sign out' }).waitFor();
    await dialog.getByRole('button', { name: /^Theme:/ }).waitFor();
    if (width === 390) {
      // Theme dropdown is portal-backed. Its sheet must remain on top of the
      // mobile drawer/backdrop and be genuinely clickable, not just present.
      await dialog.getByRole('button', { name: /^Theme:/ }).click();
      await page.getByRole('menuitemradio', { name: 'Dark' }).click();
      await dialog.getByRole('button', { name: 'Theme: Dark' }).waitFor();
    }
    assert.equal(
      await productHeader.getByRole('button', { name: 'Close workspace navigation' }).count(),
      1,
      'Only one visible Close (X) action belongs in the header'
    );
    assert.equal(
      await page.evaluate(() => document.body.style.overflow),
      'hidden',
      'Opened drawer must lock document scrolling'
    );
    assert.equal(
      await page.locator('main').evaluate((main) => main.closest('[inert]') !== null),
      true,
      'Background content must not accept focus while modal navigation is open'
    );
    assert.equal(
      await page.locator('[data-product-app-header]')
        .getByRole('button', { name: 'Close workspace navigation' })
        .getAttribute('aria-expanded'),
      'true'
    );

    await page.keyboard.press('Escape');
    await dialog.waitFor({ state: 'hidden' });
    assert.equal(
      await page.getByRole('menuitemradio').count(),
      0,
      'Closing the mobile drawer must also unmount any nested theme dropdown'
    );
    assert.equal(
      await page.evaluate(() => document.body.style.overflow),
      '',
      'Escape must unlock document scrolling'
    );
    assert.equal(
      await page.evaluate(
        () => document.activeElement?.getAttribute('aria-label')
      ),
      'Open workspace navigation',
      'Escape must return keyboard focus to the hamburger'
    );

    await page.getByRole('button', { name: 'Open workspace navigation' }).click();
    await dialog.waitFor();
    if (width > 340) {
      const backdrop = page.locator(
        'button[aria-label="Dismiss workspace navigation"]'
      );
      await backdrop.click({ position: { x: width - 10, y: 400 } });
    } else {
      // At 320px the slide-out fills the entire width: no outside backdrop.
      await page.locator('[data-product-app-header]')
        .getByRole('button', { name: 'Close workspace navigation' }).click();
    }
    await dialog.waitFor({ state: 'hidden' });

    await page.getByRole('button', { name: 'Open workspace navigation' }).click();
    await dialog.waitFor();
    await productHeader.getByRole('button', { name: 'Close workspace navigation' }).click();
    await dialog.waitFor({ state: 'hidden' });

    await page.getByRole('button', { name: 'Open workspace navigation' }).click();
    await dialog.getByRole('link', { name: 'Components' }).click();
    await page.waitForURL('**/components?from=app');
    await page.locator('[data-product-app-header]').waitFor();
    await page.getByRole('button', { name: 'Open component navigation' }).waitFor();
    assert.equal(
      await page.locator('[data-product-app-header]')
        .getByRole('button', { name: 'Account menu' }).count(),
      0,
      'Workspace-origin Components should also hide the avatar on mobile'
    );

    await page.getByRole('button', { name: 'Open component navigation' }).click();
    const componentDrawer = page.locator('#component-navigation');
    await componentDrawer.getByRole('link', { name: 'Account settings' }).waitFor();
    await componentDrawer.getByRole('link', { name: 'Billing' }).waitFor();
    await componentDrawer.getByRole('button', { name: 'Sign out' }).waitFor();
    await componentDrawer.getByRole('button', { name: /^Theme:/ }).waitFor();
    await page.locator('#component-navigation')
      .getByRole('link', { name: 'Back to workspace' }).click();
    await page.waitForURL('**/app');
    await page.getByRole('button', { name: 'Open workspace navigation' }).waitFor();
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth),
      false,
      `Mobile navigation must not cause horizontal overflow at ${width}px`
    );
  }

  await page.setViewportSize({ width: 1200, height: 900 });
  await page.goto(new URL('/app', baseUrl).toString());
  await page.getByRole('button', { name: 'Collapse sidebar' }).waitFor();
  await page.locator('[data-product-app-header]')
    .getByRole('button', { name: 'Account menu' }).waitFor();
  await page.locator('[data-product-app-header]')
    .getByRole('button', { name: /^Theme:/ }).waitFor();
  assert.equal(
    await page.getByRole('button', { name: 'Open workspace navigation', includeHidden: true }).isVisible(),
    false,
    'Desktop layout should use the existing sidebar instead of a hamburger'
  );

  console.log('OK account mobile nav: tablet/phone, overlay, Escape, backdrop, route and catalog return');
} finally {
  await page.close();
  await context.close();
  await browser.close();
}
