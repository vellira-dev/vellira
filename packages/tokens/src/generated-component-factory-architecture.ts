export type GeneratedComponentFactoryArchitectureRegistration = {
  componentTokens: 'standard' | 'boolean-control' | 'disclosure';
  factory: {
    name: string;
    source: string;
    semanticAdapter: string;
    stateKeys: readonly string[];
  };
  dependencyAudit: {
    factory: string;
    component: string;
    file: string;
    primitiveColorUsage: readonly ['none'];
    unresolved: readonly [];
  };
};

/**
 * Generator V2 owns this bounded authority. Historical hand-maintained
 * factories remain in their existing #887/#888 inventories; every factory
 * first materialized by Generator V2 is registered here once and projected
 * into both inventories.
 */
export const generatedComponentFactoryArchitectureV1 = [
  {
    componentTokens: 'standard',
    factory: {
      name: 'createAvatarTokens',
      source: 'packages/tokens/src/factories/components/createAvatarTokens.ts',
      semanticAdapter: 'createAvatarTokensFromSemantics',
      stateKeys: ['default', 'hover', 'pressed', 'error', 'disabled'],
    },
    dependencyAudit: {
      factory: 'createAvatarTokens',
      component: 'avatar',
      file: 'avatar.ts',
      primitiveColorUsage: ['none'],
      unresolved: [],
    },
  },
] as const satisfies readonly GeneratedComponentFactoryArchitectureRegistration[];

export function projectGeneratedMaintainedComponentFactories(
  registrations: readonly GeneratedComponentFactoryArchitectureRegistration[]
) {
  return registrations.map(({ factory }) => factory);
}

export function projectGeneratedComponentTokenDependencyAudits(
  registrations: readonly GeneratedComponentFactoryArchitectureRegistration[]
) {
  return registrations.map(({ dependencyAudit }) => dependencyAudit);
}
