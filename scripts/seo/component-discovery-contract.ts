/**
 * Existing component-page metadata that predates Discovery Content V1.
 *
 * This is a temporary migration ledger owned by #1136, not a permanent
 * component-name inference rule. Remove each name as it adopts the contract.
 * Newly generated components are intentionally NOT exempt.
 */
export const LEGACY_DISCOVERY_COMPONENTS = [
  'Accordion',
  'Dropdown',
  'FormField',
  'Modal',
  'Popover',
  'Radio',
  'RadioGroup',
  'Select',
  'Switch',
  'Tabs',
  'Tooltip',
] as const;

export type DiscoveryPlatform = 'react' | 'react-native';

export type DiscoveryContentCandidate = {
  status?: 'complete' | 'needs-authored-intent';
  summary?: string;
  description?: string;
  whenToUse?: readonly string[];
  patterns?: readonly {
    id?: string;
    title?: string;
    description?: string;
  }[];
  platformNotes?: Partial<Record<DiscoveryPlatform, readonly string[]>>;
  missingEvidence?: readonly string[];
};

function hasText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function hasUsableStrings(items: unknown): items is readonly string[] {
  return (
    Array.isArray(items) &&
    items.length > 0 &&
    items.every((item) => hasText(item))
  );
}

/**
 * Validate semantic coverage on adopted or newly generated component pages.
 * This intentionally checks evidence presence, not Google rankings or keywords.
 */
export function getDiscoveryContentFindings(params: {
  discovery: DiscoveryContentCandidate | undefined;
  stable: boolean;
  platforms: readonly DiscoveryPlatform[];
}): string[] {
  const { discovery, stable, platforms } = params;
  const findings: string[] = [];

  if (!discovery) {
    return ['discovery metadata is required'];
  }

  if (!hasText(discovery.summary)) {
    findings.push('discovery.summary must be non-empty');
  }

  if (!hasText(discovery.description)) {
    findings.push('discovery.description must be non-empty');
  }

  if (!hasUsableStrings(discovery.whenToUse)) {
    findings.push('discovery.whenToUse must contain useful guidance');
  }

  if (!Array.isArray(discovery.patterns) || discovery.patterns.length === 0) {
    findings.push('discovery.patterns must contain a developer pattern');
  } else {
    const ids = new Set<string>();

    for (const [index, pattern] of discovery.patterns.entries()) {
      if (
        !hasText(pattern.id) ||
        !hasText(pattern.title) ||
        !hasText(pattern.description)
      ) {
        findings.push('discovery.patterns[' + index + '] is incomplete');
        continue;
      }

      if (ids.has(pattern.id)) {
        findings.push('duplicate discovery pattern id: ' + pattern.id);
      }
      ids.add(pattern.id);
    }

    if (
      discovery.status === 'complete' &&
      !discovery.patterns.some((pattern) => pattern.id !== 'basic')
    ) {
      findings.push('complete discovery needs a non-basic developer pattern');
    }
  }

  for (const platform of platforms) {
    if (!hasUsableStrings(discovery.platformNotes?.[platform])) {
      findings.push(
        'discovery.platformNotes.' + platform + ' must describe the platform boundary'
      );
    }
  }

  if (discovery.status === 'complete') {
    if (
      !Array.isArray(discovery.missingEvidence) ||
      discovery.missingEvidence.length !== 0
    ) {
      findings.push('complete discovery cannot have unresolved evidence');
    }
  } else if (discovery.status === 'needs-authored-intent') {
    if (!hasUsableStrings(discovery.missingEvidence)) {
      findings.push('incomplete discovery must explain missing evidence');
    }
    if (stable) {
      findings.push('Stable component requires complete discovery content');
    }
  } else {
    findings.push('discovery.status must be explicit');
  }

  return findings;
}
