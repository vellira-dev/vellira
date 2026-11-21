import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const lockfile = readFileSync('pnpm-lock.yaml', 'utf8');
const workspace = readFileSync('pnpm-workspace.yaml', 'utf8');

// GHSA-mrhx-c7xc-m3w5: the first non-vulnerable Zod release is 4.6.6.
// LHCI 0.16.1 brings Lighthouse 13.6.0 and Puppeteer 25.x. The candidate
// must remove the Zod 3 path entirely without a global major override.
const safeZod = (major, minor, patch) =>
  major > 4 || (major === 4 && (minor > 6 || (minor === 6 && patch >= 6)));

test('React Hooks ESLint resolves patched Zod 4 without a global major override', () => {
  assert.match(workspace, /'eslint-plugin-react-hooks>zod': 4\.6\.7/);
  assert.doesNotMatch(workspace, /^\s*zod: 4\.6\.7$/m);
  assert.match(lockfile, /^  eslint-plugin-react-hooks>zod: 4\.6\.7$/m);

  const versions = [...lockfile.matchAll(/^  zod@(\d+)\.(\d+)\.(\d+):$/gm)]
    .map((match) => match.slice(1).map(Number));
  assert.ok(
    versions.some(
      ([major, minor, patch]) => major === 4 && safeZod(major, minor, patch)
    )
  );
  for (const [major, minor, patch] of versions) {
    if (major >= 4) {
      assert.ok(
        safeZod(major, minor, patch),
        `Unsafe Zod ${major}.${minor}.${patch}`
      );
    }
  }
  assert.match(lockfile, /eslint-plugin-react-hooks@7\.1\.1[\s\S]*?\n      zod: 4\.6\.7/);
});

test('Scorecard #32 removes the legacy Zod 3 path via supported Lighthouse tooling', () => {
  const manifest = JSON.parse(readFileSync('package.json', 'utf8'));
  assert.equal(manifest.devDependencies['@lhci/cli'], '0.16.1');
  assert.match(
    lockfile,
    /^      '@lhci\/cli':\n        specifier: 0\.16\.1\n        version: 0\.16\.1\(/m
  );
  assert.match(lockfile, /^  lighthouse@13\.6\.0:/m);
  assert.match(lockfile, /^  puppeteer-core@25\.\d+\.\d+:/m);
  assert.match(lockfile, /^  chromium-bidi@157\.0\.8090-0:/m);

  // No Zod 3 may remain anywhere in the single root graph. An unexpected
  // second introducer is a failure, not an excuse to suppress the GHSA.
  assert.doesNotMatch(lockfile, /^  zod@3\./m);
  assert.doesNotMatch(lockfile, /^      zod: 3\./m);
  assert.doesNotMatch(lockfile, /^  '@expo\/cli@57\./m);
  assert.match(
    lockfile,
    /chromium-bidi@157\.0\.8090-0\([^\n]+\):\n    dependencies:\n(?:      [^\n]+\n)*?      zod: 4\.6\.7/m
  );

  // No global override or in-place replacement of the Chromium BiDi schema
  // library. If upstream changes the major line, investigate and revalidate.
  assert.doesNotMatch(workspace, /^  '?zod(?:@<4)?'?: 4\./m);
  assert.doesNotMatch(workspace, /chromium-bidi>zod/);
});
