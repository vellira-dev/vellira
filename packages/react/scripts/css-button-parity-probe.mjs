// #2014: exact-compiler Button CSS Modules parity, optionally emitting the
// additive token-free stylesheet after the canonical library build.
// Isolated Vite compilation always takes place in an OS temporary directory.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, mkdirSync, renameSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { build } from 'vite';

const require = createRequire(import.meta.url);
const { verifyButtonCssParity } = require('../../../scripts/performance/react-button-css-parity.cjs');
const { buildTemporaryButtonCss } = require('../../../scripts/performance/button-minimal-packed-css.cjs');
const packageRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const repositoryRoot = path.resolve(packageRoot, '..', '..');
const expectedExports = ['.', './styles', './styles/button'];

function gitHead() {
  const output = spawnSync('git', ['rev-parse', 'HEAD'], {
    cwd: repositoryRoot,
    encoding: 'utf8',
  });
  if (output.status !== 0 || !/^[a-f0-9]{40}\n?$/.test(output.stdout)) {
    throw new Error('Cannot prove source SHA for Button CSS probe.');
  }
  return output.stdout.trim();
}

async function main() {
  const emitStyle = process.argv[2] === '--emit-button-style';
  if (process.argv.length > 2 && !emitStyle) {
    throw new Error('Unsupported Button CSS probe command argument.');
  }
  const packageJson = JSON.parse(readFileSync(path.join(packageRoot, 'package.json'), 'utf8'));
  if (JSON.stringify(Object.keys(packageJson.exports || {})) !==
      JSON.stringify(expectedExports)) {
    throw new Error('Public React package exports changed; refusing unpublished probe.');
  }

  const indexFile = path.join(packageRoot, 'dist/index.js');
  const cssFile = path.join(packageRoot, 'dist/styles.css');
  if (!existsSync(indexFile) || !existsSync(cssFile)) {
    throw new Error('Build published-root React dist before running the opt-in CSS proof.');
  }
  const rootJs = readFileSync(indexFile, 'utf8');
  const fullCss = readFileSync(cssFile, 'utf8');
  const sourceSha = gitHead();
  const candidateSha = process.env.VELLIRA_CANDIDATE_SHA;
  if (candidateSha && candidateSha !== sourceSha) {
    throw new Error('Button CSS probe candidate SHA does not match checked-out Git HEAD.');
  }

  const temp = mkdtempSync(path.join(tmpdir(), 'vellira-button-css-isolated-'));
  try {
    const styles = path.join(packageRoot, 'src/styles');
    const external = [
      'react',
      'react-dom',
      'react/jsx-runtime',
      'react/jsx-dev-runtime',
      '@vellira-ui/core',
      '@vellira-ui/icons',
      '@vellira-ui/tokens',
      '@vellira-ui/types',
      '@floating-ui/react',
      'clsx',
      'focus-trap',
      'focus-trap-react',
    ];
    await build({
      root: packageRoot,
      configFile: false,
      logLevel: 'warn',
      plugins: [react()],
      resolve: {
        alias: {
          '@': path.join(packageRoot, 'src'),
          '@test-utils': path.join(packageRoot, 'src/test-utils'),
          '@components': path.join(packageRoot, 'src/components'),
          '@patterns': path.join(packageRoot, 'src/patterns'),
          '@primitives': path.join(packageRoot, 'src/primitives'),
          '@styles': styles,
          '@utils': path.join(packageRoot, 'src/utils'),
          '@assets': path.join(packageRoot, 'src/assets'),
        },
      },
      css: {
        preprocessorOptions: {
          scss: { loadPaths: [styles] },
        },
      },
      build: {
        outDir: temp,
        emptyOutDir: true,
        lib: {
          entry: path.join(packageRoot, 'src/primitives/Button/index.ts'),
          name: 'VelliraButtonCssProbe',
          cssFileName: 'button',
          fileName: () => 'button.js',
          formats: ['es'],
        },
        rolldownOptions: { external },
      },
    });

    const cssFiles = readdirSync(temp).filter((name) => name.endsWith('.css'));
    if (cssFiles.length !== 1) {
      throw new Error('Isolated Vite build did not emit exactly one CSS asset.');
    }
    const isolatedCss = readFileSync(path.join(temp, cssFiles[0]), 'utf8');
    const result = verifyButtonCssParity({ rootJs, fullCss, isolatedCss });
    const report = {
      ...result,
      sourceSha,
      candidateVersion: packageJson.version,
      sourceEntry: 'packages/react/src/primitives/Button/index.ts',
      publishedRootStyles: 'packages/react/dist/styles.css',
      isolatedCssFilename: cssFiles[0],
      emission: 'ephemeral independent Vite library build, not a published package subpath',
    };

    if (emitStyle) {
      const fullBytes = Buffer.from(fullCss, 'utf8');
      const fullSha256 = createHash('sha256').update(fullBytes).digest('hex');
      const minimal = buildTemporaryButtonCss({
        fullCss: fullBytes,
        rootJs,
        parity: report,
        candidateSha: sourceSha,
        candidateVersion: packageJson.version,
      });
      // This export deliberately excludes all token definitions. Consumers
      // must import @vellira-ui/tokens/css once, then the Button stylesheet.
      const start = report.embeddedBlock.byteOffset;
      const end = start + report.embeddedBlock.rawBytes;
      const css = Buffer.concat([
        fullBytes.subarray(start, end),
        fullBytes.subarray(
          minimal.evidence.globalResetOffset,
          minimal.evidence.tokenRootOffset
        ),
      ]);
      if (!minimal.css.startsWith(css.toString('utf8')) ||
          css.includes(Buffer.from(':root{--space-0:')) ||
          css.length < 1000 ||
          createHash('sha256').update(readFileSync(cssFile)).digest('hex') !== fullSha256) {
        throw new Error('Cannot emit validated, token-free Button CSS.');
      }
      const output = path.join(packageRoot, 'dist/styles/button.css');
      const tempOutput = output + '.tmp';
      mkdirSync(path.dirname(output), { recursive: true });
      try {
        writeFileSync(tempOutput, css);
        renameSync(tempOutput, output);
      } finally {
        rmSync(tempOutput, { force: true });
      }
      console.log('[button-css-export] emitted verified styles/button.css; rawBytes=' +
        css.length + '; sha256=' + createHash('sha256').update(css).digest('hex') +
        '; fullCssSha256=' + fullSha256);
    } else {
      const evidencePath = path.resolve(repositoryRoot,
        process.env.VELLIRA_CSS_BUTTON_EVIDENCE ?? 'consumer-evidence/react-button-css-parity.json');
      mkdirSync(path.dirname(evidencePath), { recursive: true });
      writeFileSync(evidencePath, JSON.stringify(report, null, 2) + '\n');
      console.log('Button CSS module class parity proof: ' + JSON.stringify(report));
    }
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
