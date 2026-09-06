import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  checkSharedTypesContract,
  writeSharedTypesContract,
} from './compound-shared-types';
import { createComponentGenerationPlan } from './plan';
import { resolvePartTemplates } from './resolve-part-templates';
import { resolveComponentTemplates } from './resolve-templates';

const tempRoots: string[] = [];

function createPlan(
  profile: 'compound' | 'overlay' = 'compound',
  parts: readonly string[] = ['Root', 'Item', 'Trigger', 'Content']
) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vellira-shared-types-'));
  tempRoots.push(root);

  return createComponentGenerationPlan({
    root,
    options: {
      componentName: 'DisclosureProbe',
      platform: 'both',
      layer: 'components',
      category: 'utility',
      profile,
      parts,
      force: false,
    },
  });
}

function writeSharedMetadata(plan: ReturnType<typeof createPlan>) {
  fs.mkdirSync(path.dirname(plan.metadataFile), { recursive: true });
  fs.writeFileSync(
    plan.metadataFile,
    "dependencies: { packages: ['@vellira-ui/types'] },\n"
  );
}

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe('shared type ownership', () => {
  it('writes a platform-neutral compound contract and registers its barrel', () => {
    const plan = createPlan();

    fs.mkdirSync(path.dirname(plan.sharedTypesBarrelFile), { recursive: true });
    fs.writeFileSync(
      plan.sharedTypesBarrelFile,
      "export * from './button';\nexport * from './tabs';\n"
    );

    const result = writeSharedTypesContract(plan);
    const sharedTypes = fs.readFileSync(plan.sharedTypesFile, 'utf8');
    const sharedBarrel = fs.readFileSync(plan.sharedTypesBarrelFile, 'utf8');

    expect(plan.typeOwnership).toBe('shared');
    expect(result.createdFiles).toContain(plan.sharedTypesFile);
    expect(result.updatedFiles).toContain(plan.sharedTypesBarrelFile);
    expect(sharedTypes).toContain('BaseDisclosureProbeProps');
    expect(sharedTypes).toContain('BaseDisclosureProbeItemProps');
    expect(sharedTypes).toContain('BaseDisclosureProbeTriggerProps');
    expect(sharedTypes).toContain('BaseDisclosureProbeContentProps');
    expect(sharedTypes).not.toContain("from 'react'");
    expect(sharedTypes).not.toContain("from 'react-native'");
    expect(sharedBarrel).toBe(
      "export * from './button';\nexport * from './disclosureProbe';\nexport * from './tabs';\n"
    );
  });

  it('routes generated compound platform props through shared Base types', () => {
    const plan = createPlan();

    for (const target of plan.targets) {
      const componentTemplates = resolveComponentTemplates({ plan, target });

      expect(componentTemplates.types).toContain("from '@vellira-ui/types'");
      expect(componentTemplates.types).toContain('BaseDisclosureProbeProps');
      expect(componentTemplates.types).not.toContain(
        'DisclosureProbeItemProps'
      );

      const rootTemplates = resolvePartTemplates({
        plan,
        target,
        partName: 'Root',
      });
      expect(rootTemplates.types).toBe(
        '// DisclosureProbeRoot consumes the component-level DisclosureProbeProps contract.\nexport {};\n'
      );
      expect(rootTemplates.component).toContain('DisclosureProbeProps');
      expect(rootTemplates.component).toContain("from '../types'");
      expect(rootTemplates.component).not.toContain('DisclosureProbeRootProps');

      for (const partName of ['Item', 'Trigger', 'Content'] as const) {
        const partTemplates = resolvePartTemplates({
          plan,
          target,
          partName,
        });

        expect(partTemplates.types).toContain(
          `BaseDisclosureProbe${partName}Props`
        );
        expect(partTemplates.types).toContain("from '@vellira-ui/types'");
      }
    }
  });

  it('accepts a generated compound type topology in check mode', () => {
    const plan = createPlan();

    fs.mkdirSync(path.dirname(plan.sharedTypesBarrelFile), { recursive: true });
    fs.writeFileSync(plan.sharedTypesBarrelFile, '');
    writeSharedTypesContract(plan);
    writeSharedMetadata(plan);

    for (const target of plan.targets) {
      fs.mkdirSync(target.componentDir, { recursive: true });
      fs.writeFileSync(
        path.join(target.componentDir, 'types.ts'),
        resolveComponentTemplates({ plan, target }).types
      );

      for (const partName of plan.parts) {
        const partDir = path.join(target.componentDir, partName);
        const templates = resolvePartTemplates({ plan, target, partName });

        fs.mkdirSync(partDir, { recursive: true });
        fs.writeFileSync(path.join(partDir, 'types.ts'), templates.types);
        fs.writeFileSync(
          path.join(partDir, `${plan.componentName}${partName}.tsx`),
          templates.component
        );
      }
    }

    expect(checkSharedTypesContract(plan)).toEqual([]);
  });

  it('detects missing shared ownership evidence deterministically', () => {
    const plan = createPlan();

    expect(checkSharedTypesContract(plan)).toEqual(
      expect.arrayContaining([
        plan.sharedTypesFile,
        plan.sharedTypesBarrelFile,
        plan.metadataFile,
      ])
    );
  });

  it('shares overlay open-state semantics while preserving platform divergence', () => {
    const plan = createPlan('overlay', ['Root', 'Trigger', 'Content']);

    fs.mkdirSync(path.dirname(plan.sharedTypesBarrelFile), { recursive: true });
    fs.writeFileSync(plan.sharedTypesBarrelFile, '');

    writeSharedTypesContract(plan);

    const sharedTypes = fs.readFileSync(plan.sharedTypesFile, 'utf8');
    expect(sharedTypes).toContain('BaseDisclosureProbeProps');
    expect(sharedTypes).toContain('open?: boolean');
    expect(sharedTypes).toContain('defaultOpen?: boolean');
    expect(sharedTypes).toContain('onOpenChange?: (open: boolean) => void');

    const webTarget = plan.targets.find((target) => !target.isNative);
    const nativeTarget = plan.targets.find((target) => target.isNative);

    expect(webTarget).toBeDefined();
    expect(nativeTarget).toBeDefined();

    const webTypes = resolveComponentTemplates({
      plan,
      target: webTarget!,
    }).types;
    const nativeTypes = resolveComponentTemplates({
      plan,
      target: nativeTarget!,
    }).types;

    expect(webTypes).toContain('BaseDisclosureProbeProps');
    expect(nativeTypes).toContain('BaseDisclosureProbeProps');
    expect(webTypes).toContain('closeOnEscape?: boolean');
    expect(nativeTypes).not.toContain('closeOnEscape?: boolean');

    for (const target of plan.targets) {
      const rootTemplates = resolvePartTemplates({
        plan,
        target,
        partName: 'Root',
      });

      expect(rootTemplates.types).not.toContain('DisclosureProbeRootProps');
      expect(rootTemplates.component).toContain('DisclosureProbeProps');
      expect(rootTemplates.component).toContain("from '../types'");
    }
  });
});
