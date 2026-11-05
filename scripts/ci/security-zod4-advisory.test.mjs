import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const lockfile = readFileSync('pnpm-lock.yaml', 'utf8');
const workspace = readFileSync('pnpm-workspace.yaml', 'utf8');

// GHSA-mrhx-c7xc-m3w5: the first non-vulnerable Zod release is 4.6.6.
// The Expo CLI and Chromium BiDi Zod 3 paths need separate compatibility proof.
const safeZod = (major, minor, patch) =>
  major > 4 || (major === 4 && (minor > 6 || (minor === 6 && patch >= 6)));

test('React Hooks ESLint resolves patched Zod 4 without a global major override', () => {
  assert.match(workspace, /'eslint-plugin-react-hooks>zod': 4\.6\.7/);
  assert.doesNotMatch(workspace, /^\s*zod: 4\.6\.7$/m);
  assert.match(lockfile, /^  eslint-plugin-react-hooks>zod: 4\.6\.7$/m);

  const versions = [...lockfile.matchAll(/^  zod@(\d+)\.(\d+)\.(\d+):$/gm)]
    .map((match) => match.slice(1).map(Number));
  assert.ok(versions.some(([major, minor, patch]) => major === 4 && safeZod(major, minor, patch)));
  for (const [major, minor, patch] of versions) {
    if (major >= 4) {
      assert.ok(safeZod(major, minor, patch), `Unsafe Zod ${major}.${minor}.${patch}`);
    }
  }
  assert.match(lockfile, /eslint-plugin-react-hooks@7\.1\.1[\s\S]*?\n      zod: 4\.6\.7/);
});

test('unresolved Expo CLI Zod 3 remains visible and is not silently overridden', () => {
  assert.match(lockfile, /^  zod@3\.25\.76:/m);
  assert.match(lockfile, /'@expo\/cli@57\.0\.32[\s\S]*?\n      zod: 3\.25\.76/);
  assert.match(lockfile, /chromium-bidi@14\.0\.0[\s\S]*?\n      zod: 3\.25\.76/);
  assert.doesNotMatch(workspace, /^  '?(?:zod@<4|zod)'?: 4\./m);
});
