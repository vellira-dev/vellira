import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { beforeAll, describe, expect, it } from 'vitest';

// Intentionally import the actual independently built JavaScript entries.
// Run only after the canonical build and build:subpaths:probe.
let root;
let button;
let theme;

function Probe({ useTheme, label }) {
  const current = useTheme();
  return createElement('span', { 'data-probe': label }, current.themeName);
}

const optIn = process.env.VELLIRA_SUBPATH_RUNTIME_PROOF === '1';
(optIn ? describe : describe.skip)(
  'unpublished native subpath React context identity (#1906)',
  () => {
    beforeAll(async () => {
      const entryDir = process.env.VELLIRA_SHARED_CHUNK_PROOF === '1'
        ? '../../dist/shared-proof'
        : '../../dist';
      // This test uses one selected set of physically built entry points.
      const load = (name) =>
        import(/* @vite-ignore */ `${entryDir}/${name}.js`);
      root = await load('index');
      button = await load('button');
      theme = await load('theme');
    });
    it('root provider and root hook share one context (control)', () => {
      const result = renderToStaticMarkup(
        createElement(
          root.ThemeProvider,
          { theme: 'dark' },
          createElement(Probe, {
            label: 'root-control',
            useTheme: root.useTheme,
          })
        )
      );
      expect(result).toContain('data-probe="root-control">dark</span>');
    });

    it('subpath provider and subpath hook share one context (control)', () => {
      const result = renderToStaticMarkup(
        createElement(
          theme.ThemeProvider,
          { theme: 'dark' },
          createElement(Probe, {
            label: 'subpath-control',
            useTheme: theme.useTheme,
          })
        )
      );
      expect(result).toContain('data-probe="subpath-control">dark</span>');
    });

    it('root hook reads a dark theme supplied by subpath provider', () => {
      const result = renderToStaticMarkup(
        createElement(
          theme.ThemeProvider,
          { theme: 'dark' },
          createElement(Probe, { label: 'root', useTheme: root.useTheme })
        )
      );
      expect(result).toContain('data-probe="root">dark</span>');
    });

    it('subpath hook reads a dark theme supplied by root provider', () => {
      const result = renderToStaticMarkup(
        createElement(
          root.ThemeProvider,
          { theme: 'dark' },
          createElement(Probe, { label: 'subpath', useTheme: theme.useTheme })
        )
      );
      expect(result).toContain('data-probe="subpath">dark</span>');
    });

    it('both Button entrypoints remain exported for a mixed consumer', () => {
      expect(typeof root.Button).toBe('function');
      expect(typeof button.Button).toBe('function');
    });
  }
);
