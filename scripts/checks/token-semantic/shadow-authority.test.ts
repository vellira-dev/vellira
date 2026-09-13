import { describe, expect, it } from 'vitest';

import {
  auditCanonicalShadowEffect,
  auditShadowDerivedSource,
  checkTokenShadowAuthority,
} from './shadow-authority';

const root = process.cwd();

describe('shadow authority audit adapter', () => {
  it('checks the maintained #885 authority without findings', () => {
    const result = checkTokenShadowAuthority(root);
    expect(result.coverage).toBe('partial');
    expect(result.checked).toBeGreaterThan(0);
    expect(result.findings).toEqual([]);
  });

  it('rejects malformed canonical structured effects', () => {
    expect(
      auditCanonicalShadowEffect({ layers: [] }, 'shadow.test', 'fixture')
    ).toEqual([
      expect.objectContaining({ code: 'invalid-canonical-shadow-effect' }),
    ]);
  });

  it.each([
    [
      'packages/tokens/src/light/semantic/shadow.ts',
      "export const shadow = '0 1px 2px rgba(0, 0, 0, 0.2)';",
      'authored-semantic-shadow-string',
    ],
    [
      'packages/tokens/src/tokens/shadows.ts',
      'export const shadows = { sm: { x: 0, elevation: 1 } };',
      'authored-native-shadow-output',
    ],
    [
      'packages/tokens/src/platform-output/component-token-intents.ts',
      'const value = theme.semantic.shadow.lg;',
      'component-output-shadow-authority-bypass',
    ],
  ])('detects shadow authority bypass in %s', (sourcePath, source, code) => {
    expect(auditShadowDerivedSource(sourcePath, source)).toEqual([
      expect.objectContaining({ code }),
    ]);
  });
});
