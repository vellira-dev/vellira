import { chromium } from '@playwright/test';

const baseUrl = process.env.WEBSITE_URL;

if (!baseUrl) {
  throw new Error('WEBSITE_URL is required.');
}

const baseOrigin = new URL(baseUrl).origin;
const browser = await chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();
const staticFailures = [];

function isSameOriginStaticAsset(url) {
  const parsed = new URL(url);
  return (
    parsed.origin === baseOrigin &&
    parsed.pathname.startsWith('/_next/static/')
  );
}

function recordFailure(message) {
  if (!staticFailures.includes(message)) {
    staticFailures.push(message);
  }
}

page.on('response', (response) => {
  if (!isSameOriginStaticAsset(response.url()) || response.status() < 400) {
    return;
  }

  const request = response.request();
  recordFailure(
    `static response ${response.status()} ${request.resourceType()} ${response.url()} ` +
      `while=${page.url()}`
  );
});

page.on('requestfailed', (request) => {
  if (!isSameOriginStaticAsset(request.url())) {
    return;
  }

  const errorText = request.failure()?.errorText ?? '';
  if (errorText === 'net::ERR_ABORTED') {
    return;
  }

  recordFailure(
    `static requestfailed ${request.resourceType()} ${request.url()} ` +
      `${errorText} while=${page.url()}`
  );
});

async function goto(path) {
  await page.goto(`${baseUrl}${path}`, {
    waitUntil: 'domcontentloaded',
    timeout: 30_000,
  });
  await page.locator('main').first().waitFor({
    state: 'visible',
    timeout: 15_000,
  });
}

async function assertNoStaticFailures(stage) {
  if (staticFailures.length === 0) {
    return;
  }

  throw new Error(
    `Static asset failures detected during ${stage}:\n${staticFailures.join('\n')}`
  );
}

async function churnComponentRoutes() {
  await page.setViewportSize({ width: 1280, height: 900 });
  await goto('/components/switch');

  const sidebarSelector = 'aside[aria-label="Component navigation"]';
  const sidebar = page.locator(sidebarSelector).first();
  await sidebar.waitFor({ state: 'visible', timeout: 15_000 });

  const hrefs = await sidebar
    .locator('a[href^="/components/"]')
    .evaluateAll((links) => [
      ...new Set(
        links
          .map((link) => link.getAttribute('href'))
          .filter((href) => href && href !== '/components')
      ),
    ]);

  if (hrefs.length < 5) {
    throw new Error(
      `Expected at least 5 component routes for navigation soak, got ${hrefs.length}.`
    );
  }

  for (let round = 1; round <= 5; round += 1) {
    for (const href of hrefs) {
      const link = page
        .locator(`${sidebarSelector} a[href="${href}"]`)
        .first();
      await link.waitFor({ state: 'visible', timeout: 15_000 });
      await link.click();
      await page.waitForURL(`${baseUrl}${href}`, { timeout: 15_000 });
      await page.locator('main').first().waitFor({
        state: 'visible',
        timeout: 15_000,
      });
      await page.waitForTimeout(150);
      await assertNoStaticFailures(`component round ${round} at ${href}`);
    }

    console.log(
      `OK component navigation soak round ${round}/${5} across ${hrefs.length} routes`
    );
  }
}

async function churnBlogRoutes() {
  await goto('/blog');

  const hrefs = await page
    .locator('main a[href^="/blog/"]')
    .evaluateAll((links) => [
      ...new Set(
        links
          .map((link) => link.getAttribute('href'))
          .filter((href) => href && href !== '/blog')
      ),
    ]);

  if (hrefs.length < 3) {
    throw new Error(
      `Expected at least 3 blog routes for navigation soak, got ${hrefs.length}.`
    );
  }

  const targets = hrefs.slice(0, 6);
  for (let round = 1; round <= 3; round += 1) {
    for (const href of targets) {
      await goto('/blog');
      const link = page.locator(`main a[href="${href}"]`).first();
      await link.waitFor({ state: 'visible', timeout: 15_000 });
      await link.click();
      await page.waitForURL(`${baseUrl}${href}`, { timeout: 15_000 });
      await page.locator('main').first().waitFor({
        state: 'visible',
        timeout: 15_000,
      });
      await page.waitForTimeout(150);
      await assertNoStaticFailures(`blog round ${round} at ${href}`);
    }

    console.log(
      `OK blog navigation soak round ${round}/${3} across ${targets.length} routes`
    );
  }
}

try {
  await churnComponentRoutes();
  await churnBlogRoutes();
  await page.waitForTimeout(5_000);
  await assertNoStaticFailures('final preload settle');
  console.log('OK Cloudflare navigation soak: no delayed /_next/static asset failures');
} catch (error) {
  console.error(`Cloudflare navigation soak failed at ${page.url()}`);
  console.error(error);
  for (const failure of staticFailures) {
    console.error(failure);
  }
  await browser.close();
  process.exit(1);
}

await browser.close();
