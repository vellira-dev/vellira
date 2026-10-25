#!/usr/bin/env node
'use strict';

// Prototype only: not wired into Expo CLI. Do not claim advisory remediation.
// Bounds JSON bytes and output-array cardinality BEFORE Zod validation.
const MAX_JSON_BYTES = 64 * 1024;
const MAX_OUTPUT_ITEMS = 128;
function parseBoundedPluginOutput(text) {
  if (typeof text !== 'string' || Buffer.byteLength(text, 'utf8') > MAX_JSON_BYTES) {
    throw new RangeError('DevTools plugin output exceeds JSON byte budget');
  }
  const value = JSON.parse(text);
  if (!Array.isArray(value)) {
    throw new TypeError('DevTools plugin output must be an array');
  }
  if (value.length > MAX_OUTPUT_ITEMS) {
    throw new RangeError('DevTools plugin output exceeds item budget');
  }
  return value;
}
module.exports = { parseBoundedPluginOutput, MAX_JSON_BYTES, MAX_OUTPUT_ITEMS };
