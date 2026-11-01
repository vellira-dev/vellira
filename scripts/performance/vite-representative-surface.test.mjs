import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

const require = createRequire(import.meta.url);
const { components, source, measureRepresentativeWeb, formatRepresentativeWeb } =
  require('./vite-representative-surface.cjs');

function fixture(callback) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vellira-web-surface-'));
  try {
    fs.mkdirSync(path.join(dir, 'src'));
    const initial = [
      "import { Button, Input } from '@vellira-ui/react';",
      'const proof = true;',
    ].join('\n');
    fs.writeFileSync(path.join(dir, 'src', 'main.tsx'), initial);
    return callback(dir, initial);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function fakeBuild(dir) {
  const out = path.join(dir, 'dist/assets');
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(dir, 'dist/index.html'), '<div id="root"></div>');
  fs.writeFileSync(path.join(out, 'proof.js'), source.repeat(4));
  fs.writeFileSync(path.join(out, 'proof.css'), '.ui { display:block }'.repeat(70));
  fs.writeFileSync(path.join(out, 'proof.js.map'), 'ignored'.repeat(1000));
}

const base = { jsBytes: 200, jsGzipBytes: 80, cssBytes: 500, cssGzipBytes: 200 };

test('representative source includes distinct exported real UI components', () => {
  assert.ok(components.length >= 9);
  for (const component of ['Select', 'Tabs', 'Dropdown', 'Modal', 'Tooltip']) {
    assert.ok(components.includes(component));
    assert.match(source, new RegExp('<' + component));
  }
  assert.match(source, /@vellira-ui\/react\/styles/);
});

test('measures emitted bytes, excludes maps, and restores canonical source', () => {
  fixture((dir, initial) => {
    let builds = 0;
    const report = measureRepresentativeWeb(dir, () => {
      builds += 1;
      assert.equal(fs.readFileSync(path.join(dir, 'src/main.tsx'), 'utf8'), source);
      fakeBuild(dir);
    }, base);
    assert.equal(builds, 1);
    assert.equal(report.schemaVersion, 1);
    assert.ok(report.emitted.jsBytes > base.jsBytes);
    assert.ok(report.emitted.cssBytes > 1000);
    assert.ok(report.emitted.jsGzipBytes < report.emitted.jsBytes);
    assert.ok(report.emitted.cssGzipBytes < report.emitted.cssBytes);
    assert.equal(report.deltaFromButtonInput.jsBytes, report.emitted.jsBytes - base.jsBytes);
    assert.equal(fs.readFileSync(path.join(dir, 'src/main.tsx'), 'utf8'), initial);
    assert.match(formatRepresentativeWeb(report), /Delta vs Button/);
  });
});

test('throws on invalid canonical measurements and always restores on build failure', () => {
  fixture((dir, initial) => {
    assert.throws(
      () => measureRepresentativeWeb(dir, () => {}, null),
      /requires measured Button/
    );
    assert.throws(
      () => measureRepresentativeWeb(dir, () => {
        throw new Error('typecheck fixture failure');
      }, base),
      /typecheck fixture failure/
    );
    assert.equal(fs.readFileSync(path.join(dir, 'src/main.tsx'), 'utf8'), initial);
  });
});
