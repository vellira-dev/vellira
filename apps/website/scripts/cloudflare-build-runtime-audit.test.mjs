import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  auditWebsite,
  runtimeReferences,
} from './cloudflare-build-runtime-audit.mjs';

const runtime =
  'r.u=e=>"static/chunks/"+({7:"named"}[e]||e)+"."+({7:"abc",8:"def"})[e]+".js";r.miniCssF=e=>{};';
test('enumerates Webpack computed filenames including named chunks', () => {
  assert.deepEqual(
    runtimeReferences(runtime).map((r) => r.asset),
    ['static/chunks/named.abc.js', 'static/chunks/8.def.js']
  );
  assert.throws(
    () => runtimeReferences('r.unrecognized=()=>{}'),
    /Unsupported/
  );
});
test('audits decoded manifests, copied bytes, runtime-only hashes and deploy-time route cache', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vellira-assets-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const write = (file, body) => {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), body);
  };
  write('.next/BUILD_ID', 'fixture');
  const fixtures = {
    'chunks/webpack-abc.js': runtime,
    'chunks/named.abc.js': '/* named */',
    'chunks/8.def.js': '/* lazy */',
    'chunks/app/[slug]/page-abc.js': '/* route */',
    'css/abc.css': 'body{}',
  };
  for (const [name, body] of Object.entries(fixtures)) {
    write(`.next/static/${name}`, body);
    write(`.open-next/assets/_next/static/${name}`, body);
  }
  write(
    '.next/server/app/page_client-reference-manifest.js',
    '"static/chunks/app/%5Bslug%5D/page-abc.js"'
  );
  write('.open-next/cache/fixture/index.cache', '"/_next/static/css/abc.css"');
  write('.next/dev/old.js', '"static/css/obsolete.css"');
  assert.deepEqual(auditWebsite(root).failures, []);
  write('.open-next/assets/_next/static/css/abc.css', 'corrupted');
  assert.ok(
    auditWebsite(root).failures.some((f) =>
      f.includes('different copied asset')
    )
  );
  fs.unlinkSync(
    path.join(root, '.open-next/assets/_next/static/chunks/8.def.js')
  );
  assert.ok(auditWebsite(root).failures.some((f) => f.includes('u(8)')));
  write(
    '.open-next/assets/cdn-cgi/_next_cache/fixture/index.cache',
    '"/_next/static/chunks/stale.js"'
  );
  assert.ok(
    auditWebsite(root).failures.some(
      (f) => f.includes('stale.js') && f.includes('cdn-cgi')
    )
  );
});
