/* global document, window, getComputedStyle */
import assert from 'node:assert/strict';

import { chromium } from '@playwright/test';

// Start website in local account preview and set WEBSITE_URL to its origin.
const baseUrl = process.env.WEBSITE_URL;
if (!baseUrl) throw new Error('WEBSITE_URL is required.');

const browser = await chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();
page.setDefaultTimeout(15_000);

async function headerGeometry(header) {
  return header.evaluate((element) => {
    const container = element.firstElementChild;
    const brand = element.querySelector('a[aria-label="Vellira home"] img');
    const actions = container?.lastElementChild;
    if (!brand || !container || !actions) {
      throw new Error('Canonical header chrome is missing');
    }
    const headerBox = element.getBoundingClientRect();
    return {
      chromeClass: element.classList[0],
      containerClass: container.classList[0],
      actionsClass: actions.classList[0],
      brandX: brand.getBoundingClientRect().x,
      headerHeight: headerBox.height,
      brandWidth: brand.getBoundingClientRect().width,
    };
  });
}

function sameChrome(left, right, label) {
  assert.equal(left.chromeClass, right.chromeClass, `${label}: shared header`);
  assert.equal(
    left.containerClass,
    right.containerClass,
    `${label}: shared container`
  );
  assert.equal(
    left.actionsClass,
    right.actionsClass,
    `${label}: shared action alignment`
  );
  for (const key of ['brandX', 'headerHeight', 'brandWidth']) {
    assert.ok(
      Math.abs(left[key] - right[key]) <= 1,
      `${label}: ${key} must match (actual ${left[key]} vs ${right[key]})`
    );
  }
}

try {
  for (const width of [1100, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 850 });
    await page.goto(new URL('/app', baseUrl).toString());
    await page.getByText('Local UI preview', { exact: false }).waitFor();

    const header = page.locator('[data-product-app-header]');
    const appChrome = await headerGeometry(header);
    const appLogo = await header
      .getByRole('link', { name: 'Vellira home' })
      .locator('img')
      .boundingBox();
    assert.ok(appLogo, 'Header logo must be measurable');
    const open = header.getByRole('button', {
      name: 'Open workspace navigation',
    });
    await open.waitFor();
    assert.ok(await open.isVisible());
    const appTrigger = await open.boundingBox();
    assert.ok(appTrigger && appTrigger.width >= 44 && appTrigger.height >= 44);
    assert.equal(
      await header.getByRole('button', { name: 'Account menu' }).count(),
      0,
      'Account avatar is hidden in the mobile header'
    );
    assert.equal(
      await header.getByRole('button', { name: /^Theme:/ }).count(),
      0,
      'Mobile product theme belongs only in Settings -> Appearance'
    );

    assert.equal(
      await page.locator('#app-mobile-navigation').count(),
      0,
      'Closed workspace menu must be unmounted, just like Components'
    );
    await open.click();
    const drawer = page.getByRole('dialog', {
      name: 'Workspace navigation',
    });
    await drawer.waitFor();
    assert.equal(
      await drawer.evaluate((node) =>
        node.getAnimations().some((animation) => animation.playState === 'running')
      ),
      false,
      'Workspace menu must appear immediately, not slide in on open'
    );
    const openedLogo = await drawer
      .getByRole('link', { name: 'Vellira workspace' })
      .locator('img')
      .boundingBox();
    assert.ok(openedLogo, 'Opened drawer must render the canonical brand');
    assert.ok(
      Math.abs(openedLogo.width - appLogo.width) <= 1 &&
        Math.abs(openedLogo.height - appLogo.height) <= 1,
      `Workspace logo must not resize on menu open at ${width}px`
    );
    assert.equal(
      await drawer.getByRole('button', { name: 'Close workspace navigation' }).count(),
      0,
      'Account drawer must not invent an extra X absent from Components'
    );
    await drawer.getByRole('link', { name: 'Vellira workspace' }).waitFor();
    for (const name of [
      'Overview',
      'Components',
      'Docs',
      'Account settings',
      'Billing',
    ]) {
      await drawer.getByRole('link', { name: name, exact: name !== 'Docs' }).waitFor();
    }
    await drawer.getByRole('button', { name: 'Sign out' }).waitFor();
    assert.equal(
      await drawer.getByRole('button', { name: /^Theme:/ }).count(),
      0,
      'Appearance controls must not appear inside account navigation'
    );

    const separator = await page.locator('[class*="mobileAccountFooter"]')
      .evaluate((element) => {
        const rule = getComputedStyle(element, '::before');
        return {
          left: Number.parseFloat(rule.left),
          width: Number.parseFloat(rule.width),
          parentWidth: element.getBoundingClientRect().width,
        };
      });
    assert.ok(Math.abs(separator.left - 26) <= 1, 'Account divider begins at icon baseline');
    assert.ok(separator.width < separator.parentWidth - 26);

    assert.equal(
      await page.evaluate(() => document.body.style.overflow),
      'hidden',
      'Open drawer locks page scrolling'
    );
    assert.equal(
      await page.locator('main').evaluate((node) => Boolean(node.closest('[inert]'))),
      true,
      'Page content must be inert during navigation'
    );

    const workspaceSurfaceClass = await drawer.evaluate(
      (node) => node.classList[0]
    );

    await page.keyboard.press('Escape');
    await drawer.waitFor({ state: 'hidden' });
    assert.equal(
      await page.locator('#app-mobile-navigation').count(),
      0,
      'Closing workspace menu must unmount the overlay like Components'
    );
    await page.waitForFunction(() => document.body.style.overflow === '');
    assert.equal(
      await page.evaluate(() => document.activeElement?.getAttribute('aria-label')),
      'Open workspace navigation',
      'Escape must restore keyboard focus to the Menu trigger'
    );

    await open.click();
    await drawer.waitFor();
    // If the drawer occupies the entire screen, Escape remains available.
    const panelWidth = (await drawer.boundingBox()).width;
    if (panelWidth < width - 10) {
      await page.getByRole('button', {
        name: 'Dismiss workspace navigation',
      }).click({ position: { x: width - 6, y: 400 } });
    } else {
      await page.keyboard.press('Escape');
    }
    await drawer.waitFor({ state: 'hidden' });

    await open.click();
    await drawer.getByRole('link', { name: 'Components' }).click();
    await page.waitForURL('**/components?from=app');
    await page.locator('[data-product-app-header]').waitFor();
    const contextual = await headerGeometry(
      page.locator('[data-product-app-header]')
    );
    sameChrome(appChrome, contextual, 'App / contextual Components');

    const componentTrigger = page.getByRole('button', {
      name: 'Open component navigation',
    });
    const componentButton = await componentTrigger.boundingBox();
    assert.ok(componentButton && componentButton.width >= 44);
    assert.ok(
      Math.abs(componentButton.width - appTrigger.width) <= 1 &&
        Math.abs(componentButton.height - appTrigger.height) <= 1,
      'Workspace and Components must use the same Menu button geometry'
    );
    assert.equal(
      await page.locator('#component-navigation').count(),
      0,
      'Closed Components drawer must be unmounted'
    );
    await componentTrigger.click();
    const componentsDrawer = page.locator('#component-navigation');
    await componentsDrawer.waitFor();
    await page.waitForFunction(() => document.activeElement?.textContent?.includes('Back to workspace'));
    assert.equal(
      await componentsDrawer.getByRole('button', { name: 'Back to workspace' })
        .evaluate((element) => document.activeElement === element),
      true,
      'Workspace -> Components must focus the new drawer action'
    );
    assert.equal(
      await page.locator('[data-components-content-boundary]')
        .evaluate((element) => element.inert),
      true,
      'Catalog content must be inert while the Components drawer is open'
    );
    assert.equal(
      await componentsDrawer.locator('..').evaluate((node) =>
        node.getAnimations().some((animation) => animation.playState === 'running')
      ),
      false,
      'Components opens without slide animation, as does workspace'
    );
    const contextualOpenedLogo = await componentsDrawer
      .locator('..')
      .getByRole('link', { name: 'Vellira home' })
      .locator('img')
      .boundingBox();
    assert.ok(contextualOpenedLogo, 'Components drawer logo must be measurable');
    assert.ok(
      Math.abs(contextualOpenedLogo.width - contextual.brandWidth) <= 1 &&
        Math.abs(contextualOpenedLogo.height - appLogo.height) <= 1,
      `Components logo must not resize on menu open at ${width}px`
    );
    const contextualSurfaceClass = await componentsDrawer.evaluate(
      (node) => node.parentElement?.classList[0]
    );
    assert.equal(
      contextualSurfaceClass,
      workspaceSurfaceClass,
      'Workspace and Components must reuse the same sliding surface'
    );

    const componentBack = componentsDrawer.getByRole('button', {
      name: 'Back to workspace',
      exact: true,
    });
    await componentBack.waitFor();
    assert.equal(
      await componentsDrawer.getByRole('link', { name: 'Overview' }).count(),
      0,
      'The malformed Overview row must not appear in Components'
    );
    assert.equal(
      await page.locator('[data-component-explorer-main]')
        .getByRole('link', { name: 'Back to workspace' }).count(),
      0,
      'The Components page hero must not contain a second Back link'
    );
    assert.equal(
      await page.getByRole('button', { name: 'Back to workspace' }).count(),
      1,
      'Exactly one Back to workspace action belongs inside the component menu'
    );
    assert.equal(
      await componentsDrawer.getByRole('link', { name: 'Account settings' }).count(),
      0,
      'Component navigation must not include account actions'
    );
    assert.equal(
      await componentsDrawer.getByRole('button', { name: /^Theme:/ }).count(),
      0,
      'Component navigation must not include appearance controls'
    );
    const nestedUrl = page.url();
    await componentBack.click();
    const workspaceMenu = page.getByRole('dialog', {
      name: 'Workspace navigation',
    });
    await workspaceMenu.waitFor();
    assert.equal(
      await page.locator('[data-components-content-boundary]')
        .evaluate((element) => element.inert),
      true,
      'Catalog content must remain inert behind Workspace modal'
    );
    assert.equal(
      await workspaceMenu.getByRole('link', { name: 'Vellira workspace' })
        .evaluate((element) => document.activeElement === element),
      true,
      'Components -> Workspace must move focus into the new modal'
    );
    assert.equal(
      page.url(),
      nestedUrl,
      'Back must switch to the main workspace menu without navigating'
    );
    assert.equal(
      await page.locator('#component-navigation').count(),
      0,
      'Component drawer must close when the main workspace menu opens'
    );
    await workspaceMenu.getByRole('link', { name: 'Overview' }).waitFor();
    await workspaceMenu.getByRole('link', { name: 'Account settings' }).waitFor();

    // Switching into Components from the workspace menu must return to the
    // same nested drawer and preserve the current component URL.
    await workspaceMenu.getByRole('link', { name: 'Components' }).click();
    await componentsDrawer.waitFor();
    assert.equal(
      await componentsDrawer.getByRole('button', { name: 'Back to workspace' })
        .evaluate((element) => document.activeElement === element),
      true,
      'Workspace -> Components must restore focus to the new Back action'
    );
    assert.equal(
      page.url(),
      nestedUrl,
      'Components menu should reopen without reloading the catalog page'
    );
    await componentsDrawer.getByRole('button', {
      name: 'Back to workspace',
    }).click();
    await workspaceMenu.waitFor();
    await workspaceMenu.getByRole('link', { name: 'Overview' }).click();
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
      await page.getByRole('radio', { name: 'Dark' }).waitFor();
    }

    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth
      ),
      false,
      `Navigation must not overflow a ${width}px viewport`
    );
  }

  // The public Components catalog also uses the exact same mobile brand.
  // Opening its drawer must not replace the 92px mobile header logo with
  // the former hard-coded 100px image.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(new URL('/components/button', baseUrl).toString());
  const publicHeaderLogo = await page.locator('header').first()
    .getByRole('link', { name: 'Vellira home' })
    .locator('img')
    .boundingBox();
  assert.ok(publicHeaderLogo);
  await page.getByRole('button', { name: 'Open component navigation' }).click();
  const publicComponentsDrawer = page.locator('#component-navigation');
  await publicComponentsDrawer.waitFor();
  const publicDrawerLogo = await publicComponentsDrawer
    .locator('..')
    .getByRole('link', { name: 'Vellira home' })
    .locator('img')
    .boundingBox();
  assert.ok(publicDrawerLogo);
  assert.ok(
    Math.abs(publicDrawerLogo.width - publicHeaderLogo.width) <= 1 &&
      Math.abs(publicDrawerLogo.height - publicHeaderLogo.height) <= 1,
    'Public Components logo must retain the exact header size after opening its menu'
  );

  // The public site uses the same HeaderChrome but has a marketing-only
  // top navigation. Tablet/mobile Menu must be the RIGHTMOST visible action;
  // its Get started header CTA must be hidden at the same breakpoint.
  for (const width of [1280, 1200, 1100, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 850 });
    await page.goto(new URL('/', baseUrl).toString());
    const siteHeader = page.locator('header').first();
    const siteMenu = siteHeader.getByRole('button', {
      name: 'Open navigation',
    });
    await siteMenu.waitFor();
    assert.equal(await siteMenu.isVisible(), true);
    const menuBox = await siteMenu.boundingBox();
    const headerGeometry = await siteHeader.evaluate((node) => {
      const container = node.firstElementChild;
      if (!container) throw new Error('SiteHeader container missing');
      return {
        right: container.getBoundingClientRect().right,
        gutter: Number.parseFloat(getComputedStyle(container).paddingRight),
      };
    });
    assert.ok(
      menuBox &&
        Math.abs(
          headerGeometry.right - menuBox.x - menuBox.width -
          headerGeometry.gutter
        ) <= 2,
      `Site mobile Menu must be right-aligned at ${width}px`
    );
    const adjacentControls = await siteHeader.evaluate((node) => {
      const menu = node.querySelector(
        '[class*="mobileMenuTrigger"] button'
      );
      const external = node.querySelector('[class*="externalActions"]');
      const search = node.querySelector('[class*="headerSearch"]');
      const previous = external && getComputedStyle(external).display !== 'none'
        ? external
        : search;
      if (!menu || !previous) {
        throw new Error('Public SiteHeader mobile actions are missing');
      }
      return {
        gap:
          menu.getBoundingClientRect().left -
          previous.getBoundingClientRect().right,
        searchLeft: search?.getBoundingClientRect().left,
      };
    });
    assert.ok(
      Math.abs(adjacentControls.gap - 24) <= 1,
      `SiteHeader last action must sit exactly 24px before Menu at ${width}px (actual ${adjacentControls.gap})`
    );
    const siteHeaderCta = siteHeader.locator('[class*="authActions"]');
    assert.equal(
      await siteHeaderCta.isVisible(),
      false,
      `Get started header CTA must be hidden at ${width}px`
    );

    await siteMenu.click();
    await siteHeader.getByRole('button', { name: 'Close navigation' }).waitFor();
    await siteHeader.getByRole('button', { name: 'Close navigation' }).first().click();
    await siteMenu.waitFor();
  }

  // Portal Components pages retain their desktop explorer above 1100px,
  // while SiteHeader hides primary navigation at <=1280px. Ensure these
  // in-between tablet widths expose the marketing menu (including Blog).
  for (const width of [1280, 1200]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(new URL('/components/button', baseUrl).toString());
    const portalHeader = page.locator('header').first();
    const publicMenu = portalHeader.getByRole('button', {
      name: 'Open navigation',
    });
    await publicMenu.waitFor();
    assert.ok(
      await publicMenu.isVisible(),
      `Portal must expose site navigation at ${width}px`
    );
    assert.equal(
      await portalHeader.getByRole('button', {
        name: 'Open component navigation',
      }).isVisible().catch(() => false),
      false,
      'A component-only trigger must not open a hidden drawer at tablet width'
    );
    const siteMenuBox = await publicMenu.boundingBox();
    const containerPadding = await portalHeader.evaluate((node) =>
      Number.parseFloat(getComputedStyle(node.firstElementChild).paddingRight)
    );
    const portalAdjacent = await portalHeader.evaluate((node) => {
      const menu = node.querySelector(
        '[class*="portalTabletMenuTrigger"] button'
      );
      const external = node.querySelector('[class*="externalActions"]');
      if (!menu || !external) {
        throw new Error('Portal tablet actions are missing');
      }
      return menu.getBoundingClientRect().left -
        external.getBoundingClientRect().right;
    });
    assert.ok(
      Math.abs(portalAdjacent - 24) <= 1,
      `Portal tablet last action must sit 24px before Menu at ${width}px`
    );
    const portalRight = await portalHeader.evaluate((node) =>
      node.getBoundingClientRect().right
    );
    assert.ok(
      siteMenuBox &&
        Math.abs(portalRight - siteMenuBox.x - siteMenuBox.width - containerPadding) <= 2,
      `Portal tablet Menu must be right-aligned at ${width}px`
    );
    await publicMenu.click();
    const blog = portalHeader.getByRole('link', { name: 'Blog' });
    await blog.waitFor();
    await blog.click();
    await page.waitForURL('**/blog');
  }

  await page.setViewportSize({ width: 1200, height: 900 });
  await page.goto(new URL('/app', baseUrl).toString());
  await page.getByRole('button', { name: 'Collapse sidebar' }).waitFor();
  await page.locator('[data-product-app-header]')
    .getByRole('button', { name: 'Account menu' }).waitFor();
  await page.locator('[data-product-app-header]')
    .getByRole('button', { name: /^Theme:/ }).waitFor();
  const desktopApp = await headerGeometry(page.locator('[data-product-app-header]'));

  await page.goto(new URL('/components/button', baseUrl).toString());
  await page.locator('[data-component-explorer]').waitFor();
  const publicHeader = await headerGeometry(page.locator('header').first());
  sameChrome(desktopApp, publicHeader, 'Product / public SiteHeader');

  console.log('OK shared header/Menu, instant opening parity, unmounted closed overlays, and stable brand sizing at 1100/768/390/320px');
} finally {
  await page.close();
  await context.close();
  await browser.close();
}
