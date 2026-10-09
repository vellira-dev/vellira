import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createComponentGenerationPlan } from './plan';
import type { ComponentGeneratorOptions } from './cli';
import {
  checkPublicApiContractSynchronization,
  getPublicSymbolContractFile,
  synchronizePublicSymbolContracts,
} from './public-api-contract';

const tempRoots: string[] = [];

function createRoot() {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), 'vellira-public-symbol-contract-')
  );
  tempRoots.push(root);

  for (const packageName of ['react', 'react-native']) {
    const sourceRoot = path.join(root, 'packages', packageName, 'src');
    fs.mkdirSync(sourceRoot, { recursive: true });
    fs.writeFileSync(
      path.join(sourceRoot, 'public-api.test.ts'),
      `import * as api from './index';

describe('public API', () => {
  it('exports only documented runtime entries', () => {
    expect(Object.keys(api).sort()).toEqual([
      'Avatar',
      'Button',
    ]);
  });
});
`
    );
  }

  const contractFile = getPublicSymbolContractFile(root);
  fs.mkdirSync(path.dirname(contractFile), { recursive: true });
  fs.writeFileSync(
    contractFile,
    `const publicSymbolContracts = {
  'packages/react-native/src/index.ts': [
    'Button',
    'ButtonProps',
  ],
  'packages/react/src/index.ts': [
    'Button',
    'ButtonProps',
  ],
};
`
  );

  return root;
}

function createPlan(params: {
  root: string;
  platform: 'web' | 'native' | 'both';
  parts?: string[];
  capabilities?: ComponentGeneratorOptions['capabilities'];
}) {
  return createComponentGenerationPlan({
    root: params.root,
    options: {
      componentName: 'Avatar',
      platform: params.platform,
      layer: 'primitives',
      category: 'data-display',
      profile: 'base',
      parts: params.parts ?? [],
      capabilities: params.capabilities,
      force: false,
    },
  });
}

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe('generated public symbol contract synchronization', () => {
  it('updates both React and React Native symbol contracts', () => {
    const root = createRoot();
    const plan = createPlan({ root, platform: 'both' });
    const updatedFiles: string[] = [];

    synchronizePublicSymbolContracts({ plan, updatedFiles });

    const content = fs.readFileSync(getPublicSymbolContractFile(root), 'utf8');

    expect(content.match(/    'Avatar',/g)).toHaveLength(2);
    expect(content.match(/    'AvatarProps',/g)).toHaveLength(2);
    expect(updatedFiles).toEqual([getPublicSymbolContractFile(root)]);
    expect(checkPublicApiContractSynchronization(plan)).toEqual([]);
  });

  it('updates only the applicable platform contract', () => {
    const root = createRoot();
    const plan = createPlan({ root, platform: 'web' });

    synchronizePublicSymbolContracts({ plan, updatedFiles: [] });

    const content = fs.readFileSync(getPublicSymbolContractFile(root), 'utf8');
    const nativeBlock = content.match(
      /'packages\/react-native\/src\/index\.ts': \[([\s\S]*?)\n  \],/
    )?.[1];
    const reactBlock = content.match(
      /'packages\/react\/src\/index\.ts': \[([\s\S]*?)\n  \],/
    )?.[1];

    expect(nativeBlock).not.toContain("'Avatar'");
    expect(nativeBlock).not.toContain("'AvatarProps'");
    expect(reactBlock).toContain("'Avatar'");
    expect(reactBlock).toContain("'AvatarProps'");
  });

  it('includes compound public part prop types and excludes Root', () => {
    const root = createRoot();
    const plan = createPlan({
      root,
      platform: 'both',
      parts: ['Root', 'Item', 'Trigger', 'Content'],
    });

    synchronizePublicSymbolContracts({ plan, updatedFiles: [] });

    const content = fs.readFileSync(getPublicSymbolContractFile(root), 'utf8');

    for (const symbol of [
      'Avatar',
      'AvatarProps',
      'AvatarItemProps',
      'AvatarTriggerProps',
      'AvatarContentProps',
    ]) {
      expect(content.match(new RegExp(`    '${symbol}',`, 'g'))).toHaveLength(
        2
      );
    }

    expect(content).not.toContain("'AvatarRootProps'");
  });

  it('is idempotent and does not duplicate symbols', () => {
    const root = createRoot();
    const plan = createPlan({ root, platform: 'both' });
    const updatedFiles: string[] = [];

    synchronizePublicSymbolContracts({ plan, updatedFiles });
    const once = fs.readFileSync(getPublicSymbolContractFile(root), 'utf8');
    synchronizePublicSymbolContracts({ plan, updatedFiles });
    const twice = fs.readFileSync(getPublicSymbolContractFile(root), 'utf8');

    expect(twice).toBe(once);
    expect(twice.match(/    'Avatar',/g)).toHaveLength(2);
    expect(twice.match(/    'AvatarProps',/g)).toHaveLength(2);
    expect(updatedFiles).toEqual([getPublicSymbolContractFile(root)]);
  });

  it('reports checker drift without mutating it', () => {
    const root = createRoot();
    const plan = createPlan({ root, platform: 'both' });
    const contractFile = getPublicSymbolContractFile(root);
    const before = fs.readFileSync(contractFile, 'utf8');

    expect(checkPublicApiContractSynchronization(plan)).toContain(contractFile);
    expect(fs.readFileSync(contractFile, 'utf8')).toBe(before);
  });

  it('fails closed when the applicable checker block is missing', () => {
    const root = createRoot();
    const plan = createPlan({ root, platform: 'web' });
    const contractFile = getPublicSymbolContractFile(root);

    fs.writeFileSync(
      contractFile,
      `const publicSymbolContracts = {
  'packages/react-native/src/index.ts': [
    'Button',
    'ButtonProps',
  ],
};
`
    );

    expect(() =>
      synchronizePublicSymbolContracts({ plan, updatedFiles: [] })
    ).toThrow(
      'Unable to locate public symbol contract for packages/react/src/index.ts'
    );
  });
});

it('synchronizes approved shared domains and props without touching their source', () => {
  const root = createRoot();
  const plan = createPlan({
    root,
    platform: 'both',
    capabilities: ['controlled'],
  });
  fs.mkdirSync(path.dirname(plan.sharedTypesFile), { recursive: true });
  const source =
    "export type AvatarTone = 'neutral' | 'warning';\nexport interface BaseAvatarProps { tone?: AvatarTone }\n";
  fs.writeFileSync(plan.sharedTypesFile, source);
  const file = getPublicSymbolContractFile(root);
  fs.writeFileSync(
    file,
    fs
      .readFileSync(file, 'utf8')
      .replace(
        'const publicSymbolContracts = {',
        "const publicSymbolContracts = {\n  'packages/types/src/index.ts': [\n    'ExistingType',\n  ],"
      )
  );
  expect(checkPublicApiContractSynchronization(plan)).toContain(file);
  synchronizePublicSymbolContracts({ plan, updatedFiles: [] });
  const once = fs.readFileSync(file, 'utf8');
  expect(once).toContain("    'AvatarTone',");
  expect(once).toContain("    'BaseAvatarProps',");
  expect(once).toContain("    'ExistingType',");
  expect(checkPublicApiContractSynchronization(plan)).toEqual([]);
  synchronizePublicSymbolContracts({ plan, updatedFiles: [] });
  expect(fs.readFileSync(file, 'utf8')).toBe(once);
  expect(fs.readFileSync(plan.sharedTypesFile, 'utf8')).toBe(source);
});

it('rejects shared declarations outside the exact generated component owner', () => {
  const root = createRoot();
  const plan = createPlan({
    root,
    platform: 'both',
    capabilities: ['controlled'],
  });
  fs.mkdirSync(path.dirname(plan.sharedTypesFile), { recursive: true });
  fs.writeFileSync(plan.sharedTypesFile, 'export interface UnrelatedType {}');
  expect(() =>
    synchronizePublicSymbolContracts({ plan, updatedFiles: [] })
  ).toThrow('outside component ownership');
});

it.each([
  'export const AvatarValue = 1;',
  "export * from './other';",
  'export { AvatarTone };',
  'export default AvatarTone;',
])('rejects runtime or indirect shared export authority: %s', (extra) => {
  const root = createRoot();
  const plan = createPlan({
    root,
    platform: 'both',
    capabilities: ['controlled'],
  });
  fs.mkdirSync(path.dirname(plan.sharedTypesFile), { recursive: true });
  fs.writeFileSync(
    plan.sharedTypesFile,
    "export type AvatarTone = 'neutral';\n" + extra
  );
  expect(() =>
    synchronizePublicSymbolContracts({ plan, updatedFiles: [] })
  ).toThrow('explicit type declarations only');
});
