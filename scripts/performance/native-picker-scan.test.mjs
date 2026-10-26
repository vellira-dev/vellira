import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { inspectPublishedPickerReferences } = require('./native-picker-scan.cjs');
const fixtures = [];

function fixture(files) {
  const root = mkdtempSync(path.join(tmpdir(), 'vellira-picker-scan-test-'));
  fixtures.push(root);
  const paths = Object.entries(files).map(([filename, contents]) => {
    const file = path.join(root, 'dist', filename);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, contents);
    return file;
  });
  return { root, paths };
}

afterEach(() => {
  for (const dir of fixtures.splice(0)) {
    rmSync(dir, { force: true, recursive: true });
  }
});

test('accepts runtime and declarations without picker references', () => {
  const { root, paths } = fixture({
    'index.js': 'export const Button = 1;',
    'index.d.ts': 'export declare const Button: number;',
    'nested/extra.d.mts': 'export type Native = unknown;',
  });
  assert.deepEqual(inspectPublishedPickerReferences(root, paths), {
    references: [],
    scannedFiles: { runtime: 1, declarations: 2 },
  });
});

for (const extension of ['index.js', 'index.mjs', 'index.cjs']) {
  test('rejects picker reference in runtime ' + extension, () => {
    const { root, paths } = fixture({
      [extension]: "import '@react-native-picker/picker';",
      'index.d.ts': 'export type Native = unknown;',
    });
    assert.throws(
      () => inspectPublishedPickerReferences(root, paths),
      /published native dist references picker/
    );
  });
}

for (const extension of ['index.d.ts', 'index.d.mts', 'index.d.cts']) {
  test('rejects picker reference in declaration ' + extension, () => {
    const { root, paths } = fixture({
      'index.js': 'export const Button = 1;',
      [extension]: "import type { Picker } from '@react-native-picker/picker';",
    });
    assert.throws(
      () => inspectPublishedPickerReferences(root, paths),
      /published native dist references picker/
    );
  });
}

for (const [name, files] of [
  ['empty dist', {}],
  ['declarations only', { 'index.d.ts': 'export type Native = unknown;' }],
  ['runtime only', { 'index.js': 'export const Button = 1;' }],
  ['unrelated assets', { 'README.md': '@react-native-picker/picker', 'style.css': 'body {}' }],
]) {
  test('rejects ' + name, () => {
    const { root, paths } = fixture(files);
    assert.throws(
      () => inspectPublishedPickerReferences(root, paths),
      /incomplete published picker scan/
    );
  });
}
