import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const lockfile = readFileSync('pnpm-lock.yaml', 'utf8');
const workspace = readFileSync('pnpm-workspace.yaml', 'utf8');

// GHSA-mrhx-c7xc-m3w5: the first non-vulnerable Zod release is 4.6.6.
// Chromium BiDi retains the only known root-lockfile Zod 3 path.
// Never mask the unresolved advisory by silently replacing a major version.
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


test('Scorecard #32 tracks only the remaining Chromium BiDi Zod 3 dependency edge', () => {
  // Lockfile package blocks must be matched by exact package keys: historical
  // Expo CLI 57 paths are gone after the Expo 58 migration.
  assert.match(lockfile, /^  zod@3\.25\.76:$/m);
  assert.doesNotMatch(lockfile, /^  '@expo\/cli@57\./m);
  assert.match(
    lockfile,
    /^  chromium-bidi@14\.0\.0\([^\n]+\):\n    dependencies:\n      devtools-protocol: [^\n]+\n      mitt: [^\n]+\n      zod: 3\.25\.76$/m
  );
  assert.match(lockfile, /puppeteer-core@24\.43\.1\([^\n]+\):\n    dependencies:\n      '@puppeteer\/browsers': [^\n]+\n      chromium-bidi: 14\.0\.0\(/);

  // Detect a changed graph before anyone concludes the advisory is gone.
  // This is a deliberately narrow inventory for the current investigated SHA.
  const oldZodConsumers = [...lockfile.matchAll(/^      zod: 3\.25\.76$/gm)];
  assert.equal(
    oldZodConsumers.length,
    1,
    'Unexpected Zod 3 consumer: re-audit every path instead of suppressing the alert'
  );
  assert.doesNotMatch(workspace, /^  '?zod(?:@<4)?'?: 4\./m);
  assert.doesNotMatch(workspace, /chromium-bidi>zod/);
});
