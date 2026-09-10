import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import http from 'node:http';
import { respondMigrationError } from './cloudflare-migration-origin.mjs';
import {
  readDeploymentConfig,
  validateDeploymentTarget,
} from './cloudflare-target-config.mjs';
import { build } from 'esbuild';
import { assertOpenNextBuildIdentity } from './cloudflare-prepare-deployment.mjs';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import {
  applyCachePolicy,
  archivedAsset,
  createWebsiteWorker,
  staticAssetKey,
  HTML_CACHE_CONTROL,
  RSC_CACHE_CONTROL,
  IMMUTABLE_CACHE_CONTROL,
} from '../cloudflare/cache-policy.mjs';
import { deploymentIdentity } from '../cloudflare/build-identity.mjs';
import {
  ASSET_CONTENT_TYPES,
  archiveAssets,
  assetInventory,
  sha256,
  recordArchivedDeployment,
  requireArchivedDeployment,
} from './cloudflare-static-asset-archive.mjs';
import { transportOptions, verifyNextPatch } from './next-rsc-patch-check.mjs';

test('migration origin errors stay in server logs, not the non-cacheable HTTP response', async (t) => {
  const error = new Error('private upstream detail: migration-secret-9381');
  const log = t.mock.method(console, 'error', () => {});
  const server = http.createServer((_incoming, outgoing) => {
    try {
      throw error;
    } catch (caught) {
      respondMigrationError(outgoing, caught);
    }
  });
  t.after(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

  const response = await fetch(`http://127.0.0.1:${server.address().port}`);
  const body = await response.text();
  assert.equal(response.status, 500);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('content-type'), 'text/plain; charset=utf-8');
  assert.equal(body, 'Internal Server Error');
  assert.ok(!body.includes(error.message));
  assert.ok(!body.includes(error.stack));
  assert.equal(log.mock.callCount(), 1);
  assert.equal(log.mock.calls[0].arguments[1], error);
});

test('installed Wrangler parses both actual deployment configs and rejects unsafe targets', () => {
  for (const filename of ['wrangler.jsonc', 'wrangler.production.jsonc']) {
    const config = readDeploymentConfig(
      path.resolve(import.meta.dirname, '..', filename)
    );
    for (const changed of [
      { ...config, name: 'another-worker' },
      { ...config, routes: ['vellira.dev/*'] },
      { ...config, r2_buckets: [] },
      {
        ...config,
        r2_buckets: [
          { binding: 'STATIC_ASSET_ARCHIVE', bucket_name: 'wrong-target' },
        ],
      },
      {
        ...config,
        assets: { ...config.assets, run_worker_first: ['!/_next/static/*'] },
      },
    ])
      assert.throws(() => validateDeploymentTarget(changed));
  }
});

test('installed CJS/ESM transport and negative cache option contract', () => {
  assert.equal(verifyNextPatch(), '16.3.3');
  const declaration =
    "const options = {credentials:'same-origin',headers,priority,signal};";
  assert.deepEqual(transportOptions(declaration), [
    { name: 'options', cache: undefined },
  ]);
  assert.deepEqual(
    transportOptions(
      declaration.replace('credentials:', "cache:'no-store',credentials:")
    ),
    [{ name: 'options', cache: 'no-store' }]
  );
});

test('installed createFetch preserves options, cancellation and redirect replay', async () => {
  const require = createRequire(import.meta.url);
  const filename =
    require.resolve('next/dist/client/components/router-reducer/fetch-server-response');
  const source = await fs.readFile(filename, 'utf8');
  const calls = [];
  const exported = {};
  vm.runInNewContext(
    source,
    {
      exports: exported,
      URL,
      Response,
      process: {
        env: {
          NODE_ENV: 'production',
          __NEXT_CLIENT_VALIDATE_RSC_REQUEST_HEADERS: true,
        },
      },
      require(id) {
        if (id === '../segment-cache/fetch')
          return {
            fetch: async (url, options) => {
              calls.push({ url: url.href, options });
              if (options.signal?.aborted) throw options.signal.reason;
              const response = new Response('flight');
              Object.defineProperty(response, 'url', {
                value: calls.length === 1 ? 'https://test/target' : url.href,
              });
              Object.defineProperty(response, 'redirected', {
                value: calls.length === 1,
              });
              return response;
            },
          };
        if (id.endsWith('/deployment-id'))
          return { getDeploymentId: () => undefined };
        if (id === './set-cache-busting-search-param')
          return require('next/dist/client/components/router-reducer/set-cache-busting-search-param');
        if (id === '../app-router-headers')
          return require('next/dist/client/components/app-router-headers');
        return {};
      },
    },
    { filename }
  );
  const controller = new AbortController();
  const headers = { RSC: '1', 'Next-Router-Prefetch': '1' };
  const result = await exported.createFetch(
    new URL('https://test/start'),
    headers,
    'low',
    false,
    controller.signal
  );
  assert.equal(result.status, 200);
  assert.equal(result.redirected, true);
  assert.equal(
    calls.length,
    2,
    'Next must replay a redirect that lost its Flight cache key'
  );
  assert.equal(calls[0].options, calls[1].options);
  for (const { options } of calls) {
    assert.equal(options.cache, 'no-store');
    assert.equal(options.credentials, 'same-origin');
    assert.equal(options.headers, headers);
    assert.equal(options.priority, 'low');
    assert.equal(options.signal, controller.signal);
  }
  controller.abort(new Error('fixture-aborted'));
  await assert.rejects(
    exported.createFetch(
      new URL('https://test/start'),
      headers,
      'auto',
      false,
      controller.signal
    ),
    /fixture-aborted/
  );
});

test('deployable identity rejects missing, local, reused SHA-only and mismatched SHA', () => {
  for (const id of [undefined, 'local', 'a'.repeat(40), 'different-123-1']) {
    assert.throws(() =>
      deploymentIdentity({ VELLIRA_DEPLOYABLE: '1', VELLIRA_BUILD_ID: id })
    );
  }
  const id = `${'a'.repeat(40)}-123-1`;
  assert.equal(
    deploymentIdentity({ VELLIRA_DEPLOYABLE: '1', VELLIRA_BUILD_ID: id }),
    id
  );
  assert.throws(() =>
    deploymentIdentity({
      VELLIRA_DEPLOYABLE: '1',
      VELLIRA_BUILD_ID: id,
      GITHUB_SHA: 'b'.repeat(40),
    })
  );
  assert.notEqual(deploymentIdentity({}), deploymentIdentity({}));
  assertOpenNextBuildIdentity('var BuildId="A";', 'A');
  assert.throws(() => assertOpenNextBuildIdentity('var BuildId="A";', 'B'));
  assert.throws(() => assertOpenNextBuildIdentity('var BuildId="local";', 'B'));
  assert.throws(() => assertOpenNextBuildIdentity('var other="B";', 'B'));
});

test('RSC request/response classification covers statuses and preserves streaming', async () => {
  for (const marker of [
    { rsc: '1' },
    { 'next-router-prefetch': '1' },
    { 'next-router-segment-prefetch': '/_tree' },
  ]) {
    for (const status of [200, 204, 304, 307, 404, 500]) {
      for (const method of ['GET', 'HEAD']) {
        const result = applyCachePolicy(
          new Request('https://test/route', { headers: marker, method }),
          new Response(null, {
            status,
            headers: {
              'Cache-Control': 'public, max-age=3600',
              Location: '/elsewhere',
            },
          })
        );
        assert.equal(result.status, status);
        assert.equal(result.headers.get('cache-control'), RSC_CACHE_CONTROL);
        assert.equal(
          result.headers.get('cloudflare-cdn-cache-control'),
          'no-store'
        );
        assert.equal(result.headers.get('location'), '/elsewhere');
      }
    }
  }
  let controller;
  const body = new ReadableStream({
    start(c) {
      controller = c;
    },
  });
  const response = applyCachePolicy(
    new Request('https://test/action', { method: 'POST' }),
    new Response(body, { headers: { 'content-type': 'text/x-component' } })
  );
  assert.equal(response.body, body);
  controller.enqueue(new TextEncoder().encode('first'));
  const reader = response.body.getReader();
  assert.equal(new TextDecoder().decode((await reader.read()).value), 'first');
  controller.close();
});

test('HTML revalidates; APIs and hashed assets preserve their policy', () => {
  const html = applyCachePolicy(
    new Request('https://test/page'),
    new Response('html', {
      headers: {
        'Content-Type': 'text/html',
        'Cache-Control': 's-maxage=31536000',
        ETag: '"a"',
      },
    })
  );
  assert.equal(html.headers.get('cache-control'), HTML_CACHE_CONTROL);
  assert.equal(html.headers.get('cdn-cache-control'), 'no-store');
  assert.equal(html.headers.get('etag'), '"a"');
  for (const pathname of [
    '/api/data',
    '/_next/static/chunk-abcd.js',
    '/brand/logo.svg',
  ]) {
    const response = new Response('asset', {
      headers: { 'Cache-Control': 'public, max-age=600' },
    });
    assert.equal(
      applyCachePolicy(new Request(`https://test${pathname}`), response),
      response
    );
  }
});

test('immutable archive uses real R2 conditional writes, exact bytes and metadata', async () => {
  const temporary = await fs.mkdtemp(
    path.join(os.tmpdir(), 'vellira-archive-test-')
  );
  const mf = new Miniflare(
    convertV4MiniflareOptions({
      modules: true,
      script: 'export default {fetch(){return new Response("ok")}}',
      compatibilityDate: '2026-09-06',
      r2Buckets: ['ARCHIVE'],
    })
  );
  try {
    await fs.mkdir(path.join(temporary, 'chunks/[slug]'), { recursive: true });
    const filename = path.join(temporary, 'chunks/[slug]/a.js');
    await fs.writeFile(filename, 'export const version="A";');
    const inventory = await assetInventory(temporary);
    const bucket = await mf.getR2Bucket('ARCHIVE');
    const archived = await archiveAssets(bucket, inventory);
    await assert.rejects(
      requireArchivedDeployment(bucket, 'missing-predecessor'),
      /has not been archived/
    );
    await recordArchivedDeployment(bucket, 'build-A', archived);
    await recordArchivedDeployment(bucket, 'build-A', archived);
    await requireArchivedDeployment(bucket, 'build-A');
    await assert.rejects(
      recordArchivedDeployment(bucket, 'build-A', [...archived, ...archived]),
      /identity reused/
    );
    await archiveAssets(bucket, inventory);
    const request = new Request(
      'https://test/_next/static/chunks/%5Bslug%5D/a.js'
    );
    const response = await archivedAsset(request, bucket);
    assert.equal(
      sha256(Buffer.from(await response.arrayBuffer())),
      inventory[0].sha256
    );
    assert.equal(
      response.headers.get('content-type'),
      'text/javascript; charset=utf-8'
    );
    assert.equal(
      response.headers.get('cache-control'),
      IMMUTABLE_CACHE_CONTROL
    );
    const head = await archivedAsset(
      new Request(request, { method: 'HEAD' }),
      bucket
    );
    assert.equal(head.body, null);
    assert.equal(head.headers.get('content-length'), String(inventory[0].size));
    const conditional = await archivedAsset(
      new Request(request, {
        headers: { 'If-None-Match': response.headers.get('etag') },
      }),
      bucket
    );
    assert.equal(conditional.status, 304);
    await fs.writeFile(filename, 'export const version="COLLISION";');
    await assert.rejects(
      archiveAssets(bucket, await assetInventory(temporary)),
      /COLLISION/
    );
    assert.equal(
      await (await bucket.get(inventory[0].key)).text(),
      'export const version="A";'
    );
    assert.equal(
      await archivedAsset(
        new Request('https://test/_next/static/missing.js'),
        bucket
      ),
      null
    );
    for (const pathname of [
      '/_next/static/../secret',
      '/_next/static/%2e%2e/secret',
      '/_next/static/%00a.js',
      '/_next/static/%zz',
      '/api/data',
    ]) {
      assert.equal(staticAssetKey(pathname), null);
    }
  } finally {
    await mf.dispose();
    await fs.rm(temporary, { recursive: true, force: true });
  }
});

test('new Worker serves cookieless document directly and identifies each execution', async () => {
  const worker = createWebsiteWorker(
    {
      fetch: async () =>
        new Response('html', { headers: { 'Content-Type': 'text/html' } }),
    },
    'build-A'
  );
  const request = new Request('https://test/page', {
    headers: { 'sec-fetch-dest': 'document' },
  });
  const first = await worker.fetch(request, {}, {});
  const second = await worker.fetch(request, {}, {});
  assert.equal(first.status, 200);
  for (const name of ['set-cookie', 'clear-site-data', 'location'])
    assert.equal(first.headers.get(name), null);
  assert.equal(first.headers.get('x-vellira-build-id'), 'build-A');
  assert.notEqual(
    first.headers.get('x-vellira-request-id'),
    second.headers.get('x-vellira-request-id')
  );
});

test('actual Workers Assets routing serves current files directly and falls through to R2 on old paths', async () => {
  const temporary = await fs.mkdtemp(
    path.join(os.tmpdir(), 'vellira-assets-routing-')
  );
  const assets = path.join(temporary, 'assets');
  await fs.mkdir(path.join(assets, '_next/static/chunks'), { recursive: true });
  await fs.writeFile(
    path.join(assets, '_next/static/chunks/current.js'),
    'current bytes'
  );
  for (const extension of Object.keys(ASSET_CONTENT_TYPES)) {
    await fs.writeFile(
      path.join(assets, `_next/static/chunks/mime${extension}`),
      `MIME probe ${extension}`
    );
  }
  await fs.copyFile(
    new URL('../public/_headers', import.meta.url),
    path.join(assets, '_headers')
  );
  const bundle = await build({
    stdin: {
      contents:
        "import {createWebsiteWorker} from './cache-policy.mjs'; export default createWebsiteWorker({fetch:async()=>new Response('document',{headers:{'Content-Type':'text/html'}})}, 'runtime-test');",
      resolveDir: path.resolve(import.meta.dirname, '../cloudflare'),
      sourcefile: 'routing-fixture.mjs',
    },
    bundle: true,
    format: 'esm',
    write: false,
  });
  const mf = new Miniflare(
    convertV4MiniflareOptions({
      modules: true,
      script: bundle.outputFiles[0].text,
      compatibilityDate: '2026-09-06',
      r2Buckets: ['STATIC_ASSET_ARCHIVE'],
      assets: {
        directory: assets,
        binding: 'ASSETS',
        run_worker_first: ['/api/*', '/__vellira_runtime'],
        routerConfig: { has_user_worker: true },
        assetConfig: {
          html_handling: 'none',
          not_found_handling: 'none',
        },
      },
    })
  );
  try {
    const bucket = await mf.getR2Bucket('STATIC_ASSET_ARCHIVE');
    for (const [extension, contentType] of Object.entries(
      ASSET_CONTENT_TYPES
    )) {
      const response = await mf.dispatchFetch(
        `http://localhost/_next/static/chunks/mime${extension}`
      );
      assert.equal(response.status, 200);
      assert.equal(
        response.headers.get('content-type'),
        contentType,
        extension
      );
      assert.equal(
        response.headers.get('cache-control'),
        IMMUTABLE_CACHE_CONTROL
      );
      await response.body.cancel();
    }
    const old = Buffer.from('old bytes');
    await bucket.put('assets/_next/static/chunks/old.js', old, {
      httpMetadata: {
        contentType: 'text/javascript; charset=utf-8',
        cacheControl: IMMUTABLE_CACHE_CONTROL,
      },
      customMetadata: { sha256: sha256(old) },
    });
    const current = await mf.dispatchFetch(
      'https://test/_next/static/chunks/current.js'
    );
    assert.equal(await current.text(), 'current bytes');
    assert.equal(
      current.headers.get('x-vellira-build-id'),
      null,
      'Current assets should not invoke the user Worker'
    );
    assert.equal(current.headers.get('cache-control'), IMMUTABLE_CACHE_CONTROL);
    const retained = await mf.dispatchFetch(
      'https://test/_next/static/chunks/old.js'
    );
    assert.equal(
      retained.status,
      200,
      `Old asset miss did not reach Worker: ${JSON.stringify(Object.fromEntries(retained.headers))}`
    );
    assert.equal(await retained.text(), 'old bytes');
    assert.equal(retained.headers.get('x-vellira-asset-source'), 'archive');
    assert.equal(
      retained.headers.get('content-type'),
      current.headers.get('content-type'),
      'Archive MIME must match real Workers Assets'
    );
    assert.equal(
      retained.headers.get('cache-control'),
      current.headers.get('cache-control')
    );
    const absent = await mf.dispatchFetch(
      'https://test/_next/static/chunks/absent.js'
    );
    assert.equal(absent.status, 404);
    assert.equal(absent.headers.get('cache-control'), 'no-store');
    const html = await mf.dispatchFetch('https://test/');
    assert.equal(html.status, 200);
    assert.equal(html.headers.get('cache-control'), HTML_CACHE_CONTROL);
  } finally {
    await mf.dispose();
    await fs.rm(temporary, { recursive: true, force: true });
  }
});
