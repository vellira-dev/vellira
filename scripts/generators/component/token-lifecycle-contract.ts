import fs from 'node:fs';
import path from 'node:path';

import { getComponentTokenLifecycle } from '@vellira-ui/metadata';

import type { ComponentGenerationPlan } from './plan';

export type TokenLifecycleContractMutationResult = {
  updatedFiles: string[];
};

const COMPONENT_REGISTRY_END =
  '} as const satisfies Record<string, ComponentTokenLifecycleEntry>;';

export function getTokenLifecycleRegistryFile(root: string) {
  return path.join(root, 'packages', 'metadata', 'src', 'tokenLifecycle.ts');
}

export function needsComponentTokenLifecycleMutation(componentName: string) {
  return getComponentTokenLifecycle(componentName)?.status !== 'current';
}

function renderCurrentLifecycleEntry(componentName: string) {
  return `  ${componentName}: {\n    status: 'current',\n    public: true,\n    owner: '${componentName}',\n    purpose: 'Canonical ${componentName} component token contract.',\n  },\n`;
}

export function ensureComponentTokenLifecycleContract(params: {
  plan: ComponentGenerationPlan;
  result: TokenLifecycleContractMutationResult;
}) {
  const { plan, result } = params;

  if (plan.componentTokens === false) return;

  const lifecycle = getComponentTokenLifecycle(plan.componentName);

  if (lifecycle?.status === 'deprecated') {
    throw new Error(
      `deprecated-component-token-family: component="${plan.componentName}" owner="${lifecycle.owner}"`
    );
  }

  const registryFile = getTokenLifecycleRegistryFile(plan.root);

  if (!fs.existsSync(registryFile)) {
    throw new Error(`Missing token lifecycle registry: ${registryFile}`);
  }

  if (lifecycle?.status === 'current') return;

  let source = fs.readFileSync(registryFile, 'utf8');

  if (lifecycle?.status === 'reserved') {
    const entryPattern = new RegExp(
      `(\\n  ${plan.componentName}: \\{\\n    status: )'reserved'`
    );

    if (!entryPattern.test(source)) {
      throw new Error(
        `Invalid reserved token lifecycle entry for ${plan.componentName} in ${registryFile}`
      );
    }

    source = source.replace(entryPattern, `$1'current'`);
  } else {
    const markerIndex = source.indexOf(COMPONENT_REGISTRY_END);

    if (markerIndex < 0) {
      throw new Error(
        `Invalid component token lifecycle registry in ${registryFile}`
      );
    }

    source = `${source.slice(0, markerIndex)}${renderCurrentLifecycleEntry(plan.componentName)}${source.slice(markerIndex)}`;
  }

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
