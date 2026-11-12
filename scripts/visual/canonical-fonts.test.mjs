import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import {
  boundedVisualEnvironment,
  builtStorybookConfig,
  builtStorybookDirectory,
} from './built-storybook.mjs';
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

function withBuiltFixture(run) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'built-storybook-'));
  try {
    fs.mkdirSync(path.join(root, 'storybook-static'));
    for (const name of ['index.html', 'iframe.html', 'index.json']) {
      fs.writeFileSync(path.join(root, 'storybook-static', name), 'built');
    }
    run(root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

test('built transport preserves every oracle field and refuses stale server reuse', () => {
  withBuiltFixture((root) => {
    const base = canonicalVisualConfig(
      {
        testDir: './e2e',
        retries: 2,
        fullyParallel: true,
        expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.02 } },
        projects: [
          { name: 'desktop' },
          { name: 'mobile', use: { isMobile: true } },
        ],
        webServer: {
          command: 'dev-server',
          url: 'http://127.0.0.1:6106',
          timeout: 120000,
          reuseExistingServer: true,
        },
      },
      root,
      '/exact/fonts.css',
      '/trusted/e2e'
    );
    const original = structuredClone(base);
    const result = builtStorybookConfig(base, root);
    const { webServer: beforeServer, ...before } = base;
    const { webServer: afterServer, workers, ...after } = result;
    assert.deepEqual(after, before);
    assert.deepEqual(base, original);
    assert.equal(workers, 1);
    assert.equal(afterServer.url, beforeServer.url);
    assert.equal(afterServer.timeout, beforeServer.timeout);
    assert.equal(afterServer.cwd, root);
    assert.equal(afterServer.reuseExistingServer, false);
    assert.match(afterServer.command, /built-storybook\.mjs' 6106$/);
  });
});

for (const name of ['index.html', 'iframe.html', 'index.json']) {
  test(`rejects missing, empty and linked build artifact ${name}`, () => {
    withBuiltFixture((root) => {
      const file = path.join(root, 'storybook-static', name);
      fs.rmSync(file);
      assert.throws(() => builtStorybookDirectory(root));
      fs.writeFileSync(file, '');
      assert.throws(() => builtStorybookDirectory(root), /regular built/);
      fs.rmSync(file);
      fs.writeFileSync(path.join(root, 'outside'), 'outside');
      fs.symlinkSync(path.join(root, 'outside'), file);
      assert.throws(() => builtStorybookDirectory(root), /regular built/);
    });
  });
}

test('rejects a linked build directory and never falls back to a dev server', () => {
  withBuiltFixture((root) => {
    fs.renameSync(
      path.join(root, 'storybook-static'),
      path.join(root, 'outside')
    );
    fs.symlinkSync(
      path.join(root, 'outside'),
      path.join(root, 'storybook-static')
    );
    assert.throws(() => builtStorybookDirectory(root), /root-local/);
    const result = spawnSync(
      process.execPath,
      [
        fileURLToPath(new URL('./built-storybook.mjs', import.meta.url)),
        '6106',
      ],
      { cwd: root, encoding: 'utf8' }
    );
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /root-local/);
  });
});

test('rejects ambiguous or non-loopback server authority', () => {
  withBuiltFixture((root) => {
    for (const webServer of [
      undefined,
      [],
      { url: 'https://example.com:6106' },
      { url: 'http://127.0.0.1:6106/path' },
      { url: 'http://user:pass@127.0.0.1:6106' },
      { url: 'http://127.0.0.1' },
    ]) {
      assert.throws(
        () => builtStorybookConfig({ webServer }, root),
        /loopback/
      );
    }
  });
});

test('bounds subprocess concurrency without discarding existing runtime options', () => {
  const environment = {
    NODE_OPTIONS: '--max-old-space-size=1024',
    OTHER: 'preserved',
  };
  const result = boundedVisualEnvironment(environment);
  assert.equal(
    result.NODE_OPTIONS,
    '--max-old-space-size=1024 --v8-pool-size=1'
  );
  assert.equal(result.UV_THREADPOOL_SIZE, '1');
  assert.equal(result.GOMAXPROCS, '2');
  assert.equal(result.VELLIRA_VISUAL_BUILT_STORYBOOK, '1');
  assert.equal(result.OTHER, 'preserved');
  assert.deepEqual(environment, {
    NODE_OPTIONS: '--max-old-space-size=1024',
    OTHER: 'preserved',
  });
});

test('production bundling retains an explicitly side-effectful style entry, unlike the old manifest', async () => {
  const manifest = JSON.parse(
    fs.readFileSync(
      new URL('../../packages/react/package.json', import.meta.url),
      'utf8'
    )
  );
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'style-entry-build-'));
  try {
    const pkg = path.join(root, 'node_modules/style-entry-probe');
    fs.mkdirSync(path.join(pkg, 'src'), { recursive: true });
    fs.writeFileSync(
      path.join(root, 'entry.js'),
      "import 'style-entry-probe/styles';"
    );
    fs.writeFileSync(path.join(pkg, 'src/styles.ts'), "import './base.css';");
    fs.writeFileSync(
      path.join(pkg, 'src/base.css'),
      '.preserved-reset { box-sizing: border-box; }'
    );
    const bundle = async (sideEffects) => {
      fs.writeFileSync(
        path.join(pkg, 'package.json'),
        JSON.stringify({
          name: 'style-entry-probe',
          type: 'module',
          exports: { './styles': './src/styles.ts' },
          sideEffects,
        })
      );
      const result = await build({
        configFile: false,
        root,
        logLevel: 'silent',
        build: {
          write: false,
          minify: false,
          cssMinify: false,
          rollupOptions: { input: path.join(root, 'entry.js') },
        },
      });
      return [result]
        .flat()
        .flatMap((output) => output.output)
        .filter(
          (output) =>
            output.type === 'asset' && output.fileName.endsWith('.css')
        )
        .map((output) => String(output.source))
        .join('\n');
    };
    assert.equal(await bundle(['**/*.css']), '');
    assert.match(
      await bundle(manifest.sideEffects),
      /\.preserved-reset\s*\{\s*box-sizing:\s*border-box/
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
