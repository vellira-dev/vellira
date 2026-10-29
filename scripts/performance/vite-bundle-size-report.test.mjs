import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

const require = createRequire(import.meta.url);
const {
  emittedSize,
  measureViteBundleVariants,
  sizeReportMarkdown,
} = require('./vite-bundle-size-report.cjs');

function inFixture(visit) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vellira-size-proof-'));
  try {
    fs.mkdirSync(path.join(root, 'src'));
    return visit(root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function buildFake(root, source) {
  const dist = path.join(root, 'dist', 'assets');
  fs.mkdirSync(dist, { recursive: true });
  fs.writeFileSync(path.join(root, 'dist', 'index.html'), '<div id="root"></div>');
  fs.writeFileSync(path.join(dist, 'app.js'), 'var app = ' + JSON.stringify(source.repeat(8)) + ';');
  if (source.includes("@vellira-ui/react/styles")) {
    fs.writeFileSync(path.join(dist, 'style.css'), '.x{color:red}'.repeat(100));
  }
  // A sourcemap must not inflate actual JS/CSS output.
  fs.writeFileSync(path.join(dist, 'app.js.map'), 'unused'.repeat(1000));
}

test('emitted size counts only real JS and CSS; checks gzip and ignores maps', () => {
  inFixture((root) => {
    buildFake(root, "import '@vellira-ui/react/styles';");
    const result = emittedSize(root);
    assert.equal(result.jsFiles, 1);
    assert.equal(result.cssFiles, 1);
    assert.ok(result.jsBytes > 100);
    assert.ok(result.cssBytes > 100);
    assert.ok(result.jsGzipBytes < result.jsBytes);
    assert.ok(result.cssGzipBytes < result.cssBytes);
  });
});

test('size proof compares bare, Button and Button+Input in one fixture and restores source', () => {
  inFixture((root) => {
    const entry = path.join(root, 'src', 'main.tsx');
    const original = [
      "import '@vellira-ui/react/styles';",
      "import { Button, Input } from '@vellira-ui/react';",
      "const marker = 'Button+Input';",
    ].join('\n');
    fs.writeFileSync(entry, original);
    buildFake(root, original);
    const executed = [];
    const result = measureViteBundleVariants(root, () => {
      const current = fs.readFileSync(entry, 'utf8');
      executed.push(current);
      buildFake(root, current);
    });
    assert.equal(executed.length, 2);
    assert.ok(executed[0].includes('React-only baseline'));
    assert.ok(executed[1].includes('Button-only'));
    assert.deepEqual(Object.keys(result.scenarios), ['buttonInput', 'bare', 'button']);
    assert.equal(result.scenarios.bare.cssBytes, 0);
    assert.ok(result.scenarios.button.cssBytes > 0);
    assert.equal(result.deltas.buttonVsBare.cssBytes, result.scenarios.button.cssBytes);
    assert.equal(result.deltas.buttonInputVsButton.cssBytes, 0);
    assert.equal(fs.readFileSync(entry, 'utf8'), original);
    assert.match(sizeReportMarkdown(result), /Vite size observation/);
    assert.match(sizeReportMarkdown(result), /report-only/);
  });
});

test('no nontrivial JS fails closed; original source is restored after build failure', () => {
  inFixture((root) => {
    assert.throws(() => emittedSize(root), /missing its production output/);
    const entry = path.join(root, 'src', 'main.tsx');
    const original = [
      "import '@vellira-ui/react/styles';",
      "import { Button, Input } from '@vellira-ui/react';",
    ].join('\n');
    fs.writeFileSync(entry, original);
    buildFake(root, original);
    assert.throws(
      () => measureViteBundleVariants(root, () => {
        throw new Error('synthetic build failure');
      }),
      /synthetic build failure/
    );
    assert.equal(fs.readFileSync(entry, 'utf8'), original);
  });
});
