import type {
  ComponentMetadata,
  ComponentTokenLifecycleEntry,
} from '@vellira-ui/metadata';

export type ComponentTokenOwnershipParityFindingCode =
  | 'missing-current-component-token-family'
  | 'missing-component-metadata-owner'
  | 'invalid-current-component-owner'
  | 'invalid-current-component-public-state'
  | 'current-component-metadata-token-opt-out';

export type ComponentTokenOwnershipParityFinding = {
  code: ComponentTokenOwnershipParityFindingCode;
  componentName: string;
  message: string;
};

export type ComponentTokenOwnershipParityResult = {
  metadataTokenFamilies: string[];
  currentTokenFamilies: string[];
  findings: ComponentTokenOwnershipParityFinding[];
};

export function componentMetadataRequiresTokenFamily(
  metadata: Pick<ComponentMetadata, 'requirements'>
): boolean {
  return metadata.requirements.componentTokens !== false;
}

export function auditComponentTokenOwnershipParity(params: {
  metadata: readonly ComponentMetadata[];
  lifecycle: Readonly<Record<string, ComponentTokenLifecycleEntry>>;
}): ComponentTokenOwnershipParityResult {
  const findings: ComponentTokenOwnershipParityFinding[] = [];
  const metadataByName = new Map(
    params.metadata.map((metadata) => [metadata.name, metadata] as const)
  );
  const metadataTokenFamilies = params.metadata
    .filter(componentMetadataRequiresTokenFamily)
    .map((metadata) => metadata.name)
    .sort();
  const currentTokenFamilies = Object.entries(params.lifecycle)
    .filter(([, lifecycle]) => lifecycle.status === 'current')
    .map(([name]) => name)
    .sort();

  for (const componentName of currentTokenFamilies) {
    const lifecycle = params.lifecycle[componentName]!;
    const metadata = metadataByName.get(componentName);

    if (!lifecycle.public) {
      findings.push({
        code: 'invalid-current-component-public-state',
        componentName,
        message: `Current component-token family "${componentName}" must be public.`,
      });
    }

    if (lifecycle.owner !== componentName) {
      findings.push({
        code: 'invalid-current-component-owner',
        componentName,
        message: `Current component-token family "${componentName}" must be owned by canonical component metadata of the same name, not "${lifecycle.owner}".`,
      });
    }

    if (!metadata) {
      findings.push({
        code: 'missing-component-metadata-owner',
        componentName,
        message: `Current component-token family "${componentName}" has no canonical component metadata owner.`,
      });
      continue;
    }

    if (!componentMetadataRequiresTokenFamily(metadata)) {
      findings.push({
        code: 'current-component-metadata-token-opt-out',
        componentName,
        message: `Current component-token family "${componentName}" is materialized even though canonical component metadata opts out of component tokens.`,
      });
    }
  }

  for (const componentName of metadataTokenFamilies) {
    const lifecycle = params.lifecycle[componentName];

    if (lifecycle?.status !== 'current') {
      findings.push({
        code: 'missing-current-component-token-family',
        componentName,
        message: `Canonical component metadata for "${componentName}" requires component tokens, but lifecycle status is ${lifecycle?.status ?? 'missing'} instead of current.`,
      });
    }
  }

  return {
    metadataTokenFamilies,
    currentTokenFamilies,
    findings,
  };
}
