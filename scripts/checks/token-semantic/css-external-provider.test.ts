import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { shikiProviderVariables } from './css-external-provider';

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

function fixture(ownerSource: string, withDependency = true) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vellira-shiki-provider-'));
  roots.push(root);

  function write(file: string, content: string) {
    const target = path.join(root, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
  }

  write(
    'apps/website/package.json',
    JSON.stringify({
      dependencies: withDependency ? { shiki: '^4.4.2' } : {},
    })
  );
  write('apps/website/src/blog/ui/BlogCodeBlock.tsx', ownerSource);

  return { root };
}

const validOwner = `
import { createHighlighter } from 'shiki';
const highlighter = createHighlighter({
  themes: ['github-light', 'github-dark', 'github-dark-high-contrast'],
  langs: ['typescript'],
});
async function render() {
  const instance = await highlighter;
  return instance.codeToHtml('const x = 1', {
    themes: {
      light: 'github-light',
      dark: 'github-dark',
      highContrast: 'github-dark-high-contrast',
    },
  });
}
`;

describe('external CSS provider ownership', () => {
  it('derives Shiki custom properties from configured codeToHtml theme aliases', () => {
    const { root } = fixture(validOwner);
    const source = `.shiki {
      color: var(--shiki-dark);
      background: var(--shiki-dark-bg);
      font-weight: var(--shiki-dark-font-weight);
      font-style: var(--shiki-dark-font-style);
      text-decoration: var(--shiki-dark-text-decoration);
      border-color: var(--shiki-highContrast);
    }`;

    expect(
      [
        ...shikiProviderVariables(
          root,
          'apps/website/src/styles/globals.css',
          source,
          new Map()
        ),
      ].sort()
    ).toEqual([
      '--shiki-dark',
      '--shiki-dark-bg',
      '--shiki-dark-font-style',
      '--shiki-dark-font-weight',
      '--shiki-dark-text-decoration',
      '--shiki-highContrast',
    ]);
  });

  it('does not infer Shiki ownership when the package dependency is absent', () => {
    const { root } = fixture(validOwner, false);
    expect(
      shikiProviderVariables(
        root,
        'apps/website/src/blog/ui/BlogCodeBlock.module.css',
        '.shiki { color: var(--shiki-dark); }',
        new Map()
      ).size
    ).toBe(0);
  });

  it('does not infer aliases that codeToHtml does not configure', () => {
    const { root } = fixture(`
      import { createHighlighter } from 'shiki';
      const highlighter = createHighlighter({ themes: ['github-dark'] });
      async function render() {
        const instance = await highlighter;
        return instance.codeToHtml('x', { themes: { dark: 'github-dark' } });
      }
    `);
    const variables = shikiProviderVariables(
      root,
      'apps/website/src/blog/ui/BlogCodeBlock.module.css',
      '.shiki { color: var(--shiki-highContrast); color: var(--shiki-dark); }',
      new Map()
    );

    expect([...variables]).toEqual(['--shiki-dark']);
  });

  it('does not expose Shiki variables to unrelated stylesheets', () => {
    const { root } = fixture(validOwner);
    expect(
      shikiProviderVariables(
        root,
        'apps/website/src/Probe/Probe.module.css',
        '.shiki { color: var(--shiki-dark); }',
        new Map()
      ).size
    ).toBe(0);
  });

  it('does not bless unknown Shiki variable suffixes', () => {
    const { root } = fixture(validOwner);
    expect(
      shikiProviderVariables(
        root,
        'apps/website/src/styles/globals.css',
        '.shiki { color: var(--shiki-dark-made-up); }',
        new Map()
      ).size
    ).toBe(0);
  });
});
