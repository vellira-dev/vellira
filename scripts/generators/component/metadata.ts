import type { ComponentMetadata } from '@vellira-ui/metadata';

import type { ComponentGenerationPlan } from './plan';
import { getComponentProfile } from './profiles';
import type { MetadataTemplateParams } from './templates';

export function resolvePlanCapabilities(plan: ComponentGenerationPlan) {
  const profile = getComponentProfile(plan.profile);

  return [...new Set([...profile.capabilities, ...plan.capabilities])];
}

/**
 * Canonical projection from generation intent to generated metadata intent.
 * Writers, checkers, and documentation consumers must share this projection so
 * a plan cannot have multiple metadata interpretations.
 */
export function createMetadataTemplateParamsFromPlan(
  plan: ComponentGenerationPlan
): MetadataTemplateParams {
  const platformSemanticCapabilities = Object.fromEntries(
    Object.entries(plan.platformSemanticCapabilities)
      .filter((entry): entry is [string, NonNullable<(typeof entry)[1]>] =>
        Boolean(entry[1] && entry[1].length > 0)
      )
      .sort(([left], [right]) => left.localeCompare(right))
  );

  return {
    componentName: plan.componentName,
    layer: plan.layer,
    category: plan.category,
    platforms: plan.targets.map((target) => target.packageName),
    profile: plan.profile,
    capabilities: resolvePlanCapabilities(plan),
    ...(plan.semanticCapabilities.length > 0
      ? { semanticCapabilities: plan.semanticCapabilities }
      : {}),
    ...(Object.keys(platformSemanticCapabilities).length > 0
      ? { platformSemanticCapabilities }
      : {}),
    typeOwnership: plan.typeOwnership,
    dependencies: plan.dependencies,
    icons: plan.icons,
    tokens: plan.tokens,
    assets: plan.assets,
    componentTokens: plan.componentTokens,
  };
}

export function createComponentMetadataFromPlan(
  plan: ComponentGenerationPlan
): ComponentMetadata {
  const metadata = createMetadataTemplateParamsFromPlan(plan);
  const resourceRequirements = {
    ...(metadata.tokens && metadata.tokens.length > 0
      ? { tokens: metadata.tokens }
      : {}),
    ...(metadata.icons && metadata.icons.length > 0
      ? { icons: metadata.icons }
      : {}),
    ...(metadata.assets && metadata.assets.length > 0
      ? { assets: metadata.assets }
      : {}),
  };
  const semanticCapabilities = metadata.semanticCapabilities ?? [];
  const platformSemanticCapabilities =
    metadata.platformSemanticCapabilities ?? {};

  return {
    name: metadata.componentName,
    layer: metadata.layer,
    category: metadata.category,
    platforms: metadata.platforms,
    profile: metadata.profile,
    status: 'experimental',
    capabilities: metadata.capabilities,
    ...(semanticCapabilities.length > 0 ? { semanticCapabilities } : {}),
    ...(Object.keys(platformSemanticCapabilities).length > 0
      ? { platformSemanticCapabilities }
      : {}),
    ...(metadata.dependencies && Object.keys(metadata.dependencies).length > 0
      ? { dependencies: metadata.dependencies }
      : {}),
    requirements: {
      tests: true,
      storybook: true,
      docs: true,
      accessibility: true,
      componentTokens: metadata.componentTokens ?? 'standard',
      ...resourceRequirements,
    },
  };
}
