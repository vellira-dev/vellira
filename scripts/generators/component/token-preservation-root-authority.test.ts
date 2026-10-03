import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../packages/tokens/src/preservation/token-migrations', () => {
  const reason =
    'Authorize a first-materialized canonical component-token leaf produced by Generator V2.';
  const suffixes = [
    'default.bg',
    'default.fg',
    'default.border',
    'hover.bg',
    'hover.fg',
    'hover.border',
    'pressed.bg',
    'pressed.fg',
    'pressed.border',
    'focusRing',
    'error.fg',
    'error.border',
    'error.ring',
    'disabled.bg',
    'disabled.fg',
    'disabled.border',
  ];

  return {
    tokenMigrationManifestV1: suffixes.map((suffix) => {
      const to = `components.evidenceProbe.${suffix}`;

      return {
        id: `1283-generator-v2-component-token-addition-${to.replaceAll(
          '.',
          '-'
        )}`,
        kind: 'addition',
        issue: '#1283',
        reason,
        to,
      };
    }),
  };
});

import {
  copyTokenLifecycleFixture,
  reserveTokenLifecycleFixture,
} from '../../token-lifecycle/fixtures/lifecycle';

import { createComponentGenerationPlan } from './plan';
import {
  getPlannedComponentTokenPreservationArtifacts,
  getTokenMigrationManifestFile,
} from './token-preservation-contract';

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe('Generator V2 root-scoped token preservation authority', () => {
  it('ignores generated additions inherited from the tooling checkout', () => {
    const root = fs.mkdtempSync(
      path.join(os.tmpdir(), 'vellira-token-root-authority-')
    );
    roots.push(root);

    copyTokenLifecycleFixture(root);
    reserveTokenLifecycleFixture(root, 'EvidenceProbe');

    const preservation = path.join(root, 'packages/tokens/src/preservation');
    fs.mkdirSync(preservation, { recursive: true });
    fs.copyFileSync(
      path.resolve(
        'packages/tokens/src/preservation/token-preservation-baseline.v1.json'
      ),
      path.join(preservation, 'token-preservation-baseline.v1.json')
    );
    fs.writeFileSync(
      path.join(preservation, 'token-migrations.ts'),
      'export const generatedComponentTokenAdditionMigrationsV1 = [] as const;\n'
    );
    fs.copyFileSync(
      path.resolve('packages/tokens/package.json'),
      path.join(root, 'packages/tokens/package.json')
    );

    const plan = createComponentGenerationPlan({
      root,
      options: {
        componentName: 'EvidenceProbe',
        platform: 'both',
        layer: 'components',
        category: 'feedback',
        profile: 'base',
        componentTokens: 'standard',
        workItem: {
          provider: 'github',
          repository: 'vellira-dev/vellira',
          issue: '#1283',
        },
        parts: [],
        force: false,
      },
    });

    expect(getPlannedComponentTokenPreservationArtifacts(plan)).toEqual([
      getTokenMigrationManifestFile(root),
    ]);
  });
});
