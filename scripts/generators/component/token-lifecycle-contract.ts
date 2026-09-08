import fs from 'node:fs';
import path from 'node:path';

import { getComponentTokenLifecycle } from '@vellira-ui/metadata';

import type { ComponentGenerationPlan } from './plan';

export type TokenLifecycleContractMutationResult = {
  updatedFiles: string[];
};

export function getTokenLifecycleRegistryFile(root: string) {
  return path.join(root, 'packages', 'metadata', 'src', 'tokenLifecycle.ts');
}

export function needsComponentTokenLifecycleMutation(componentName: string) {
  return getComponentTokenLifecycle(componentName)?.status === 'reserved';
}

export function assertComponentTokenLifecycleCanMaterialize(
  componentName: string
) {
  const lifecycle = getComponentTokenLifecycle(componentName);

  if (!lifecycle) {
    throw new Error(
      `unregistered-component-token-family: component="${componentName}"; reserve the family in packages/metadata/src/tokenLifecycle.ts before Generator V2 may materialize it`
    );
  }

  if (lifecycle.status === 'deprecated') {
    throw new Error(
      `deprecated-component-token-family: component="${componentName}" owner="${lifecycle.owner}"`
    );
  }

  if (lifecycle.status === 'current') {
    if (lifecycle.owner !== componentName || !lifecycle.public) {
      throw new Error(
        `invalid-current-component-token-family: component="${componentName}" owner="${lifecycle.owner}" public=${String(lifecycle.public)}`
      );
    }

    return lifecycle;
  }

  if (lifecycle.owner !== componentName || !lifecycle.public) {
    throw new Error(
      `invalid-reserved-component-token-family: component="${componentName}" owner="${lifecycle.owner}" public=${String(lifecycle.public)}`
    );
  }

  return lifecycle;
}

export function ensureComponentTokenLifecycleContract(params: {
  plan: ComponentGenerationPlan;
  result: TokenLifecycleContractMutationResult;
}) {
  const { plan, result } = params;

  if (plan.componentTokens === false) return;

  const lifecycle = assertComponentTokenLifecycleCanMaterialize(
    plan.componentName
  );

  if (lifecycle.status === 'current') return;

  const registryFile = getTokenLifecycleRegistryFile(plan.root);

  if (!fs.existsSync(registryFile)) {
    throw new Error(`Missing token lifecycle registry: ${registryFile}`);
  }

  let source = fs.readFileSync(registryFile, 'utf8');
  const entryPattern = new RegExp(
    `(\\n  ${plan.componentName}: \\{\\n    status: )'reserved'`
  );

  if (!entryPattern.test(source)) {
    throw new Error(
      `Invalid reserved token lifecycle entry for ${plan.componentName} in ${registryFile}`
    );
  }

  source = source.replace(entryPattern, `$1'current'`);
  fs.writeFileSync(registryFile, source);

  if (!result.updatedFiles.includes(registryFile)) {
    result.updatedFiles.push(registryFile);
  }
}

export function checkComponentTokenLifecycleContract(
  plan: ComponentGenerationPlan
) {
  if (plan.componentTokens === false) return [];

  const lifecycle = getComponentTokenLifecycle(plan.componentName);

  if (
    lifecycle?.status === 'current' &&
    lifecycle.owner === plan.componentName &&
    lifecycle.public
  ) {
    return [];
  }

  return [path.relative(plan.root, getTokenLifecycleRegistryFile(plan.root))];
}
