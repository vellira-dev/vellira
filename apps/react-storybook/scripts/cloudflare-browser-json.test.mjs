import assert from 'node:assert/strict';
import http from 'node:http';
import { after, before, test } from 'node:test';
import { chromium } from '@playwright/test';
import { captureBrowserJson } from './cloudflare-browser-json.mjs';

let browser;
let base;
const payload = { slug: 'two-runtimes-é-中-🚀', views: 9, likes: 1 };
const likePath = '/api/blog-metrics/articles/two-runtimes/like';
const viewPath = '/api/blog-metrics/articles/two-runtimes/views';

before(async () => {
  browser = await chromium.launch();
});
after(async () => {
  await browser?.close();
});

async function fixture(t) {
  const state = { calls: [], mode: 'ok', liked: false };
  const server = http.createServer((request, response) => {
    if (!request.url.startsWith('/api/')) {
      response.writeHead(200, { 'Content-Type': 'text/html' });
      response.end(`<button id="like">Like</button><script>
        async function load(url, method = 'GET') {
          const response = await fetch(url, { method, credentials: 'include' });
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let text = '';
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            text += decoder.decode(value, { stream: true });
          }
          return JSON.parse(text + decoder.decode());
        }
        window.load = load;
        document.querySelector('#like').onclick = async () => {
          window.received = await load('${likePath}', 'PUT');
          document.querySelector('#like').textContent = 'Unlike';
        };
      </script>`);
      return;
    }
    state.calls.push({
      method: request.method,
      url: request.url,
      cookie: request.headers.cookie,
    });
    const previous = state.liked;
    if (request.method === 'PUT') state.liked = true;
    if (request.method === 'DELETE') state.liked = false;
    response.writeHead(state.mode === 'http-error' ? 503 : 200, {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'Set-Cookie': 'actor=fixture; Path=/; HttpOnly; SameSite=Lax',
    });
    const data = JSON.stringify({
      liked: state.liked,
      changed: state.liked !== previous,
      metrics: payload,
      error: state.mode === 'http-error' ? { code: 'unavailable' } : undefined,
    });
    if (state.mode === 'hang') {
      response.write('{');
      return;
    }
    if (state.mode === 'malformed') return response.end('{invalid');
    if (state.mode === 'oversize')
      return response.end(JSON.stringify({ ignored: 'a'.repeat(128 * 1024) }));
    if (state.mode === 'late') return setTimeout(() => response.end(data), 200);
    // Use real streamed HTTP bytes, including split multi-byte Unicode.
    const bytes = Buffer.from(data);
    let offset = 0;
    const send = () => {
      if (response.destroyed) return;
      if (offset === bytes.length) return response.end();
      response.write(bytes.subarray(offset, ++offset));
      setImmediate(send);
    };
    send();
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
  const context = await browser.newContext();
  t.after(async () => {
    await context.close();
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  });
  const page = await context.newPage();
  const observe = await captureBrowserJson(page, base);
  await page.goto(base);
  return { page, context, observe, state };
}
const spec = (method = 'PUT', path = likePath) => ({
  url: `${base}${path}`,
  method,
});

test('captures the original streamed click response even when CDP body access fails; never repeats the mutation', async (t) => {
  const { page, observe, state } = await fixture(t);
  let denied = 0;
  page.on('response', (response) => {
    if (!response.url().endsWith(likePath)) return;
    response.json = async () => {
      denied += 1;
      throw new Error(
        'Protocol error (Network.getResponseBody): No data found for resource with given identifier'
      );
    };
  });
  const network = page.waitForResponse(
    (response) => response.request().method() === 'PUT'
  );
  const [result] = await observe([spec()], () => page.locator('#like').click());
  assert.equal(result.status, 200);
  assert.equal(result.payload.changed, true);
  assert.deepEqual(result.payload.metrics, payload);
  await page.waitForFunction(() => window.received?.liked === true);
  assert.deepEqual(await page.evaluate(() => window.received), result.payload);
  assert.equal(denied, 0, 'capture must not depend on the protocol body cache');
  // The previous smoke read fails against this exact same response.
  await assert.rejects((await network).json(), /Network.getResponseBody/);
  assert.equal(denied, 1);
  assert.deepEqual(
    state.calls.map(({ method }) => method),
    ['PUT']
  );
});

test('preserves browser cookies, exact method pairing and original payloads across reloads', async (t) => {
  const { page, observe, state } = await fixture(t);
  const [first] = await observe([spec()], () => page.locator('#like').click());
  assert.equal(first.payload.changed, true);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await page.reload();
    const results = await observe([spec('GET'), spec('POST', viewPath)], () =>
      page.evaluate(
        async ({ likePath, viewPath }) => {
          await load(likePath);
          await load(viewPath, 'POST');
        },
        { likePath, viewPath }
      )
    );
    assert.equal(results[0].payload.liked, true);
    assert.equal(results[1].payload.metrics.views, payload.views);
  }
  const [last] = await observe([spec('DELETE')], () =>
    page.evaluate((url) => load(url, 'DELETE'), likePath)
  );
  assert.equal(last.payload.liked, false);
  assert.equal(state.calls.length, 8);
  assert.ok(
    state.calls.slice(1).every((call) => call.cookie === 'actor=fixture')
  );
});

test('HTTP failure is retained and malformed JSON cannot become a success', async (t) => {
  const { page, observe, state } = await fixture(t);
  state.mode = 'http-error';
  const [result] = await observe([spec()], () =>
    page.evaluate((url) => load(url, 'PUT'), likePath)
  );
  assert.equal(result.status, 503);
  assert.equal(result.payload.error.code, 'unavailable');
  state.mode = 'malformed';
  await assert.rejects(
    observe([spec()], () =>
      page.evaluate((url) => load(url, 'PUT').catch(() => {}), likePath)
    ),
    /SyntaxError/
  );
  assert.equal(state.calls.length, 2);
});

test('missing and stalled responses fail within the observation deadline without retrying', async (t) => {
  const { page, observe, state } = await fixture(t);
  await assert.rejects(
    observe([spec()], async () => {}, 100),
    /timed out/
  );
  assert.equal(state.calls.length, 0);
  state.mode = 'hang';
  await assert.rejects(
    observe(
      [spec()],
      () =>
        page.evaluate((url) => {
          void load(url, 'PUT').catch(() => {});
        }, likePath),
      100
    ),
    /timed out/
  );
  assert.equal(state.calls.length, 1);
});

test('an oversized body cannot exhaust capture memory or pass as valid evidence', async (t) => {
  const { page, observe, state } = await fixture(t);
  state.mode = 'oversize';
  await assert.rejects(
    observe([spec()], () => page.evaluate((url) => load(url, 'PUT'), likePath)),
    /128 KiB/
  );
  assert.equal(state.calls.length, 1);
});

test('late responses cannot satisfy a later observation of the same URL and method', async (t) => {
  const { page, observe, state } = await fixture(t);
  state.mode = 'late';
  await assert.rejects(
    observe(
      [spec()],
      () =>
        page.evaluate((url) => {
          void load(url, 'PUT');
        }, likePath),
      50
    ),
    /timed out/
  );
  await assert.rejects(
    observe([spec()], async () => {}, 350),
    /timed out/
  );
  assert.equal(state.calls.length, 1);
});

test('duplicate writes during one action fail rather than accepting the first good response', async (t) => {
  const { page, observe, state } = await fixture(t);
  await assert.rejects(
    observe([spec()], () =>
      page.evaluate(async (url) => {
        await load(url, 'PUT');
        await load(url, 'PUT');
      }, likePath)
    ),
    /Duplicate observed request/
  );
});

test('wrong method and wrong endpoint do not satisfy a pending observation', async (t) => {
  const { page, observe, state } = await fixture(t);
  await assert.rejects(
    observe(
      [spec()],
      () =>
        page.evaluate(
          async ({ likePath, viewPath }) => {
            await load(likePath, 'GET');
            await load(viewPath, 'POST');
          },
          { likePath, viewPath }
        ),
      300
    ),
    /timed out/
  );
  assert.deepEqual(
    state.calls.map(({ method }) => method),
    ['GET', 'POST']
  );
});
