import type { ComponentCapability } from '@vellira-ui/metadata';

import { getComponentProfile } from './profiles';

import type { ComponentGeneratorOptions } from './cli';

export type ComponentTypeOwnership = 'shared' | 'platform';

const sharedSemanticCapabilities = new Set<ComponentCapability>([
  'controlled',
  'uncontrolled',
  'compound-api',
]);

export function hasSharedTypeSemantics(
  capabilities: Iterable<ComponentCapability>
) {
  return [...capabilities].some((capability) =>
    sharedSemanticCapabilities.has(capability)
  );
}

/**
 * Resolves the owner of renderer-neutral public component semantics.
 *
 * Ownership is derived from semantic intent (effective capabilities), not from
 * a profile-specific writer branch or component name. Platform packages may
 * still add renderer-specific props on top of a shared contract.
 */
export function resolveComponentTypeOwnership(
  options: Pick<ComponentGeneratorOptions, 'profile' | 'capabilities'>
): ComponentTypeOwnership {
  const profile = getComponentProfile(options.profile);
  const capabilities = new Set<ComponentCapability>([
    ...profile.capabilities,
    ...(options.capabilities ?? []),
  ]);

  return hasSharedTypeSemantics(capabilities) ? 'shared' : 'platform';
}
