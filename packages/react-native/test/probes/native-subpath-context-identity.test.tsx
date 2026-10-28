import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeAll, describe, expect, it } from 'vitest';

import type * as NativeEntryModule from '../../src/index';

// Intentionally import the actual independently built JavaScript entries.
// Run only after the canonical build and build:subpaths:probe.
type NativeEntry = typeof NativeEntryModule;
let root: NativeEntry;
let button: Pick<NativeEntry, 'Button'>;
let theme: Pick<NativeEntry, 'ThemeProvider' | 'useTheme'>;

function Probe({
  useTheme,
  label,
}: {
  useTheme: NativeEntry['useTheme'];
  label: string;
}) {
  const current = useTheme();
  return createElement('span', { 'data-probe': label }, current.themeName);
}

const optIn = process.env.VELLIRA_SUBPATH_RUNTIME_PROOF === '1';
(optIn ? describe : describe.skip)(
  'unpublished native subpath React context identity (#1906)', () => {
  beforeAll(async () => {
    root = (await import('../../dist/index.js')) as NativeEntry;
    button = (await import('../../dist/button.js')) as Pick<NativeEntry, 'Button'>;
    theme = (await import('../../dist/theme.js')) as Pick<
      NativeEntry,
      'ThemeProvider' | 'useTheme'
    >;
  });
  it('root provider and root hook share one context (control)', () => {
    const result = renderToStaticMarkup(
      createElement(root.ThemeProvider, { theme: 'dark' },
        createElement(Probe, { label: 'root-control', useTheme: root.useTheme }))
    );
    expect(result).toContain('data-probe="root-control">dark</span>');
  });

  it('subpath provider and subpath hook share one context (control)', () => {
    const result = renderToStaticMarkup(
      createElement(theme.ThemeProvider, { theme: 'dark' },
        createElement(Probe, { label: 'subpath-control', useTheme: theme.useTheme }))
    );
    expect(result).toContain('data-probe="subpath-control">dark</span>');
  });

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
