import { describe, expect, it } from 'vitest';

import { auditCssReferences } from './css-references';
import { createScssVariableExpressionResolver } from './css-sass-expression';

const variables = new Set(['--surface-canvas', '--select-option-bg']);

function scan(expression: string) {
  return auditCssReferences(
    'packages/probe/style.scss',
    `.a { color: var(${expression}); }`,
    variables
  );
}

function scanScss(source: string, canonicalVariables: readonly string[]) {
  const sourcePath = 'packages/react/src/components/Probe/Probe.module.scss';
  return auditCssReferences(
    sourcePath,
    source,
    new Set(canonicalVariables),
    new Set(),
    new Set(),
    createScssVariableExpressionResolver(sourcePath, source)
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

  it('expands nested @each variables only inside their lexical scopes', () => {
    const source = `
$colors: primary, danger;
$variants: outline, soft;
@each $color in $colors {
  @each $variant in $variants {
    .#{$color}.#{$variant} {
      color: var(--select-#{$color}-#{$variant}-bg);
    }
  }
}
`;
    expect(
      scanScss(source, [
        '--select-primary-outline-bg',
        '--select-primary-soft-bg',
        '--select-danger-outline-bg',
        '--select-danger-soft-bg',
      ])
    ).toEqual([]);
  });

  it('reports a concrete missing token when one bounded expansion is absent', () => {
    const source = `
@each $color in primary, danger {
  .#{$color} { color: var(--select-#{$color}-bg); }
}
`;
    expect(scanScss(source, ['--select-primary-bg'])).toEqual([
      expect.objectContaining({
        code: 'missing-expanded-token-variable',
        severity: 'error',
        tokenPath: '--select-#{$color}-bg',
        evidence: expect.stringContaining('--select-danger-bg'),
      }),
    ]);
  });

  it('derives mixin parameter domains from literal and lexical include arguments', () => {
    const source = `
$colors: primary, danger;
@mixin tabs-color-vars($color) {
  color: var(--tabs-#{$color}-trigger-fg);
}
.base { @include tabs-color-vars(primary); }
@each $color in $colors {
  .#{$color} { @include tabs-color-vars($color); }
}
`;
    expect(
      scanScss(source, [
        '--tabs-primary-trigger-fg',
        '--tabs-danger-trigger-fg',
      ])
    ).toEqual([]);
  });

  it('uses actual mixin call arguments instead of unrelated same-name loops', () => {
    const source = `
@mixin option-state($color) {
  color: var(--select-#{$color}-option-bg);
}
.success { @include option-state(success); }
@each $color in primary, neutral {
  .unrelated-#{$color} { color: var(--surface-canvas); }
}
`;
    expect(
      scanScss(source, ['--surface-canvas', '--select-success-option-bg'])
    ).toEqual([]);
  });

  it('keeps unsupported Sass expressions visible instead of guessing', () => {
    const source = `
$palette: (primary: blue);
.a { color: var(--select-#{map.get($palette, primary)}-bg); }
`;
    expect(scanScss(source, ['--select-primary-bg'])).toEqual([
      expect.objectContaining({
        code: 'unresolved-css-variable-expression',
        severity: 'warning',
      }),
    ]);
  });
});
