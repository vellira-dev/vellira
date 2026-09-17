import {
  componentCapabilities,
  type ComponentCapability,
  type ComponentCategory,
  type ComponentLayer,
  type ComponentMetadata,
  type ComponentPlatform,
  type ComponentProfile,
  type ComponentTokenContract,
} from './component';

export const COMPONENT_INTENT_SCHEMA_VERSION = '1' as const;

export type ComponentIntentV1 = {
  schemaVersion: typeof COMPONENT_INTENT_SCHEMA_VERSION;
  /** Stable human-readable UI job owned by public product metadata. */
  job: string;
  /** Semantic capabilities required on every target platform. */
  requiredCapabilities: readonly ComponentCapability[];
  /** Extra semantic requirements that intentionally differ by platform. */
  platformRequirements?: Partial<
    Record<ComponentPlatform, readonly ComponentCapability[]>
  >;
};

/**
 * Structural target authority shared by expansion/gap analysis and coverage.
 * ComponentExpansionTarget adds rollout-specific role/dependency fields.
 */
export type ComponentIntentTargetV1 = {
  name: string;
  layer: ComponentLayer;
  category: ComponentCategory;
  platforms: readonly ComponentPlatform[];
  profile: ComponentProfile;
  componentTokens: ComponentTokenContract | false;
  representedBy?: readonly string[];
  intent: ComponentIntentV1;
};

export const componentIntentCoverageStatuses = [
  'satisfied',
  'partial',
  'missing',
  'unknown',
] as const;

export type ComponentIntentCoverageStatus =
  (typeof componentIntentCoverageStatuses)[number];

export type ComponentIntentPlatformCoverageV1 = {
  platform: ComponentPlatform;
  status: ComponentIntentCoverageStatus;
  requiredCapabilities: readonly ComponentCapability[];
  satisfiedCapabilities: readonly ComponentCapability[];
  missingCapabilities: readonly ComponentCapability[];
};

export type ComponentIntentCoverageV1 = {
  schemaVersion: typeof COMPONENT_INTENT_SCHEMA_VERSION;
  intentId: string;
  target: string;
  component: string | null;
  status: ComponentIntentCoverageStatus;
  platforms: readonly ComponentIntentPlatformCoverageV1[];
  structuralMismatches: readonly string[];
  errors: readonly string[];
};

const KNOWN_CAPABILITIES = new Set<string>(componentCapabilities);
const KNOWN_PLATFORMS = new Set<ComponentPlatform>(['react', 'react-native']);

function uniqueCapabilities(
  values: readonly ComponentCapability[]
): ComponentCapability[] {
  return [...new Set(values)];
}

export function componentIntentId(target: ComponentIntentTargetV1) {
  return `component:${target.name}:intent:v${target.intent.schemaVersion}`;
}

export function componentCapabilitiesForPlatform(
  metadata: ComponentMetadata,
  platform: ComponentPlatform
): readonly ComponentCapability[] {
  return uniqueCapabilities([
    ...(metadata.capabilities ?? []),
    ...(metadata.platformCapabilities?.[platform] ?? []),
  ]);
}

export function requiredComponentIntentCapabilitiesForPlatform(
  intent: ComponentIntentV1,
  platform: ComponentPlatform
): readonly ComponentCapability[] {
  return uniqueCapabilities([
    ...intent.requiredCapabilities,
    ...(intent.platformRequirements?.[platform] ?? []),
  ]);
}

export function validateComponentIntentTarget(
  target: ComponentIntentTargetV1
): readonly string[] {
  const errors: string[] = [];

  if (target.intent.schemaVersion !== COMPONENT_INTENT_SCHEMA_VERSION) {
    errors.push(
      `Unsupported component intent schema version "${String(
        target.intent.schemaVersion
      )}" for ${target.name}.`
    );
  }

  if (target.intent.job.trim().length === 0) {
    errors.push(`Component intent job must be non-empty for ${target.name}.`);
  }

  const targetPlatforms = new Set(target.platforms);
  if (targetPlatforms.size !== target.platforms.length) {
    errors.push(`Component intent platforms must be unique for ${target.name}.`);
  }

  for (const platform of target.platforms) {
    if (!KNOWN_PLATFORMS.has(platform)) {
      errors.push(
        `Component intent contains unsupported platform "${platform}" for ${target.name}.`
      );
    }
  }

  const sharedCapabilities = new Set<string>();
  for (const capability of target.intent.requiredCapabilities) {
    if (!KNOWN_CAPABILITIES.has(capability)) {
      errors.push(
        `Component intent contains unknown capability "${capability}" for ${target.name}.`
      );
    }
    if (sharedCapabilities.has(capability)) {
      errors.push(
        `Component intent capability "${capability}" is duplicated for ${target.name}.`
      );
    }
    sharedCapabilities.add(capability);
  }

  for (const [platform, capabilities] of Object.entries(
    target.intent.platformRequirements ?? {}
  )) {
    if (!KNOWN_PLATFORMS.has(platform as ComponentPlatform)) {
      errors.push(
        `Component intent contains unsupported platform requirement "${platform}" for ${target.name}.`
      );
      continue;
    }
    if (!targetPlatforms.has(platform as ComponentPlatform)) {
      errors.push(
        `Component intent platform requirement "${platform}" is outside the target platforms for ${target.name}.`
      );
    }

    const seen = new Set<string>();
    for (const capability of capabilities ?? []) {
      if (!KNOWN_CAPABILITIES.has(capability)) {
        errors.push(
          `Component intent contains unknown ${platform} capability "${capability}" for ${target.name}.`
        );
      }
      if (sharedCapabilities.has(capability)) {
        errors.push(
          `Component intent ${platform} capability "${capability}" duplicates a shared requirement for ${target.name}.`
        );
      }
      if (seen.has(capability)) {
        errors.push(
          `Component intent ${platform} capability "${capability}" is duplicated for ${target.name}.`
        );
      }
      seen.add(capability);
    }
  }

  return errors;
}

export function evaluateComponentIntentCoverage(
  target: ComponentIntentTargetV1,
  metadata: ComponentMetadata | null | undefined
): ComponentIntentCoverageV1 {
  const intentId = componentIntentId(target);
  const errors = [...validateComponentIntentTarget(target)];

  if (errors.length > 0) {
    return {
      schemaVersion: COMPONENT_INTENT_SCHEMA_VERSION,
      intentId,
      target: target.name,
      component: metadata?.name ?? null,
      status: 'unknown',
      platforms: target.platforms.map((platform) => ({
        platform,
        status: 'unknown',
        requiredCapabilities: [],
        satisfiedCapabilities: [],
        missingCapabilities: [],
      })),
      structuralMismatches: [],
      errors,
    };
  }

  if (!metadata) {
    return {
      schemaVersion: COMPONENT_INTENT_SCHEMA_VERSION,
      intentId,
      target: target.name,
      component: null,
      status: 'missing',
      platforms: target.platforms.map((platform) => {
        const requiredCapabilities =
          requiredComponentIntentCapabilitiesForPlatform(target.intent, platform);
        return {
          platform,
          status: 'missing' as const,
          requiredCapabilities,
          satisfiedCapabilities: [],
          missingCapabilities: requiredCapabilities,
        };
      }),
      structuralMismatches: [],
      errors: [],
    };
  }

  const acceptedNames = new Set([target.name, ...(target.representedBy ?? [])]);
  if (!acceptedNames.has(metadata.name)) {
    errors.push(
      `Component metadata "${metadata.name}" is not canonical evidence for target "${target.name}".`
    );
  }

  if (errors.length > 0) {
    return {
      schemaVersion: COMPONENT_INTENT_SCHEMA_VERSION,
      intentId,
      target: target.name,
      component: metadata.name,
      status: 'unknown',
      platforms: [],
      structuralMismatches: [],
      errors,
    };
  }

  const structuralMismatches: string[] = [];
  if (metadata.layer !== target.layer) {
    structuralMismatches.push(
      `layer expected ${target.layer}, received ${metadata.layer}`
    );
  }
  if (metadata.category !== target.category) {
    structuralMismatches.push(
      `category expected ${target.category}, received ${metadata.category}`
    );
  }
  if (metadata.profile !== target.profile) {
    structuralMismatches.push(
      `profile expected ${target.profile}, received ${metadata.profile}`
    );
  }
  if (metadata.requirements.componentTokens !== target.componentTokens) {
    structuralMismatches.push(
      `componentTokens expected ${String(target.componentTokens)}, received ${String(
        metadata.requirements.componentTokens
      )}`
    );
  }

  const platforms = target.platforms.map((platform) => {
    const requiredCapabilities = requiredComponentIntentCapabilitiesForPlatform(
      target.intent,
      platform
    );

    if (!metadata.platforms.includes(platform)) {
      return {
        platform,
        status: 'missing' as const,
        requiredCapabilities,
        satisfiedCapabilities: [],
        missingCapabilities: requiredCapabilities,
      };
    }

    const actual = new Set(
      componentCapabilitiesForPlatform(metadata, platform)
    );
    const satisfiedCapabilities = requiredCapabilities.filter((capability) =>
      actual.has(capability)
    );
    const missingCapabilities = requiredCapabilities.filter(
      (capability) => !actual.has(capability)
    );
    const status: ComponentIntentCoverageStatus =
      missingCapabilities.length === 0
        ? 'satisfied'
        : satisfiedCapabilities.length === 0
          ? 'missing'
          : 'partial';

    return {
      platform,
      status,
      requiredCapabilities,
      satisfiedCapabilities,
      missingCapabilities,
    };
  });

  const status: ComponentIntentCoverageStatus =
    structuralMismatches.length === 0 &&
    platforms.every((platform) => platform.status === 'satisfied')
      ? 'satisfied'
      : 'partial';

  return {
    schemaVersion: COMPONENT_INTENT_SCHEMA_VERSION,
    intentId,
    target: target.name,
    component: metadata.name,
    status,
    platforms,
    structuralMismatches,
    errors,
  };
}
