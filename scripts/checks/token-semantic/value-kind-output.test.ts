import { describe, expect, it } from 'vitest';

import {
  auditGeneratedCssOutput,
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

  it('rejects CSS blocks that serialize a unitless value with px', () => {
    const output = new Map([
      [
        'components.probe.scale',
        { variable: '--components-probe-scale', value: '0.98' },
      ],
    ]);

    expect(
      auditGeneratedCssOutput({
        generated: ':root {\n  --components-probe-scale: 0.98px;\n}\n',
        blocks: [{ selector: ':root', output }],
      })
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'generated-css-output-drift' }),
      ])
    );
  });

  it('rejects Generator V2 source that stops delegating numeric roles', () => {
    expect(auditGeneratorValueKindIntegration('// no shared value-kind call')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'generator-value-kind-wiring-missing' }),
      ])
    );
  });
});
