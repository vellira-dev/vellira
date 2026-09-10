import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { unstable_dev } from 'wrangler';
import { prepareDeployment } from './cloudflare-prepare-deployment.mjs';
import { readDeploymentConfig } from './cloudflare-target-config.mjs';
import { rscProbe } from './cloudflare-rsc-probe.mjs';
import {
  HTML_CACHE_CONTROL,
  RSC_CACHE_CONTROL,
} from '../cloudflare/cache-policy.mjs';

const root = path.resolve(import.meta.dirname, '..');
const config = readDeploymentConfig(path.join(root, 'wrangler.jsonc'));
const identity = prepareDeployment(root);
const temporary = await fs.mkdtemp(
  path.join(os.tmpdir(), 'vellira-opennext-runtime-')
);
const entry = path.join(temporary, 'worker.mjs');
// Local-only test entry: does not mint a deployment seal or touch remote R2.
await fs.writeFile(
  entry,
  `import handler from ${JSON.stringify(path.join(root, '.open-next/worker.js'))};
import { createWebsiteWorker } from ${JSON.stringify(path.join(root, 'cloudflare/cache-policy.mjs'))};
export default createWebsiteWorker(handler, ${JSON.stringify(identity.buildId)});`
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
    assert.match(flight.headers.get('content-type'), /^text\/x-component/);
    assert.equal(flight.headers.get('cache-control'), RSC_CACHE_CONTROL);
    await flight.arrayBuffer();
  }
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
