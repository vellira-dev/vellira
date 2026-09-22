import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  createTokenPreservationBaseline,
  verifyTokenPreservation,
} from '../../../packages/tokens/scripts/token-preservation';
import type { TokenMigrationEntry } from '../../../packages/tokens/src/preservation/token-migrations';
import {
  copyTokenLifecycleFixture,
  reserveTokenLifecycleFixture,
} from '../../token-lifecycle/fixtures/lifecycle';

import { getGeneratedComponentTokenLogicalPaths } from './component-token-logical-paths';
import { createComponentGenerationPlan } from './plan';
import {
  checkComponentTokenPreservationContract,
  createGeneratedComponentTokenAddition,
  getPlannedComponentTokenPreservationArtifacts,
  getTokenMigrationManifestFile,
  readGeneratedComponentTokenAdditions,
  synchronizeComponentTokenPreservationContract,
} from './token-preservation-contract';

const roots: string[] = [];
const workItem = {
  provider: 'github',
  repository: 'vellira-dev/vellira',
  issue: '#1283',
} as const;

function createRoot(): string {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), 'vellira-token-preservation-generator-')
  );
  roots.push(root);
  copyTokenLifecycleFixture(root);

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

  return root;
}

function createPlan(params: {
  root: string;
  componentName?: string;
  componentTokens?: 'standard' | 'boolean-control' | 'disclosure' | false;
  withWorkItem?: boolean;
}) {
  return createComponentGenerationPlan({
    root: params.root,
    options: {
      componentName: params.componentName ?? 'EvidenceProbe',
      platform: 'both',
      layer: 'components',
      category: 'feedback',
      profile: 'base',
      componentTokens: params.componentTokens ?? 'standard',
      ...(params.withWorkItem === false ? {} : { workItem }),
      parts: [],
      force: false,
    },
  });
}

afterEach(() => {
  for (const root of roots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe('Generator V2 token-preservation contract', () => {
  it('writes one governed addition for every logical leaf and reruns idempotently', async () => {
    const root = createRoot();
    reserveTokenLifecycleFixture(root, 'EvidenceProbe');
    const plan = createPlan({ root });
    const manifestFile = getTokenMigrationManifestFile(root);
    const result = { updatedFiles: [] as string[] };

    await synchronizeComponentTokenPreservationContract({ plan, result });

    const expectedPaths = getGeneratedComponentTokenLogicalPaths({
      componentName: 'EvidenceProbe',
      componentTokens: 'standard',
    });
    const entries = readGeneratedComponentTokenAdditions(root);

    expect(entries).toHaveLength(expectedPaths.length);
    expect(entries.map((entry) => entry.to)).toEqual(expectedPaths);
    expect(entries.every((entry) => entry.issue === '#1283')).toBe(true);
    expect(entries.every((entry) => entry.kind === 'addition')).toBe(true);
    expect(new Set(entries.map((entry) => entry.id)).size).toBe(entries.length);
    expect(result.updatedFiles).toEqual([manifestFile]);

    const firstSource = fs.readFileSync(manifestFile, 'utf8');
    const rerun = { updatedFiles: [] as string[] };
    await synchronizeComponentTokenPreservationContract({
      plan,
      result: rerun,
    });

    expect(rerun.updatedFiles).toEqual([]);
    expect(fs.readFileSync(manifestFile, 'utf8')).toBe(firstSource);
    expect(readGeneratedComponentTokenAdditions(root)).toEqual(entries);
  });

  it('reports dry-run and check drift without mutating the manifest', () => {
    const root = createRoot();
    reserveTokenLifecycleFixture(root, 'EvidenceProbe');
    const plan = createPlan({ root });
    const manifestFile = getTokenMigrationManifestFile(root);
    const before = fs.readFileSync(manifestFile, 'utf8');

    expect(getPlannedComponentTokenPreservationArtifacts(plan)).toEqual([
      manifestFile,
    ]);
    expect(checkComponentTokenPreservationContract(plan)).toEqual([
      'packages/tokens/src/preservation/token-migrations.ts',
    ]);
    expect(fs.readFileSync(manifestFile, 'utf8')).toBe(before);
  });

  it('fails closed without provenance and rejects malformed repository authority', () => {
    const root = createRoot();
    reserveTokenLifecycleFixture(root, 'EvidenceProbe');

    expect(() =>
      getPlannedComponentTokenPreservationArtifacts(
        createPlan({ root, withWorkItem: false })
      )
    ).toThrow('component-token-preservation-provenance-required');

    const mismatched = createPlan({ root });
    mismatched.workItem = {
      ...workItem,
      repository: 'other/repository',
    };

    expect(() =>
      getPlannedComponentTokenPreservationArtifacts(mismatched)
    ).toThrow('component-token-work-item-repository-mismatch');
  });

  it('detects drift in generated evidence rather than normalizing it silently', async () => {
    const root = createRoot();
    reserveTokenLifecycleFixture(root, 'EvidenceProbe');
    const plan = createPlan({ root });
    const result = { updatedFiles: [] as string[] };

    await synchronizeComponentTokenPreservationContract({ plan, result });

    const manifestFile = getTokenMigrationManifestFile(root);
    fs.writeFileSync(
      manifestFile,
      fs
        .readFileSync(manifestFile, 'utf8')
        .replace(
          'Authorize a first-materialized canonical component-token leaf produced by Generator V2.',
          'Tampered reason.'
        )
    );

    expect(() => checkComponentTokenPreservationContract(plan)).toThrow(
      'component-token-preservation-managed-entry-drift'
    );
  });

  it('leaves current Textarea static evidence unchanged and does not duplicate it', async () => {
    const root = createRoot();
    const plan = createPlan({
      root,
      componentName: 'Textarea',
      componentTokens: 'standard',
      withWorkItem: false,
    });
    const manifestFile = getTokenMigrationManifestFile(root);
    const before = fs.readFileSync(manifestFile, 'utf8');
    const result = { updatedFiles: [] as string[] };

    expect(getPlannedComponentTokenPreservationArtifacts(plan)).toEqual([]);
    await synchronizeComponentTokenPreservationContract({ plan, result });

    expect(result.updatedFiles).toEqual([]);
    expect(fs.readFileSync(manifestFile, 'utf8')).toBe(before);
    expect(readGeneratedComponentTokenAdditions(root)).toEqual([]);
  });

  it('does not create preservation additions for tokenless components', async () => {
    const root = createRoot();
    const plan = createPlan({
      root,
      componentName: 'TokenlessProbe',
      componentTokens: false,
      withWorkItem: false,
    });
    const result = { updatedFiles: [] as string[] };
    const before = fs.readFileSync(getTokenMigrationManifestFile(root), 'utf8');

    expect(getPlannedComponentTokenPreservationArtifacts(plan)).toEqual([]);
    await synchronizeComponentTokenPreservationContract({ plan, result });

    expect(result.updatedFiles).toEqual([]);
    expect(fs.readFileSync(getTokenMigrationManifestFile(root), 'utf8')).toBe(
      before
    );
  });

  it('authorizes every first-materialized logical leaf across all preservation contexts', () => {
    const paths = getGeneratedComponentTokenLogicalPaths({
      componentName: 'Textarea',
      componentTokens: 'standard',
    });
    const baseline = createTokenPreservationBaseline('synthetic-revision');

    for (const snapshot of [
      ...Object.values(baseline.themes),
      ...Object.values(baseline.platformOutputs.web),
    ]) {
      for (const tokenPath of paths) {
        expect(snapshot.entries[tokenPath]).toBeDefined();
        delete snapshot.entries[tokenPath];
        snapshot.entryCount -= 1;
      }
    }

    const manifest: readonly TokenMigrationEntry[] = paths.map((to) =>
      createGeneratedComponentTokenAddition({ issue: '#1283', to })
    );
    const findings = verifyTokenPreservation({ baseline, manifest });

    expect(findings).toEqual([]);
  });
});
