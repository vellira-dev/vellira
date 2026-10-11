import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import { prepareRouteCache } from './cloudflare-route-cache.mjs';
const require = createRequire(import.meta.url);
const { getRouteCacheKey } = require('next/dist/server/lib/route-cache-key.js');
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vellira-route-cache-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const write = (name, data) => {
    const file = path.join(root, name);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(
      file,
      typeof data === 'string' ? data : JSON.stringify(data)
    );
  };
  write('.next/BUILD_ID', 'build-1');
  write('.next/prerender-manifest.json', {
    routes: {
      '/': { dataRoute: '/index.rsc', srcRoute: '/' },
      '/blog/article': {
        dataRoute: '/blog/article.rsc',
        srcRoute: '/blog/[slug]',
      },
      '/robots.txt': { dataRoute: null, srcRoute: '/robots.txt' },
    },
  });
  write('.next/app-path-routes-manifest.json', {
    '/(site)/page': '/',
    '/(site)/blog/[slug]/page': '/blog/[slug]',
    '/robots.txt/route': '/robots.txt',
  });
  write('.open-next/cache/build-1/index.cache', {
    type: 'app',
    html: '<h1>Home</h1>',
    rsc: 'home-rsc',
  });
  write('.open-next/cache/build-1/blog/article.cache', {
    type: 'app',
    html: '<h1>Article</h1>',
    rsc: 'article-rsc',
  });
  write('.open-next/cache/build-1/robots.txt.cache', {
    type: 'route',
    body: 'robots',
  });
  return { root, write };
}
test('materializes the exact pinned Next owner keys, byte-identical and build-scoped', (t) => {
  const { root } = fixture(t);
  const result = prepareRouteCache(root);
  assert.equal(result.entries.length, 3);
  for (const e of result.entries) {
    assert.equal(e.key, getRouteCacheKey(e.pathname, e.owner));
    const original = e.pathname === '/' ? 'index' : e.pathname.slice(1);
    assert.deepEqual(
      fs.readFileSync(
        path.join(root, '.open-next/cache/build-1', e.key + '.cache')
      ),
      fs.readFileSync(
        path.join(root, '.open-next/cache/build-1', original + '.cache')
      )
    );
  }
  assert.deepEqual(
    prepareRouteCache(root),
    result,
    'preflight and deployment preparation are idempotent'
  );
  const wrongOwner = getRouteCacheKey('/blog/article', {
    kind: 'APP_PAGE',
    sourceRoute: '/(other)/blog/[slug]/page',
  });
  assert.equal(
    fs.existsSync(
      path.join(root, '.open-next/cache/build-1', wrongOwner + '.cache')
    ),
    false,
    'another route owner must not read this cache'
  );
  assert.equal(
    fs.existsSync(path.join(root, '.open-next/cache/build-2')),
    false
  );
});
test('ambiguous ownership cannot publish a pathname into arbitrary route namespaces', (t) => {
  const { root, write } = fixture(t);
  write('.next/app-path-routes-manifest.json', {
    '/(site)/page': '/',
    '/(other)/page': '/',
  });
  assert.throws(() => prepareRouteCache(root), /Ambiguous or missing/);
});
test('missing or wrong-kind cache fails before cache publication/deployment', (t) => {
  const { root, write } = fixture(t);
  write('.open-next/cache/build-1/index.cache', { type: 'route' });
  assert.throws(() => prepareRouteCache(root), /Cache kind mismatch/);
  fs.unlinkSync(path.join(root, '.open-next/cache/build-1/index.cache'));
  assert.throws(() => prepareRouteCache(root), /ENOENT/);
});
test('conflicting generated owner entry is rejected rather than overwritten', (t) => {
  const { root, write } = fixture(t);
  const e = prepareRouteCache(root).entries[0];
  write(path.join('.open-next/cache/build-1', e.key + '.cache'), {
    type: 'app',
    html: 'foreign',
  });
  assert.throws(() => prepareRouteCache(root), /Conflicting owner cache/);
});
