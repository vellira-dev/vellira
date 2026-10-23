import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { unstable_dev } from 'wrangler';
import { prepareDeployment } from './cloudflare-prepare-deployment.mjs';
import { readDeploymentConfig } from './cloudflare-target-config.mjs';
import { rscProbe } from './cloudflare-rsc-probe.mjs';
import { prepareRouteCache } from './cloudflare-route-cache.mjs';
import { verifySiteNavigationSurfaces } from './cloudflare-site-navigation-browser.mjs';
import {
  HTML_CACHE_CONTROL,
  RSC_CACHE_CONTROL,
} from '../cloudflare/cache-policy.mjs';

const root = path.resolve(import.meta.dirname, '..');
const config = readDeploymentConfig(path.join(root, 'wrangler.jsonc'));
const identity = prepareDeployment(root);
const routeCache = prepareRouteCache(root);
const { getRouteCacheKey } = createRequire(import.meta.url)(
  'next/dist/server/lib/route-cache-key.js'
);
const cachePrefix = `/cdn-cgi/_next_cache/${identity.buildId}`;
const home = routeCache.entries.find(({ pathname }) => pathname === '/');
assert.ok(home, 'Missing root route cache evidence');
const cacheProbes = [
  ...routeCache.entries.map((entry) => ({
    path: `${cachePrefix}${entry.key}.cache`,
    sha256: entry.sha256,
  })),
  {
    path: `${cachePrefix}${getRouteCacheKey('/', { ...home.owner, sourceRoute: '/(foreign)/page' })}.cache`,
  },
  { path: `/cdn-cgi/_next_cache/other-build${home.key}.cache` },
  { path: `${cachePrefix}/index.cache` },
];
const temporary = await fs.mkdtemp(
  path.join(os.tmpdir(), 'vellira-opennext-runtime-')
);
const entry = path.join(temporary, 'worker.mjs');
// Local-only test entry: does not mint a deployment seal or touch remote R2.
await fs.writeFile(
  entry,
  `import handler from ${JSON.stringify(path.join(root, '.open-next/worker.js'))};
import { createWebsiteWorker } from ${JSON.stringify(path.join(root, 'cloudflare/cache-policy.mjs'))};
const website = createWebsiteWorker(handler, ${JSON.stringify(identity.buildId)});
// This probe exists only in the temporary local test entry. It exercises the
// real ASSETS binding without exposing private cache data in the shipped Worker.
const probes = ${JSON.stringify(Object.fromEntries(cacheProbes.map((probe, index) => [`/__vellira_local_cache_probe/${index}`, probe.path])))};
export default { fetch(request, env, ctx) {
  const url = new URL(request.url);
  const asset = probes[url.pathname];
  // Miniflare's public asset router canonicalizes reserved /cdn-cgi paths
  // before the Worker. Exercise the website handler's private-path response
  // explicitly, while ASSETS probes above test the separate binding.
  if (url.pathname === '/__vellira_local_private_cache_probe') {
    url.pathname = ${JSON.stringify(`${cachePrefix}${home.key}.cache`)};
    request = new Request(url, request);
  }
  return asset ? env.ASSETS.fetch('http://assets.local' + asset) : website.fetch(request, env, ctx);
} };`
);
const configPath = path.join(temporary, 'wrangler.json');
await fs.writeFile(
  configPath,
  JSON.stringify({
    name: 'vellira-local-runtime-test',
    main: entry,
    compatibility_date: config.compatibility_date,
    compatibility_flags: config.compatibility_flags,
    assets: {
      ...config.assets,
      directory: path.join(root, '.open-next/assets'),
    },
    images: config.images,
    version_metadata: config.version_metadata,
    r2_buckets: [
      {
        binding: 'STATIC_ASSET_ARCHIVE',
        bucket_name: 'local-archive',
        remote: false,
      },
    ],
  })
);
let worker;
const evidence = {
  ...identity,
  liveCloudflare: false,
  cache: [],
  routes: [],
  passed: false,
};
try {
  worker = await unstable_dev(entry, {
    config: configPath,
    local: true,
    ip: '127.0.0.1',
    port: 0,
    persist: false,
    experimental: {
      disableExperimentalWarning: true,
      disableDevRegistry: true,
      watch: false,
    },
  });
  for (const [index, probe] of cacheProbes.entries()) {
    const response = await worker.fetch(
      `/__vellira_local_cache_probe/${index}`
    );
    const bytes = Buffer.from(await response.arrayBuffer());
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    evidence.cache.push({
      ...probe,
      status: response.status,
      actualSha256: sha256,
    });
    assert.equal(response.status, probe.sha256 ? 200 : 404, probe.path);
    if (probe.sha256)
      assert.equal(
        sha256,
        probe.sha256,
        `Published cache changed: ${probe.path}`
      );
  }
  const privateCache = await worker.fetch(
    '/__vellira_local_private_cache_probe',
    { redirect: 'manual' }
  );
  evidence.privateCacheHandler = {
    status: privateCache.status,
    location: privateCache.headers.get('location'),
  };
  assert.equal(
    privateCache.status,
    404,
    'Website handler must not expose private cache data'
  );
  await privateCache.arrayBuffer();
  for (const route of [
    '/',
    '/blog',
    '/blog/typescript-project-ownership',
    '/components/button',
  ]) {
    const response = await worker.fetch(route, {
      headers: { Accept: 'text/html' },
    });
    const body = await response.text();
    evidence.routes.push({
      route,
      status: response.status,
      headers: Object.fromEntries(response.headers),
      bytes: Buffer.byteLength(body),
    });
    assert.equal(response.status, 200, route);
    assert.equal(
      response.headers.get('x-nextjs-cache'),
      'HIT',
      `Prerender cache miss: ${route}`
    );
    assert.match(body, /<html/);
    assert.match(body, /<h1/);
    assert.equal(response.headers.get('cache-control'), HTML_CACHE_CONTROL);
    assert.equal(
      response.headers.get('cloudflare-cdn-cache-control'),
      'no-store'
    );
    assert.equal(response.headers.get('x-vellira-build-id'), identity.buildId);
    assert.equal(response.headers.get('clear-site-data'), null);
    assert.equal(response.headers.get('set-cookie'), null);
    const probe = await rscProbe(
      route,
      `http://${worker.address}:${worker.port}`
    );
    const flight = await worker.fetch(probe.url.toString(), {
      headers: probe.headers,
    });
    evidence.routes.push({
      route,
      rsc: true,
      status: flight.status,
      headers: Object.fromEntries(flight.headers),
    });
    assert.equal(flight.status, 200, `Flight ${route}`);
    assert.equal(
      flight.headers.get('x-nextjs-cache'),
      'HIT',
      `Flight cache miss: ${route}`
    );
    assert.match(flight.headers.get('content-type'), /^text\/x-component/);
    assert.equal(flight.headers.get('cache-control'), RSC_CACHE_CONTROL);
    assert.equal(
      flight.headers.get('cloudflare-cdn-cache-control'),
      'no-store'
    );
    assert.equal(flight.headers.get('x-vellira-build-id'), identity.buildId);
    assert.equal(flight.headers.get('set-cookie'), null);
    await flight.arrayBuffer();
  }
  evidence.siteNavigation = await verifySiteNavigationSurfaces(
    `http://${worker.address}:${worker.port}`
  );
  evidence.passed = true;
  console.log(
    'Actual OpenNext Workers runtime: HTML/Flight routes and identity verified'
  );
} finally {
  await worker?.stop();
  await fs.writeFile(
    path.join(root, '.open-next/local-runtime-contract.json'),
    JSON.stringify(evidence, null, 2)
  );
  await fs.rm(temporary, { recursive: true, force: true });
}
