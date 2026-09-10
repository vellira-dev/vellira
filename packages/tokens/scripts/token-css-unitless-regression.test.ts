import { describe, expect, it } from 'vitest';

import { serializeCssTokenValue } from './token-css-output.js';

describe('unitless token string bypass prevention', () => {
  it.each(['0.98', '0.98px', '98%', '1e0', 'calc(1)', 'var(--scale)', ''])(
    'rejects string-backed scale %s',
    (value) => {
      expect(() =>
        serializeCssTokenValue('components.probe.motion.scale', value)
      ).toThrow(/stored as a string/);
    }
  );

  it.each([
    ['components.probe.motion.opacity', '0.5px'],
    ['components.probe.content.zIndex', '1px'],
    ['components.probe.shadow.elevation', '2px'],
  ])('rejects dimensional strings for %s', (tokenPath, value) => {
    expect(() => serializeCssTokenValue(tokenPath, value)).toThrow(
      /stored as a string/
    );
  });

  it('retains numeric scale and canonical length serialization', () => {
    expect(serializeCssTokenValue('components.probe.motion.scale', 0.98)).toBe(
      '0.98'
    );
    expect(serializeCssTokenValue('components.probe.geometry.width', 44)).toBe(
      '44px'
    );
    expect(
      serializeCssTokenValue('components.probe.content.maxHeight', '90vh')
    ).toBe('90vh');
  });
});
