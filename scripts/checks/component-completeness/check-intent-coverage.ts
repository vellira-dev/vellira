import {
  evaluateComponentIntentCoverage,
  type ComponentExpansionTarget,
  type ComponentMetadata,
} from '@vellira-ui/metadata';

import type { ComponentCheckResult } from './types';

export function checkComponentIntentCoverage(params: {
  metadata: ComponentMetadata;
  targets: readonly ComponentExpansionTarget[];
}): ComponentCheckResult | null {
  const target = params.targets.find(
    (candidate) => candidate.name === params.metadata.name
  );

  if (!target) {
    return null;
  }

  const coverage = evaluateComponentIntentCoverage(target, params.metadata);
  if (coverage.status === 'satisfied') {
    return {
      name: 'intent-coverage',
      ok: true,
    };
  }

  const details = [
    `Component intent coverage is ${coverage.status} for ${coverage.target}.`,
    ...coverage.structuralMismatches.map(
      (mismatch) => `Structural mismatch: ${mismatch}.`
    ),
    ...coverage.platforms.flatMap((platform) =>
      platform.missingCapabilities.length > 0
        ? [
            `${platform.platform} missing semantic capabilities: ${platform.missingCapabilities.join(
              ', '
            )}.`,
          ]
        : []
    ),
    ...coverage.errors.map((error) => `Intent error: ${error}`),
  ];

  return {
    name: 'intent-coverage',
    ok: false,
    details: details.join('\n'),
  };
}
