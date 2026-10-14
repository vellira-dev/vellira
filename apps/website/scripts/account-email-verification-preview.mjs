import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';

// Launch a separate dev server with both preview flags set:
// NEXT_PUBLIC_VELLIRA_LOCAL_PREVIEW=1
// NEXT_PUBLIC_VELLIRA_LOCAL_PREVIEW_EMAIL_UNVERIFIED=1
// Then WEBSITE_URL=http://localhost:3002 pnpm --filter @vellira-ui/website test:account-email-verification-preview
const baseUrl = process.env.WEBSITE_URL;
if (!baseUrl) throw new Error('WEBSITE_URL is required.');

const browser = await chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();
page.setDefaultTimeout(15_000);
const apiRequests = [];
page.on('request', (request) => {
  if (/\/v1\//.test(new URL(request.url()).pathname)) {
    apiRequests.push(request.url());
  }
});

try {
  await page.goto(new URL('/app/settings', baseUrl).toString());
  await page.getByText('Local UI preview', { exact: false }).waitFor();
  await page.getByText('Not verified', { exact: true }).waitFor();
  const verification = page.getByText('Not verified', { exact: true });
  assert.equal(
    await verification.locator('..').locator('svg').count(),
    1,
    'Unverified should have the canonical circle-cross status icon'
  );
  assert.equal(
    await page.locator('label[for="account-primary-email"]').getByRole('status', { name: 'Not verified' }).count(),
    1,
    'The unverified status pill must be colocated with Email address'
  );
  assert.equal(
    await page.getByRole('button', { name: 'Update email', exact: true }).isDisabled(),
    true,
    'Unverified account cannot bypass secure email change with a live action'
  );

  const actions = page.getByRole('button', { name: 'Resend verification email' });
  assert.equal(
    await actions.count(),
    2,
    'Unverified banner and Account must each expose resend verification'
  );
  for (const button of await actions.all()) {
    assert.equal(await button.isDisabled(), true, 'Preview must not send email');
  }
  assert.equal(
    await page.getByText('Disabled in local UI preview', { exact: false }).count(),
    2,
    'Preview must explain why resend is disabled'
  );

  await page.goto(new URL('/app', baseUrl).toString());
  await page.getByText('Email not verified', { exact: true }).waitFor();
  await page.getByRole('heading', { name: 'Start building with Vellira' }).waitFor();
  assert.deepEqual(apiRequests, [], 'Preview must never call the production API');
  console.log('OK unverified preview: red icon, banner, Account resend, and no API calls');
} finally {
  await page.close();
  await context.close();
  await browser.close();
}
