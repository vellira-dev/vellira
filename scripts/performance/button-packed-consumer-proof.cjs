// #2014: manual-only real packed Vite + Next.js + Chromium Button CSS proof.
// Uses the SAME immutable candidate tarballs for full and temporary reduced CSS.
// Does not mutate npm package exports, source files, or publish a new stylesheet.
const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { gzipSync } = require('node:zlib');
const { buildTemporaryButtonCss } = require('./button-minimal-packed-css.cjs');
const {
  WEB_PACKAGE_NAMES,
  captureConsumerHarness,
  validateCandidateArtifactDirectory,
  assertInstalledCandidatePackages,
} = require('../release-candidate/consumer-artifacts.cjs');

const repositoryRoot = path.resolve(__dirname, '../..');

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function pin(value, name) {
  const match = typeof value === 'string' &&
    value.match(/^[~^]?(\d+\.\d+\.\d+)$/);
  if (!match) throw new Error('Missing pinned version for ' + name + '.');
  return match[1];
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    encoding: 'utf8',
    env: { ...process.env, ...options.env },
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 5 * 1024 * 1024,
  });
  if (result.error || result.status !== 0) {
    throw new Error(command + ' ' + args.join(' ') + ' failed:\n' +
      (result.stderr || '') + '\n' + (result.stdout || '') +
      '\n' + (result.error?.message || ''));
  }
  return result.stdout.trim();
}

function write(root, name, contents) {
  const target = path.join(root, name);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, contents);
}

function assets(dir) {
  const totals = { jsBytes: 0, jsGzipBytes: 0, cssBytes: 0, cssGzipBytes: 0 };
  let cssFiles = 0;
  let jsFiles = 0;
  function walk(current) {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const file = path.join(current, entry.name);
      if (entry.isDirectory()) walk(file);
      else if (entry.isFile() && (entry.name.endsWith('.css') || entry.name.endsWith('.js'))) {
        const data = fs.readFileSync(file);
        const ext = entry.name.endsWith('.css') ? 'css' : 'js';
        totals[ext + 'Bytes'] += data.length;
        totals[ext + 'GzipBytes'] += gzipSync(data, { level: 9 }).length;
        if (ext === 'css') cssFiles += 1;
        else jsFiles += 1;
      }
    }
  }
  walk(dir);
  if (!cssFiles || !jsFiles || totals.cssBytes < 1000) {
    throw new Error('Real production consumer did not emit CSS and JS.');
  }
  return { ...totals, cssFiles, jsFiles };
}

function delta(before, after) {
  const keys = ['jsBytes', 'jsGzipBytes', 'cssBytes', 'cssGzipBytes'];
  return Object.fromEntries(keys.map((key) => [key, after[key] - before[key]]));
}

function createFixture(root, candidate) {
  const playground = readJson(path.join(repositoryRoot, 'apps/react-playground/package.json'));
  const storybook = readJson(path.join(repositoryRoot, 'apps/react-storybook/package.json'));
  const website = readJson(path.join(repositoryRoot, 'apps/website/package.json'));
  const react = readJson(path.join(repositoryRoot, 'packages/react/package.json'));
  const top = readJson(path.join(repositoryRoot, 'package.json'));
  const dependencies = {
    react: pin(playground.dependencies.react, 'react'),
    'react-dom': pin(playground.dependencies['react-dom'], 'react-dom'),
    next: pin(website.dependencies.next, 'next'),
  };
  for (const pkg of candidate.packages) {
    dependencies[pkg.name] = 'file:' + pkg.tarballPath;
  }
  const devDependencies = {
    vite: pin(playground.devDependencies.vite, 'vite'),
    '@vitejs/plugin-react': pin(playground.devDependencies['@vitejs/plugin-react'], 'plugin-react'),
    '@playwright/test': pin(storybook.devDependencies['@playwright/test'], 'playwright'),
    typescript: pin(top.devDependencies.typescript, 'typescript'),
    '@types/react': pin(react.devDependencies['@types/react'], 'types-react'),
    '@types/react-dom': pin(react.devDependencies['@types/react-dom'], 'types-react-dom'),
    '@types/node': pin(top.devDependencies['@types/node'], 'types-node'),
  };
  write(root, 'package.json', JSON.stringify({
    name: 'vellira-button-packed-consumer-proof',
    private: true,
    version: '0.0.0',
    type: 'module',
    scripts: { 'build:vite': 'vite build', 'build:next': 'next build' },
    dependencies,
    devDependencies,
  }, null, 2) + '\n');

  write(root, 'vite.config.ts', [
    "import { defineConfig } from 'vite';",
    "import react from '@vitejs/plugin-react';",
    'export default defineConfig({ plugins: [react()], build: { outDir: "vite-dist" } });',
    '',
  ].join('\n'));
  write(root, 'index.html', [
    '<!doctype html><html lang="en"><head><meta charset="UTF-8" />',
    '<meta name="viewport" content="width=device-width,initial-scale=1" />',
    '</head><body><div id="root"></div>',
    '<script type="module" src="/src/main.tsx"></script></body></html>',
  ].join('\n'));
  write(root, 'next.config.mjs', 'export default { reactStrictMode: true };\n');
  write(root, 'tsconfig.json', JSON.stringify({
    compilerOptions: {
      target: 'ES2022', lib: ['dom', 'dom.iterable', 'esnext'],
      jsx: 'react-jsx', module: 'esnext', moduleResolution: 'bundler',
      skipLibCheck: true, strict: true, noEmit: true,
      esModuleInterop: true, allowJs: false, isolatedModules: true,
      resolveJsonModule: true, incremental: true,
      plugins: [{ name: 'next' }],
    },
    include: ['next-env.d.ts', '.next/types/**/*.ts', '**/*.ts', '**/*.tsx'],
    exclude: ['node_modules'],
  }, null, 2) + '\n');

  const surface = [
    "'use client';",
    "import { useState } from 'react';",
    "import { Button, ThemeProvider } from '@vellira-ui/react';",
    'type Theme = "light" | "dark" | "highContrast";',
    'export default function ButtonSurface() {',
    '  const [theme, setTheme] = useState<Theme>("light");',
    '  return <ThemeProvider theme={theme}>',
    '    <main id="surface" aria-label="Vellira Button CSS consumer proof">',
    '      <nav aria-label="Theme switcher">',
    '        <button data-theme-choice="light" onClick={() => setTheme("light")}>Light theme</button>',
    '        <button data-theme-choice="dark" onClick={() => setTheme("dark")}>Dark theme</button>',
    '        <button data-theme-choice="highContrast" onClick={() => setTheme("highContrast")}>Contrast theme</button>',
    '      </nav>',
    '      <Button data-case="solid" color="primary" appearance="solid">Solid</Button>',
    '      <Button data-case="outline" color="neutral" appearance="outline">Outline</Button>',
    '      <Button data-case="ghost" color="success" appearance="ghost">Ghost</Button>',
    '      <Button data-case="soft" color="warning" appearance="soft">Soft</Button>',
    '      <Button data-case="link" color="danger" appearance="link">Link</Button>',
    '      <Button data-case="disabled" color="primary" disabled>Disabled</Button>',
    '      <Button data-case="loading" color="primary" loading>Loading</Button>',
    '      <Button data-case="small" color="neutral" size="sm">Small</Button>',
    '      <Button data-case="large" color="primary" size="lg">Large</Button>',
    '      <Button data-case="icon" iconOnly iconStart={<span>+</span>} aria-label="Add">+</Button>',
    '    </main>',
    '  </ThemeProvider>;',
    '}',
  ].join('\n');
  write(root, 'src/ButtonSurface.tsx', surface + '\n');
  write(root, 'app/page.tsx', [
    "import ButtonSurface from '../src/ButtonSurface';",
    'export default function Page() { return <ButtonSurface />; }',
  ].join('\n') + '\n');
}

function setVariant(root, variant) {
  const cssImport = variant === 'full'
    ? "import '@vellira-ui/react/styles';"
    : "import './button-minimal.css';";
  write(root, 'src/main.tsx', [
    "import { createRoot } from 'react-dom/client';",
    "import ButtonSurface from './ButtonSurface';",
    cssImport,
    'const root = document.getElementById("root");',
    'if (!root) throw new Error("Missing root element.");',
    'createRoot(root).render(<ButtonSurface />);',
  ].join('\n') + '\n');
  const nextImport = variant === 'full'
    ? "import '@vellira-ui/react/styles';"
    : "import '../src/button-minimal.css';";
  write(root, 'app/layout.tsx', [
    nextImport,
    "import type { ReactNode } from 'react';",
    'export default function Layout({ children }: { children: ReactNode }) {',
    '  return <html lang="en"><body>{children}</body></html>;',
    '}',
  ].join('\n') + '\n');
}

async function staticServer(root) {
  const server = http.createServer((request, response) => {
    try {
      const raw = new URL(request.url || '/', 'http://127.0.0.1').pathname;
      const relative = raw === '/' ? 'index.html' : decodeURIComponent(raw.slice(1));
      const file = path.resolve(root, relative);
      if (!file.startsWith(path.resolve(root) + path.sep)) {
        response.writeHead(403).end();
        return;
      }
      const content = fs.readFileSync(file);
      const mime = file.endsWith('.css') ? 'text/css' :
        file.endsWith('.js') ? 'text/javascript' : 'text/html';
      response.writeHead(200, { 'Content-Type': mime });
      response.end(content);
    } catch {
      response.writeHead(404).end();
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return {
    url: 'http://127.0.0.1:' + server.address().port + '/',
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

async function browserSnapshots(chromium, dir) {
  const server = await staticServer(dir);
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage({ reducedMotion: 'reduce' });
    const frames = {};
    for (const viewport of [{ width: 1180, height: 820 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(viewport);
      await page.goto(server.url, { waitUntil: 'networkidle' });
      await page.locator('[data-case="solid"]').waitFor();
      for (const choice of ['light', 'dark', 'highContrast']) {
        await page.locator('[data-theme-choice="' + choice + '"]').click();
        const expected = choice === 'highContrast' ? 'high-contrast' : choice;
        await page.waitForFunction((name) =>
          document.documentElement.dataset.velliraTheme === name, expected);
        await page.mouse.move(1, 1);
        await page.evaluate(() => document.fonts.ready);
        const snapshot = await page.evaluate(() => {
          const props = [
            'display', 'color', 'background-color', 'border-color',
            'border-width', 'border-radius', 'font-size', 'font-family',
            'font-weight', 'line-height', 'height', 'padding-left',
            'padding-right', 'box-shadow', 'outline-color', 'cursor',
            'transform', 'animation-name',
          ];
          const nodes = [...document.querySelectorAll('[data-case]')];
          return {
            theme: document.documentElement.dataset.velliraTheme,
            buttonCount: nodes.length,
            cases: Object.fromEntries(nodes.map((element) => {
              const computed = getComputedStyle(element);
              return [element.dataset.case, {
                className: element.className,
                disabled: element.hasAttribute('disabled'),
                busy: element.getAttribute('aria-busy'),
                style: Object.fromEntries(props.map((p) => [p, computed.getPropertyValue(p)])),
              }];
            })),
          };
        });
        if (snapshot.buttonCount !== 10 ||
            snapshot.cases.solid.style['background-color'] === 'rgba(0, 0, 0, 0)' ||
            !snapshot.cases.solid.className.includes('_button_') ||
            !snapshot.cases.disabled.disabled) {
          throw new Error('Browser fixture does not render a styled Vellira Button.');
        }
        const image = await page.locator('#surface').screenshot({
          animations: 'disabled',
          caret: 'hide',
        });
        frames[viewport.width + '-' + choice] = {
          computed: snapshot,
          screenshotSha256: sha256(image),
        };
      }
      await page.locator('[data-case="solid"]').hover();
      const hover = await page.locator('[data-case="solid"]').evaluate((el) => {
        const s = getComputedStyle(el);
        return [s.color, s.backgroundColor, s.transform];
      });
      frames[viewport.width + '-hover'] = { computed: hover };
    }
    await page.close();
    return frames;
  } finally {
    await browser.close();
    await server.close();
  }
}

async function main() {
  const harness = captureConsumerHarness();
  const sha = process.env.VELLIRA_CANDIDATE_SHA;
  const candidate = validateCandidateArtifactDirectory(
    path.resolve(process.env.VELLIRA_CANDIDATE_DIR || '.candidate-artifacts'),
    sha,
    WEB_PACKAGE_NAMES
  );
  const parity = readJson(path.resolve(
    process.env.VELLIRA_BUTTON_CSS_PARITY || 'consumer-evidence/react-button-css-parity.json'
  ));
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'vellira-packed-button-'));
  try {
    createFixture(fixture, candidate);
    run('npm', ['install', '--no-audit', '--no-fund', '--package-lock=true'], { cwd: fixture });
    const installed = assertInstalledCandidatePackages(fixture, candidate, WEB_PACKAGE_NAMES);
    const reactDist = path.join(fixture, 'node_modules/@vellira-ui/react/dist');
    const minimal = buildTemporaryButtonCss({
      fullCss: fs.readFileSync(path.join(reactDist, 'styles.css')),
      rootJs: fs.readFileSync(path.join(reactDist, 'index.js'), 'utf8'),
      parity,
      candidateSha: candidate.manifest.source.sha,
      candidateVersion: candidate.manifest.version,
    });
    write(fixture, 'src/button-minimal.css', minimal.css);
    const { chromium } = require(path.join(fixture, 'node_modules/@playwright/test'));
    const variants = {};
    for (const name of ['full', 'minimal']) {
      setVariant(fixture, name);
      run('npm', ['run', 'build:vite'], { cwd: fixture });
      const dist = path.join(fixture, 'vite-dist');
      variants[name] = {
        vite: assets(path.join(dist, 'assets')),
        browser: await browserSnapshots(chromium, dist),
      };
      fs.rmSync(path.join(fixture, '.next'), { recursive: true, force: true });
      run('npm', ['run', 'build:next'], {
        cwd: fixture,
        env: { CI: '1', NEXT_TELEMETRY_DISABLED: '1' },
      });
      variants[name].next = assets(path.join(fixture, '.next/static'));
    }

    const before = variants.full;
    const after = variants.minimal;
    if (JSON.stringify(before.browser) !== JSON.stringify(after.browser)) {
      throw new Error('Packed Vite browser computed styles or screenshots diverge.');
    }
    if (after.vite.cssGzipBytes >= before.vite.cssGzipBytes ||
        after.next.cssGzipBytes >= before.next.cssGzipBytes) {
      throw new Error('No independently measured Vite and Next CSS gzip reduction.');
    }
    const proof = {
      schemaVersion: 1,
      state: 'PACKED_CONSUMER_AND_CHROMIUM_PARITY',
      candidateSha: candidate.manifest.source.sha,
      candidateVersion: candidate.manifest.version,
      manifestSha256: candidate.manifestSha256,
      harness,
      node: process.version,
      npm: run('npm', ['--version'], { cwd: fixture }),
      packageLockSha256: sha256(fs.readFileSync(path.join(fixture, 'package-lock.json'))),
      installedPackages: installed,
      minimalFixture: minimal.evidence,
      variants,
      deltas: {
        vite: delta(before.vite, after.vite),
        next: delta(before.next, after.next),
      },
      limitations: [
        'Temporary CSS fixture from immutable packed artifact; no public CSS export.',
        'Vite computed-style/screenshots are Chromium-only, not cross-browser.',
        'Next.js is a clean production-build size proof, not a browser parity proof.',
        'Emitted gzip assets are not actual HTTP transferred bytes or runtime memory.',
      ],
    };
    const output = path.resolve(
      process.env.VELLIRA_CSS_BUTTON_CONSUMER_EVIDENCE ||
      'consumer-evidence/button-packed-consumer.json'
    );
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, JSON.stringify(proof, null, 2) + '\n');
    console.log('[button-packed-consumer] ' + JSON.stringify({
      status: proof.state,
      source: proof.candidateSha,
      fullViteCssGzip: before.vite.cssGzipBytes,
      reducedViteCssGzip: after.vite.cssGzipBytes,
      fullNextCssGzip: before.next.cssGzipBytes,
      reducedNextCssGzip: after.next.cssGzipBytes,
      browserComparisons: Object.keys(before.browser).length,
    }));
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
