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
    label: element.querySelector('label')?.getBoundingClientRect().top,
    controlRow: element
      .querySelector('[data-newsletter-control-row]')
      ?.getBoundingClientRect().top,
    email: element.querySelector('input[name="email"]')?.getBoundingClientRect()
      .top,
    subscribe: Array.from(element.querySelectorAll('button'))
      .find((button) => button.textContent?.trim() === 'Subscribe')
      ?.getBoundingClientRect().top,
  }));
}

async function newsletterLayoutMetrics(card) {
  return card.evaluate((element) => {
    const cardRect = element.getBoundingClientRect();
    const cardStyle =
      element.ownerDocument.defaultView.getComputedStyle(element);
    const leftContent = element.firstElementChild?.getBoundingClientRect();
    const form = element.querySelector('form')?.getBoundingClientRect();
    const description = element
      .querySelector('[data-newsletter-description]')
      ?.getBoundingClientRect();
    const label = element.querySelector('form label')?.getBoundingClientRect();
    const controls = element
      .querySelector('[data-newsletter-control-row]')
      ?.getBoundingClientRect();
    const input = element
      .querySelector('input[name="email"]')
      ?.getBoundingClientRect();
    const subscribe = Array.from(element.querySelectorAll('button'))
      .find((button) => button.textContent?.trim() === 'Subscribe')
      ?.getBoundingClientRect();
    const message = element
      .querySelector('[id$="-message"], [id$="-error"]')
      ?.getBoundingClientRect();
    if (
      !leftContent ||
      !form ||
      !description ||
      !label ||
      !controls ||
      !input ||
      !subscribe ||
      !message
    )
      throw new Error('Newsletter cluster is incomplete');

    const top = Math.min(label.top, controls.top);
    const bottom = Math.max(label.bottom, controls.bottom);
    return {
      card: {
        height: cardRect.height,
        top: cardRect.top,
        bottom: cardRect.bottom,
      },
      cardPaddingBottom: Number.parseFloat(cardStyle.paddingBottom),
      leftContent: {
        top: leftContent.top,
        bottom: leftContent.bottom,
        height: leftContent.height,
      },
      description: {
        top: description.top,
        bottom: description.bottom,
        height: description.height,
      },
      form: {
        top: form.top,
        bottom: form.bottom,
        height: form.height,
      },
      formPaddingBlockStart: Number.parseFloat(
        element.ownerDocument.defaultView.getComputedStyle(
          element.querySelector('form')
        ).paddingBlockStart
      ),
      visibleCluster: {
        top,
        bottom,
        height: bottom - top,
      },
      controlRow: {
        top: controls.top,
        bottom: controls.bottom,
        height: controls.height,
      },
      input: {
        top: input.top,
        bottom: input.bottom,
      },
      subscribe: {
        top: subscribe.top,
        bottom: subscribe.bottom,
      },
      message: {
        top: message.top,
        bottom: message.bottom,
        height: message.height,
      },
    };
  });
}

async function messageHeight(form) {
  const message = form.locator('[id$="-error"]');
  return message.evaluate((element) => element.getBoundingClientRect().height);
}

function assertFeedbackContained(layoutMetrics) {
  assert.ok(
    layoutMetrics.message.top >= layoutMetrics.controlRow.bottom,
    'newsletter message is not below the control row'
  );
  assert.ok(
    layoutMetrics.message.bottom <= layoutMetrics.card.bottom - 1,
    'newsletter message overlaps the card border'
  );
}

function assertDesktopAlignment(layoutMetrics) {
  assert.ok(
    layoutMetrics.formPaddingBlockStart === 0,
    'newsletter form has an unexpected top balancing lane'
  );
  assert.ok(
    Math.abs(
      layoutMetrics.controlRow.bottom - layoutMetrics.description.bottom
    ) <= 1,
    'newsletter control row does not align with the description bottom'
  );
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
    const card = newsletter.locator('[data-newsletter-card]');
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

    const layoutMetrics = await newsletterLayoutMetrics(card);
    if (viewport.width >= 1000) {
      assertDesktopAlignment(layoutMetrics);
    }
    assertFeedbackContained(layoutMetrics);

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
      idleMessageMetrics.height <= idleMessageMetrics.lineHeight * 3 + 1,
      `idle message area is unexpectedly tall: ${idleMessageMetrics.height}px`
    );

    await email.scrollIntoViewIfNeeded();
    const beforeEmptyScrollY = await page.evaluate(() => globalThis.scrollY);
    const beforeEmpty = await controlTops(form);
    await subscribe.click();
    await expect(
      form.getByText('Enter your email address.', { exact: true })
    ).toBeVisible();
    const emptyMessageHeight = await messageHeight(form);
    const emptyLayoutMetrics = await newsletterLayoutMetrics(card);
    assertFeedbackContained(emptyLayoutMetrics);
    if (viewport.width >= 1000) assertDesktopAlignment(emptyLayoutMetrics);
    assert.ok(
      emptyMessageHeight <= idleMessageMetrics.height + 1,
      `empty error exceeds the reserved message area: ${emptyMessageHeight}px > ${idleMessageMetrics.height}px`
    );
    await restoreScrollPosition(page, beforeEmptyScrollY);
    const afterEmpty = await controlTops(form);

    const emptyDeltas = {
      label: assertStablePosition(
        beforeEmpty.label,
        afterEmpty.label,
        'Newsletter label'
      ),
      controlRow: assertStablePosition(
        beforeEmpty.controlRow,
        afterEmpty.controlRow,
        'Newsletter control row'
      ),
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
    const longestMessageHeight = await messageHeight(form);
    const longestLayoutMetrics = await newsletterLayoutMetrics(card);
    assertFeedbackContained(longestLayoutMetrics);
    if (viewport.width >= 1000) assertDesktopAlignment(longestLayoutMetrics);
    assert.ok(
      longestMessageHeight <= idleMessageMetrics.height + 1,
      `longest error exceeds the reserved message area: ${longestMessageHeight}px > ${idleMessageMetrics.height}px`
    );
    await restoreScrollPosition(page, beforeLongestScrollY);
    const afterLongest = await controlTops(form);

    const longestDeltas = {
      label: assertStablePosition(
        beforeLongest.label,
        afterLongest.label,
        'Newsletter label'
      ),
      controlRow: assertStablePosition(
        beforeLongest.controlRow,
        afterLongest.controlRow,
        'Newsletter control row'
      ),
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

    console.log({
      viewport,
      layoutMetrics,
      reservedMessageHeight: idleMessageMetrics.height,
      reservedMessageLines:
        idleMessageMetrics.height / idleMessageMetrics.lineHeight,
      emptyMessageHeight,
      longestMessageHeight,
      emptyMessage: emptyLayoutMetrics.message,
      longestMessage: longestLayoutMetrics.message,
      emptyDeltas,
      longestDeltas,
    });

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
