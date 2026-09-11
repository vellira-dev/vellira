import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { checkTokenCssReferences } from './css-repository';

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

function fixture(cssVariables: readonly string[]) {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), 'vellira-css-provider-audit-')
  );
  roots.push(root);

  function write(file: string, content: string) {
    const target = path.join(root, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
  }

  write(
    'packages/tokens/src/generated/token-types.ts',
    `export const cssVariableNames = ${JSON.stringify(cssVariables)} as const;\n`
  );
  write('apps/probe/valid.css', '.valid { color: var(--surface-canvas); }');

  return { root, write };
}

describe('CSS provider resolution boundaries', () => {
  it('accepts literal runtime providers from the same CSS-module basename', () => {
    const { root, write } = fixture(['--surface-canvas', '--action-primary']);
    write(
      'apps/website/src/SiteHeader/SiteHeader.module.css',
      '.icon { mask: var(--action-icon); width: var(--action-icon-size); }'
    );
    write(
      'apps/website/src/SiteHeader/SiteHeader.tsx',
      "const style = { '--action-icon': 'url(icon.svg)', '--action-icon-size': '20px' };\n"
    );

    expect(checkTokenCssReferences(root).findings).toEqual([]);
  });

  it('does not let a different sibling source file provide a CSS module variable', () => {
    const { root, write } = fixture(['--surface-canvas', '--action-primary']);
    write(
      'apps/website/src/SiteHeader/SiteHeader.module.css',
      '.icon { mask: var(--action-icon); }'
    );
    write(
      'apps/website/src/SiteHeader/Other.tsx',
      "const style = { '--action-icon': 'url(icon.svg)' };\n"
    );

    expect(checkTokenCssReferences(root).findings).toEqual([
      expect.objectContaining({
        code: 'missing-token-variable',
        sourcePath: 'apps/website/src/SiteHeader/SiteHeader.module.css',
        tokenPath: '--action-icon',
      }),
    ]);
  });

  it('downgrades an unproven same-family CSS provider to a warning', () => {
    const { root, write } = fixture([
      '--surface-canvas',
      '--dropdown-primary-content-border',
    ]);
    write(
      'packages/react/src/components/Dropdown/Content/DropdownContent.module.scss',
      '.content { --dropdown-content-current-border: var(--dropdown-primary-content-border); }'
    );
    write(
      'packages/react/src/components/Dropdown/Item/DropdownItem.module.scss',
      '.item { border-color: var(--dropdown-content-current-border); }'
    );

    expect(checkTokenCssReferences(root).findings).toEqual([
      expect.objectContaining({
        code: 'unproven-provider-boundary',
        severity: 'warning',
        sourcePath:
          'packages/react/src/components/Dropdown/Item/DropdownItem.module.scss',
        tokenPath: '--dropdown-content-current-border',
      }),
    ]);
  });

  it('does not expose a family provider to another component family', () => {
    const { root, write } = fixture([
      '--surface-canvas',
      '--dropdown-primary-content-border',
    ]);
    write(
      'packages/react/src/components/Dropdown/Content/DropdownContent.module.scss',
      '.content { --dropdown-content-current-border: var(--dropdown-primary-content-border); }'
    );
    write(
      'packages/react/src/components/Other/Other.module.scss',
      '.other { border-color: var(--dropdown-content-current-border); }'
    );

    expect(checkTokenCssReferences(root).findings).toEqual([
      expect.objectContaining({
        code: 'missing-token-variable',
        sourcePath: 'packages/react/src/components/Other/Other.module.scss',
        tokenPath: '--dropdown-content-current-border',
      }),
    ]);
  });
});
