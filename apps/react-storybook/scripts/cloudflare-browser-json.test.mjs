/* global load, bootstrap, releaseEarlierStart */
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
const redirectHopPath = '/api/metrics-redirect-hop';

before(async () => {
  browser = await chromium.launch();
});
after(async () => {
  await browser?.close();
});

async function fixture(t) {
  const state = {
    calls: [],
    mode: 'ok',
    liked: false,
    redirectStatus: 307,
    redirectStep: 0,
  };
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
    const redirectHops =
      state.mode === 'redirect-roundtrip'
        ? 2
        : state.mode === 'redirect-away'
          ? 1
          : 0;
    if (state.redirectStep < redirectHops) {
      const location = state.redirectStep++ === 0 ? redirectHopPath : likePath;
      response.writeHead(state.redirectStatus, {
        Location: location,
        'Cache-Control': 'no-store',
      });
      response.end();
      return;
    }
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
  const { page, observe } = await fixture(t);
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

for (const status of [307, 308]) {
  for (const mode of ['redirect-roundtrip', 'redirect-away']) {
    test(`rejects HTTP ${status} ${mode} without replaying or changing the application's fetch`, async (t) => {
      const { page, observe, state } = await fixture(t);
      state.mode = mode;
      state.redirectStatus = status;
      let applicationResult;
      await assert.rejects(
        observe([spec()], () => {
          applicationResult = page.evaluate(async (url) => {
            window.redirectFetchCalls = (window.redirectFetchCalls ?? 0) + 1;
            const response = await fetch(url, {
              method: 'PUT',
              credentials: 'include',
            });
            return {
              url: response.url,
              redirected: response.redirected,
              status: response.status,
              payload: await response.json(),
              fetchCalls: window.redirectFetchCalls,
            };
          }, `${base}${likePath}`);
          return applicationResult;
        }),
        /Observed metrics response was redirected/
      );
      // The guard rejects evidence after the native redirect has happened. It
      // must not abort/rewrite the application's fetch or replay the mutation.
      const received = await applicationResult;
      const roundtrip = mode === 'redirect-roundtrip';
      assert.equal(received.redirected, true);
      assert.equal(received.status, 200);
      assert.equal(
        received.url,
        `${base}${roundtrip ? likePath : redirectHopPath}`
      );
      assert.deepEqual(received.payload.metrics, payload);
      assert.equal(received.fetchCalls, 1);
      assert.deepEqual(
        state.calls.map(({ method, url }) => ({ method, url })),
        (roundtrip
          ? [likePath, redirectHopPath, likePath]
          : [likePath, redirectHopPath]
        ).map((url) => ({ method: 'PUT', url }))
      );
    });
  }
}

// Synthetic routes keep the document-boundary regression deterministic. The
// production observer still receives only each original browser fetch/response.
async function documentFixture(t, options) {
  const origin = 'https://vellira-observer.test';
  const context = await browser.newContext();
  const calls = [];
  let documentNumber = 0;
  t.after(() => context.close());
  await context.route(`${origin}/**`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname.startsWith('/api/')) {
      const number = Number(request.headers()['x-fixture-document']);
      calls.push({
        document: number,
        method: request.method(),
        path: url.pathname,
      });
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          document: number,
          liked: number > 1,
          metrics: payload,
        }),
      });
      return;
    }
    const number = ++documentNumber;
    await route.fulfill({
      contentType: 'text/html',
      body: `<script>
        window.load = async (path, method = 'GET') => {
          const response = await fetch(path, {
            method, headers: { 'x-fixture-document': '${number}' },
          });
          return response.json();
        };
        window.bootstrapDone = false;
        window.bootstrap = async () => {
          for (const [method, path] of ${JSON.stringify([
            ['GET', likePath],
            ['POST', viewPath],
          ])}) {
            if (method === ${JSON.stringify(url.searchParams.get('omit'))}) continue;
            await load(path, method);
            if (method === ${JSON.stringify(url.searchParams.get('duplicate'))}) await load(path, method);
          }
          window.bootstrapDone = true;
        };
        ${url.pathname === '/bootstrap' ? 'void bootstrap();' : ''}
      </script>`,
    });
  });
  const page = await context.newPage();
  const observe = await captureBrowserJson(page, origin, options);
  await page.goto(`${origin}/plain`);
  const requests = [
    { url: `${origin}${likePath}`, method: 'GET' },
    { url: `${origin}${viewPath}`, method: 'POST' },
  ];
  const navigate = async (query = '') => {
    await page.goto(`${origin}/bootstrap${query}`);
    await page.waitForFunction(() => window.bootstrapDone);
  };
  return { page, observe, calls, requests, navigate };
}

test('next-document bootstrap excludes outgoing GET and POST, including repeated same-URL reloads', async (t) => {
  const { page, observe, calls, requests, navigate } = await documentFixture(t);
  for (let number = 2; number <= 5; number += 1) {
    const responses = await observe(
      requests,
      async () => {
        // Deterministically reproduce the outgoing hydration captured while the
        // old smoke was arming a reload. Both methods still reach the application.
        await page.evaluate(() => bootstrap());
        await navigate();
      },
      2_000,
      { document: 'next' }
    );
    assert.deepEqual(
      responses.map((response) => response.payload.document),
      [number, number]
    );
  }
  assert.equal(
    calls.length,
    16,
    'capture must not retry, suppress or add requests'
  );
});

for (const missing of ['GET', 'POST']) {
  test(`outgoing ${missing} cannot hide a missing destination bootstrap response`, async (t) => {
    const { page, observe, requests, navigate } = await documentFixture(t);
    await assert.rejects(
      observe(
        requests,
        async () => {
          await page.evaluate(() => bootstrap());
          await navigate(`?omit=${missing}`);
        },
        500,
        { document: 'next' }
      ),
      /timed out/
    );
  });
}

for (const method of ['GET', 'POST']) {
  test(`duplicate destination ${method} still fails in next-document mode`, async (t) => {
    const { observe, requests, navigate } = await documentFixture(t);
    await assert.rejects(
      observe(requests, () => navigate(`?duplicate=${method}`), 2_000, {
        document: 'next',
      }),
      /Duplicate observed request/
    );
  });
}

for (const method of ['GET', 'POST', 'PUT', 'DELETE']) {
  test(`current-document ${method} duplicates remain fatal`, async (t) => {
    const { page, observe, requests } = await documentFixture(t);
    const url = method === 'POST' ? requests[1].url : requests[0].url;
    await assert.rejects(
      observe([{ url, method }], () =>
        page.evaluate(
          async ({ url, method }) => {
            await load(url, method);
            await load(url, method);
          },
          { url, method }
        )
      ),
      /Duplicate observed request/
    );
  });
}

test('current-document mode rejects navigation rather than accepting replacement responses', async (t) => {
  const { observe, requests, navigate } = await documentFixture(t);
  await assert.rejects(
    observe(requests, () => navigate()),
    /document changed/
  );
});

test('a completed current-document response cannot authorize a later document in the same action', async (t) => {
  const { page, observe, requests, navigate } = await documentFixture(t);
  await assert.rejects(
    observe(requests, async () => {
      await page.evaluate(() => bootstrap());
      await navigate();
    }),
    /document changed/
  );
});

test('one bootstrap cannot combine GET and POST from two replacement documents', async (t) => {
  const { observe, requests, navigate } = await documentFixture(t);
  await assert.rejects(
    observe(
      requests,
      async () => {
        await navigate('?omit=POST');
        await navigate('?omit=GET');
      },
      2_000,
      { document: 'next' }
    ),
    /document changed/
  );
});

test('invalid document scope fails before action and leaves the observer reusable', async (t) => {
  const { page, observe, requests } = await documentFixture(t);
  let acted = false;
  await assert.rejects(
    observe(
      requests,
      async () => {
        acted = true;
      },
      2_000,
      { document: 'any' }
    ),
    /Invalid.*document scope/
  );
  assert.equal(acted, false);
  const result = await observe(requests, () =>
    page.evaluate(() => bootstrap())
  );
  assert.equal(result[0].payload.document, 1);
});

test('a queued request start cannot acquire a subsequent observation ticket', async (t) => {
  const { page, observe, requests } = await documentFixture(t);
  await observe(requests, () => page.evaluate(() => bootstrap()));
  await page.evaluate(async (url) => {
    const key = Object.getOwnPropertySymbols(window).find((key) =>
      Symbol.keyFor(key)?.startsWith('__velliraJson_')
    );
    const state = window[key];
    const earlier = await state.observation;
    state.observation = new Promise((resolve) => {
      window.releaseEarlierStart = () => resolve(earlier);
    });
    void load(url);
  }, requests[0].url);
  await assert.rejects(
    observe(
      [requests[0]],
      () => page.evaluate(() => releaseEarlierStart()),
      500
    ),
    /timed out/
  );
});

test('the arming deadline prevents a late action and holds the overlap lock', async (t) => {
  const { page, observe, requests } = await documentFixture(t);
  const evaluate = page.evaluate.bind(page);
  let release;
  const delayed = new Promise((resolve) => {
    release = resolve;
  });
  let arming;
  page.evaluate = (...args) => {
    arming = delayed.then(() => evaluate(...args));
    return arming;
  };
  let acted = false;
  const pending = observe(
    requests,
    async () => {
      acted = true;
    },
    50
  );
  await assert.rejects(
    observe(requests, async () => {}),
    /Overlapping/
  );
  await assert.rejects(pending, /timed out/);
  page.evaluate = evaluate;
  release();
  // Finish the exact held evaluation before checking for a late action.
  await arming;
  assert.equal(acted, false);
  const responses = await observe(requests, () =>
    page.evaluate(() => bootstrap())
  );
  assert.equal(responses[0].payload.document, 1);
});

test('bootstrap separates document readiness from original GET/POST dispatch without replay', async (t) => {
  const records = [];
  const { page, observe, requests, calls } = await documentFixture(t, {
    gateBootstrap: true,
    record: (kind, data) => records.push({ kind, ...data }),
  });
  const results = await observe(
    requests,
    async () => {
      await page.goto('https://vellira-observer.test/bootstrap');
      // Automatic app bootstrap already called fetch, but Phase A cannot mutate.
      assert.equal(calls.length, 0);
    },
    2_000,
    { document: 'next', deferFetchUntilReady: true }
  );
  assert.deepEqual(
    results.map((r) => r.payload.document),
    [2, 2]
  );
  assert.deepEqual(
    calls.map((c) => c.method),
    ['GET', 'POST']
  );
  const phases = records
    .filter((r) => r.kind === 'metrics-observation')
    .map((r) => r.phase);
  assert.deepEqual(phases, ['document-readiness', 'metrics']);
});

test('failed document readiness cancels held mutation; recovered navigation does not evaluate the failed document', async (t) => {
  const { page, observe, requests, calls } = await documentFixture(t, {
    gateBootstrap: true,
  });
  const original = new Error('classified edge document 503');
  await assert.rejects(
    observe(
      requests,
      async () => {
        await page.goto('https://vellira-observer.test/bootstrap');
        throw original;
      },
      2_000,
      { document: 'next', deferFetchUntilReady: true }
    ),
    (e) => e === original
  );
  assert.equal(
    calls.length,
    0,
    'no held request may dispatch after a failed Phase A'
  );
  const evaluate = page.evaluate.bind(page);
  let navigated = false;
  page.evaluate = (...args) => {
    assert.ok(
      navigated,
      'next-document arming must not evaluate a failed outgoing context'
    );
    return evaluate(...args);
  };
  await observe(
    requests,
    async () => {
      await page.goto('https://vellira-observer.test/bootstrap');
      navigated = true;
    },
    2_000,
    { document: 'next', deferFetchUntilReady: true }
  );
  assert.deepEqual(
    calls.map((c) => c.method),
    ['GET', 'POST']
  );
});

test('a missing POST response retains the completed GET and never repeats a dispatched mutation', async (t) => {
  const records = [];
  const { observe, requests, calls, navigate } = await documentFixture(t, {
    record: (kind, data) => records.push({ kind, ...data }),
  });
  await assert.rejects(
    observe(requests, () => navigate('?omit=POST'), 500, { document: 'next' }),
    /timed out/
  );
  const finish = records.find((r) => r.kind === 'metrics-observation-finish');
  assert.equal(finish.entries[0].response.status, 200);
  assert.equal(finish.entries[0].completed, true);
  assert.equal(finish.entries[1].started, false);
  assert.deepEqual(
    calls.map((c) => c.method),
    ['GET']
  );
});

test('a gated metrics fetch without an observer ticket cannot dispatch a mutation', async (t) => {
  const { page, observe, calls, requests } = await documentFixture(t, {
    gateBootstrap: true,
  });
  const result = await page.evaluate(async (url) => {
    try {
      await load(url, 'POST');
      return 'sent';
    } catch (error) {
      return error.name;
    }
  }, requests[1].url);
  assert.equal(result, 'AbortError');
  assert.deepEqual(calls, []);
  // Missing registration did not create a mutation or poison a later observer.
  await observe(requests, () => page.evaluate(() => bootstrap()));
  assert.deepEqual(
    calls.map(({ method }) => method),
    ['GET', 'POST']
  );
});
