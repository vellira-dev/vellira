import assert from 'node:assert/strict';

import { chromium } from '@playwright/test';

const baseUrl = process.env.WEBSITE_URL ?? 'http://127.0.0.1:3100';

const isTransparent = (value) =>
  value === 'transparent' ||
  value === 'rgba(0, 0, 0, 0)' ||
  value === 'rgba(0,0,0,0)';

const browser = await chromium.launch({ headless: true });

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.goto(`${baseUrl}/blog`, { waitUntil: 'networkidle' });

  const search = page.getByRole('searchbox', { name: 'Search articles' });
  await search.waitFor();

  const searchStyle = await search.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      backgroundColor: style.backgroundColor,
      borderTopWidth: style.borderTopWidth,
      borderRightWidth: style.borderRightWidth,
      borderBottomWidth: style.borderBottomWidth,
      borderLeftWidth: style.borderLeftWidth,
      transform: style.transform,
    };
  });

  assert.equal(searchStyle.borderTopWidth, '0px');
  assert.equal(searchStyle.borderRightWidth, '0px');
  assert.equal(searchStyle.borderBottomWidth, '0px');
  assert.equal(searchStyle.borderLeftWidth, '0px');
  assert.ok(
    isTransparent(searchStyle.backgroundColor),
    `expected borderless Blog search background, got ${searchStyle.backgroundColor}`
  );
  assert.equal(searchStyle.transform, 'none');

  const filters = page.getByRole('group', {
    name: 'Filter articles by topic',
  });
  const allFilter = filters.getByRole('button', { name: 'All', exact: true });
  await allFilter.waitFor();

  const desktopFilterStyle = await allFilter.evaluate((element) => {
    const style = getComputedStyle(element);
    const underline = getComputedStyle(element, '::after');
    return {
      minHeight: style.minHeight,
      paddingLeft: style.paddingLeft,
      paddingRight: style.paddingRight,
      backgroundColor: style.backgroundColor,
      borderTopWidth: style.borderTopWidth,
      transform: style.transform,
      underlineHeight: underline.height,
      underlineOpacity: underline.opacity,
    };
  });

  assert.equal(desktopFilterStyle.minHeight, '40px');
  assert.equal(desktopFilterStyle.paddingLeft, '12px');
  assert.equal(desktopFilterStyle.paddingRight, '12px');
  assert.ok(isTransparent(desktopFilterStyle.backgroundColor));
  assert.equal(desktopFilterStyle.borderTopWidth, '0px');
  assert.equal(desktopFilterStyle.transform, 'none');
  assert.equal(desktopFilterStyle.underlineHeight, '2px');
  assert.equal(desktopFilterStyle.underlineOpacity, '1');

  await search.fill('React');
  await page.waitForFunction(() => new URL(window.location.href).searchParams.get('q') === 'React');
  await page.getByRole('button', { name: 'Clear input' }).click();
  await page.waitForFunction(() => !new URL(window.location.href).searchParams.has('q'));

  const filterButtons = filters.getByRole('button');
  const filterCount = await filterButtons.count();
  assert.ok(filterCount > 1, 'expected at least one topic filter beside All');

  const firstTopic = filterButtons.nth(1);
  await firstTopic.click();
  assert.equal(await firstTopic.getAttribute('aria-pressed'), 'true');
  await page.waitForFunction(() => new URL(window.location.href).searchParams.has('tags'));
  await allFilter.click();
  await page.waitForFunction(() => !new URL(window.location.href).searchParams.has('tags'));

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload({ waitUntil: 'networkidle' });

  const mobileSearch = page.getByRole('searchbox', { name: 'Search articles' });
  const mobileAllFilter = page
    .getByRole('group', { name: 'Filter articles by topic' })
    .getByRole('button', { name: 'All', exact: true });

  const mobileSearchStyle = await mobileSearch.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      backgroundColor: style.backgroundColor,
      borderTopWidth: style.borderTopWidth,
      transform: style.transform,
    };
  });
  const mobileFilterStyle = await mobileAllFilter.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      minHeight: style.minHeight,
      paddingLeft: style.paddingLeft,
      paddingRight: style.paddingRight,
      borderTopWidth: style.borderTopWidth,
      transform: style.transform,
    };
  });

  assert.equal(mobileSearchStyle.borderTopWidth, '0px');
  assert.ok(isTransparent(mobileSearchStyle.backgroundColor));
  assert.equal(mobileSearchStyle.transform, 'none');
  assert.equal(mobileFilterStyle.minHeight, '44px');
  assert.equal(mobileFilterStyle.paddingLeft, '10px');
  assert.equal(mobileFilterStyle.paddingRight, '10px');
  assert.equal(mobileFilterStyle.borderTopWidth, '0px');
  assert.equal(mobileFilterStyle.transform, 'none');

  console.log('Blog discovery browser visual contract: OK');
} finally {
  await browser.close();
}
