import { describe, expect, it } from 'vitest';

import {
  auditGeneratedCssBytes,
  auditGeneratorValueKindIntegration,
  auditRegistryParity,
  checkTokenValueKindOutputs,
} from './value-kind-output';

const root = process.cwd();

describe('token value-kind output audit', () => {
  it('proves generated CSS, registries, and Generator V2 use the #881 authority', () => {
    const result = checkTokenValueKindOutputs(root);
    expect(result.coverage).toBe('complete');
    expect(result.checked).toBeGreaterThan(100);
    expect(result.findings).toEqual([]);
  });

  it('rejects generated registry drift in either direction', () => {
    expect(
      auditRegistryParity({
        code: 'fixture-registry-drift',
        sourcePath: 'fixture.ts',
        label: 'Fixture',
        actual: ['--a', '--extra'],
        expected: ['--a', '--missing'],
      })
    ).toEqual([
      expect.objectContaining({
        code: 'fixture-registry-drift',
        evidence: expect.stringContaining('--missing'),
      }),
    ]);
  });

  it('rejects stale committed generated CSS', () => {
    expect(
      auditGeneratedCssBytes({
        generated: ':root {\n  --scale: 0.98;\n}\n',
        committed: ':root {\n  --scale: 0.98px;\n}\n',
      })
    ).toEqual([
      expect.objectContaining({ code: 'generated-css-stale' }),
    ]);
  });

  it('rejects Generator V2 source that stops delegating numeric roles', () => {
    expect(auditGeneratorValueKindIntegration('// no shared value-kind call')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'generator-value-kind-wiring-missing' }),
      ])
    );
  });
});
