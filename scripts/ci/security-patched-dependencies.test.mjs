import assert from 'node:assert/strict';
import test from 'node:test';

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
