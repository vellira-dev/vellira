import { describe, expect, it } from 'vitest';

import {
  auditComponentPlatformBoundary,
  checkTokenPlatformBoundary,
} from './platform-boundary';

function audit(components: unknown) {
  return auditComponentPlatformBoundary(components, 'light', 'fixture.ts');
}

describe('platform boundary audit adapter', () => {
  it('checks all maintained themes through the shared authority', () => {
    const report = checkTokenPlatformBoundary();
    expect(report.checked).toBeGreaterThan(0);
    expect(report.findings).toEqual([]);
    expect(report.coverage).toBe('partial');
  });

  it('accepts renderer-neutral geometry and atomic intents', () => {
    const report = audit({
      probe: {
        width: 44,
        shadow: { kind: 'shadow', role: 'elevation', level: 'lg' },
        maxHeight: { kind: 'viewport-height', ratio: 0.9 },
      },
    });
    expect(report.findings).toEqual([]);
    expect(report.checked).toBe(1);
  });

  it.each(['web', 'native', 'reactNative', 'nativeMaxHeight'])(
    'retains source and token identity for forbidden %s keys',
    (key) => {
      const report = audit({ probe: { [key]: 42 } });
      expect(report.findings).toHaveLength(1);
      expect(report.findings[0]).toMatchObject({
        ruleId: 'tokens.platform-boundary',
        severity: 'error',
        tokenPath: `components.probe.${key}`,
        sourcePath: 'fixture.ts',
        theme: 'light',
        layer: 'component',
      });
    }
  );

  it('does not let malformed intents hide renderer keys', () => {
    const report = audit({
      probe: {
        shadow: {
          kind: 'shadow',
          role: 'elevation',
          level: 'lg',
          native: {},
        },
      },
    });
    expect(report.findings[0].tokenPath).toBe('components.probe.shadow.native');
  });

  it('detects renderer-specific shadows inside arrays', () => {
    const report = audit({ probe: [{ shadow: '0 0 8px black' }] });
    expect(report.findings[0].tokenPath).toBe('components.probe.0.shadow');
  });

  it('rejects empty inventories instead of claiming a clean scan', () => {
    expect(() => audit({})).toThrow(/non-empty/);
    expect(() => audit([])).toThrow(/non-empty/);
  });
});
