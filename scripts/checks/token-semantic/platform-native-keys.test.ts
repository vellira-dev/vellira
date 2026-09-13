import { describe, expect, it } from 'vitest';

import { auditComponentPlatformBoundary } from './platform-boundary';

describe('canonical native-key boundary', () => {
  it.each(['nativeWidth', 'nativeShadow', 'nativeOffset', 'reactNativeStyle'])(
    'rejects %s without adding a one-off key exception',
    (key) => {
      const report = auditComponentPlatformBoundary(
        { probe: { nested: { [key]: 12 } } },
        'dark',
        'fixture.ts'
      );
      expect(report.findings).toHaveLength(1);
      expect(report.findings[0]).toMatchObject({
        ruleId: 'tokens.platform-boundary',
        severity: 'error',
        tokenPath: `components.probe.nested.${key}`,
        theme: 'dark',
      });
    }
  );

  it('preserves neutral geometry and explicit platform intents', () => {
    const report = auditComponentPlatformBoundary(
      {
        probe: {
          width: 12,
          shadow: { kind: 'shadow', role: 'elevation', level: 'md' },
        },
      },
      'dark',
      'fixture.ts'
    );
    expect(report.findings).toEqual([]);
  });
});
