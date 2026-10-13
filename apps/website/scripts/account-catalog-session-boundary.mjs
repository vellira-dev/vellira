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
  const pendingMe = new Promise((resolve) => {
    releaseMe = resolve;
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
    const requestedMe = delayedPage.waitForRequest(
      (request) => new URL(request.url()).pathname === '/v1/me',
      { timeout: 15_000 }
    );
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


  // Real /app -> /components soft navigation with a deliberately slow second
  // GET /v1/me. Track every rendered frame, not just the final settled state:
  // marketing navigation must never become visible between product headers.
  const transitionContext = await browser.newContext();
  let sessionRequests = 0;
  let releaseVerification = () => {};
  let signalVerification = () => {};
  const verificationGate = new Promise((resolve) => {
    releaseVerification = resolve;
  });
  const verificationStarted = new Promise((resolve) => {
    signalVerification = resolve;
  });
  await transitionContext.route('**/v1/**', async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    assert.equal(route.request().method(), 'GET', 'Catalog transition cannot mutate the API');
    const headers = {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': new URL(baseUrl).origin,
      'Access-Control-Allow-Credentials': 'true',
    };
    if (pathname === '/v1/me') {
      sessionRequests += 1;
      if (sessionRequests === 2) {
        signalVerification();
        await verificationGate;
      }
      await route.fulfill({
        status: 200,
        headers,
        body: '{"user":{"id":"test-user","status":"active","emailVerified":true}}',
      });
    } else if (pathname === '/v1/workspaces') {
      await route.fulfill({
        status: 200,
        headers,
        body: '{"workspaces":[{"id":"00000000-0000-4000-8000-000000000123","name":"Test workspace","status":"active","membership":{"role":"owner"}}]}',
      });
    } else {
      await route.fulfill({
        status: 404,
        headers,
        body: '{"error":{"code":"not_found"}}',
      });
    }
  });
  const transitionPage = await transitionContext.newPage();
  transitionPage.setDefaultTimeout(15_000);
  try {
    await transitionPage.setViewportSize({ width: 1440, height: 900 });
    await transitionPage.goto(new URL('/app', baseUrl).toString());
    await transitionPage.locator('[data-product-app-header]').waitFor();
    await transitionPage.evaluate(() => {
      window.__workspacePaintProbe = { siteFrames: 0, frames: 0 };
      const sample = () => {
        const probe = window.__workspacePaintProbe;
        if (!probe || probe.frames > 3600) return;
        if (document.querySelector('header nav[aria-label="Primary navigation"]')) {
          probe.siteFrames += 1;
        }
        probe.frames += 1;
        window.requestAnimationFrame(sample);
      };
      window.requestAnimationFrame(sample);
    });

    await transitionPage.locator('#app-sidebar-navigation')
      .getByRole('link', { name: 'Components' }).click();
    await transitionPage.waitForURL('**/components?from=app');
    await verificationStarted;
    await transitionPage.locator('[data-component-explorer]').waitFor();
    assert.equal(
      await transitionPage.locator('header nav[aria-label="Primary navigation"]').count(),
      0,
      'No public header while workspace verification is pending'
    );
    assert.equal(
      await transitionPage.locator('[data-product-app-header]').count(),
      0,
      'Product authentication marker requires a canonical verified session'
    );
    assert.equal(
      await transitionPage.getByRole('button', { name: 'Account menu' }).count(),
      0,
      'Do not expose account controls during workspace verification'
    );
    assert.equal(
      await transitionPage.getByRole('link', { name: 'Back to workspace' }).count(),
      0,
      'Do not expose workspace affordances before canonical verification'
    );
    const pendingHeader = await transitionPage.locator('header').first().boundingBox();
    assert.ok(pendingHeader);

    releaseVerification();
    await transitionPage.locator('[data-product-app-header]').waitFor();
    await transitionPage.getByRole('link', { name: 'Back to workspace' }).waitFor();
    const readyHeader = await transitionPage.locator('[data-product-app-header]').boundingBox();
    assert.ok(readyHeader);
    assert.ok(
      Math.abs(pendingHeader.height - readyHeader.height) <= 1,
      'The header must not resize when workspace session becomes ready'
    );
    assert.equal(
      await transitionPage.locator('[data-component-explorer]').count(),
      1,
      'The catalog must not switch between marketing and explorer layouts'
    );
    assert.equal(
      await transitionPage.evaluate(() => window.__workspacePaintProbe?.siteFrames),
      0,
      'No painted frame may show public navigation during workspace transition'
    );
  } finally {
    releaseVerification();
    await transitionPage.close();
    await transitionContext.close();
  }

  console.log('OK catalog session boundary: public/denied/query history, delayed session, no workspace header flash');
} finally {
  await browser.close();
}
