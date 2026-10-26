import { createRequire } from 'node:module';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { inspectPublishedPickerReferences } = require('./native-picker-scan.cjs') as {
  inspectPublishedPickerReferences: (
    root: string,
    files: string[]
  ) => {
    scannedFiles: { runtime: number; declarations: number };
    references: string[];
  };
};
const fixtures: string[] = [];

function fixture(files: Record<string, string>) {
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

describe('published picker negative-dependency scanner', () => {
  it('accepts published runtime and declaration surfaces without picker imports', () => {
    const { root, paths } = fixture({
      'index.js': 'export const Button = 1;',
      'index.d.ts': 'export declare const Button: number;',
      'nested/extra.d.mts': 'export type Native = unknown;',
    });
    expect(inspectPublishedPickerReferences(root, paths)).toEqual({
      references: [],
      scannedFiles: { runtime: 1, declarations: 2 },
    });
  });

  it.each(['index.js', 'index.mjs', 'index.cjs'])(
    'rejects a picker reference in runtime %s',
    (extension) => {
      const { root, paths } = fixture({
        [extension]: "import '@react-native-picker/picker';",
        'index.d.ts': 'export type Native = unknown;',
      });
      expect(() => inspectPublishedPickerReferences(root, paths)).toThrow(
        /published native dist references picker/
      );
    }
  );

  it.each(['index.d.ts', 'index.d.mts', 'index.d.cts'])(
    'rejects a picker reference in declaration %s',
    (extension) => {
      const { root, paths } = fixture({
        'index.js': 'export const Button = 1;',
        [extension]: "import type { Picker } from '@react-native-picker/picker';",
      });
      expect(() => inspectPublishedPickerReferences(root, paths)).toThrow(
        /published native dist references picker/
      );
    }
  );

  it('rejects empty packed dist', () => {
    const { root, paths } = fixture({});
    expect(() => inspectPublishedPickerReferences(root, paths)).toThrow(
      /incomplete published picker scan/
    );
  });

  it('rejects declarations without runtime', () => {
    const { root, paths } = fixture({
      'index.d.ts': 'export type Native = unknown;',
    });
    expect(() => inspectPublishedPickerReferences(root, paths)).toThrow(
      /incomplete published picker scan/
    );
  });

  it('rejects runtime without declarations', () => {
    const { root, paths } = fixture({
      'index.js': 'export const Button = 1;',
    });
    expect(() => inspectPublishedPickerReferences(root, paths)).toThrow(
      /incomplete published picker scan/
    );
  });

  it('does not count unrelated asset files toward either required surface', () => {
    const { root, paths } = fixture({
      'README.md': '@react-native-picker/picker',
      'style.css': 'body {}',
    });
    expect(() => inspectPublishedPickerReferences(root, paths)).toThrow(
      /incomplete published picker scan/
    );
  });
});
