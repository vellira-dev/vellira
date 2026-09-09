import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import { afterEach, describe, expect, it } from 'vitest';

import {
  componentTokenLifecycle,
  semanticTokenLifecycle,
} from '@vellira-ui/metadata';

import { checkTokenOwnership } from './checker';
import {
  copyTokenLifecycleFixture,
  mutateTokenLifecycleFixture,
} from '../../token-lifecycle/fixtures/lifecycle';
import { readTokenLifecycleAuthority } from '../../token-lifecycle/authority';

const toComponentFamily = (componentName: string) =>
  `${componentName[0]?.toLowerCase() ?? ''}${componentName.slice(1)}`;

describe('token ownership checker', () => {
  it('keeps the checked-in token authority baseline free of ownership drift', () => {
    const report = checkTokenOwnership(process.cwd());

    expect(report.schemaVersion).toBe(1);
    expect(report.findings).toEqual([]);
  });

  it('reports exactly the lifecycle entries that remain public', () => {
    const report = checkTokenOwnership(process.cwd());
    const expectedComponentFamilies = Object.entries(componentTokenLifecycle)
      .filter(([, lifecycle]) => lifecycle.public)
      .map(([name]) => toComponentFamily(name))
      .sort();
    const expectedSemanticNamespaces = Object.entries(semanticTokenLifecycle)
      .filter(([, lifecycle]) => lifecycle.public)
      .map(([name]) => name)
      .sort();

    expect(report.componentFamilies).toEqual(expectedComponentFamilies);
    expect(report.semanticNamespaces).toEqual(expectedSemanticNamespaces);
  });

  it('keeps ContextMenu compatibility explicit and navigation tombstoned', () => {
    expect(componentTokenLifecycle.ContextMenu).toMatchObject({
      status: 'deprecated',
      public: true,
      owner: 'token-compatibility',
    });
    expect(semanticTokenLifecycle.navigation).toMatchObject({
      status: 'deprecated',
      public: false,
      authority: 'compatibility',
      owner: 'removed-semantic-tombstone',
    });

    const report = checkTokenOwnership(process.cwd());
    expect(report.componentFamilies).toContain('contextMenu');
    expect(report.semanticNamespaces).not.toContain('navigation');
  });
});

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0))
    fs.rmSync(root, { recursive: true, force: true });
});
const themes = ['light', 'dark', 'highContrast'] as const;
function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vellira-ownership-'));
  roots.push(root);
  copyTokenLifecycleFixture(root);
  for (const theme of themes) {
    for (const group of ['components', 'semantic']) {
      const relative = `packages/tokens/src/${theme}/${group}`;
      fs.cpSync(path.join(process.cwd(), relative), path.join(root, relative), {
        recursive: true,
      });
    }
  }
  for (const entry of Object.values(semanticTokenLifecycle)) {
    for (const evidence of entry.consumerEvidence) {
      if (evidence.startsWith('components.')) continue;
      const target = path.join(root, evidence);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.copyFileSync(path.join(process.cwd(), evidence), target);
    }
  }
  return root;
}

function changeBarrel(
  root: string,
  theme: string,
  group: string,
  change: (source: string) => string
) {
  const file = path.join(
    root,
    `packages/tokens/src/${theme}/${group}/index.ts`
  );
  fs.writeFileSync(file, change(fs.readFileSync(file, 'utf8')));
}

describe('token ownership mutations', () => {
  it('reads exactly the canonical source authority used by metadata exports', () => {
    const authority = readTokenLifecycleAuthority(process.cwd());
    expect(authority.components).toEqual(componentTokenLifecycle);
    expect(authority.semantics).toEqual(semanticTokenLifecycle);
  });

  it.each(themes)(
    'rejects unclassified component and semantic exports in %s, including multiline aliases',
    (theme) => {
      const root = fixture();
      expect(checkTokenOwnership(root).findings).toEqual([]);
      for (const group of ['components', 'semantic']) {
        changeBarrel(
          root,
          theme,
          group,
          (source) =>
            source +
            "export {\n  future as unknownFuture, anotherFuture\n} from './future.js';\n"
        );
      }
      const report = checkTokenOwnership(root);
      expect(report.findings).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: 'unclassified-component-family',
            path: `packages/tokens/src/${theme}/components/index.ts`,
          }),
          expect.objectContaining({
            code: 'unclassified-semantic-namespace',
            path: `packages/tokens/src/${theme}/semantic/index.ts`,
          }),
          expect.objectContaining({ code: 'theme-component-family-drift' }),
          expect.objectContaining({ code: 'theme-semantic-namespace-drift' }),
        ])
      );
      expect(checkTokenOwnership(root)).toEqual(report);
    }
  );

  it.each(themes)(
    'rejects lifecycle-public families missing from %s',
    (theme) => {
      const root = fixture();
      changeBarrel(root, theme, 'components', (source) =>
        source.replace(/^export.*button.*\n/m, '')
      );
      changeBarrel(root, theme, 'semantic', (source) =>
        source.replace(/^export.*surface.*\n/m, '')
      );
      expect(checkTokenOwnership(root).findings).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: 'missing-public-component-family',
            path: `packages/tokens/src/${theme}/components/index.ts`,
          }),
          expect.objectContaining({
            code: 'missing-public-semantic-namespace',
            path: `packages/tokens/src/${theme}/semantic/index.ts`,
          }),
        ])
      );
    }
  );

  it('rejects navigation returning even when every theme agrees', () => {
    const root = fixture();
    for (const theme of themes)
      changeBarrel(
        root,
        theme,
        'semantic',
        (source) => source + "export { navigation } from './navigation.js';\n"
      );
    const report = checkTokenOwnership(root);
    expect(
      report.findings.filter(
        (finding) => finding.code === 'unclassified-semantic-namespace'
      )
    ).toHaveLength(3);
    expect(
      report.findings.some(
        (finding) => finding.code === 'theme-semantic-namespace-drift'
      )
    ).toBe(false);
  });

  it('rejects current ownership without real metadata, mismatched owners, and non-public current families', () => {
    const root = fixture();
    mutateTokenLifecycleFixture(root, ({ components }) => {
      components.MissingMetadata = {
        ...components.Button,
        owner: 'MissingMetadata',
      };
      components.Button.owner = 'Checkbox';
      components.Input.public = false;
    });
    expect(checkTokenOwnership(root).findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'missing-component-metadata-owner' }),
        expect.objectContaining({ code: 'invalid-current-component-owner' }),
        expect.objectContaining({
          code: 'invalid-current-component-public-state',
        }),
      ])
    );
  });

  it('rejects absent, placeholder, and stale semantic consumer evidence', () => {
    const root = fixture();
    mutateTokenLifecycleFixture(root, ({ semantics }) => {
      semantics.border.consumerEvidence = [];
      semantics.control.consumerEvidence = ['public-semantic-contract'];
      semantics.icons.consumerEvidence = ['components.Button'];
    });
    const findings = checkTokenOwnership(root).findings;
    expect(
      findings.filter(
        (finding) => finding.code === 'missing-semantic-consumer-evidence'
      )
    ).toHaveLength(1);
    expect(
      findings.filter(
        (finding) => finding.code === 'invalid-semantic-consumer-evidence'
      )
    ).toHaveLength(2);
  });

  it('does not accept imports, comments, or string mentions as consuming references', () => {
    const root = fixture();
    const file = path.join(
      root,
      'packages/tokens/src/dark/components/input.ts'
    );
    fs.writeFileSync(
      file,
      "import { icons } from '../semantic/icons.js';\n// icons.brand\nconst example = 'icons.brand';\n"
    );
    expect(checkTokenOwnership(root).findings).toContainEqual(
      expect.objectContaining({
        code: 'invalid-semantic-consumer-evidence',
        message: expect.stringContaining('components.Input'),
      })
    );
  });

  it('keeps unused roles deprecated and records real action compatibility consumption', () => {
    for (const name of ['action', 'divider', 'skeleton'] as const)
      expect(semanticTokenLifecycle[name]).toMatchObject({
        status: 'deprecated',
        public: true,
        authority: 'compatibility',
      });
    expect(semanticTokenLifecycle.action.consumerEvidence).toContain(
      'apps/native-playground/App.tsx'
    );
  });

  it('uses nonzero exit status in strict mode and emits the same JSON in report mode', () => {
    const root = fixture();
    changeBarrel(
      root,
      'light',
      'semantic',
      (source) => source + "export { future } from './future.js';\n"
    );
    const cli = path.join(
      process.cwd(),
      'scripts/checks/token-ownership/cli.ts'
    );
    const run = (args: string[]) =>
      spawnSync(
        process.execPath,
        ['--import', import.meta.resolve('tsx'), cli, '--json', ...args],
        { cwd: root, encoding: 'utf8' }
      );
    const strict = run([]);
    const report = run(['--report']);
    expect(strict.stderr).toBe('');
    expect(report.stderr).toBe('');
    expect(strict.status).toBe(1);
    expect(report.status).toBe(0);
    expect(JSON.parse(strict.stdout)).toEqual(JSON.parse(report.stdout));
    expect(JSON.parse(strict.stdout).findings).toContainEqual(
      expect.objectContaining({ code: 'unclassified-semantic-namespace' })
    );
  });
});
