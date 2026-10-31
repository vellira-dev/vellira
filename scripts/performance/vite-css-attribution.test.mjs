import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

const require = createRequire(import.meta.url);
const { emittedSize } = require('./vite-bundle-size-report.cjs');
const {
  measureCssAttribution,
  formatCssAttribution,
} = require('./vite-css-attribution.cjs');

const canonical = [
  "import '@vellira-ui/tokens/css';",
  "import '@vellira-ui/react/styles';",
  "import { Button, Input } from '@vellira-ui/react';",
  "function App() { return <Button>Canonical fixture</Button>; }",
].join('\n');

function withFixture(visit) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vellira-css-probe-'));
  try {
    fs.mkdirSync(path.join(root, 'src'), { recursive: true });
    fs.writeFileSync(path.join(root, 'src', 'main.tsx'), canonical);
    return visit(root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function fakeBuild(root, source) {
  const assets = path.join(root, 'dist', 'assets');
  fs.mkdirSync(assets, { recursive: true });
  fs.writeFileSync(path.join(root, 'dist', 'index.html'), '<div id="root"></div>');
  fs.writeFileSync(
    path.join(assets, 'app.js'),
    'var app = ' + JSON.stringify(source.repeat(10)) + ';'
  );
  let css = '';
  if (source.includes("@vellira-ui/tokens/css")) {
    css += '.token{color:var(--text-primary)}'.repeat(30);
  }
  if (source.includes("import { Button } from '@vellira-ui/react'")) {
    css += '.button{padding:1px}'.repeat(10);
  }
  if (source.includes("@vellira-ui/react/styles")) {
    css += '.full{background:transparent}'.repeat(100);
  }
  if (css) fs.writeFileSync(path.join(assets, 'app.css'), css);
}

function priorScenarios(root) {
  fs.rmSync(path.join(root, 'dist'), { recursive: true, force: true });
  fakeBuild(root, 'bare React-only fixture');
  const bare = emittedSize(root);
  fs.rmSync(path.join(root, 'dist'), { recursive: true, force: true });
  fakeBuild(root, canonical);
  const button = emittedSize(root);
  return { bare, button };
}

test('opt-in variants use the same fixture, count CSS, and restore original source', () => {
  withFixture((root) => {
    const prior = priorScenarios(root);
    const seen = [];
    const result = measureCssAttribution(root, () => {
      const source = fs.readFileSync(path.join(root, 'src', 'main.tsx'), 'utf8');
      seen.push(source);
      fakeBuild(root, source);
    }, prior);

    assert.equal(result.status, 'DIAGNOSTIC_ONLY');
    assert.equal(seen.length, 2);
    assert.ok(seen[0].includes('Tokens-only diagnostic'));
    assert.ok(seen[1].includes('Unvalidated style diagnostic'));
    assert.ok(seen.every((source) =>
      !source.includes("import '@vellira-ui/react/styles'")
    ));
    assert.ok(seen.every((source) =>
      source.includes("import '@vellira-ui/tokens/css'")
    ));
    assert.equal(result.scenarios.bare.cssBytes, 0);
    assert.ok(result.scenarios.tokensOnly.cssBytes > 0);
    assert.ok(result.scenarios.buttonWithoutFullStyles.cssBytes > 0);
    assert.ok(result.scenarios.buttonFullStyles.cssBytes > 0);
    assert.equal(
      result.deltas.fullStylesVsButtonWithoutFullStyles.cssBytes,
      prior.button.cssBytes - result.scenarios.buttonWithoutFullStyles.cssBytes
    );
    assert.match(formatCssAttribution(result), /DIAGNOSTIC_ONLY/);
    assert.match(formatCssAttribution(result), /not a supported Button usage/);
    assert.equal(
      fs.readFileSync(path.join(root, 'src', 'main.tsx'), 'utf8'),
      canonical
    );
  });
});

test('failed opt-in build restores original source and never emits fake evidence', () => {
  withFixture((root) => {
    const prior = priorScenarios(root);
    assert.throws(
      () => measureCssAttribution(root, () => {
        throw new Error('synthetic build failure');
      }, prior),
      /synthetic build failure/
    );
    assert.equal(
      fs.readFileSync(path.join(root, 'src', 'main.tsx'), 'utf8'),
      canonical
    );
  });
});

test('missing canonical source or baseline is rejected before any diagnostic build', () => {
  withFixture((root) => {
    const prior = priorScenarios(root);
    const entry = path.join(root, 'src', 'main.tsx');
    fs.writeFileSync(entry, canonical.replace("import '@vellira-ui/react/styles';", ''));
    let builds = 0;
    assert.throws(
      () => measureCssAttribution(root, () => { builds += 1; }, prior),
      /needs the canonical/
    );
    assert.equal(builds, 0);

    fs.writeFileSync(entry, canonical);
    assert.throws(
      () => measureCssAttribution(root, () => { builds += 1; }, { bare: prior.bare }),
      /needs prior exact-candidate/
    );
    assert.equal(builds, 0);
  });
});
