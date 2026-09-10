import { describe, expect, it } from 'vitest';

import { auditCssReferences, maskCssNonCode } from './css-references';

const variables = new Set([
  '--surface-canvas',
  '--text-primary',
  '--button-height',
  '--popover-content-shadow-web',
]);

function scan(source: string, file = 'apps/probe/style.css') {
  return auditCssReferences(file, source, variables);
}

describe('token semantic CSS references', () => {
  it('accepts current variables and compatibility names', () => {
    const source =
      '.a { color: var(--text-primary); box-shadow: var(--popover-content-shadow-web); }';
    expect(scan(source)).toEqual([]);
  });

  it('rejects removed tokens even with fallbacks', () => {
    const findings = scan('.a { background: var(--surface-background, red); }');
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      code: 'missing-token-variable',
      severity: 'error',
      tokenPath: '--surface-background',
    });
  });

  it('reports multiple missing names, including nested fallbacks', () => {
    const findings = scan(
      '.a { color: var(--text-tertiary, var(--surface-missing)); }'
    );
    expect(findings.map((finding) => finding.tokenPath)).toEqual([
      '--text-tertiary',
      '--surface-missing',
    ]);
  });

  it('preserves locations across comments and quoted content', () => {
    const source =
      '/* var(--text-missing) */\n.a { content: "var(--text-missing)";\ncolor: var(--text-absent); }';
    const findings = scan(source);
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ line: 3, column: 12 });
    expect(maskCssNonCode(source, false).length).toBe(source.length);
  });

  it('allows comments between the var opener and its name', () => {
    const findings = scan('.a { color: var(/* reason */ --text-missing); }');
    expect(findings).toHaveLength(1);
  });

  it('handles escaped quotes in content', () => {
    expect(scan('.a { content: "a \\" var(--text-missing)"; }')).toEqual([]);
  });

  it('does not treat SCSS URL schemes as comments', () => {
    const source =
      '.a { background: url(https://example.test/a.png); color: var(--text-missing); }';
    expect(scan(source, 'apps/probe/style.scss')).toHaveLength(1);
  });

  it('matches CSS function names, not identifier suffixes', () => {
    expect(scan('.a { color: VAR(--text-missing); }')).toHaveLength(1);
    expect(scan('.a { value: custom-var(--text-missing); }')).toEqual([]);
  });

  it('ignores SCSS line comments', () => {
    const source =
      '// var(--text-missing)\n.a { color: var(--text-primary); }';
    expect(scan(source, 'apps/probe/style.scss')).toEqual([]);
  });

  it('accepts a non-token local declaration only in its own file', () => {
    expect(scan('.a { --local-gap: 4px; gap: var(--local-gap); }')).toEqual([]);
    const findings = scan(
      '.a { gap: var(--local-gap); }',
      'packages/probe/other.css'
    );
    expect(findings[0]).toMatchObject({
      code: 'unclassified-css-variable',
      severity: 'warning',
    });
  });

  it('does not whitelist token-prefixed local overrides', () => {
    const source =
      '.a { --surface-background: red; color: var(--surface-background); }';
    expect(scan(source)[0]).toMatchObject({
      code: 'token-namespace-local-override',
      severity: 'warning',
    });
  });

  it('retains unknown provider names for ownership review', () => {
    const findings = scan('.a { color: var(--thirdparty-foreground); }');
    expect(findings[0]).toMatchObject({
      code: 'unclassified-css-variable',
      severity: 'warning',
    });
  });

  it('fails closed on missing authority and malformed input', () => {
    expect(() => auditCssReferences('x.css', '', new Set())).toThrow(/empty/);
    expect(() => scan('/* missing end')).toThrow(/Unterminated CSS comment/);
    expect(() => scan('.a { content: "missing end; }')).toThrow(
      /Unterminated CSS string/
    );
  });
});
