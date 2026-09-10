import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { deploymentIdentity } from '../cloudflare/build-identity.mjs';
import {
  HTML_CACHE_CONTROL,
  RSC_CACHE_CONTROL,
  IMMUTABLE_CACHE_CONTROL,
} from '../cloudflare/cache-policy.mjs';
import { sha256 } from './cloudflare-static-asset-archive.mjs';
import { rscProbe } from './cloudflare-rsc-probe.mjs';

const base = process.env.WEBSITE_URL;
assert.ok(base, 'WEBSITE_URL is required');
const buildId = deploymentIdentity({ ...process.env, VELLIRA_DEPLOYABLE: '1' });
const root = path.resolve(import.meta.dirname, '..');
const evidence = [];
let passed = false;
async function request(pathname, options = {}) {
  const response = await fetch(new URL(pathname, base), {
    cache: 'no-store',
    ...options,
  });
  const bytes = Buffer.from(await response.arrayBuffer());
  evidence.push({
    pathname,
    status: response.status,
    headers: Object.fromEntries(response.headers),
    sha256: sha256(bytes),
  });
  return { response, bytes };
}
try {
  const ids = new Set();
  for (let attempt = 0; attempt < 2; attempt++) {
    const { response, bytes } = await request('/__vellira_runtime');
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), RSC_CACHE_CONTROL);
    const runtime = JSON.parse(bytes.toString());
    assert.equal(runtime.buildId, buildId);
    assert.ok(runtime.workerVersion, 'Missing Cloudflare version metadata');
    assert.equal(
      response.headers.get('x-vellira-request-id'),
      runtime.requestId
    );
    ids.add(runtime.requestId);
  }
  assert.equal(
    ids.size,
    2,
    'Runtime diagnostics were cached instead of executing twice'
  );
  const document = await request('/components/switch', {
    headers: { Accept: 'text/html' },
  });
  assert.equal(document.response.status, 200);
  assert.equal(document.response.headers.get('x-vellira-build-id'), buildId);
  assert.equal(
    document.response.headers.get('cache-control'),
    HTML_CACHE_CONTROL
  );
  assert.equal(
    document.response.headers.get('cloudflare-cdn-cache-control'),
    'no-store'
  );
  for (const header of ['clear-site-data', 'set-cookie', 'location'])
    assert.equal(document.response.headers.get(header), null);
  const probe = await rscProbe('/components/switch', base);
  const rsc = await request(probe.url.toString(), { headers: probe.headers });
  assert.equal(rsc.response.status, 200);
  assert.match(
    rsc.response.headers.get('content-type') ?? '',
    /^text\/x-component/
  );
  assert.equal(rsc.response.headers.get('cache-control'), RSC_CACHE_CONTROL);
  assert.equal(
    rsc.response.headers.get('cloudflare-cdn-cache-control'),
    'no-store'
  );
  assert.ok(
    rsc.bytes.includes(Buffer.from(buildId)),
    'Flight payload identity does not match active deployment'
  );
  const archive = JSON.parse(
    await fs.readFile(
      path.join(root, '.open-next/archive-evidence.json'),
      'utf8'
    )
  );
  assert.equal(archive.buildId, buildId);
  // Verify the complete current graph, not only the deployment anchor. The
  // migration test independently checks old-generation archive fallbacks.
  for (const asset of archive.assets) {
    const result = await request(
      asset.pathname.split('/').map(encodeURIComponent).join('/')
    );
    assert.equal(result.response.status, 200, asset.pathname);
    assert.equal(sha256(result.bytes), asset.sha256, asset.pathname);
    assert.equal(
      result.response.headers.get('content-type'),
      asset.contentType,
      asset.pathname
    );
    assert.equal(
      result.response.headers.get('cache-control'),
      IMMUTABLE_CACHE_CONTROL,
      asset.pathname
    );
  }
  passed = true;
  console.log(
    `Runtime deployment contract passed: ${buildId}; ${archive.assets.length} exact assets`
  );
} finally {
  await fs.writeFile(
    path.join(root, '.open-next/runtime-contract.json'),
    JSON.stringify({ buildId, passed, evidence }, null, 2)
  );
}
