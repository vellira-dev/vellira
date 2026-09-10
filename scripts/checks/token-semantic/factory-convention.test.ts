import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { checkTokenFactoryConventions } from './factory-convention';

const root = process.cwd();

function copyFactoryTree() {
  const fixture = fs.mkdtempSync(
    path.join(os.tmpdir(), 'vellira-factory-audit-')
  );
  const source = path.join(root, 'packages/tokens/src/factories');
  const target = path.join(fixture, 'packages/tokens/src/factories');
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.cpSync(source, target, { recursive: true });
  return fixture;
}

describe('factory convention audit adapter', () => {
  it('checks the maintained repository inventory without findings', () => {
    const result = checkTokenFactoryConventions(root);
    expect(result.coverage).toBe('partial');
    expect(result.checked).toBeGreaterThan(0);
    expect(result.findings).toEqual([]);
  });

  it('detects an unregistered full-component factory', () => {
    const fixture = copyFactoryTree();
    try {
      fs.writeFileSync(
        path.join(
          fixture,
          'packages/tokens/src/factories/components/createProbeTokens.ts'
        ),
        'export const createProbeTokens = () => ({});\n'
      );
      const result = checkTokenFactoryConventions(fixture);
      expect(result.findings).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: 'unregistered-component-factory',
            sourcePath:
              'packages/tokens/src/factories/components/createProbeTokens.ts',
          }),
        ])
      );
    } finally {
      fs.rmSync(fixture, { recursive: true, force: true });
    }
  });

  it('detects a root-level full-component factory bypass', () => {
    const fixture = copyFactoryTree();
    try {
      fs.writeFileSync(
        path.join(
          fixture,
          'packages/tokens/src/factories/createProbeTokens.ts'
        ),
        'export const createProbeTokens = () => ({});\n'
      );
      const result = checkTokenFactoryConventions(fixture);
      expect(result.findings).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: 'root-factory-bypass',
            sourcePath: 'packages/tokens/src/factories/createProbeTokens.ts',
          }),
        ])
      );
    } finally {
      fs.rmSync(fixture, { recursive: true, force: true });
    }
  });
});
