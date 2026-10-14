/* global document, window */
import assert from 'node:assert/strict';

import { chromium } from '@playwright/test';

// Run against an ordinary local website server (no preview fixture).
// Every API request is intercepted: this script never touches real accounts.
const baseUrl = process.env.WEBSITE_URL;
if (!baseUrl) throw new Error('WEBSITE_URL is required.');

const origin = new URL(baseUrl).origin;
const browser = await chromium.launch();
const context = await browser.newContext();
let profile = { fullName: '', displayName: '', locale: 'en', timeZone: 'UTC', revision: 1 };
let profileReads = 0;
let profileWrites = 0;
let emailReads = 0;
let emailUnavailable = false;
let mockedConflict = false;
let readUnavailable = false;
let unexpectedMutations = 0;

await context.route('**/v1/**', async (route) => {
  const request = route.request();
  const method = request.method();
  const path = new URL(request.url()).pathname;
  const headers = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Headers': 'Content-Type, X-CSRF-Token',
    'Access-Control-Allow-Methods': 'GET, PATCH, OPTIONS',
  };
  const reply = (status, body) => route.fulfill({
    status,
    headers,
    body: JSON.stringify(body),
  });

  if (method === 'OPTIONS') {
    await route.fulfill({ status: 204, headers, body: '' });
    return;
  }
  if (path === '/v1/me' && method === 'GET') {
    await reply(200, { user: { id: 'profile-owner', status: 'active', emailVerified: true } });
    return;
  }
  if (path === '/v1/workspaces' && method === 'GET') {
    await reply(200, {
      workspaces: [{
        id: '00000000-0000-4000-8000-000000000123',
        name: 'Test workspace',
        status: 'active',
        membership: { role: 'owner' },
      }],
    });
    return;
  }
  if (path === '/v1/auth/email/current' && method === 'GET') {
    emailReads += 1;
    if (emailUnavailable) {
      await reply(503, { error: { code: 'account_email_unavailable' } });
    } else {
      await reply(200, { email: { address: 'owner@example.test', verified: true } });
    }
    return;
  }
  if (path === '/v1/auth/csrf' && method === 'GET') {
    await reply(200, { csrfToken: 'isolated-test-csrf' });
    return;
  }
  if (path === '/v1/profile' && method === 'GET') {
    profileReads += 1;
    if (readUnavailable) {
      await reply(503, { error: { code: 'profile_unavailable' } });
    } else {
      await reply(200, { profile });
    }
    return;
  }
  if (path === '/v1/profile' && method === 'PATCH') {
    profileWrites += 1;
    assert.equal(request.headers()['x-csrf-token'], 'isolated-test-csrf');
    const submitted = JSON.parse(request.postData() || '{}');
    assert.deepEqual(Object.keys(submitted).sort(),
      ['displayName', 'fullName', 'locale', 'revision', 'timeZone'].sort());
    assert.ok(!('userId' in submitted) && !('email' in submitted));
    if (mockedConflict || submitted.revision !== profile.revision) {
      mockedConflict = false;
      await reply(409, { error: { code: 'profile_conflict' } });
      return;
    }
    profile = { ...submitted, revision: submitted.revision + 1 };
    await reply(200, { profile });
    return;
  }
  if (method !== 'GET') unexpectedMutations += 1;
  await reply(404, { error: { code: 'not_found' } });
});

const page = await context.newPage();
page.setDefaultTimeout(15000);

try {
  await page.goto(new URL('/app/settings', baseUrl).toString());
  await page.getByRole('heading', { name: 'Your account' }).waitFor();
  const fullName = page.getByRole('textbox', { name: 'Full name' });
  const displayName = page.getByRole('textbox', { name: 'Display name' });
  await fullName.waitFor();
  assert.equal(await fullName.inputValue(), '');
  const email = page.getByRole('textbox', { name: 'Email address' });
  await page.waitForFunction(() => {
    const field = document.querySelector('input[type="email"]');
    return field?.value === 'owner@example.test';
  });
  assert.equal(await email.getAttribute('readonly'), '');
  assert.equal(emailReads, 1, 'current sign-in email must load from auth exactly once');
  assert.equal(
    await page.getByRole('heading', { name: 'Account details' }).count(),
    0,
    'Account details duplicated status and email: remove the redundant block'
  );
  const verifiedLabel = page.getByText('Verified', { exact: true });
  await verifiedLabel.waitFor();
  assert.equal(await verifiedLabel.count(), 1, 'Verification status should occur only once');
  assert.equal(
    await verifiedLabel.locator('..').locator('svg').count(),
    1,
    'Verified indicator should sit beside the email, with its check icon'
  );
  assert.equal(await page.locator('[data-profile-save-bar]').count(), 0, 'Clean profile must not show the sticky bar');
  assert.equal(profileReads, 1, 'profile GET must be read-only and load exactly once');

  // Discard returns to the last server-confirmed values without a PATCH.
  await fullName.fill('Temporary change');
  const dirtyBar = page.locator('[data-profile-save-bar]');
  await dirtyBar.waitFor();
  assert.equal(await dirtyBar.getByRole('button', { name: 'Discard' }).isEnabled(), true);
  const barPosition = await dirtyBar.evaluate((element) => ({
    position: window.getComputedStyle(element).position,
    bottom: window.getComputedStyle(element).bottom,
  }));
  assert.equal(barPosition.position, 'sticky', 'The action bar must stay attached to the viewport');
  assert.notEqual(barPosition.bottom, 'auto', 'Sticky action bar needs a bottom offset');
  await dirtyBar.getByRole('button', { name: 'Discard' }).click();
  assert.equal(await fullName.inputValue(), '');
  assert.equal(await dirtyBar.count(), 0, 'Discard must hide the action bar');
  assert.equal(profileWrites, 0, 'Discard must not mutate the backend');

  await fullName.fill('Ada Lovelace');
  await displayName.fill('Ada');
  assert.equal(await page.getByText('Unsaved changes').count(), 1);
  await page.getByRole('button', { name: 'Save changes' }).click();
  await page.getByText('Changes saved.', { exact: true }).waitFor();
  assert.equal(profileWrites, 1);
  assert.equal(profile.revision, 2);
  assert.equal(profile.fullName, 'Ada Lovelace');
  assert.equal(await page.locator('[data-profile-save-bar]').count(), 0, 'Successful save must hide the bar');

  // Unsaved edits must be kept on a conflict and never overwritten optimistically.
  await displayName.fill('Unsaved edit');
  mockedConflict = true;
  await page.getByRole('button', { name: 'Save changes' }).click();
  await page.getByText('This profile was changed elsewhere.', { exact: false }).waitFor();
  assert.equal(await displayName.inputValue(), 'Unsaved edit');
  assert.equal(profile.displayName, 'Ada', 'conflict must not mutate canonical server data');
  await page.getByRole('button', { name: 'Discard', exact: true }).click();
  await displayName.waitFor();
  assert.equal(await displayName.inputValue(), 'Ada');
  assert.equal(await page.locator('[data-profile-save-bar]').count(), 0, 'Conflict discard must hide the bar');

  // Email read failures must not hide or reset the editable profile.
  emailUnavailable = true;
  await page.reload();
  await page.getByText('Could not load your sign-in email.', { exact: true }).waitFor();
  assert.equal(await fullName.inputValue(), 'Ada Lovelace');
  emailUnavailable = false;
  const readsBeforeRetry = profileReads;
  await page.getByRole('button', { name: 'Retry email' }).click();
  await page.waitForFunction(() =>
    document.querySelector('input[type="email"]')?.value === 'owner@example.test'
  );
  assert.equal(profileReads, readsBeforeRetry, 'email retry must not reload profile data');

  // A deliberately rejected tab navigation must preserve both edits and tab.
  await fullName.fill('Uncommitted');
  page.once('dialog', async (dialog) => {
    assert.equal(dialog.type(), 'confirm');
    await dialog.dismiss();
  });
  await page.getByRole('tab', { name: 'Security' }).click();
  assert.equal(await fullName.inputValue(), 'Uncommitted');
  assert.equal(await page.getByRole('tab', { name: 'Account' }).getAttribute('aria-selected'), 'true');
  page.once('dialog', async (dialog) => dialog.accept());
  await page.getByRole('tab', { name: 'Security' }).click();
  await page.waitForURL('**/app/settings?section=security');

  // A failed GET must never show a stale account or issue mutations.
  readUnavailable = true;
  await page.goto(new URL('/app/settings', baseUrl).toString());
  await page.getByText('Your profile is temporarily unavailable.', { exact: false }).waitFor();
  assert.equal(await page.getByRole('textbox', { name: 'Full name' }).count(), 0);
  readUnavailable = false;
  await page.getByRole('button', { name: 'Try again' }).click();
  await page.getByRole('textbox', { name: 'Full name' }).waitFor();

  await fullName.fill('Pending mobile edit');
  for (const width of [768, 390, 320]) {
    await page.setViewportSize({ width, height: 820 });
    await dirtyBar.waitFor();
    const mobileBar = await dirtyBar.boundingBox();
    if (!mobileBar) throw new Error('Dirty action bar is not visible on viewport ' + width);
    assert.ok(mobileBar.x >= 0 && mobileBar.x + mobileBar.width <= width + 1, 'Sticky bar must fit viewport ' + width);
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth),
      false,
      'Account profile must fit viewport ' + width
    );
  }
  await dirtyBar.getByRole('button', { name: 'Discard' }).click();
  assert.equal(await dirtyBar.count(), 0, 'Mobile discard hides the bar');
  assert.equal(unexpectedMutations, 0);
  assert.ok(profileReads >= 3, 'retry must issue a new GET');
  console.log('OK Account Profile: canonical email, no duplicate details, GET/PATCH, CSRF, conflict, independent retries and mobile geometry');
} finally {
  await page.close();
  await context.close();
  await browser.close();
}
