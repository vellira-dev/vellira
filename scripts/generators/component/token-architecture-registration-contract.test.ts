import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  projectGeneratedComponentTokenDependencyAudits,
  projectGeneratedMaintainedComponentFactories,
} from '../../../packages/tokens/src/generated-component-factory-architecture';
import {
  analyzeComponentTokenArchitectureRegistration,
  checkComponentTokenArchitectureRegistration,
  createGeneratedComponentFactoryArchitectureRegistration,
  getComponentTokenArchitectureRegistrationFile,
  readGeneratedComponentFactoryArchitectureRegistrations,
  synchronizeComponentTokenArchitectureRegistration,
} from './token-architecture-registration-contract';

const roots: string[] = [];

function fixtureRoot() {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), 'vellira-token-architecture-registration-')
  );
  roots.push(root);
  const target = getComponentTokenArchitectureRegistrationFile(root);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(
    target,
    'export const generatedComponentFactoryArchitectureV1 = [] as const;\n'
  );
  return root;
}

function plan(
  root: string,
  componentTokens:
    'standard' | 'boolean-control' | 'disclosure' | false = 'standard'
) {
  return { root, componentName: 'ArchitectureProbe', componentTokens } as const;
}

afterEach(() => {
  for (const root of roots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe('Generator V2 component token architecture registration', () => {
  it.each([
    ['standard', ['default', 'hover', 'pressed', 'error', 'disabled']],
    ['boolean-control', ['default', 'hover', 'pressed', 'disabled']],
    ['disclosure', ['default', 'expanded', 'hover', 'pressed', 'disabled']],
  ] as const)(
    'derives the complete %s registration from canonical generation intent',
    (componentTokens, stateKeys) => {
      expect(
        createGeneratedComponentFactoryArchitectureRegistration({
          componentName: 'ArchitectureProbe',
          componentTokens,
        })
      ).toEqual({
        componentTokens,
        factory: {
          name: 'createArchitectureProbeTokens',
          source:
            'packages/tokens/src/factories/components/createArchitectureProbeTokens.ts',
          semanticAdapter: 'createArchitectureProbeTokensFromSemantics',
          stateKeys,
        },
        dependencyAudit: {
          factory: 'createArchitectureProbeTokens',
          component: 'architectureProbe',
          file: 'architectureProbe.ts',
          primitiveColorUsage: ['none'],
          unresolved: [],
        },
      });
    }
  );

  it('writes one authority that projects into both canonical inventories', async () => {
    const root = fixtureRoot();
    const result = { updatedFiles: [] as string[] };

    expect(
      await checkComponentTokenArchitectureRegistration(plan(root))
    ).toEqual([
      'packages/tokens/src/generated-component-factory-architecture.ts',
    ]);
    await synchronizeComponentTokenArchitectureRegistration({
      plan: plan(root),
      result,
    });

    const registrations =
      readGeneratedComponentFactoryArchitectureRegistrations(root);
    expect(registrations).toHaveLength(1);
    expect(projectGeneratedMaintainedComponentFactories(registrations)).toEqual(
      [registrations[0]!.factory]
    );
    expect(
      projectGeneratedComponentTokenDependencyAudits(registrations)
    ).toEqual([registrations[0]!.dependencyAudit]);
    expect(result.updatedFiles).toEqual([
      getComponentTokenArchitectureRegistrationFile(root),
    ]);
    expect(
      await checkComponentTokenArchitectureRegistration(plan(root))
    ).toEqual([]);
  });

  it('is idempotent on a second synchronization run', async () => {
    const root = fixtureRoot();
    await synchronizeComponentTokenArchitectureRegistration({
      plan: plan(root),
      result: { updatedFiles: [] },
    });
    const before = fs.readFileSync(
      getComponentTokenArchitectureRegistrationFile(root),
      'utf8'
    );
    const rerun = { updatedFiles: [] as string[] };

    await synchronizeComponentTokenArchitectureRegistration({
      plan: plan(root),
      result: rerun,
    });

    expect(rerun.updatedFiles).toEqual([]);
    expect(
      fs.readFileSync(
        getComponentTokenArchitectureRegistrationFile(root),
        'utf8'
      )
    ).toBe(before);
  });

  it('fails closed on malformed or drifted generated state evidence', async () => {
    const root = fixtureRoot();
    await synchronizeComponentTokenArchitectureRegistration({
      plan: plan(root),
      result: { updatedFiles: [] },
    });
    const file = getComponentTokenArchitectureRegistrationFile(root);
    fs.writeFileSync(
      file,
      fs.readFileSync(file, 'utf8').replace("'pressed',", "'guessed',")
    );

    await expect(
      analyzeComponentTokenArchitectureRegistration(plan(root))
    ).rejects.toThrow('component-token-architecture-entry-drift');
  });

  it('fails closed when generated authority ambiguously duplicates a historical factory', async () => {
    const root = fixtureRoot();
    const file = getComponentTokenArchitectureRegistrationFile(root);
    const generated = createGeneratedComponentFactoryArchitectureRegistration({
      componentName: 'Textarea',
      componentTokens: 'standard',
    })!;
    fs.writeFileSync(
      file,
      fs
        .readFileSync(file, 'utf8')
        .replace(
          '[] as const',
          `${JSON.stringify([generated])} as const`
        )
    );

    await expect(
      analyzeComponentTokenArchitectureRegistration(plan(root))
    ).rejects.toThrow('overlaps a historical #887/#888 registration');
  });

  it('does not register a component with componentTokens false', async () => {
    const root = fixtureRoot();
    const result = { updatedFiles: [] as string[] };

    await synchronizeComponentTokenArchitectureRegistration({
      plan: plan(root, false),
      result,
    });

    expect(result.updatedFiles).toEqual([]);
    expect(
      readGeneratedComponentFactoryArchitectureRegistrations(root)
    ).toEqual([]);
  });

  it('leaves existing historical maintained factories unchanged', async () => {
    const root = fixtureRoot();
    const file = getComponentTokenArchitectureRegistrationFile(root);
    const before = fs.readFileSync(file, 'utf8');
    const result = { updatedFiles: [] as string[] };

    await synchronizeComponentTokenArchitectureRegistration({
      plan: {
        root,
        componentName: 'Textarea',
        componentTokens: 'standard',
      },
      result,
    });

    expect(result.updatedFiles).toEqual([]);
    expect(fs.readFileSync(file, 'utf8')).toBe(before);
  });
});
