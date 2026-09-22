import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { createComponentGenerationPlan } from './plan';
import { writeComponentGenerationPlan } from './write';

function createFixtureRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vellira-root-exports-'));

  for (const packageName of ['react', 'react-native']) {
    const sourceRoot = path.join(root, 'packages', packageName, 'src');

    for (const layerName of ['components', 'primitives']) {
      fs.mkdirSync(path.join(sourceRoot, layerName), { recursive: true });
      fs.writeFileSync(path.join(sourceRoot, layerName, 'index.ts'), '');
    }

    fs.writeFileSync(path.join(sourceRoot, 'index.ts'), '');
    fs.writeFileSync(
      path.join(sourceRoot, 'public-api.test.ts'),
      `import * as api from './index';

expect(Object.keys(api).sort()).toEqual([
      'Button',
    ]);
`
    );
    fs.writeFileSync(path.join(root, 'packages', packageName, 'API.md'), '');
  }

  const metadataRoot = path.join(
    root,
    'packages',
    'metadata',
    'src',
    'components'
  );

  fs.mkdirSync(metadataRoot, { recursive: true });
  fs.writeFileSync(
    path.join(metadataRoot, 'index.ts'),
    `export const componentMetadata = [
] as const;
`
  );

  const docsContractRoot = path.join(
    root,
    'apps',
    'docs',
    'src',
    'component-docs'
  );

  fs.mkdirSync(docsContractRoot, { recursive: true });
  fs.writeFileSync(
    path.join(docsContractRoot, 'index.ts'),
    `export const componentDocsContracts = [
] as const;
`
  );

  return root;
}

function countMatches(source: string, pattern: RegExp) {
  return source.match(pattern)?.length ?? 0;
}

describe('component generator package root exports', () => {
  it('registers public value and type exports exactly once for each target', async () => {
    const root = createFixtureRoot();
    const plan = createComponentGenerationPlan({
      root,
      options: {
        componentName: 'Switch',
        platform: 'both',
        layer: 'primitives',
        category: 'form',
        profile: 'form-control',
        control: 'boolean',
        parts: [],
        force: true,
      },
    });

    await writeComponentGenerationPlan(plan);
    await writeComponentGenerationPlan(plan);

    for (const packageName of ['react', 'react-native']) {
      const source = fs.readFileSync(
        path.join(root, 'packages', packageName, 'src', 'index.ts'),
        'utf8'
      );

      expect(
        countMatches(
          source,
          /export type \{ SwitchProps \} from '\.\/primitives\/Switch';/g
        )
      ).toBe(1);
      expect(
        countMatches(
          source,
          /export \{ Switch \} from '\.\/primitives\/Switch';/g
        )
      ).toBe(1);
    }
  });

  it(
    'registers public compound part type exports except Root exactly once',
    async () => {
      const root = createFixtureRoot();
      const plan = createComponentGenerationPlan({
        root,
        options: {
          componentName: 'Accordion',
          platform: 'both',
          layer: 'components',
          category: 'navigation',
          profile: 'compound',
          parts: ['Root', 'Item', 'Trigger', 'Content'],
          force: true,
        },
      });

      await writeComponentGenerationPlan(plan);
      await writeComponentGenerationPlan(plan);

      for (const packageName of ['react', 'react-native']) {
        const packageRootSource = fs.readFileSync(
          path.join(root, 'packages', packageName, 'src', 'index.ts'),
          'utf8'
        );

        expect(
          countMatches(
            packageRootSource,
            /export \{ Accordion \} from '\.\/components\/Accordion';/g
          )
        ).toBe(1);
        expect(
          countMatches(
            packageRootSource,
            /export type \{ AccordionProps \} from '\.\/components\/Accordion';/g
          )
        ).toBe(1);
        expect(
          countMatches(
            packageRootSource,
            /export type \{ AccordionItemProps \} from '\.\/components\/Accordion';/g
          )
        ).toBe(1);
        expect(
          countMatches(
            packageRootSource,
            /export type \{ AccordionTriggerProps \} from '\.\/components\/Accordion';/g
          )
        ).toBe(1);
        expect(
          countMatches(
            packageRootSource,
            /export type \{ AccordionContentProps \} from '\.\/components\/Accordion';/g
          )
        ).toBe(1);
        expect(packageRootSource).not.toContain('AccordionRootProps');

        const componentBarrelSource = fs.readFileSync(
          path.join(
            root,
            'packages',
            packageName,
            'src',
            'components',
            'Accordion',
            'index.ts'
          ),
          'utf8'
        );

        expect(componentBarrelSource).toContain("export * from './Item';");
        expect(componentBarrelSource).toContain("export * from './Trigger';");
        expect(componentBarrelSource).toContain("export * from './Content';");

        for (const partName of ['Item', 'Trigger', 'Content']) {
          const partTypesSource = fs.readFileSync(
            path.join(
              root,
              'packages',
              packageName,
              'src',
              'components',
              'Accordion',
              partName,
              'types.ts'
            ),
            'utf8'
          );

          expect(partTypesSource).toContain(
            `export type Accordion${partName}Props`
          );
        }
      }
    },
    15_000
  );
});
