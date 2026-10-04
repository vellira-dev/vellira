import type { ComponentProductionInputV1 } from '../component-production/contracts';
import type { ComponentProgramSourceV1 } from '../../packages/metadata/src/componentProgram';
import type { ComponentIntentCapability } from '../../packages/metadata/src/componentIntent';

/** A projection, not another writable platform/capability/resource authority. */
export function componentProgramSource(
  input: ComponentProductionInputV1
): ComponentProgramSourceV1 {
  const platforms: ComponentProgramSourceV1['platforms'] =
    input.platform === 'both'
      ? ['react', 'react-native']
      : [input.platform === 'web' ? 'react' : 'react-native'];
  const capabilities = new Map<
    ComponentIntentCapability,
    Set<(typeof platforms)[number]>
  >();
  for (const platform of platforms)
    for (const capability of [
      ...input.capabilities,
      ...(input.semanticCapabilities ?? []),
      ...(input.platformSemanticCapabilities?.[platform] ?? []),
    ]) {
      const scope = capabilities.get(capability) ?? new Set();
      scope.add(platform);
      capabilities.set(capability, scope);
    }
  return {
    platforms,
    capabilities: [...capabilities].map(([capability, scope]) => ({
      capability,
      platforms: [...scope].sort(),
    })),
    parts: input.parts,
    resources: {
      componentTokens: input.componentTokens,
      tokens: input.tokens ?? [],
      icons: input.icons ?? [],
      assets: input.assets ?? [],
    },
  };
}
