/* global document, window */
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';

const baseUrl = process.env.WEBSITE_URL;
if (!baseUrl) throw new Error('WEBSITE_URL is required');

const browser = await chromium.launch();
try {
  for (const authenticated of [false, true]) {
    const context = await browser.newContext();
    const calls = [];
    await context.route('**/v1/**', async (route) => {
      const request = route.request();
      const pathname = new URL(request.url()).pathname;
      calls.push(pathname);
      const headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': new URL(baseUrl).origin,
        'Access-Control-Allow-Credentials': 'true',
      };
      if (request.method() !== 'GET') {
        throw new Error(`Unexpected account mutation: ${pathname}`);
      }
      if (!authenticated) {
        await route.fulfill({
          status: 401,
          headers,
          body: '{"error":{"code":"unauthenticated"}}',
        });
        return;
      }
      if (pathname === '/v1/me') {
        await route.fulfill({
          status: 200,
          headers,
          body: JSON.stringify({
            user: { id: 'test-user', status: 'active', emailVerified: true },
          }),
        });
      } else if (pathname === '/v1/workspaces') {
        await route.fulfill({
          status: 200,
          headers,
          body: JSON.stringify({
            workspaces: [{
              id: '00000000-0000-4000-8000-000000000123',
              name: 'Test workspace',
              status: 'active',
              membership: { role: 'owner' },
            }],
          }),
        });
      } else {
        await route.fulfill({
          status: 404,
          headers,
          body: '{"error":{"code":"not_found"}}',
        });
      }
    });

    const page = await context.newPage();
    page.setDefaultTimeout(15_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    try {
      const sessionResponse = page.waitForResponse(
        (response) => new URL(response.url()).pathname === '/v1/me'
      );
      await page.goto(new URL('/components?from=app', baseUrl).toString());
      await sessionResponse;
      await page.getByText('Button', { exact: true }).first().waitFor();
      if (authenticated) {
        await page.locator('[data-product-app-header]').waitFor();
        await page.getByRole('link', { name: 'Back to workspace' }).waitFor();
        await page.locator('[data-component-explorer-sidebar]').waitFor();

        // Next soft-navigation must react to query-only history mutations
        // even though the persistent Components pathname does not change.
        await page.evaluate(() => window.history.pushState(null, '', '/components'));
        await page.waitForFunction(() =>
          document.querySelector('[data-product-app-header]') === null
        );
        await page.waitForFunction(() =>
          document.querySelector('[data-component-explorer-sidebar]') === null
        );
        assert.equal(
          await page.locator('a[href="/components/button"]').count() > 0,
          true,
          'Removing from=app must restore plain public links'
        );
        await page.goBack();
        await page.locator('[data-product-app-header]').waitFor();
        await page.getByRole('link', { name: 'Back to workspace' }).waitFor();
        assert.equal(
          await page.locator('a[href="/components/button?from=app"]').count() > 0,
          true,
          'Back navigation must restore requested catalog links'
        );
      } else {
        await page.waitForFunction(() =>
          document.querySelector('[data-product-app-header]') === null
        );
        assert.equal(
          await page.getByRole('link', { name: 'Back to workspace' }).count(),
          0,
          'Unauthenticated catalog must not expose workspace navigation'
        );
      }
      assert.ok(calls.includes('/v1/me'), 'Session must be checked');
      assert.ok(!calls.some((p) => p.includes('/bootstrap')), 'Public catalog must never bootstrap a workspace');
    } finally {
      await page.close();
      await context.close();
    }
  }
  // Hold the canonical account response until after a catalog click, proving
  // that a requested URL survives routing before session approval is known.
  const delayedContext = await browser.newContext();
  let releaseMe = () => {};
  let meStarted = () => {};
  const pendingMe = new Promise((resolve) => {
    releaseMe = resolve;
  });
  const requestedMe = new Promise((resolve) => {
    meStarted = resolve;
  });
  const delayedCalls = [];
  await delayedContext.route('**/v1/**', async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    delayedCalls.push({ pathname, method: request.method() });
    const headers = {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': new URL(baseUrl).origin,
      'Access-Control-Allow-Credentials': 'true',
    };
    if (request.method() !== 'GET') {
      throw new Error(`Unexpected mutation during delayed auth: ${pathname}`);
    }
    if (pathname === '/v1/me') {
      meStarted();
      await pendingMe;
      await route.fulfill({
        status: 200,
        headers,
        body: '{"user":{"id":"test-user","status":"active","emailVerified":true}}',
      });
    } else if (pathname === '/v1/workspaces') {
      await route.fulfill({
        status: 200,
        headers,
        body: JSON.stringify({
          workspaces: [{
            id: '00000000-0000-4000-8000-000000000123',
            name: 'Test workspace',
            status: 'active',
            membership: { role: 'owner' },
          }],
        }),
      });
    } else {
      await route.fulfill({ status: 404, headers, body: '{"error":{"code":"not_found"}}' });
    }
  });
  const delayedPage = await delayedContext.newPage();
  delayedPage.setDefaultTimeout(15_000);
  try {
    await delayedPage.goto(new URL('/components?from=app', baseUrl).toString());
    await requestedMe;
    await delayedPage.locator(
      'a[class*="card"][href="/components/button?from=app"]'
    ).click();
    await delayedPage.waitForURL('**/components/button?from=app');
    assert.equal(
      await delayedPage.locator('[data-product-app-header]').count(),
      0,
      'Unauthenticated/loading catalog must not render product controls'
    );
    releaseMe();
    await delayedPage.locator('[data-product-app-header]').waitFor();
    await delayedPage.getByRole('link', { name: 'Back to workspace' }).waitFor();
    assert.ok(
      !delayedCalls.some((request) => request.method !== 'GET'),
      'Catalog navigation must never initiate a backend mutation'
    );
  } finally {
    releaseMe();
    await delayedPage.close();
    await delayedContext.close();
  }

  console.log('OK catalog session boundary: anonymous, query-only history, delayed canonical session and context retention');
} finally {
  await browser.close();
}
