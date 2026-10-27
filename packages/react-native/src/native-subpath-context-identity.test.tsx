import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

// Intentionally import the actual independently built JavaScript entries.
// Run only after the canonical build and build:subpaths:probe.
import * as root from '../dist/index.js';
import * as button from '../dist/button.js';
import * as theme from '../dist/theme.js';

function Probe({ useTheme, label }: {
  useTheme: typeof theme.useTheme;
  label: string;
}) {
  const current = useTheme();
  return createElement('span', { 'data-probe': label }, current.themeName);
}

describe('unpublished native subpath React context identity (#1906)', () => {
  it('root hook reads a dark theme supplied by subpath provider', () => {
    const result = renderToStaticMarkup(
      createElement(theme.ThemeProvider, { theme: 'dark' },
        createElement(Probe, { label: 'root', useTheme: root.useTheme }))
    );
    expect(result).toContain('data-probe="root">dark</span>');
  });

  it('subpath hook reads a dark theme supplied by root provider', () => {
    const result = renderToStaticMarkup(
      createElement(root.ThemeProvider, { theme: 'dark' },
        createElement(Probe, { label: 'subpath', useTheme: theme.useTheme }))
    );
    expect(result).toContain('data-probe="subpath">dark</span>');
  });

  it('both Button entrypoints remain exported for a mixed consumer', () => {
    expect(typeof root.Button).toBe('function');
    expect(typeof button.Button).toBe('function');
  });
});
