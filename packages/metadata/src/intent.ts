import {
  componentCapabilities,
  type ComponentCapability,
  type ComponentCategory,
  type ComponentLayer,
  type ComponentMetadata,
  type ComponentPlatform,
  type ComponentProfile,
} from './component';
import type {
  ComponentExpansionRole,
  ComponentExpansionTarget,
} from './expansion';

export const COMPONENT_INTENT_SCHEMA_VERSION = '1' as const;

export type ComponentIntentDefinitionV1 = {
  schemaVersion: typeof COMPONENT_INTENT_SCHEMA_VERSION;
  revision: number;
  job: string;
  requiredCapabilities: readonly ComponentCapability[];
  platformCapabilities?: Partial<
    Record<ComponentPlatform, readonly ComponentCapability[]>
  >;
  /**
   * Explicit approved semantics that cannot yet be represented safely by the
   * bounded capability vocabulary. Any unresolved requirement fails closed.
   */
  unresolvedRequirements?: readonly string[];
};

export type ComponentIntentContractV1 = {
  schemaVersion: typeof COMPONENT_INTENT_SCHEMA_VERSION;
  targetId: string;
  revision: number;
  componentName: string;
  layer: ComponentLayer;
  category: ComponentCategory;
  profile: ComponentProfile;
  role: ComponentExpansionRole;
  platforms: readonly ComponentPlatform[];
  job: string;
  requiredCapabilities: readonly ComponentCapability[];
  platformCapabilities: Partial<
    Record<ComponentPlatform, readonly ComponentCapability[]>
  >;
  representedBy: readonly string[];
  dependsOn: readonly string[];
  unresolvedRequirements: readonly string[];
  provenance: {
    authority: 'component-expansion-catalog';
    targetName: string;
  };
};

export type ComponentIntentCoverageStatus =
  | 'satisfied'
  | 'missing'
  | 'partial'
  | 'unknown';

export type ComponentIntentPlatformCoverageV1 = {
  platform: ComponentPlatform;
  status: ComponentIntentCoverageStatus;
  requiredCapabilities: readonly ComponentCapability[];
  missingCapabilities: readonly ComponentCapability[];
};

export type ComponentIntentCoverageV1 = {
  schemaVersion: typeof COMPONENT_INTENT_SCHEMA_VERSION;
  coverageId: string;
  targetId: string;
  revision: number;
  requestedComponent: string;
  canonicalComponent?: string;
  status: ComponentIntentCoverageStatus;
  platforms: readonly ComponentIntentPlatformCoverageV1[];
  missingPlatforms: readonly ComponentPlatform[];
  missingCapabilities: readonly ComponentCapability[];
  structuralMismatches: readonly string[];
  unresolvedRequirements: readonly string[];
};

const PLATFORM_ORDER: readonly ComponentPlatform[] = ['react', 'react-native'];
const SUPPORTED_CAPABILITIES = new Set<ComponentCapability>(
  componentCapabilities
);

function normalizeName(value: string): string {
  return value.trim().toLocaleLowerCase('en-US');
}

function targetIdForName(value: string): string {
  return normalizeName(value)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function orderedCapabilities(
  values: readonly ComponentCapability[]
): readonly ComponentCapability[] {
  const selected = new Set(values);
  return componentCapabilities.filter((capability) => selected.has(capability));
}

function orderedPlatforms(
  values: readonly ComponentPlatform[]
): readonly ComponentPlatform[] {
  const selected = new Set(values);
  return PLATFORM_ORDER.filter((platform) => selected.has(platform));
}

function validateCapabilityList(
  values: readonly ComponentCapability[],
  field: string,
  errors: string[]
) {
  const seen = new Set<ComponentCapability>();

  for (const capability of values) {
    if (!SUPPORTED_CAPABILITIES.has(capability)) {
      errors.push(`${field} contains unsupported capability "${capability}".`);
      continue;
    }

    if (seen.has(capability)) {
      errors.push(`${field} must not contain duplicate capability "${capability}".`);
    }
    seen.add(capability);
  }
}

export function validateComponentIntentTarget(
  target: ComponentExpansionTarget
): readonly string[] {
  const errors: string[] = [];
  const intent = target.intent;

  if (intent.schemaVersion !== COMPONENT_INTENT_SCHEMA_VERSION) {
    errors.push(
      `intent.schemaVersion must be "${COMPONENT_INTENT_SCHEMA_VERSION}".`
    );
  }

  if (!Number.isInteger(intent.revision) || intent.revision < 1) {
    errors.push('intent.revision must be a positive integer.');
  }

  if (intent.job.trim().length === 0) {
    errors.push('intent.job must be a non-empty string.');
  }

  validateCapabilityList(
    intent.requiredCapabilities,
    'intent.requiredCapabilities',
    errors
  );

  const sharedCapabilities = new Set(intent.requiredCapabilities);
  for (const [platform, capabilities] of Object.entries(
    intent.platformCapabilities ?? {}
  )) {
    if (!target.platforms.includes(platform as ComponentPlatform)) {
      errors.push(
        `intent.platformCapabilities contains undeclared platform "${platform}".`
      );
      continue;
    }

    const typedCapabilities = capabilities as readonly ComponentCapability[];
    validateCapabilityList(
      typedCapabilities,
      `intent.platformCapabilities.${platform}`,
      errors
    );

    for (const capability of typedCapabilities) {
      if (sharedCapabilities.has(capability)) {
        errors.push(
          `intent.platformCapabilities.${platform} duplicates shared capability "${capability}".`
        );
      }
    }
  }

  const unresolved = intent.unresolvedRequirements ?? [];
  if (unresolved.some((requirement) => requirement.trim().length === 0)) {
    errors.push('intent.unresolvedRequirements must not contain empty values.');
  }
  if (new Set(unresolved).size !== unresolved.length) {
    errors.push('intent.unresolvedRequirements must not contain duplicates.');
  }

  return errors;
}

export function createComponentIntentContract(
  target: ComponentExpansionTarget
): ComponentIntentContractV1 {
  const errors = validateComponentIntentTarget(target);
  if (errors.length > 0) {
    throw new Error(
      `Invalid component intent target "${target.name}": ${errors.join(' ')}`
    );
  }

  const platformCapabilities: ComponentIntentContractV1['platformCapabilities'] =
    {};
  for (const platform of PLATFORM_ORDER) {
    const capabilities = target.intent.platformCapabilities?.[platform];
    if (capabilities && capabilities.length > 0) {
      platformCapabilities[platform] = orderedCapabilities(capabilities);
    }
  }

  return {
    schemaVersion: COMPONENT_INTENT_SCHEMA_VERSION,
    targetId: `component-target:${targetIdForName(target.name)}`,
    revision: target.intent.revision,
    componentName: target.name,
    layer: target.layer,
    category: target.category,
    profile: target.profile,
    role: target.role,
    platforms: orderedPlatforms(target.platforms),
    job: target.intent.job.trim(),
    requiredCapabilities: orderedCapabilities(
      target.intent.requiredCapabilities
    ),
    platformCapabilities,
    representedBy: [...(target.representedBy ?? [])].sort((left, right) =>
      left.localeCompare(right)
    ),
    dependsOn: [...(target.dependsOn ?? [])].sort((left, right) =>
      left.localeCompare(right)
    ),
    unresolvedRequirements: [...(target.intent.unresolvedRequirements ?? [])]
      .map((requirement) => requirement.trim())
      .sort((left, right) => left.localeCompare(right)),
    provenance: {
      authority: 'component-expansion-catalog',
      targetName: target.name,
    },
  };
}

function candidateComponents(
  contract: ComponentIntentContractV1,
  components: readonly ComponentMetadata[]
): readonly ComponentMetadata[] {
  const names = new Set(
    [contract.componentName, ...contract.representedBy].map(normalizeName)
  );

  return components
    .filter((component) => names.has(normalizeName(component.name)))
    .sort((left, right) => {
      const leftExact = normalizeName(left.name) === normalizeName(contract.componentName);
      const rightExact =
        normalizeName(right.name) === normalizeName(contract.componentName);

      if (leftExact !== rightExact) {
        return leftExact ? -1 : 1;
      }
      return left.name.localeCompare(right.name);
    });
}

function requiredCapabilitiesForPlatform(
  contract: ComponentIntentContractV1,
  platform: ComponentPlatform
): readonly ComponentCapability[] {
  return orderedCapabilities([
    ...contract.requiredCapabilities,
    ...(contract.platformCapabilities[platform] ?? []),
  ]);
}

function structuralMismatches(
  contract: ComponentIntentContractV1,
  component: ComponentMetadata
): readonly string[] {
  if (normalizeName(component.name) !== normalizeName(contract.componentName)) {
    return [];
  }

  const mismatches: string[] = [];
  if (component.layer !== contract.layer) {
    mismatches.push(`layer:${component.layer}->${contract.layer}`);
  }
  if (component.category !== contract.category) {
    mismatches.push(`category:${component.category}->${contract.category}`);
  }
  if (component.profile !== contract.profile) {
    mismatches.push(`profile:${component.profile}->${contract.profile}`);
  }
  return mismatches;
}

export function evaluateComponentIntentCoverage(
  contract: ComponentIntentContractV1,
  components: readonly ComponentMetadata[]
): ComponentIntentCoverageV1 {
  const candidates = candidateComponents(contract, components);
  const canonical = candidates[0];
  const coverageId = [
    'component-intent-coverage-v1',
    contract.targetId,
    `r${contract.revision}`,
    canonical ? targetIdForName(canonical.name) : 'missing',
  ].join(':');

  if (!canonical) {
    return {
      schemaVersion: COMPONENT_INTENT_SCHEMA_VERSION,
      coverageId,
      targetId: contract.targetId,
      revision: contract.revision,
      requestedComponent: contract.componentName,
      status: 'missing',
      platforms: contract.platforms.map((platform) => ({
        platform,
        status: 'missing',
        requiredCapabilities: requiredCapabilitiesForPlatform(
          contract,
          platform
        ),
        missingCapabilities: requiredCapabilitiesForPlatform(
          contract,
          platform
        ),
      })),
      missingPlatforms: contract.platforms,
      missingCapabilities: orderedCapabilities([
        ...contract.requiredCapabilities,
        ...contract.platforms.flatMap(
          (platform) => contract.platformCapabilities[platform] ?? []
        ),
      ]),
      structuralMismatches: [],
      unresolvedRequirements: contract.unresolvedRequirements,
    };
  }

  const declaredCapabilities = new Set(canonical.capabilities ?? []);
  const platforms = contract.platforms.map((platform) => {
    const requiredCapabilities = requiredCapabilitiesForPlatform(
      contract,
      platform
    );
    const missingCapabilities = requiredCapabilities.filter(
      (capability) => !declaredCapabilities.has(capability)
    );
    const platformMissing = !canonical.platforms.includes(platform);

    return {
      platform,
      status: contract.unresolvedRequirements.length > 0
        ? ('unknown' as const)
        : platformMissing
          ? ('missing' as const)
          : missingCapabilities.length > 0
            ? ('partial' as const)
            : ('satisfied' as const),
      requiredCapabilities,
      missingCapabilities,
    };
  });
  const missingPlatforms = platforms
    .filter((platform) => platform.status === 'missing')
    .map((platform) => platform.platform);
  const missingCapabilities = orderedCapabilities(
    platforms.flatMap((platform) => platform.missingCapabilities)
  );
  const mismatches = structuralMismatches(contract, canonical);
  const status: ComponentIntentCoverageStatus =
    contract.unresolvedRequirements.length > 0
      ? 'unknown'
      : missingPlatforms.length > 0 ||
          missingCapabilities.length > 0 ||
          mismatches.length > 0
        ? 'partial'
        : 'satisfied';

  return {
    schemaVersion: COMPONENT_INTENT_SCHEMA_VERSION,
    coverageId,
    targetId: contract.targetId,
    revision: contract.revision,
    requestedComponent: contract.componentName,
    canonicalComponent: canonical.name,
    status,
    platforms,
    missingPlatforms,
    missingCapabilities,
    structuralMismatches: mismatches,
    unresolvedRequirements: contract.unresolvedRequirements,
  };
}
