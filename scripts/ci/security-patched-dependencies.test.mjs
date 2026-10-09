import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const { sprintf } = require('sprintf-js');

import braces from 'braces';

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
