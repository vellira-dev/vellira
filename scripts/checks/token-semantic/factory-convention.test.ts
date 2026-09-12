import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { checkTokenFactoryConventions } from './factory-convention';

const root = process.cwd();
const themes = ['light', 'dark', 'highContrast'] as const;

function copyFactoryAuditTree() {
  const fixture = fs.mkdtempSync(
    path.join(os.tmpdir(), 'vellira-factory-audit-')
  );
  const sourceRoot = path.join(root, 'packages/tokens/src');
  const targetRoot = path.join(fixture, 'packages/tokens/src');

  fs.mkdirSync(targetRoot, { recursive: true });
  fs.cpSync(path.join(sourceRoot, 'factories'), path.join(targetRoot, 'factories'), {
    recursive: true,
  });
  for (const theme of themes) {
    fs.mkdirSync(path.join(targetRoot, theme), { recursive: true });
    fs.cpSync(
      path.join(sourceRoot, theme, 'components'),
      path.join(targetRoot, theme, 'components'),
      { recursive: true }
    );
  }

  return fixture;
}

describe('factory convention audit adapter', () => {
  it('checks the complete maintained repository contract without findings', () => {
    const result = checkTokenFactoryConventions(root);
    expect(result.coverage).toBe('complete');
    expect(result.checked).toBeGreaterThan(0);
    expect(result.findings).toEqual([]);
  });

  it('detects an unregistered full-component factory', () => {
    const fixture = copyFactoryAuditTree();
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

  it('detects a root-level full-component factory bypass with the stable finding code', () => {
    const fixture = copyFactoryAuditTree();
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

  it('fails closed on a palette helper outside the canonical #887 inventory', () => {
    const fixture = copyFactoryAuditTree();
    try {
      fs.writeFileSync(
        path.join(
          fixture,
          'packages/tokens/src/factories/palettes/createProbeIntentPalette.ts'
        ),
        'export const createProbeIntentPalette = () => ({});\n'
      );
      const result = checkTokenFactoryConventions(fixture);
      expect(result.findings).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: 'invalid-palette-helper-classification',
            sourcePath:
              'packages/tokens/src/factories/palettes/createProbeIntentPalette.ts',
          }),
        ])
      );
    } finally {
      fs.rmSync(fixture, { recursive: true, force: true });
    }
  });

  it('detects theme construction that bypasses the canonical full-component factory', () => {
    const fixture = copyFactoryAuditTree();
    try {
      const buttonSource = path.join(
        fixture,
        'packages/tokens/src/light/components/button.ts'
      );
      fs.writeFileSync(
        buttonSource,
        fs
          .readFileSync(buttonSource, 'utf8')
          .replace(
            '../../factories/components/createButtonTokens.js',
            '../../factories/createButtonTokens.js'
          )
      );
      const result = checkTokenFactoryConventions(fixture);
      expect(result.findings).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: 'theme-construction-bypasses-canonical-factory',
            sourcePath: 'packages/tokens/src/light/components/button.ts',
          }),
          expect.objectContaining({
            code: 'legacy-theme-factory-bypass',
            sourcePath: 'packages/tokens/src/light/components/button.ts',
          }),
        ])
      );
    } finally {
      fs.rmSync(fixture, { recursive: true, force: true });
    }
  });
});
