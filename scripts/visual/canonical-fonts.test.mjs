import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  canonicalScreenshotFonts,
  canonicalVisualConfig,
} from './canonical-fonts.mjs';

test('font stabilization preserves root-local bytes and font descriptors', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'visual-font-contract-'));
  try {
    fs.mkdirSync(path.join(root, 'packages/assets/fonts'), { recursive: true });
    fs.mkdirSync(path.join(root, 'packages/assets/styles'), {
      recursive: true,
    });
    fs.writeFileSync(
      path.join(root, 'packages/assets/fonts/probe.woff2'),
      'exact-font-bytes'
    );
    const stylesheet =
      "@font-face { font-family: 'Probe'; src: url('../fonts/probe.woff2'); font-weight: 600; font-display: optional; }";
    const source = path.join(root, 'packages/assets/styles/fonts.css');
    fs.writeFileSync(source, stylesheet);
    const result = canonicalScreenshotFonts(root);
    assert.match(result, /font-display: block/);
    assert.match(result, /font-weight: 600/);
    assert.ok(
      result.includes(Buffer.from('exact-font-bytes').toString('base64'))
    );
    assert.equal(fs.readFileSync(source, 'utf8'), stylesheet);
    fs.writeFileSync(
      source,
      stylesheet.replace('../fonts/probe.woff2', '../styles/fonts.css')
    );
    assert.throws(() => canonicalScreenshotFonts(root), /root-local WOFF2/);
  } finally {
    fs.rmSync(root, { recursive: true });
  }
});

test('external harness preserves tests, thresholds, projects, retries and candidate server', () => {
  const base = {
    testDir: './e2e',
    retries: 2,
    snapshotPathTemplate: '{testDir}/{arg}{ext}',
    expect: {
      toHaveScreenshot: { maxDiffPixelRatio: 0.02, stylePath: '/existing.css' },
    },
    projects: [{ name: 'mobile', use: { isMobile: true } }],
    webServer: { command: 'pnpm storybook', url: 'http://localhost:6106' },
  };
  const result = canonicalVisualConfig(
    base,
    '/candidate/apps/storybook',
    '/tmp/fonts.css'
  );
  assert.equal(result.testDir, '/candidate/apps/storybook/e2e');
  assert.equal(result.webServer.cwd, '/candidate/apps/storybook');
  assert.deepEqual(result.projects, base.projects);
  assert.equal(result.retries, base.retries);
  assert.equal(result.snapshotPathTemplate, base.snapshotPathTemplate);
  assert.equal(result.expect.toHaveScreenshot.maxDiffPixelRatio, 0.02);
  assert.deepEqual(result.expect.toHaveScreenshot.stylePath, [
    '/existing.css',
    '/tmp/fonts.css',
  ]);
});

test('baseline authority is the pinned harness while rendering remains candidate-owned', () => {
  const config = canonicalVisualConfig(
    { testDir: './e2e', reporter: [['html', { open: 'never' }]] },
    '/candidate/storybook',
    '/tmp/fonts.css',
    '/trusted/e2e'
  );
  assert.equal(
    config.snapshotPathTemplate,
    '/trusted/e2e/{testFilePath}-snapshots/{arg}{ext}'
  );
  assert.equal(config.testDir, '/candidate/storybook/e2e');
  assert.equal(
    config.reporter[0][1].outputFolder,
    '/candidate/storybook/playwright-report'
  );
});
