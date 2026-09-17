import type {
  ComponentExpansionTarget,
  ComponentMetadata,
} from '@vellira-ui/metadata';

import { evaluateComponentIntentCoverage } from '../../../packages/metadata/src/componentIntent';

import type { ComponentCheckResult } from './types';

export function checkComponentIntentCoverage(params: {
  metadata: ComponentMetadata;
  targets: readonly ComponentExpansionTarget[];
}): readonly ComponentCheckResult[] {
  const target = params.targets.find(
    (candidate) => candidate.name === params.metadata.name
  );

  if (!target) {
    return [];
  }

  const coverage = evaluateComponentIntentCoverage(target, params.metadata);
  const sharedOk =
    coverage.errors.length === 0 && coverage.structuralMismatches.length === 0;
  const sharedDetails = [
    ...coverage.structuralMismatches.map(
      (mismatch) => `Structural mismatch: ${mismatch}.`
    ),
    ...coverage.errors.map((error) => `Intent error: ${error}`),
  ];

  const checks: ComponentCheckResult[] = [
    {
      name: 'intent-coverage',
      ok: sharedOk,
      ...(sharedOk ? {} : { details: sharedDetails.join('\n') }),
    },
  ];

  for (const platform of coverage.platforms) {
    const ok = sharedOk && platform.status === 'satisfied';
    checks.push({
      name: 'intent-coverage',
      platform: platform.platform,
      ok,
      ...(ok
        ? {}
        : {
            details: [
              `Component intent coverage is ${platform.status} on ${platform.platform}.`,
              platform.missingCapabilities.length > 0
                ? `Missing semantic capabilities: ${platform.missingCapabilities.join(', ')}.`
                : null,
              ...sharedDetails,
            ]
              .filter((detail): detail is string => detail !== null)
              .join('\n'),
          }),
    });
  }

  return checks;
}
