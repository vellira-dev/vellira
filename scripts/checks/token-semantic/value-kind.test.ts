import { describe, expect, it } from 'vitest';

import { serializeCssTokenValue } from '../../../packages/tokens/scripts/token-css-output';
import { auditTokenValueKinds } from './value-kind';

function audit(value: unknown) {
  return auditTokenValueKinds(value, 'components.probe', 'dark', 'fixture.ts');
}

describe('canonical value-kind audit adapter', () => {
  it.each([
    ['width', 44, '44px'],
    ['scale', 0.98, '0.98'],
    ['opacity', 0.8, '0.8'],
    ['zIndex', 1, '1'],
    ['duration', 150, '150ms'],
    ['duration', '0.2s', '0.2s'],
    ['easing', 'ease-out', 'ease-out'],
    ['maxHeight', '90vh', '90vh'],
  ])('accepts the canonical representation of %s', (role, value, output) => {
    expect(audit({ [role]: value }).findings).toEqual([]);
    expect(serializeCssTokenValue(`components.probe.${role}`, value)).toBe(
      output
    );
  });

  it.each([
    ['scale', '0.98px'],
    ['scale', '0.98'],
    ['opacity', '0.8px'],
    ['zIndex', '1'],
    ['zIndex', 1.5],
    ['opacity', 1.1],
    ['scale', -0.1],
    ['duration', -1],
    ['duration', '150px'],
    ['easing', 'not-an-easing'],
    ['width', Number.NaN],
    ['width', Number.POSITIVE_INFINITY],
    ['springResponse', 0.7],
  ])('reports an invalid %s value with exact token identity', (role, value) => {
    const report = audit({ [role]: value });
    expect(report.checked).toBe(1);
    expect(report.findings).toHaveLength(1);
    expect(report.findings[0]).toMatchObject({
      ruleId: 'tokens.value-kind',
      code: 'invalid-token-value',
      severity: 'error',
      tokenPath: `components.probe.${role}`,
      sourcePath: 'fixture.ts',
      theme: 'dark',
      platform: 'web',
      layer: 'component',
      line: null,
      column: null,
    });
    expect(report.findings[0].evidence.length).toBeGreaterThan(0);
  });

  it('keeps valid intents atomic rather than serializing their metadata', () => {
    const report = audit({
      shadow: { kind: 'shadow', role: 'elevation', level: 'lg' },
      maxHeight: { kind: 'viewport-height', ratio: 0.9 },
    });
    expect(report.checked).toBe(2);
    expect(report.findings).toEqual([]);
  });

  it.each([
    { kind: 'shadow', role: 'elevation', level: 'unknown' },
    { kind: 'shadow', role: 'elevation', level: 'lg', web: 'none' },
    { kind: 'viewport-height', ratio: 2 },
    { kind: 'unregistered-kind', value: 'anything' },
  ])('rejects malformed and unknown tagged values: %j', (intent) => {
    expect(audit({ shadow: intent }).findings[0]).toMatchObject({
      code: 'invalid-token-intent',
      tokenPath: 'components.probe.shadow',
    });
  });

  it.each([null, undefined, true, () => 1])(
    'rejects unsupported leaves without an empty pass: %s',
    (value) => {
      expect(audit({ width: value }).findings[0].code).toBe(
        'unsupported-token-value'
      );
    }
  );

  it('visits every invalid leaf without rewriting the input', () => {
    const value = Object.freeze({
      motion: Object.freeze({ scale: '0.98px', opacity: '0.5px' }),
      geometry: Object.freeze({ width: 44 }),
    });
    const before = JSON.stringify(value);
    const report = audit(value);
    expect(report.checked).toBe(3);
    expect(report.findings).toHaveLength(2);
    expect(JSON.stringify(value)).toBe(before);
  });

  it('visits array entries and shared objects at every token path', () => {
    const shared = { opacity: 0.8 };
    const report = audit({ items: [shared, shared, { opacity: '1px' }] });
    expect(report.checked).toBe(3);
    expect(report.findings.map((finding) => finding.tokenPath)).toEqual([
      'components.probe.items.2.opacity',
    ]);
  });

  it('reports cycles without recursing forever', () => {
    const value: Record<string, unknown> = { width: 44 };
    value.self = value;
    expect(audit(value).findings[0]).toMatchObject({
      code: 'cyclic-token-value',
      tokenPath: 'components.probe.self',
    });
  });

  it('rejects empty inventories and exposes empty branches', () => {
    expect(() => audit({})).toThrow(/non-empty/);
    expect(() => audit([])).toThrow(/non-empty/);
    expect(audit({ geometry: {} }).findings[0].code).toBe('empty-token-branch');
    expect(audit({ geometry: [] }).findings[0].code).toBe('empty-token-branch');
  });

  it('does not claim full string grammar or emitted CSS coverage', () => {
    expect(audit({ width: 44 }).coverage).toBe('partial');
  });
});
