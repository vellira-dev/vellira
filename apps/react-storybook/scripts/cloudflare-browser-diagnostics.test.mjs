import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { chromium } from '@playwright/test';
import {
  captureDiagnostics,
  waitForRoute,
  diagnosticHeaders,
} from './cloudflare-browser-diagnostics.mjs';

const base = 'https://vellira-soak.test';
test('cache diagnostics do not persist credential headers', () => {
  assert.deepEqual(
    diagnosticHeaders({
      Cookie: 'secret',
      'Set-Cookie': 'secret',
      Authorization: 'secret',
      'Proxy-Authorization': 'secret',
      RSC: '1',
      'x-vellira-request-id': 'id',
    }),
    { RSC: '1', 'x-vellira-request-id': 'id' }
  );
});
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
  assert.ok(result.firstBadAsset.url.includes('/_next/static/'));
  assert.ok(result.cacheAttributionCaveat.includes('not proof'));
  assert.ok(
    result.events.some(
      (event) =>
        event.kind === 'network-source' && event.fromDiskCache === false
    )
  );
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

test('an opt-in expected 404 is reconciled only with its matching resource console error', async (t) => {
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), 'vellira-browser-expected-404-test-')
  );
  const browser = await chromium.launch();
  t.after(async () => {
    await browser.close();
    await fs.rm(directory, { recursive: true, force: true });
  });
  const context = await browser.newContext();
  await context.route('**/*', (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/expected') {
      return route.fulfill({ status: 404, body: 'expected' });
    }
    if (url.pathname === '/api/unexpected') {
      return route.fulfill({ status: 404, body: 'unexpected' });
    }
    return route.fulfill({
      contentType: 'text/html',
      body: '<title>Fixture</title><h1>Fixture</h1>',
    });
  });
  const page = await context.newPage();
  const diagnostics = await captureDiagnostics(page, context, base, directory, {
    isExpected404Response: (response) =>
      response.url === `${base}/api/expected` && response.method === 'GET',
  });

  await page.goto(`${base}/fixture`);
  await page.evaluate(() => fetch('/api/expected'));
  await page.waitForTimeout(50);
  assert.doesNotThrow(() => diagnostics.assertHealthy('expected 404'));

  await page.evaluate(() =>
    console.error(
      'Failed to load resource: the server responded with a status of 404 ()'
    )
  );
  await assert.rejects(
    async () => diagnostics.assertHealthy('unmatched resource console error'),
    /console/
  );

  await page.evaluate(() => fetch('/api/unexpected'));
  await page.waitForTimeout(50);
  assert.throws(
    () => diagnostics.assertHealthy('unexpected 404'),
    /api\/unexpected/
  );
});

test('diagnostics recover transient Cloudflare edge RSC 503 only on the exact build', async (t) => {
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), 'vellira-browser-edge-recovery-test-')
  );
  let rscRequests = 0;
  const server = http.createServer((request, response) => {
    if (request.url?.startsWith('/rsc')) {
      rscRequests += 1;
      if (rscRequests === 1) {
        response.statusCode = 503;
        response.setHeader('Server', 'cloudflare');
        response.setHeader('Content-Type', 'text/html');
        response.end('temporary edge failure');
        return;
      }
      response.statusCode = 200;
      response.setHeader('Server', 'cloudflare');
      response.setHeader('x-vellira-build-id', 'build-1');
      response.setHeader('Content-Type', 'text/x-component');
      response.end('recovered');
      return;
    }

    response.statusCode = 200;
    response.setHeader('Content-Type', 'text/html');
    response.end('<title>Fixture</title><h1>Fixture</h1>');
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(
    () =>
      new Promise((resolve) => {
        server.close(resolve);
      })
  );

  const address = server.address();
  assert.ok(address && typeof address === 'object');
  const origin = `http://127.0.0.1:${address.port}`;

  const browser = await chromium.launch();
  t.after(async () => {
    await browser.close();
    await fs.rm(directory, { recursive: true, force: true });
  });
  const context = await browser.newContext();
  const page = await context.newPage();
  const diagnostics = await captureDiagnostics(
    page,
    context,
    origin,
    directory,
    { expectedBuildId: 'build-1' }
  );

  await page.goto(`${origin}/fixture`);
  const edgeCursor = diagnostics.edgeFailureCursor();
  await page.evaluate(() =>
    fetch('/rsc?_rsc=edge-test', { headers: { RSC: '1' } })
  );
  await page.waitForTimeout(50);

  assert.throws(
    () => diagnostics.assertHealthy('before recovery'),
    /\/rsc\?_rsc=edge-test/
  );

  await diagnostics.recoverEdgeFailures('test recovery');
  assert.doesNotThrow(() => diagnostics.assertHealthy('after recovery'));
  assert.equal(
    diagnostics.recoveredDestinationEdgeFailureSince(edgeCursor, '/rsc'),
    true
  );
  assert.equal(
    diagnostics.recoveredDestinationEdgeFailureSince(edgeCursor, '/other'),
    false
  );
  assert.equal(rscRequests, 2);

  await diagnostics.finish(null);
});

for (const scenario of [
  'transport-recovery',
  'worker-failure',
  'wrong-build',
]) {
  test(`diagnostics preserve browser failure unless shared proof succeeds: ${scenario}`, async (t) => {
    const directory = await fs.mkdtemp(
      path.join(os.tmpdir(), 'vellira-edge-caller-')
    );
    let calls = 0;
    const server = http.createServer((request, response) => {
      if (request.url.startsWith('/rsc')) {
        calls++;
        if (scenario === 'transport-recovery' && calls > 1 && calls < 4) {
          request.socket.destroy();
          return;
        }
        response.setHeader('server', 'cloudflare');
        if (calls === 1) response.statusCode = 503;
        else {
          response.statusCode = scenario === 'worker-failure' ? 503 : 200;
          response.setHeader(
            'x-vellira-build-id',
            scenario === 'wrong-build' ? 'other' : 'build-1'
          );
          response.setHeader('x-vellira-worker-version', 'worker-1');
        }
      }
      response.end('<h1>Fixture</h1>');
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const browser = await chromium.launch();
    t.after(async () => {
      await browser.close();
      await new Promise((resolve) => server.close(resolve));
      await fs.rm(directory, { recursive: true, force: true });
    });
    const origin = `http://127.0.0.1:${server.address().port}`;
    const context = await browser.newContext();
    const page = await context.newPage();
    const diagnostics = await captureDiagnostics(
      page,
      context,
      origin,
      directory,
      { expectedBuildId: 'build-1' }
    );
    await page.goto(origin);
    const cursor = diagnostics.edgeFailureCursor();
    await page.evaluate(() =>
      fetch('/rsc?_rsc=caller', { headers: { RSC: '1' } })
    );
    await page.waitForTimeout(50);
    await diagnostics.recoverEdgeFailures('caller proof');
    const recovered = scenario === 'transport-recovery';
    assert.equal(
      diagnostics.recoveredDestinationEdgeFailureSince(cursor, '/rsc'),
      recovered
    );
    if (recovered) diagnostics.assertHealthy('proven');
    else
      assert.throws(
        () => diagnostics.assertHealthy('unproven'),
        /Browser failure/
      );
    await diagnostics.finish(null);
    assert.equal(
      calls,
      recovered ? 4 : 2,
      'finish must not reset exhausted/rejected recovery'
    );
    const evidence = JSON.parse(
      await fs.readFile(path.join(directory, 'diagnostics.json'), 'utf8')
    );
    assert.equal(evidence.errors.length === 0, recovered);
    assert.ok(
      evidence.events.some(
        (event) =>
          event.kind === 'edge-recovery' && event.recovered === recovered
      )
    );
  });
}

test('browser document reads are bounded and never convert expiry into evidence', async () => {
  const { boundedBrowserRead } =
    await import('./cloudflare-browser-diagnostics.mjs');
  assert.equal(
    await boundedBrowserRead(async () => 'token', 'token', 50),
    'token'
  );
  await assert.rejects(
    boundedBrowserRead(() => new Promise(() => {}), 'stalled document', 10),
    /Browser read timed out: stalled document/
  );
  const programmingError = new TypeError('invalid observer');
  await assert.rejects(
    boundedBrowserRead(() => {
      throw programmingError;
    }, 'token'),
    (error) => error === programmingError
  );
  await assert.rejects(
    boundedBrowserRead(() => 'token', 'token', 0),
    /positive timeout/
  );
});

test(
  'finish retains failure evidence when document title/count/HTML reads never settle',
  { timeout: 25_000 },
  async (t) => {
    const { EventEmitter } = await import('node:events');
    const directory = await fs.mkdtemp(
      path.join(os.tmpdir(), 'vellira-stalled-evidence-')
    );
    const server = http.createServer((_request, response) => {
      response.setHeader('x-vellira-build-id', 'build-1');
      response.end('build-1');
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    t.after(async () => {
      await new Promise((resolve) => server.close(resolve));
      await fs.rm(directory, { recursive: true, force: true });
    });
    const origin = `http://127.0.0.1:${server.address().port}`;
    const never = () => new Promise(() => {});
    const page = Object.assign(new EventEmitter(), {
      url: () => `${origin}/stalled`,
      title: never,
      content: never,
      locator: () => ({ count: never }),
      screenshot: async ({ timeout }) => assert.equal(timeout, 5_000),
    });
    let traceStopped = false;
    const context = {
      newCDPSession: async () => {
        throw new Error('no CDP');
      },
      tracing: {
        start: async () => {},
        stop: async () => {
          traceStopped = true;
        },
      },
    };
    const diagnostics = await captureDiagnostics(
      page,
      context,
      origin,
      directory,
      { expectedBuildId: 'build-1' }
    );
    const failure = new Error('original route readiness failure');
    await diagnostics.finish(failure);
    const evidence = JSON.parse(
      await fs.readFile(path.join(directory, 'diagnostics.json'), 'utf8')
    );
    assert.match(evidence.error, /original route readiness failure/);
    assert.equal(evidence.title, null);
    assert.equal(evidence.mainCount, null);
    assert.match(
      await fs.readFile(path.join(directory, 'page.html'), 'utf8'),
      /Browser read timed out: diagnostic HTML/
    );
    assert.equal(traceStopped, true);
  }
);
