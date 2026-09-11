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

  it('accepts a component-owned variable declared and consumed in the same stylesheet', () => {
    const { root, write } = fixture([
      '--surface-canvas',
      '--radio-primary-default-bg',
    ]);
    write(
      'packages/react/src/primitives/Radio/Radio.module.scss',
      '.root { --radio-selected-bg: var(--radio-primary-default-bg); background: var(--radio-selected-bg); }'
    );

    expect(checkTokenCssReferences(root).findings).toEqual([]);
  });

  it('keeps semantic-namespace local aliases visible for ownership review', () => {
    const { root, write } = fixture(['--surface-canvas']);
    write(
      'apps/website/src/Probe/Probe.module.css',
      '.probe { --surface-local: red; color: var(--surface-local); }'
    );

    expect(checkTokenCssReferences(root).findings).toEqual([
      expect.objectContaining({
        code: 'token-namespace-local-override',
        sourcePath: 'apps/website/src/Probe/Probe.module.css',
        tokenPath: '--surface-local',
      }),
    ]);
  });

  it('accepts website root-global variables only when the root layout imports their provider', () => {
    const { root, write } = fixture(['--surface-canvas']);
    write(
      'apps/website/src/styles/globals.css',
      ':root { --site-gutter: 24px; --site-header-height: 68px; }'
    );
    write(
      'apps/website/src/app/layout.tsx',
      "import '../styles/globals.css';\nexport default function Layout() { return null; }\n"
    );
    write(
      'apps/website/src/Probe/Probe.module.css',
      '.probe { padding: var(--site-gutter); min-height: var(--site-header-height); }'
    );

    expect(checkTokenCssReferences(root).findings).toEqual([]);
  });

  it('does not treat an unimported global stylesheet as an application-wide provider', () => {
    const { root, write } = fixture(['--surface-canvas']);
    write(
      'apps/website/src/styles/globals.css',
      ':root { --site-gutter: 24px; }'
    );
    write(
      'apps/website/src/app/layout.tsx',
      'export default function Layout() { return null; }\n'
    );
    write(
      'apps/website/src/Probe/Probe.module.css',
      '.probe { padding: var(--site-gutter); }'
    );

    expect(checkTokenCssReferences(root).findings).toEqual([
      expect.objectContaining({
        code: 'unclassified-css-variable',
        sourcePath: 'apps/website/src/Probe/Probe.module.css',
        tokenPath: '--site-gutter',
      }),
    ]);
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

  it('accepts a component provider only when its styled JSX ancestor renders the consumer', () => {
    const { root, write } = fixture([
      '--surface-canvas',
      '--dropdown-primary-content-border',
    ]);
    write(
      'packages/react/src/components/Dropdown/Content/DropdownContent.module.scss',
      '.content { --dropdown-content-current-border: var(--dropdown-primary-content-border); }'
    );
    write(
      'packages/react/src/components/Dropdown/Content/DropdownContent.tsx',
      "import { DropdownItemRow } from '../Item';\nimport styles from './DropdownContent.module.scss';\nexport const DropdownContent = () => { const contentClassName = styles.content; return <ul className={contentClassName}><DropdownItemRow /></ul>; };\n"
    );
    write(
      'packages/react/src/components/Dropdown/Item/index.ts',
      "export { DropdownItemRow } from './DropdownItem';\n"
    );
    write(
      'packages/react/src/components/Dropdown/Item/DropdownItem.tsx',
      "import styles from './DropdownItem.module.scss';\nexport const DropdownItemRow = () => <li className={styles.item} />;\n"
    );
    write(
      'packages/react/src/components/Dropdown/Item/DropdownItem.module.scss',
      '.item { border-color: var(--dropdown-content-current-border); }'
    );

    expect(checkTokenCssReferences(root).findings).toEqual([]);
  });

  it('does not prove inheritance when the imported child renders outside the provider-class ancestor', () => {
    const { root, write } = fixture([
      '--surface-canvas',
      '--dropdown-primary-content-border',
    ]);
    write(
      'packages/react/src/components/Dropdown/Content/DropdownContent.module.scss',
      '.content { --dropdown-content-current-border: var(--dropdown-primary-content-border); }'
    );
    write(
      'packages/react/src/components/Dropdown/Content/DropdownContent.tsx',
      "import { DropdownItemRow } from '../Item';\nimport styles from './DropdownContent.module.scss';\nexport const DropdownContent = () => <><ul className={styles.content} /><DropdownItemRow /></>;\n"
    );
    write(
      'packages/react/src/components/Dropdown/Item/index.ts',
      "export { DropdownItemRow } from './DropdownItem';\n"
    );
    write(
      'packages/react/src/components/Dropdown/Item/DropdownItem.tsx',
      "import styles from './DropdownItem.module.scss';\nexport const DropdownItemRow = () => <li className={styles.item} />;\n"
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
