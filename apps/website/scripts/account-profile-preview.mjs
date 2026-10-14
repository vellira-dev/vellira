/* global document, window, getComputedStyle */
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';

// Development-only account fixture. Must never communicate with the backend.
const baseUrl = process.env.WEBSITE_URL;
if (!baseUrl) throw new Error('WEBSITE_URL is required.');

const browser = await chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();
page.setDefaultTimeout(15_000);

const backendRequests = [];
page.on('request', (request) => {
  if (/\/v1\//.test(new URL(request.url()).pathname)) {
    backendRequests.push(request.url());
  }
});

try {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(new URL('/app/settings?section=account', baseUrl).toString());
  await page.getByText('Local UI preview', { exact: false }).waitFor();
  await page.getByRole('heading', { name: 'Alex', exact: true }).waitFor();

  const panel = page.locator('[data-profile-settings]');
  const badge = panel.locator('span').filter({ hasText: /^Active$/ }).first();
  await badge.waitFor();
  assert.equal(await badge.locator('svg').count(), 1, 'Active must include a real Check icon');

  const appearance = await badge.evaluate((element) => ({
    border: getComputedStyle(element).borderTopWidth,
    background: getComputedStyle(element).backgroundColor,
    radius: getComputedStyle(element).borderTopLeftRadius,
  }));
  assert.equal(appearance.border, '0px', 'Active must have no border');
  assert.ok(
    appearance.background !== 'transparent' && appearance.background !== 'rgba(0, 0, 0, 0)',
    'Active must use a visible success background'
  );
  assert.notEqual(appearance.radius, '0px', 'Active must be a pill');

  // Tabs.List already reserves 24px below the tabs. The Account view must
  // not add Tabs.Content padding AND root padding again.
  const tabList = page.getByRole('tablist', { name: 'Account settings sections' });
  const avatar = panel.locator(':scope > header > div:first-child');
  const header = panel.locator(':scope > header');
  const layout = await panel.evaluate((root) => {
    const tabs = document.querySelector('[role="tablist"][aria-label="Account settings sections"]');
    const card = root.querySelector(':scope > header');
    const circle = card?.firstElementChild;
    if (!tabs || !card || !circle) throw new Error('Missing account tabs, card or avatar');
    const circleStyle = getComputedStyle(circle);
    return {
      tabGap: card.getBoundingClientRect().top - tabs.getBoundingClientRect().bottom,
      circleBorder: circleStyle.borderTopWidth,
      circleBg: circleStyle.backgroundColor,
      circleSize: circle.getBoundingClientRect().width,
      cardBg: getComputedStyle(card).backgroundColor,
      circleRadius: circleStyle.borderTopLeftRadius,
    };
  });
  assert.ok(
    layout.tabGap >= 16 && layout.tabGap <= 32,
    'Tabs → first card gap must be approximately 24px, got ' + layout.tabGap
  );
  assert.equal(layout.circleBorder, '1px', 'Avatar circle needs a visible outline');
  assert.notEqual(layout.circleBg, layout.cardBg, 'Avatar must stand out from the card surface');
  assert.notEqual(layout.circleRadius, '0px', 'Avatar must remain round');
  assert.ok(layout.circleSize >= 56, 'Avatar should remain a visible, comfortably sized circle');
  await tabList.waitFor();
  await avatar.waitFor();
  await header.waitFor();

  const cards = panel.locator(':scope > header, [data-account-block="personal"], [data-account-block="preferences"]');
  assert.equal(await cards.count(), 3, 'Account should have three distinct surfaces');
  for (const card of await cards.all()) {
    const style = await card.evaluate((el) => ({
      background: getComputedStyle(el).backgroundColor,
      borderWidth: getComputedStyle(el).borderTopWidth,
      radius: getComputedStyle(el).borderTopLeftRadius,
    }));
    assert.ok(style.background !== 'transparent' && style.background !== 'rgba(0, 0, 0, 0)',
      'Each account card must have its own solid theme-aware surface');
    assert.equal(style.borderWidth, '1px', 'Each account card needs a subtle boundary');
    assert.notEqual(style.radius, '0px', 'Cards must have rounded corners');
  }
  assert.equal(await panel.locator('[data-profile-save-bar]').count(), 0,
    'Clean preview must not show any floating Save controls');

  const fullName = page.getByRole('textbox', { name: 'Full name' });
  const displayName = page.getByRole('textbox', { name: 'Display name' });
  const email = page.getByRole('textbox', { name: 'Email address' });
  const language = page.getByRole('combobox', { name: 'Language' });
  const timeZone = page.getByRole('combobox', { name: 'Time zone' });
  for (const input of [fullName, displayName, language, timeZone]) {
    assert.equal(await input.isEnabled(), true, 'Preview controls must be editable');
  }
  assert.equal(await email.inputValue(), 'alex@example.com');
  assert.equal(await email.getAttribute('readonly'), '', 'Email remains read-only');
  assert.equal(await email.getAttribute('id'), 'account-primary-email');
  assert.equal(
    await page.getByRole('textbox', { name: 'Email address', exact: true }).count(),
    1,
    'Email verification status must not pollute the input accessible name'
  );

  const emailLabel = panel.locator('label[for="account-primary-email"]');
  const labelVerification = emailLabel.getByRole('status', { name: 'Verified' });
  await labelVerification.waitFor();
  assert.equal(
    await labelVerification.count(),
    1,
    'Verified must appear alongside Email address, inside its field label'
  );
  assert.equal(await labelVerification.locator('svg').count(), 1);
  const pillAppearance = await labelVerification.evaluate((element) => ({
    background: getComputedStyle(element).backgroundColor,
    border: getComputedStyle(element).borderTopWidth,
    radius: getComputedStyle(element).borderTopLeftRadius,
  }));
  assert.equal(pillAppearance.background, appearance.background,
    'Verified and Active should use the same filled success surface');
  assert.equal(pillAppearance.border, '0px', 'Email Verified pill must have no border');
  assert.notEqual(pillAppearance.radius, '0px', 'Email Verified must be an oval badge');

  const labelGeometry = await emailLabel.evaluate((element) => {
    const text = element.querySelector('#account-primary-email-label-text');
    const pill = element.querySelector('[role="status"]');
    if (!text || !pill) throw new Error('Email label and status are incomplete');
    const textBox = text.getBoundingClientRect();
    const pillBox = pill.getBoundingClientRect();
    return {
      horizontalGap: pillBox.left - textBox.right,
      centersDelta: Math.abs(
        pillBox.top + pillBox.height / 2 - textBox.top - textBox.height / 2
      ),
    };
  });
  assert.ok(labelGeometry.horizontalGap >= 0 && labelGeometry.horizontalGap <= 24,
    'Verified must sit beside Email address, not at the opposite side of the form');
  assert.ok(labelGeometry.centersDelta <= 3, 'Email label and badge must be vertically centered');

  const updateEmail = panel.getByRole('button', { name: 'Update email', exact: true });
  assert.equal(await updateEmail.count(), 1);
  assert.equal(await updateEmail.isDisabled(), true,
    'Email change cannot be activated before backend step-up and verification exist');
  assert.ok(
    (await page.locator('#account-email-change-help').textContent()).includes('not available in preview'),
    'Disabled email-change action must have an explicit explanation'
  );
  const blockSpacing = await panel.evaluate((root) => {
    const personal = root.querySelector('[data-account-block="personal"]');
    const preferences = root.querySelector('[data-account-block="preferences"]');
    const hero = root.querySelector(':scope > header');
    if (!personal || !preferences || !hero) {
      throw new Error('Account profile sections are missing');
    }
    if (root.querySelector('[data-account-block="details"]')) {
      throw new Error('Duplicate Account details must not be rendered');
    }
    return {
      betweenSections: preferences.getBoundingClientRect().top - personal.getBoundingClientRect().bottom,
      belowHero: personal.getBoundingClientRect().top - hero.getBoundingClientRect().bottom,
    };
  });
  assert.ok(
    blockSpacing.betweenSections >= 20,
    'Desktop cards require at least 20px of separation (approved rhythm: 24px)'
  );
  assert.ok(
    blockSpacing.belowHero >= 20,
    'Desktop header and personal card require at least 20px of separation'
  );
  assert.equal(
    await page.getByRole('heading', { name: 'Account details' }).count(),
    0,
    'Do not duplicate status and email in a redundant Account details block'
  );
  const verification = page.getByText('Verified', { exact: true });
  await verification.waitFor();
  assert.equal(await verification.count(), 1, 'Email verification status must appear only once');
  assert.equal(
    await verification.locator('..').locator('svg').count(),
    1,
    'Verification status must include the canonical icon near the email'
  );
  assert.equal(await fullName.inputValue(), 'Alex Morgan');
  assert.equal(await displayName.inputValue(), 'Alex');
  const sizes = await Promise.all([fullName, displayName, language, timeZone].map(async (locator) =>
    locator.evaluate((element) => element.getBoundingClientRect().height)
  ));
  assert.ok(sizes.every((height) => height <= 56), 'Form controls must be compact, got ' + sizes.join(', '));

  await fullName.fill('Discard this preview edit');
  const floatingBar = panel.locator('[data-profile-save-bar]');
  await floatingBar.waitFor();
  assert.equal(await floatingBar.getByRole('button', { name: 'Discard' }).isEnabled(), true);
  await floatingBar.getByRole('button', { name: 'Discard' }).click();
  assert.equal(await fullName.inputValue(), 'Alex Morgan', 'Preview discard restores local last-save state');
  assert.equal(await floatingBar.count(), 0, 'Discard removes the floating action bar');

  await fullName.fill('Ada Lovelace');
  await displayName.fill('Ada');
  await floatingBar.waitFor();
  await page.getByText('Unsaved changes', { exact: true }).waitFor();
  const save = page.getByRole('button', { name: 'Save changes' });
  assert.equal(await save.isEnabled(), true, 'Local preview should allow saving to a local draft');

  // Local-only save is explicitly labelled. It is not a simulated server success.
  await save.click();
  await page.getByText('Preview saved on this page only.', { exact: false }).waitFor();
  assert.equal(await floatingBar.count(), 0, 'Local preview save hides the dirty action bar');

  await language.click();
  await page.getByRole('option', { name: 'Français' }).click();
  await page.getByText('Unsaved changes', { exact: true }).waitFor();

  for (const width of [768, 390, 320]) {
    await page.setViewportSize({ width, height: 850 });
    await page.getByRole('heading', { name: 'Ada', exact: true }).waitFor();
    const updateActionRect = await updateEmail.boundingBox();
    const emailInputRect = await email.boundingBox();
    if (!updateActionRect || !emailInputRect) throw new Error('Missing email action geometry');
    assert.ok(
      updateActionRect.x >= 0 && updateActionRect.x + updateActionRect.width <= width + 1,
      'Update email action must stay within the mobile viewport'
    );
    if (width <= 390) {
      assert.ok(updateActionRect.y >= emailInputRect.y + emailInputRect.height,
        'On narrow screens Update email should sit below the address field');
    }
    const tabRect = await tabList.boundingBox();
    const cardRect = await header.boundingBox();
    if (!tabRect || !cardRect) throw new Error('Missing mobile tab/card geometry');
    const mobileGap = cardRect.y - tabRect.y - tabRect.height;
    assert.ok(
      mobileGap >= 16 && mobileGap <= 32,
      'Mobile tabs to profile card gap must be compact, got ' + mobileGap
    );
    if (width === 390) {
      const gap = await panel.evaluate((root) => {
        const personal = root.querySelector('[data-account-block="personal"]');
        const preferences = root.querySelector('[data-account-block="preferences"]');
        if (!personal || !preferences) throw new Error('Missing account section');
        return preferences.getBoundingClientRect().top - personal.getBoundingClientRect().bottom;
      });
      assert.ok(gap >= 16, 'Mobile cards require at least 16px separation (approved rhythm: 20px)');
    }
    assert.equal(await floatingBar.isVisible(), true, 'Floating actions must show for dirty state');
    const bar = await floatingBar.boundingBox();
    if (!bar) throw new Error('No floating bar on viewport ' + width);
    assert.ok(bar.x >= 0 && bar.x + bar.width <= width + 1, 'Save/Discard bar must fit viewport ' + width);
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth),
      false,
      'Profile overflow on ' + width + 'px viewport'
    );
  }

  await floatingBar.getByRole('button', { name: 'Discard' }).click();
  assert.equal(await floatingBar.count(), 0, 'Mobile Discard returns to a clean form');
  assert.deepEqual(backendRequests, [], 'Local Account preview may not access the real backend');
  console.log('OK compact Account UI: Active pill/check, editable preview, local save, and mobile geometry');
} finally {
  await page.close();
  await context.close();
  await browser.close();
}
