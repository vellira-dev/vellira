#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { parseBoundedPluginOutput, MAX_JSON_BYTES, MAX_OUTPUT_ITEMS } =
  require('./security-expo-output-boundary-prototype.cjs');

test('accepts small legitimate structured output', () => {
  assert.deepEqual(parseBoundedPluginOutput('[{"type":"text","text":"ok","level":"info"}]'),
    [{type:'text',text:'ok',level:'info'}]);
});
test('rejects too many elements before Zod', () => {
  const input = JSON.stringify(Array(MAX_OUTPUT_ITEMS + 1).fill(null));
  assert.throws(() => parseBoundedPluginOutput(input), RangeError);
});
test('rejects excessive UTF-8 bytes before JSON.parse', () => {
  assert.throws(() => parseBoundedPluginOutput('x'.repeat(MAX_JSON_BYTES + 1)), RangeError);
  assert.throws(() => parseBoundedPluginOutput(JSON.stringify(['é'.repeat(MAX_JSON_BYTES / 2)])), RangeError);
});
test('rejects JSON objects and malformed JSON', () => {
  assert.throws(() => parseBoundedPluginOutput('{}'), TypeError);
  assert.throws(() => parseBoundedPluginOutput('['), SyntaxError);
});
test('allows exactly the item budget', () => {
  assert.equal(parseBoundedPluginOutput(JSON.stringify(Array(MAX_OUTPUT_ITEMS).fill(null))).length, MAX_OUTPUT_ITEMS);
});
