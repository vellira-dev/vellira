import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const website = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const require = createRequire(path.join(website, 'package.json'));
export const NEXT_PATCH_VERSION = '16.3.3';
const transport = 'client/components/router-reducer/fetch-server-response.js';

function property(object, name) {
  return object.properties.find(
    (p) =>
      ts.isPropertyAssignment(p) &&
      p.name.getText().replace(/['"]/g, '') === name
  );
}

export function transportOptions(source) {
  const ast = ts.createSourceFile(
    'transport.js',
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS
  );
  const found = [];
  function visit(node) {
    if (
      ts.isVariableDeclaration(node) &&
      node.initializer &&
      ts.isObjectLiteralExpression(node.initializer)
    ) {
      const object = node.initializer;
      const credentials = property(object, 'credentials');
      const names = object.properties.map((p) =>
        p.name?.getText().replace(/['"]/g, '')
      );
      if (
        credentials?.initializer.text === 'same-origin' &&
        ['headers', 'priority', 'signal'].every((p) => names.includes(p))
      ) {
        const cache = property(object, 'cache');
        found.push({
          name: node.name.getText(),
          cache: cache?.initializer.text,
        });
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  return found;
}

export function verifyNextPatch() {
  const packagePath = require.resolve('next/package.json');
  const manifest = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  const declared = JSON.parse(
    fs.readFileSync(path.join(website, 'package.json'), 'utf8')
  ).dependencies.next;
  assert.equal(
    manifest.version,
    NEXT_PATCH_VERSION,
    'Next upgrade requires an explicit RSC transport patch review'
  );
  assert.equal(
    declared,
    NEXT_PATCH_VERSION,
    'Website Next pin changed without updating transport contract'
  );
  for (const prefix of ['dist', 'dist/esm']) {
    const filename = path.join(path.dirname(packagePath), prefix, transport);
    const source = fs.readFileSync(filename, 'utf8');
    assert.deepEqual(
      transportOptions(source),
      [{ name: 'fetchOptions', cache: 'no-store' }],
      `${filename}: missing/changed RSC no-store options`
    );
    const ast = ts.createSourceFile(
      filename,
      source,
      ts.ScriptTarget.Latest,
      true
    );
    let uses = 0;
    function visit(node) {
      if (
        ts.isCallExpression(node) &&
        /\bfetch\b/.test(node.expression.getText()) &&
        node.arguments[0]?.getText() === 'fetchUrl'
      ) {
        assert.equal(
          node.arguments[1]?.getText(),
          'fetchOptions',
          'RSC retry bypasses shared options'
        );
        uses++;
      }
      ts.forEachChild(node, visit);
    }
    visit(ast);
    assert.equal(
      uses,
      2,
      'Review changed initial/redirect RSC fetch call paths'
    );
  }
  return manifest.version;
}

export function verifyShippedTransport(root = website) {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(root, '.next/build-manifest.json'), 'utf8')
  );
  assert.ok(
    manifest.rootMainFiles?.length,
    'Missing browser bootstrap manifest'
  );
  const matches = [];
  for (const filename of manifest.rootMainFiles.filter((p) =>
    p.endsWith('.js')
  )) {
    const options = transportOptions(
      fs.readFileSync(path.join(root, '.next', filename), 'utf8')
    );
    for (const candidate of options) {
      assert.equal(
        candidate.cache,
        'no-store',
        `Shipped RSC transport in ${filename} is cacheable`
      );
      matches.push(filename);
    }
  }
  assert.ok(
    matches.length > 0,
    'Patched RSC transport not found in shipped browser bootstrap; review bundler output'
  );
  return matches;
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  console.log(`Next RSC transport patch verified: ${verifyNextPatch()}`);
  if (process.argv.includes('--bundle'))
    console.log('Shipped transport:', verifyShippedTransport());
}
