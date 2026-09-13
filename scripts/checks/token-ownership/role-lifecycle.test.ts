import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { semanticTokenLifecycle } from '@vellira-ui/metadata';
import { afterEach, describe, expect, it } from 'vitest';

import { checkTokenOwnership } from './checker';
import {
  copyTokenLifecycleFixture,
  mutateTokenLifecycleFixture,
} from '../../token-lifecycle/fixtures/lifecycle';

const themes = ['light', 'dark', 'highContrast'] as const;
const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

function fixture() {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), 'vellira-ownership-role-lifecycle-')
  );
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

  for (const lifecycle of Object.values(semanticTokenLifecycle)) {
    for (const evidence of lifecycle.consumerEvidence) {
      if (evidence.startsWith('components.')) continue;
      const target = path.join(root, evidence);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.copyFileSync(path.join(process.cwd(), evidence), target);
    }
  }

  return root;
}

function addSemanticRole(
  root: string,
  theme: (typeof themes)[number],
  namespace: string,
  role = 'unclassifiedProbe'
) {
  const file = path.join(
    root,
    `packages/tokens/src/${theme}/semantic/${namespace}.ts`
  );
  const source = fs.readFileSync(file, 'utf8');
  const suffix = '} as const;';
  expect(source.endsWith(`${suffix}\n`) || source.endsWith(suffix)).toBe(true);
  const offset = source.lastIndexOf(suffix);
  fs.writeFileSync(
    file,
    `${source.slice(0, offset)}  ${role}: '#fff',\n${source.slice(offset)}`
  );
}

describe('token ownership metadata parity', () => {
  it('rejects metadata-backed token ownership disappearing from current lifecycle', () => {
    const root = fixture();
    mutateTokenLifecycleFixture(root, ({ components }) => {
      components.Button.status = 'deprecated';
    });

    expect(checkTokenOwnership(root).findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'missing-current-component-token-family',
        }),
      ])
    );
  });
});

describe('semantic role lifecycle coverage', () => {
  it('keeps the maintained semantic role baseline classified and theme-aligned', () => {
    const report = checkTokenOwnership(process.cwd());

    expect(report.semanticRolePaths.length).toBeGreaterThan(0);
    expect(report.findings).toEqual([]);
  });

  it('rejects an unclassified role even when every theme adds the same shape', () => {
    const root = fixture();
    for (const theme of themes) addSemanticRole(root, theme, 'surface');

    const report = checkTokenOwnership(root);
    expect(
      report.findings.filter(
        (finding) => finding.code === 'unclassified-semantic-role'
      )
    ).toHaveLength(3);
    expect(
      report.findings.some(
        (finding) => finding.code === 'theme-semantic-role-drift'
      )
    ).toBe(false);
  });

  it('rejects role shape drift isolated to one theme', () => {
    const root = fixture();
    addSemanticRole(root, 'dark', 'surface');

    expect(checkTokenOwnership(root).findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'unclassified-semantic-role' }),
        expect.objectContaining({ code: 'theme-semantic-role-drift' }),
      ])
    );
  });

  it('rejects a non-public tombstone being materialized without a barrel export', () => {
    const root = fixture();
    for (const theme of themes) {
      const file = path.join(
        root,
        `packages/tokens/src/${theme}/semantic/navigation.ts`
      );
      fs.writeFileSync(
        file,
        "export const navigation = { item: '#fff' } as const;\n"
      );
    }

    expect(
      checkTokenOwnership(root).findings.filter(
        (finding) =>
          finding.code === 'nonpublic-semantic-namespace-materialized'
      )
    ).toHaveLength(3);
  });

  it('rejects lifecycle authority classes that contradict current/deprecated status', () => {
    const root = fixture();
    mutateTokenLifecycleFixture(root, ({ semantics }) => {
      semantics.surface.authority = 'compatibility';
      semantics.divider.authority = 'shared-lower-level';
    });

    expect(checkTokenOwnership(root).findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'invalid-current-semantic-lifecycle' }),
        expect.objectContaining({
          code: 'invalid-deprecated-semantic-authority',
        }),
      ])
    );
  });
});
