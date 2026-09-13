import { readFileSync } from 'node:fs';

import {
  cssVariableNames,
  darkTheme,
  highContrastTheme,
  lightTheme,
} from '../../../packages/tokens/src/index';
import postcss from 'postcss';
import { describe, expect, it } from 'vitest';

import { checkStyleFile } from './checker';

const authorities = {
  canonicalIcons: new Set<string>(),
  canonicalCssVariables: new Set<string>(cssVariableNames),
};
const managerPath = 'apps/react-storybook/.storybook/manager.css';
const cssFiles = [
  managerPath,
  'apps/website/src/component-catalog/shared/ComponentsCatalog/ComponentsCatalog.module.css',
  'apps/website/src/sections/home/FinalCta/FinalCta.module.css',
  'apps/website/src/sections/home/Pro/Pro.module.css',
];

describe('remaining first-party visual resources', () => {
  it.each(cssFiles)(
    'uses registered resources in %s and detects regressed literals',
    (file) => {
      const source = readFileSync(file, 'utf8');
      expect(checkStyleFile(file, source, authorities)).toEqual([]);
      const regressed = source.replace(
        /color: var\(--text-[a-z0-9-]+\)/,
        'color: #123456'
      );
      expect(regressed).not.toBe(source);
      expect(checkStyleFile(file, regressed, authorities)).toEqual([
        expect.objectContaining({
          ruleId: 'vellira-ui.noncanonical-token-value',
          detected: '#123456',
        }),
      ]);
    }
  );

  it('assigns toolbar foreground, hover surface and focus to their semantic roles', () => {
    const values = new Map<string, string>();
    postcss.parse(readFileSync(managerPath, 'utf8')).walkRules((rule) => {
      rule.walkDecls((declaration) => {
        values.set(`${rule.selector}/${declaration.prop}`, declaration.value);
      });
    });
    expect(values.get('.velliraToolbarLink/color')).toBe(
      'var(--text-secondary)'
    );
    expect(values.get('.velliraToolbarLink:hover/color')).toBe(
      'var(--text-primary)'
    );
    expect(values.get('.velliraToolbarLink:hover/background')).toBe(
      'var(--surface-hover)'
    );
    expect(values.get('.velliraToolbarLink:focus-visible/outline')).toBe(
      '2px solid var(--focus-ring-color)'
    );
  });

  it('preserves page-owned shadow geometry and opacity without inventing effect tokens', () => {
    const expected = new Map([
      ['.card:hover', ['0 2px 4px', '0 10px 24px', '0 20px 40px']],
      ['.commandCapsule', ['0 18px 50px', '0 4px 14px']],
      ['.commandCapsule:hover', ['0 18px 56px', '0 18px 50px', '0 4px 14px']],
      ['.proDirections > article', ['0 12px 28px']],
      ['.proDirections > article:hover', ['0 18px 38px']],
    ]);
    for (const file of cssFiles.slice(1)) {
      postcss.parse(readFileSync(file, 'utf8')).walkRules((rule) => {
        const geometry = expected.get(rule.selector);
        if (!geometry) return;
        const shadow = rule.nodes.find(
          (node) => node.type === 'decl' && node.prop === 'box-shadow'
        );
        expect(shadow?.type).toBe('decl');
        if (shadow?.type !== 'decl') throw new Error('Missing shadow');
        expect(shadow.value.match(/\b0 \d+px \d+px\b/g)).toEqual(geometry);
        expect(shadow.value).not.toMatch(/var\(--(?:text|surface)-/);
        expected.delete(rule.selector);
      });
    }
    expect([...expected.keys()]).toEqual([]);
    // Physical black shadow pigment is theme-independent. The existing complete
    // semantic effects cannot substitute for these custom layers' geometry.
    for (const theme of [lightTheme, darkTheme, highContrastTheme]) {
      expect(theme.colors.mono[950]).toBe('#000000');
    }
  });

  it('continues reporting missing canonical token names', () => {
    expect(
      checkStyleFile(
        managerPath,
        '.link { color: var(--text-invented); }',
        authorities
      )
    ).toEqual([
      expect.objectContaining({ ruleId: 'vellira-ui.missing-token-resource' }),
    ]);
  });
});
