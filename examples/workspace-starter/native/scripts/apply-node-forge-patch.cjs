#!/usr/bin/env node
'use strict';
// Fail-closed, source-pinned npm postinstall patch for the Native Starter only.
// This is an interim candidate until a supported node-forge fix ships.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const EXPECTED = Object.freeze({
  original: 'fd4740238145ec26470eb3f06a627c72039538ce1307dbdce40521f94dfd0a50',
  patched: 'f1c736cb0dcd2615e9e8225ab894cd4cab55a384f6f07df221da1436096f3761',
  patch: '85b8d466c47d1e1ae85a28a2be6b6db12ce72e412245bcc39f848b97a5c65065',
});
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

const root = path.resolve(__dirname, '..');
const target = path.join(root, 'node_modules', 'node-forge', 'lib', 'rsa.js');
const packagePath = path.join(root, 'node_modules', 'node-forge', 'package.json');
const patchFile = path.join(__dirname, 'node-forge-1.4.0-candidate.patch');
assert.equal(JSON.parse(fs.readFileSync(packagePath, 'utf8')).version, '1.4.0',
  'Unsupported node-forge version; review the security patch before proceeding');

const patchBytes = fs.readFileSync(patchFile);
assert.equal(sha256(patchBytes), EXPECTED.patch, 'Pinned RSA patch integrity mismatch');
const patch = patchBytes.toString('utf8').replace(/\r\n/g, '\n');
const hunks = [];
let current = null;
for (const line of patch.split('\n')) {
  if (line.startsWith('@@ ')) {
    current = { before: [], after: [] };
    hunks.push(current);
  } else if (current && line.length && [' ', '+', '-'].includes(line[0])) {
    if (line[0] !== '+') current.before.push(line.slice(1));
    if (line[0] !== '-') current.after.push(line.slice(1));
  } else if (current && line.startsWith('\\ No newline')) {
    throw new Error('Unsupported patch newline marker');
  }
}
assert.equal(hunks.length, 3, 'Unexpected upstream RSA patch shape');

const rawSource = fs.readFileSync(target);
const baselineHash = sha256(rawSource);
assert.ok([EXPECTED.original, EXPECTED.patched].includes(baselineHash),
  'Unrecognized or partially modified node-forge rsa.js; refusing patch');
const input = rawSource.toString('utf8');
assert.ok(input.endsWith('\n'), 'Expected newline-terminated rsa.js');
let content = input.slice(0, -1).split('\n');
let changed = false;
let cursor = 0;
function findBlock(lines, block, from) {
  for (let i = from; i + block.length <= lines.length; i++) {
    if (block.every((line, j) => lines[i + j] === line)) return i;
  }
  return -1;
}
for (const hunk of hunks) {
  const beforeAt = findBlock(content, hunk.before, cursor);
  if (beforeAt !== -1) {
    content.splice(beforeAt, hunk.before.length, ...hunk.after);
    cursor = beforeAt + hunk.after.length;
    changed = true;
  } else {
    const afterAt = findBlock(content, hunk.after, cursor);
    if (afterAt === -1) throw new Error('Pinned RSA patch does not match installed source');
    cursor = afterAt + hunk.after.length;
  }
}
const output = content.join('\n') + '\n';
assert.equal(sha256(Buffer.from(output)), EXPECTED.patched,
  'Patched RSA result does not match reviewed SHA-256');
assert.ok(output.includes('_encodeDigestInfo') && output.includes('var expected ='),
  'Canonical DER enforcement missing');
if (changed) {
  const tmp = target + '.vellira-' + process.pid + '.tmp';
  try {
    fs.writeFileSync(tmp, output, { mode: fs.statSync(target).mode });
    fs.renameSync(tmp, target);
  } finally {
    if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
  }
}
console.log(changed ? 'Pinned node-forge RSA patch applied' : 'Pinned node-forge RSA patch already applied');
