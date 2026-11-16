// Regression contract for the published Next 16.4.2 CJS and ESM patched dist.
// This verifies actual compiled transport logic; browser migration remains a separate gate.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const key = Symbol.for('vellira.next2130.mpaEpoch.v1');
const root = process.env.NEXT2130_DIST_ROOT || path.dirname(
  createRequire(path.join(fileURLToPath(new URL('..', import.meta.url)),
    'apps/website/package.json')).resolve('next/package.json')
);
const versions = ['dist/client', 'dist/esm/client'];

function source(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}
function functionBody(content, name) {
  const ast = ts.createSourceFile('next.js', content, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const funcs = ast.statements.filter(node => ts.isFunctionDeclaration(node) && node.name?.text === name);
  assert.equal(funcs.length, 1, 'Expected exactly one compiled ' + name);
  return funcs[0].getText(ast).replace(/^export\s+/, '');
}
function runtime(prefix, { redirect = false } = {}) {
  const src = source(prefix + '/components/router-reducer/fetch-server-response.js');
  const queued = [];
  const sent = [];
  const context = {
    URL, Symbol, DOMException, Headers, Response, Error,
    process: { env: { __NEXT_CLIENT_VALIDATE_RSC_REQUEST_HEADERS: redirect } },
    _deploymentid: { getDeploymentId: () => null },
    getDeploymentId: () => null,
    _approuterheaders: { NEXT_RSC_UNION_QUERY: '_rsc' },
    NEXT_RSC_UNION_QUERY: '_rsc',
    processFetch: async response => ({ response, cacheData: null }),
    decodeFlightResponse: () => { throw new Error('Unexpected decode'); },
  };
  const digest = (url) => new Promise(resolve => queued.push(() => {
    url.searchParams.set('_rsc', 'EhaCa9lrLxaM_bV6');
    resolve();
  }));
  const nativeFetch = async (url, options) => {
    sent.push({ url: String(url), headers: options.headers, cache: options.cache });
    return {
      ok: true, redirected: redirect && sent.length === 1,
      status: 200,
      url: redirect && sent.length === 1 ? 'http://example.test/redirected' : String(url),
      headers: new Headers({ 'content-type': 'text/x-component' }),
      body: null,
    };
  };
  context._setcachebustingsearchparam = { setCacheBustingSearchParam: digest };
  context.setCacheBustingSearchParam = digest;
  context._fetch = { fetch: nativeFetch };
  context.fetch = nativeFetch;
  vm.createContext(context);
  vm.runInContext([
    'let isPageUnloading = false;',
    "const velliraNext2130MpaEpochKey = Symbol.for('vellira.next2130.mpaEpoch.v1');",
    functionBody(src, 'assertVelliraNext2130PrefetchMayDispatch'),
    functionBody(src, 'createFetch'),
    'globalThis.__guard = { createFetch, unload: value => { isPageUnloading = value; } };',
  ].join('\n'), context);
  return {
    context, queued, sent,
    start: (headers = { rsc: '1', 'next-router-prefetch': '1' }) =>
      context.__guard.createFetch(new URL('http://example.test/target/prefetched'), headers, 'low', false),
    mark: () => { context[key] = {}; },
    unload: value => context.__guard.unload(value),
    release: index => { assert.ok(queued[index], 'Missing pending SHA-256 digest'); queued[index](); },
    wait: async n => {
      for (let i = 0; i < 12 && queued.length < n; i++) await new Promise(resolve => setImmediate(resolve));
      assert.ok(queued.length >= n, 'Expected deferred _rsc calculations');
    },
  };
}

for (const prefix of versions) {
  test(prefix + ': MPA is marked before hard navigation and no-store is preserved', () => {
    const app = source(prefix + '/components/app-router.js');
    const transport = source(prefix + '/components/router-reducer/fetch-server-response.js');
    const marker = "globalThis[Symbol.for('vellira.next2130.mpaEpoch.v1')] = {};";
    assert.equal(app.split(marker).length - 1, 1);
    assert.ok(app.indexOf(marker) < app.indexOf('location.assign(canonicalUrl);'));
    assert.ok(app.indexOf(marker) < app.indexOf('location.replace(canonicalUrl);'));
    assert.equal(transport.split("cache: 'no-store'").length - 1, 1);
    assert.equal(transport.split('assertVelliraNext2130PrefetchMayDispatch(headers, velliraNext2130EpochAtStart);').length - 1, 2);
    assert.equal(transport.includes('console.debug'), false);
  });

  test(prefix + ': pending old prefetch is canceled before native fetch', async () => {
    const t = runtime(prefix);
    const old = t.start();
    await t.wait(1);
    t.mark();
    t.release(0);
    await assert.rejects(old, { name: 'AbortError' });
    assert.equal(t.sent.length, 0);
  });

  test(prefix + ': canceled MPA does not indefinitely block later prefetches', async () => {
    const t = runtime(prefix);
    const before = t.start();
    await t.wait(1);
    t.mark();
    const after = t.start();
    await t.wait(2);
    t.release(0);
    t.release(1);
    await assert.rejects(before, { name: 'AbortError' });
    assert.equal((await after).status, 200);
    assert.equal(t.sent.length, 1);
  });

  test(prefix + ': ordinary RSC request remains allowed across MPA', async () => {
    const t = runtime(prefix);
    const req = t.start({ rsc: '1' });
    await t.wait(1);
    t.mark();
    t.release(0);
    assert.equal((await req).status, 200);
    assert.equal(t.sent.length, 1);
    assert.equal(t.sent[0].cache, 'no-store');
  });

  test(prefix + ': pagehide blocks prefetch and pageshow restores it', async () => {
    const t = runtime(prefix);
    const old = t.start();
    await t.wait(1);
    t.unload(true);
    t.release(0);
    await assert.rejects(old, { name: 'AbortError' });
    t.unload(false);
    const newer = t.start();
    await t.wait(2);
    t.release(1);
    assert.equal((await newer).status, 200);
    assert.equal(t.sent.length, 1);
  });

  test(prefix + ': redirect retry must recheck MPA epoch', async () => {
    const t = runtime(prefix, { redirect: true });
    const old = t.start();
    await t.wait(1);
    t.release(0);
    await t.wait(2);
    assert.equal(t.sent.length, 1);
    t.mark();
    t.release(1);
    await assert.rejects(old, { name: 'AbortError' });
    assert.equal(t.sent.length, 1);
  });
}
