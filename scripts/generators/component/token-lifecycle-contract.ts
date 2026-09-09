import path from 'node:path';

import {
  getTokenLifecycleRegistryFile,
  promoteReservedTokenFamily,
  readTokenLifecycleAuthority,
} from '../../token-lifecycle/authority';

export { getTokenLifecycleRegistryFile } from '../../token-lifecycle/authority';

import type { ComponentGenerationPlan } from './plan';

export type TokenLifecycleContractMutationResult = {
  updatedFiles: string[];
};

export function needsComponentTokenLifecycleMutation(
  componentName: string,
  root = process.cwd()
) {
  return (
    readTokenLifecycleAuthority(root).components[componentName]?.status ===
    'reserved'
  );
}

export function assertComponentTokenLifecycleCanMaterialize(
  componentName: string,
  root = process.cwd()
) {
  const lifecycle = readTokenLifecycleAuthority(root).components[componentName];

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
    plan.componentName,
    plan.root
  );

  if (lifecycle.status === 'current') return;

  const registryFile = promoteReservedTokenFamily(
    plan.root,
    plan.componentName
  );

  if (!result.updatedFiles.includes(registryFile)) {
    result.updatedFiles.push(registryFile);
  }
}

export function checkComponentTokenLifecycleContract(
  plan: ComponentGenerationPlan
) {
  if (plan.componentTokens === false) return [];

  const lifecycle = readTokenLifecycleAuthority(plan.root).components[
    plan.componentName
  ];

  if (
    lifecycle?.status === 'current' &&
    lifecycle.owner === plan.componentName &&
    lifecycle.public
  ) {
    return [];
  }

  return [path.relative(plan.root, getTokenLifecycleRegistryFile(plan.root))];
}
