import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { chromium } from '@playwright/test';
import {
  captureDiagnostics,
  waitForRoute,
} from './cloudflare-browser-diagnostics.mjs';

const base = 'https://vellira-soak.test';
test('heading readiness works without main; later failures retain HTTP, static and initiator evidence', async (t) => {
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), 'vellira-browser-test-')
  );
  const browser = await chromium.launch();
  t.after(async () => {
    await browser.close();
    await fs.rm(directory, { recursive: true, force: true });
  });
  const context = await browser.newContext();
  await context.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/_next/static/missing.js')
      return route.fulfill({ status: 404, body: 'missing' });
    if (url.pathname === '/_next/static/failed.css')
      return route.abort('failed');
    if (url.pathname === '/api/broken')
      return route.fulfill({ status: 503, body: 'unavailable' });
    if (url.pathname === '/denied')
      return route.fulfill({
        status: 403,
        contentType: 'text/html',
        body: '<title>Denied</title><h1>Forbidden</h1>',
      });
    if (url.pathname === '/components/switch')
      return route.fulfill({
        contentType: 'text/html',
        body: '<title>Switch fixture</title><h1>Switch</h1>',
      });
    return route.fulfill({ body: 'fixture-build' });
  });
  const page = await context.newPage();
  const diagnostics = await captureDiagnostics(page, context, base, directory);
  await page.goto(`${base}/components/switch`);
  await waitForRoute(page, diagnostics, base, '/components/switch', 'Switch');
  assert.equal(await page.locator('main').count(), 0);
  // Same document: trigger errors after successful readiness, as in a long-lived client.
  const failuresObserved = Promise.all([
    page.waitForResponse((response) => response.url().endsWith('/missing.js')),
    page.waitForEvent('requestfailed', (request) =>
      request.url().endsWith('/failed.css')
    ),
    page.waitForEvent('pageerror'),
  ]);
  await page.evaluate(async () => {
    const script = document.createElement('script');
    script.src = '/_next/static/missing.js';
    document.head.append(script);
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = '/_next/static/failed.css';
    document.head.append(css);
    await fetch('/api/broken');
    console.error('fixture console error');
    setTimeout(() => {
      throw new Error('fixture page error');
    }, 0);
  });
  await failuresObserved;
  await assert.rejects(
    waitForRoute(page, diagnostics, base, '/components/switch', 'Switch'),
    /missing\.js/
  );
  await page.goto(`${base}/denied`);
  await diagnostics.finish(new Error('fixture failure'));
  const result = JSON.parse(
    await fs.readFile(path.join(directory, 'diagnostics.json'), 'utf8')
  );
  assert.equal(result.finalUrl, `${base}/denied`);
  assert.equal(result.title, 'Denied');
  assert.equal(result.mainCount, 0);
  assert.ok(result.events.some((e) => e.document && e.status === 403));
  assert.ok(result.errors.some((e) => e.status === 503));
  assert.ok(
    result.errors.some(
      (e) => e.kind === 'console' && e.text === 'fixture console error'
    )
  );
  assert.ok(
    result.errors.some(
      (e) => e.kind === 'pageerror' && e.error.includes('fixture page error')
    )
  );
  assert.ok(
    result.staticFailures.some(
      (e) => e.status === 404 && e.resourceType === 'script'
    )
  );
  assert.ok(
    result.staticFailures.some(
      (e) => e.kind === 'requestfailed' && e.url.endsWith('failed.css')
    )
  );
  assert.ok(
    result.events.some(
      (e) =>
        e.kind === 'initiator' && e.url.endsWith('missing.js') && e.initiator
    )
  );
  assert.match(
    await fs.readFile(path.join(directory, 'page.html'), 'utf8'),
    /Forbidden/
  );
  assert.ok((await fs.stat(path.join(directory, 'trace.zip'))).size > 0);
});

test('an existing heading cannot satisfy a different destination heading', async (t) => {
  const browser = await chromium.launch();
  t.after(() => browser.close());
  const page = await browser.newPage();
  await page.route('**/*', (route) =>
    route.fulfill({ contentType: 'text/html', body: '<h1>Switch</h1>' })
  );
  await page.goto(`${base}/components/checkbox`);
  await assert.rejects(
    waitForRoute(
      page,
      { assertHealthy() {} },
      base,
      '/components/checkbox',
      'Checkbox'
    ),
    /Route readiness failed/
  );
});
