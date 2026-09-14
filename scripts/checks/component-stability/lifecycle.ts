import { spawnSync } from 'node:child_process';

import {
  componentLifecycleStatuses,
  componentMetadata,
} from '../../../packages/metadata/src';
import type {
  ComponentLifecycle,
  ComponentMetadata,
  ComponentStabilityReportV1,
} from '@vellira-ui/metadata';

import {
  runComponentStabilityCheck,
  validateComponentLifecycleTransition,
} from './engine';

export type ComponentLifecycleValidation = {
  component: string;
  previous: ComponentLifecycle | null;
  next: ComponentLifecycle;
  valid: boolean;
  error?: string;
  stability?: ComponentStabilityReportV1;
};

export async function validateCanonicalLifecycleTransitions(params: {
  metadataRegistry?: readonly ComponentMetadata[];
  previousStatuses: ReadonlyMap<string, ComponentLifecycle>;
  runStability?: (componentName: string) => Promise<ComponentStabilityReportV1>;
}) {
  const metadataRegistry = params.metadataRegistry ?? componentMetadata;
  const runStability =
    params.runStability ??
    ((componentName: string) => runComponentStabilityCheck({ componentName }));
  const results: ComponentLifecycleValidation[] = [];

  for (const metadata of metadataRegistry) {
    const previous = params.previousStatuses.get(metadata.name) ?? null;
    const stability =
      metadata.status === 'stable' && previous !== 'stable'
        ? await runStability(metadata.name)
        : undefined;
    const transition = validateComponentLifecycleTransition({
      component: metadata.name,
      previous,
      next: metadata.status,
      stability,
    });

    results.push({
      component: metadata.name,
      previous,
      next: metadata.status,
      valid: transition.valid,
      ...(!transition.valid ? { error: transition.error } : {}),
      ...(stability ? { stability } : {}),
    });
  }

  return results;
}

function readStatusFromSource(source: string, componentName: string) {
  const match = source.match(/\bstatus\s*:\s*['"]([^'"]+)['"]/);
  const status = match?.[1];

  if (
    !status ||
    !componentLifecycleStatuses.includes(status as ComponentLifecycle)
  ) {
    throw new Error(
      `Could not read a canonical lifecycle for ${componentName} from the base revision.`
    );
  }

  return status as ComponentLifecycle;
}

export function readBaseLifecycleStatuses(params: {
  rootDir: string;
  baseRevision: string;
  metadataRegistry?: readonly ComponentMetadata[];
}) {
  const statuses = new Map<string, ComponentLifecycle>();
  const revision = spawnSync(
    'git',
    [
      '--no-optional-locks',
      'rev-parse',
      '--verify',
      `${params.baseRevision}^{commit}`,
    ],
    {
      cwd: params.rootDir,
      encoding: 'utf8',
      shell: false,
      timeout: 10_000,
    }
  );

  if (revision.status !== 0) {
    throw new Error(
      `Could not resolve lifecycle base revision "${params.baseRevision}".`
    );
  }

  for (const metadata of params.metadataRegistry ?? componentMetadata) {
    const file = `packages/metadata/src/components/${metadata.name}.metadata.ts`;
    const result = spawnSync(
      'git',
      ['--no-optional-locks', 'show', `${params.baseRevision}:${file}`],
      {
        cwd: params.rootDir,
        encoding: 'utf8',
        shell: false,
        timeout: 10_000,
      }
    );

    if (result.status !== 0) {
      continue;
    }

    statuses.set(
      metadata.name,
      readStatusFromSource(result.stdout, metadata.name)
    );
  }

  return statuses;
}
