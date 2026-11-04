import type { ComponentCapability } from '@vellira-ui/metadata';
import type { ComponentProfileArg } from './cli';

export type ComponentProfileDefinition = {
  profile: ComponentProfileArg;
  capabilities: readonly ComponentCapability[];
  description: string;
  supportsParts: boolean;
};

export const componentProfiles: Record<
  ComponentProfileArg,
  ComponentProfileDefinition
> = {
  base: {
    profile: 'base',
    capabilities: [],
    supportsParts: false,
    description: 'Neutral component scaffold with no specialized behavior.',
  },

  'form-control': {
    profile: 'form-control',
    capabilities: [
      'controlled',
      'uncontrolled',
      'disabled',
      'required',
      'invalid',
    ],
    supportsParts: false,
    description:
      'Form-oriented scaffold with controlled and uncontrolled state, validation, and field-state requirements.',
  },

  compound: {
    profile: 'compound',
    capabilities: ['compound-api'],
    supportsParts: true,
    description:
      'Compound component scaffold composed from a root and public child slots.',
  },

  overlay: {
    profile: 'overlay',
    capabilities: [
      'controlled',
      'uncontrolled',
      'keyboard',
      'focus-management',
      'compound-api',
      'portal',
    ],
    supportsParts: true,
    description:
      'Overlay scaffold with open-state, focus, dismissal, and portal requirements.',
  },
};

export function getComponentProfile(
  profile: ComponentProfileArg
): ComponentProfileDefinition {
  return componentProfiles[profile];
}

/** Effective behavior authority shared by metadata and Component Program. */
export function resolveComponentCapabilities(input: {
  profile: ComponentProfileArg;
  capabilities: readonly ComponentCapability[];
}): ComponentCapability[] {
  return [
    ...new Set([
      ...getComponentProfile(input.profile).capabilities,
      ...input.capabilities,
    ]),
  ];
}
