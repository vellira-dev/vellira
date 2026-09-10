import { describe, expect, it } from 'vitest';

import { auditCssReferences } from './css-references';

const variables = new Set(['--surface-canvas', '--select-option-bg']);

function scan(expression: string) {
  return auditCssReferences(
    'packages/probe/style.scss',
    `.a { color: var(${expression}); }`,
    variables
  );
}

describe('dynamic CSS token-reference classification', () => {
  it.each([
    '--select-#{$color}-bg',
    '#{$name}',
    '--select-#{map.get($palette, $intent)}-bg',
    String.raw`--select-\62 g`,
    '--select-option-bg#{$suffix}',
  ])('never treats the prefix of %s as a missing static token', (name) => {
    expect(scan(name)).toHaveLength(1);
    expect(scan(name)[0]).toMatchObject({
      code: 'unresolved-css-variable-expression',
      severity: 'warning',
      tokenPath: name,
    });
  });

  it('still detects missing static tokens inside dynamic fallbacks', () => {
    const findings = scan('--select-#{$color}, var(--surface-absent)');
    expect(findings).toHaveLength(2);
    expect(findings[1]).toMatchObject({
      code: 'missing-token-variable',
      tokenPath: '--surface-absent',
      severity: 'error',
    });
  });
});
