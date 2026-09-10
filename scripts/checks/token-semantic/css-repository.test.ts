import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { checkTokenCssReferences } from './css-repository';

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vellira-token-audit-'));
  roots.push(root);
  function write(file: string, content: string) {
    const target = path.join(root, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
  }
  write(
    'packages/tokens/src/generated/token-types.ts',
    "export const cssVariableNames = ['--surface-canvas'] as const;\n"
  );
  write('apps/probe/valid.css', '.a { background: var(--surface-canvas); }');
  return { root, write };
}

describe('maintained token CSS reference scan', () => {
  it('covers both apps and packages without modifying source files', () => {
    const { root, write } = fixture();
    write(
      'packages/probe/broken.scss',
      '.a { color: var(--surface-background); }'
    );
    const file = path.join(root, 'packages/probe/broken.scss');
    const before = fs.readFileSync(file, 'utf8');
    const report = checkTokenCssReferences(root);
    expect(report.checked).toBe(2);
    expect(report.findings[0].sourcePath).toBe('packages/probe/broken.scss');
    expect(fs.readFileSync(file, 'utf8')).toBe(before);
  });

  it('ignores builds, not generated-looking authored comments', () => {
    const { root, write } = fixture();
    write(
      'apps/probe/.next/build.css',
      '.a { color: var(--surface-background); }'
    );
    write(
      'apps/probe/source.css',
      '/* AUTO-GENERATED */ .a { color: var(--surface-background); }'
    );
    expect(checkTokenCssReferences(root).findings).toHaveLength(1);
  });

  it('fails when the canonical registry is missing or malformed', () => {
    const { root, write } = fixture();
    write(
      'packages/tokens/src/generated/token-types.ts',
      'export const cssVariableNames = getNames();'
    );
    expect(() => checkTokenCssReferences(root)).toThrow(/registry/);
    fs.unlinkSync(
      path.join(root, 'packages/tokens/src/generated/token-types.ts')
    );
    expect(() => checkTokenCssReferences(root)).toThrow(/registry/);
  });
});
