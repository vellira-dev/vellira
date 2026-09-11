import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { deploymentIdentity } from '../cloudflare/build-identity.mjs';
import {
  verifyNextPatch,
  verifyShippedTransport,
} from './next-rsc-patch-check.mjs';
import { auditWebsite } from './cloudflare-build-runtime-audit.mjs';

export function assertOpenNextBuildIdentity(source, expected) {
  const ast = ts.createSourceFile(
    'open-next.mjs',
    source,
    ts.ScriptTarget.Latest,
    true
  );
  const identities = [];
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText() === 'BuildId')
      identities.push(node.initializer?.text);
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.deepEqual(
    identities,
    [expected],
    'OpenNext compiled runtime identity missing or mismatched'
  );
}

export function prepareDeployment(root, env = process.env) {
  // A failed new preparation must not leave an earlier activation seal usable.
  fs.rmSync(path.join(root, '.open-next/vellira-build.json'), { force: true });
  const buildId = deploymentIdentity({ ...env, VELLIRA_DEPLOYABLE: '1' });
  verifyNextPatch();
  const browserChunks = verifyShippedTransport(root);
  for (const filename of ['.next/BUILD_ID', '.open-next/assets/BUILD_ID']) {
    assert.equal(
      fs.readFileSync(path.join(root, filename), 'utf8').trim(),
      buildId,
      `${filename}: deployment identity mismatch`
    );
  }
  const config = JSON.parse(
    fs.readFileSync(path.join(root, '.next/required-server-files.json'), 'utf8')
  ).config;
  for (const filename of [
    '.open-next/middleware/handler.mjs',
    '.open-next/server-functions/default/apps/website/index.mjs',
  ]) {
    assertOpenNextBuildIdentity(
      fs.readFileSync(path.join(root, filename), 'utf8'),
      buildId
    );
  }
  assert.ok(
    !config.deploymentId,
    'deploymentId changes BUILD_ID semantics and requires architecture review'
  );
  const namespace = path.join(root, '.open-next/cache', buildId);
  assert.ok(
    fs.existsSync(namespace),
    'Missing deployment-scoped OpenNext cache namespace'
  );
  assert.equal(
    fs.readFileSync(path.join(root, '.open-next/assets/_headers'), 'utf8'),
    fs.readFileSync(path.join(root, 'public/_headers'), 'utf8'),
    'Workers Assets immutable header policy was not copied'
  );
  assert.ok(
    fs.existsSync(
      path.join(root, '.open-next/assets/cdn-cgi/_next_cache', buildId)
    ),
    'OpenNext route cache was not populated in the deployment namespace before activation'
  );
  const report = auditWebsite(root);
  const directHtml = fs
    .readdirSync(path.join(root, '.open-next/assets'), { recursive: true })
    .filter((name) => /\.html?$/i.test(name));
  assert.deepEqual(
    directHtml,
    [],
    'Direct Workers Assets HTML would bypass the document freshness policy'
  );
  assert.deepEqual(
    report.failures,
    [],
    'Runtime asset closure failed before activation'
  );
  const identity = { buildId, nextVersion: verifyNextPatch(), browserChunks };
  fs.writeFileSync(
    path.join(root, '.open-next/assets/__vellira_deploy.txt'),
    `${buildId}\n`
  );
  fs.writeFileSync(
    path.join(root, '.open-next/asset-audit-preactivation.json'),
    JSON.stringify(report, null, 2)
  );
  return identity;
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  console.log(
    prepareDeployment(path.resolve(process.argv[2] ?? 'apps/website'))
  );
}
