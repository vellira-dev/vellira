import assert from 'node:assert/strict';

import { chromium, expect } from '@playwright/test';

const baseUrl = process.env.WEBSITE_URL ?? 'http://127.0.0.1:3100';
const longestError =
  'Newsletter signup is temporarily unavailable. Please try again later.';
const tooltipText =
  'We’ll only send Vellira engineering notes. Unsubscribe anytime.';

const browser = await chromium.launch({ headless: true });

function assertStablePosition(before, after, controlName) {
  const delta = Math.abs(after - before);
  assert.ok(
    delta <= 1,
    `${controlName} moved ${delta}px; expected movement to be <= 1px`
  );
  return delta;
}

async function controlTops(form) {
  return form.evaluate((element) => ({
    email: element.querySelector('input[name="email"]')?.getBoundingClientRect()
      .top,
    subscribe: Array.from(element.querySelectorAll('button'))
      .find((button) => button.textContent?.trim() === 'Subscribe')
      ?.getBoundingClientRect().top,
  }));
}

async function restoreScrollPosition(page, scrollY) {
  await page.evaluate((position) => {
    globalThis.document.documentElement.style.scrollBehavior = 'auto';
    globalThis.scrollTo(0, position);
  }, scrollY);
  await page.waitForFunction(
    (position) => Math.abs(globalThis.scrollY - position) <= 1,
    scrollY
  );
}

async function checkViewport(viewport) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);

  try {
    await page.route('**/api/blog-metrics**', async (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [] }),
      })
    );
    await page.goto(`${baseUrl}/blog`, { waitUntil: 'domcontentloaded' });

    const newsletter = page.getByRole('region', {
      name: 'Keep up with Vellira',
    });
    const form = newsletter.locator('form');
    const email = form.getByRole('textbox', { name: 'Email address' });
    const subscribe = form.getByRole('button', {
      name: 'Subscribe',
      exact: true,
    });
    const info = form.getByRole('button', {
      name: 'Newsletter email privacy information',
      exact: true,
    });

    await expect(email).toBeVisible();
    await expect(subscribe).toBeVisible();
    await expect(info).toHaveCount(1);

    const idleMessage = form.locator('[id$="-message"]');
    const idleMessageMetrics = await idleMessage.evaluate((element) => {
      const style = element.ownerDocument.defaultView.getComputedStyle(element);
      return {
        height: element.getBoundingClientRect().height,
        lineHeight: Number.parseFloat(style.lineHeight),
      };
    });
    assert.ok(idleMessageMetrics.height > 0);
    assert.ok(
      idleMessageMetrics.height <= idleMessageMetrics.lineHeight * 4 + 1,
      `idle message area is unexpectedly tall: ${idleMessageMetrics.height}px`
    );

    await email.scrollIntoViewIfNeeded();
    const beforeEmptyScrollY = await page.evaluate(() => globalThis.scrollY);
    const beforeEmpty = await controlTops(form);
    await subscribe.click();
    await expect(
      form.getByText('Enter your email address.', { exact: true })
    ).toBeVisible();
    await restoreScrollPosition(page, beforeEmptyScrollY);
    const afterEmpty = await controlTops(form);

    const emptyDeltas = {
      email: assertStablePosition(
        beforeEmpty.email,
        afterEmpty.email,
        'Email input'
      ),
      subscribe: assertStablePosition(
        beforeEmpty.subscribe,
        afterEmpty.subscribe,
        'Subscribe button'
      ),
    };

    await page.route('**/api/newsletter/subscribe', async (route) =>
      route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: false,
          code: 'temporarily_unavailable',
        }),
      })
    );

    await email.fill('person@example.com');
    await expect(
      form.getByText('Enter your email address.', { exact: true })
    ).toBeHidden();
    await email.scrollIntoViewIfNeeded();
    const beforeLongestScrollY = await page.evaluate(() => globalThis.scrollY);
    const beforeLongest = await controlTops(form);
    await subscribe.click();
    await expect(form.getByText(longestError, { exact: true })).toBeVisible();
    await restoreScrollPosition(page, beforeLongestScrollY);
    const afterLongest = await controlTops(form);

    const longestDeltas = {
      email: assertStablePosition(
        beforeLongest.email,
        afterLongest.email,
        'Email input'
      ),
      subscribe: assertStablePosition(
        beforeLongest.subscribe,
        afterLongest.subscribe,
        'Subscribe button'
      ),
    };

    console.log({ viewport, emptyDeltas, longestDeltas });

    await info.hover();
    await expect(page.getByRole('tooltip')).toContainText(tooltipText);
    await info.focus();
    await expect(page.getByRole('tooltip')).toContainText(tooltipText);
  } finally {
    await context.close();
  }
}

try {
  await checkViewport({ width: 1440, height: 1000 });
  await checkViewport({ width: 390, height: 844 });
  console.log(
    'Newsletter browser regression: stable empty/longest-error geometry and accessible tooltip OK'
  );
} finally {
  await browser.close();
}
