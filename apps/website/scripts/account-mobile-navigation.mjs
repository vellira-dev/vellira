/* global document, window */
import assert from 'node:assert/strict';

import { chromium } from '@playwright/test';

// Start the website in development-only account preview, then supply WEBSITE_URL.
const baseUrl = process.env.WEBSITE_URL;
if (!baseUrl) throw new Error('WEBSITE_URL is required.');

const browser = await chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();
page.setDefaultTimeout(15_000);

async function waitForUnlockedScroll() {
  await page.waitForFunction(() => document.body.style.overflow === '');
}

try {
  for (const width of [1100, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 850 });
    await page.goto(new URL('/app', baseUrl).toString());
    await page.getByText('Local UI preview', { exact: false }).waitFor();

    const header = page.locator('[data-product-app-header]');
    const open = header.getByRole('button', {
      name: 'Open workspace navigation',
    });
    await open.waitFor();
    assert.equal(await open.isVisible(), true);
    assert.equal(
      await header.getByRole('button', { name: 'Account menu' }).count(),
      0,
      'Avatar must not occupy the mobile header'
    );
    assert.equal(
      await header.getByRole('button', { name: /^Theme:/ }).count(),
      0,
      'Theme is only in Settings -> Appearance on mobile'
    );

    await open.click();
    const drawer = page.getByRole('dialog', {
      name: 'Workspace navigation',
    });
    await drawer.waitFor();
    const close = drawer.getByRole('button', {
      name: 'Close workspace navigation',
    });
    await close.waitFor();
    assert.equal(await close.count(), 1, 'Exactly one in-drawer X');
    const closeBox = await close.boundingBox();
    assert.ok(
      closeBox && closeBox.width >= 44 && closeBox.height >= 44,
      'The X needs a 44x44px touch target'
    );

    await drawer.getByRole('link', { name: 'Vellira workspace' }).waitFor();
    for (const name of [
      'Overview',
      'Components',
      'Docs',
      'Account settings',
      'Billing',
    ]) {
      await drawer.getByRole('link', { name: new RegExp(name) }).waitFor();
    }
    await drawer.getByRole('button', { name: 'Sign out' }).waitFor();
    assert.equal(
      await drawer.getByText('Appearance', { exact: true }).count(),
      0,
      'No Appearance item may exist in mobile navigation'
    );
    assert.equal(
      await drawer.getByRole('button', { name: /^Theme:/ }).count(),
      0,
      'No ThemeSwitcher may exist in the mobile drawer'
    );
    assert.equal(
      await page.evaluate(() => document.body.style.overflow),
      'hidden',
      'Opening the overlay must lock background scrolling'
    );
    assert.equal(
      await page.locator('main').evaluate((node) => Boolean(node.closest('[inert]'))),
      true,
      'Main content must be inert while the drawer is open'
    );

    // Both account and component drawers use the same imported surface style.
    const workspaceSurfaceClass = await drawer.getAttribute('class');

    await page.keyboard.press('Escape');
    await drawer.waitFor({ state: 'hidden' });
    await waitForUnlockedScroll();
    assert.equal(
      await page.evaluate(() => document.activeElement?.getAttribute('aria-label')),
      'Open workspace navigation',
      'Escape must return focus to the trigger'
    );

    await open.click();
    await drawer.waitFor();
    await close.click();
    await drawer.waitFor({ state: 'hidden' });

    await open.click();
    await drawer.waitFor();
    if (width > 340) {
      await page.getByRole('button', {
        name: 'Dismiss workspace navigation',
      }).click({ position: { x: width - 10, y: 400 } });
    } else {
      await close.click();
    }
    await drawer.waitFor({ state: 'hidden' });

    await open.click();
    await drawer.getByRole('link', { name: 'Components' }).click();
    await page.waitForURL('**/components?from=app');
    await page.locator('[data-product-app-header]').waitFor();
    assert.equal(
      await page.locator('[data-product-app-header]')
        .getByRole('button', { name: /^Theme:/ }).count(),
      0,
      'Contextual Components header must not expose mobile theme'
    );

    await page.getByRole('button', { name: 'Open component navigation' }).click();
    const componentNav = page.locator('#component-navigation');
    await componentNav.waitFor();
    const componentSurfaceClass = await componentNav.evaluate(
      (node) => node.parentElement?.className
    );
    assert.equal(
      workspaceSurfaceClass,
      componentSurfaceClass,
      'Account must use exactly the same sliding surface CSS as Components'
    );
    await componentNav.getByRole('link', { name: 'Account settings' }).waitFor();
    await componentNav.getByRole('link', { name: 'Billing' }).waitFor();
    await componentNav.getByRole('button', { name: 'Sign out' }).waitFor();
    assert.equal(
      await componentNav.getByText('Appearance', { exact: true }).count(),
      0,
      'Contextual Components menu must also omit Appearance'
    );
    assert.equal(
      await componentNav.getByRole('button', { name: /^Theme:/ }).count(),
      0,
      'Contextual Components menu must omit ThemeSwitcher'
    );
    await componentNav.getByRole('link', {
      name: 'Back to workspace',
    }).click();
    await page.waitForURL('**/app');

    if (width === 390) {
      await page.getByRole('button', {
        name: 'Open workspace navigation',
      }).click();
      await page.getByRole('dialog', {
        name: 'Workspace navigation',
      }).getByRole('link', { name: 'Account settings' }).click();
      await page.waitForURL('**/app/settings');
      await page.getByRole('tab', { name: 'Appearance' }).click();
      await page.getByRole('heading', { name: 'Appearance' }).waitFor();
      await page.getByRole('radio', { name: 'Dark' }).waitFor();
    }

    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth
      ),
      false,
      `No horizontal overflow at ${width}px`
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
    await page.getByRole('button', {
      name: 'Open workspace navigation',
      includeHidden: true,
    }).isVisible(),
    false,
    'Desktop must retain its original sidebar and header actions'
  );

  console.log('OK mobile account: Components drawer parity; no theme; X, links, Escape, backdrop and Settings Appearance');
} finally {
  await page.close();
  await context.close();
  await browser.close();
}
