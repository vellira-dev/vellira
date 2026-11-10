import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import test from 'node:test';

import braces from 'braces';

const require = createRequire(import.meta.url);
const { sprintf } = require('sprintf-js');

function nestedAst(depth) {
  let node = { type: 'text', value: 'a' };
  for (let index = 0; index < depth; index += 1) {
    node = { type: 'brace', nodes: [node] };
  }
  return { type: 'root', nodes: [node] };
}

test('braces security backport rejects parser nesting above the upstream bound', () => {
  assert.throws(
    () => braces.parse('{'.repeat(101) + 'a,b' + '}'.repeat(101)),
    /exceeds max depth/
  );
  assert.throws(
    () => braces.parse('('.repeat(101) + ')'.repeat(101)),
    /exceeds max depth/
  );
  assert.doesNotThrow(() => braces.parse('{{a,b},c}', { maxDepth: 2 }));
  assert.throws(
    () => braces.parse('{{a,b},c}', { maxDepth: 1 }),
    /exceeds max depth/
  );
});

test('braces security backport bounds caller-supplied recursive ASTs', () => {
  assert.throws(() => braces.compile(nestedAst(101)), /exceeds max depth/);
  assert.throws(() => braces.stringify(nestedAst(101)), /exceeds max depth/);
  assert.throws(() => braces.expand(nestedAst(101)), /exceeds max depth/);
});

test('sprintf-js security backport rejects precision above the native bound', () => {
  for (const format of ['%.101f', '%.101e', '%.101g', '%.200f']) {
    assert.throws(
      () => sprintf(format, 1),
      (error) =>
        error instanceof RangeError &&
        /precision must be between 0 and 100/.test(error.message)
    );
  }
});

test('sprintf-js security backport preserves supported precision boundaries', () => {
  assert.doesNotThrow(() => sprintf('%.0f', 1));
  assert.doesNotThrow(() => sprintf('%.100f', 1));
  assert.doesNotThrow(() => sprintf('%.0e', 1));
  assert.doesNotThrow(() => sprintf('%.100e', 1));
  assert.doesNotThrow(() => sprintf('%.0g', 1));
  assert.doesNotThrow(() => sprintf('%.100g', 1));
});

test('deepmerge security backport rejects unsafe keys across entrypoints', () => {
  const packageRoot = resolve(dirname(require.resolve('deepmerge')), '..');

  for (const entry of ['dist/cjs.js', 'dist/umd.js']) {
    const merge = require(resolve(packageRoot, entry));

    for (const key of ['__proto__', 'constructor', 'prototype']) {
      const source = JSON.parse(`{"${key}":{"isAdmin":true}}`);
      const result = merge(Object.create(null), source);

      assert.equal(Object.getPrototypeOf(result), Object.prototype, entry);
      assert.equal(Object.hasOwn(result, key), false, entry);
      assert.equal(result.isAdmin, undefined, entry);

      const target = Object.create(null);
      Object.defineProperty(target, key, {
        value: { isAdmin: true },
        enumerable: true,
        configurable: true,
      });

      const cloned = merge(target, { safe: true });

      assert.equal(Object.getPrototypeOf(cloned), Object.prototype, entry);
      assert.equal(Object.hasOwn(cloned, key), false, entry);
      assert.equal(cloned.safe, true, entry);
    }
  }

  assert.equal(Object.prototype.isAdmin, undefined);
});

test('deepmerge source entry retains both unsafe-key guards', () => {
  const packageRoot = resolve(dirname(require.resolve('deepmerge')), '..');
  const source = readFileSync(resolve(packageRoot, 'index.js'), 'utf8');

  assert.match(source, /function isUnsafeMergeKey\(key\)/);
  assert.match(source, /if \(isUnsafeMergeKey\(key\)\) return true;/);
  assert.match(source, /if \(isUnsafeMergeKey\(key\)\) return;/);
});

test('deepmerge security backport preserves nested Storybook theme merging', () => {
  const merge = require('deepmerge');

  assert.deepEqual(
    merge(
      { colors: { primary: 'red', secondary: 'blue' } },
      { colors: { primary: 'green' }, spacing: 8 }
    ),
    {
      colors: { primary: 'green', secondary: 'blue' },
      spacing: 8,
    }
  );
});
