import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import prettier from 'prettier';
import prettierConfig from '../../.prettierrc.js';
import { fileURLToPath } from 'node:url';

import { readRuntimeExportExpectation } from './utils.mjs';

const dirname = path.dirname(fileURLToPath(import.meta.url));

function renderExpectation(entries) {
  return [
    "import * as api from './index';",
    '',
    "describe('public API', () => {",
    "  it('exports only documented runtime entries', () => {",
    '    expect(Object.keys(api).sort()).toEqual([',
    ...entries.map((entry) => `      '${entry}',`),
    '    ]);',
    '  });',
    '});',
    '',
  ].join('\n');
}

test('shared smoke authority follows synthetic Web and Native runtime exports', () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'vellira-smoke-authority-'));

  try {
    for (const [name, entries] of [
      ['web', ['Button', 'Notice', 'useTheme']],
      ['native', ['Button', 'Notice', 'nativeThemes', 'useTheme']],
    ]) {
      const file = path.join(root, `${name}.public-api.test.ts`);
      writeFileSync(file, renderExpectation(entries));

      assert.deepEqual(readRuntimeExportExpectation(file), [...entries].sort());
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('shared smoke authority fails closed on malformed or empty expectations', () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'vellira-smoke-authority-'));

  try {
    const malformed = path.join(root, 'malformed.ts');
    writeFileSync(malformed, 'export const unrelated = true;\n');
    assert.throws(
      () => readRuntimeExportExpectation(malformed),
      /Unable to locate runtime export expectation/
    );

    const empty = path.join(root, 'empty.ts');
    writeFileSync(empty, renderExpectation([]));
    assert.throws(
      () => readRuntimeExportExpectation(empty),
      /Runtime export expectation is empty or invalid/
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('both package smoke scripts consume the shared public API authority', () => {
  const web = readFileSync(path.join(dirname, 'web.mjs'), 'utf8');
  const native = readFileSync(path.join(dirname, 'native.mjs'), 'utf8');

  assert.match(web, /readRuntimeExportExpectation/);
  assert.match(web, /packages\/react\/src\/public-api\.test\.ts/);
  assert.match(native, /readRuntimeExportExpectation/);
  assert.match(native, /packages\/react-native\/src\/public-api\.test\.ts/);
});


test('diagnostic: README regression is repository-Prettier clean', async () => {
  const source = path.join(
    dirname,
    '../generators/component/readme-inventory-contract.test.ts'
  );
  const current = readFileSync(source, 'utf8');
  const formatted = await prettier.format(current, {
    ...prettierConfig,
    parser: 'typescript',
  });

  if (current !== formatted) {
    throw new Error(
      `README_PRETTIER_EXPECTED_START\n${formatted}README_PRETTIER_EXPECTED_END`
    );
  }
});
