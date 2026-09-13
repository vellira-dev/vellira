import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import type { ComponentPlatform } from '@vellira-ui/metadata';

import type {
  ComponentProductionFinding,
  ComponentProductionInputV1,
  ComponentProductionStageResult,
} from './contracts';

export const COMPONENT_REVIEW_BUNDLE_SCHEMA_VERSION = '1' as const;

export type ComponentReviewBundleSurfaceStatus =
  | 'ready'
  | 'missing'
  | 'not-applicable';

export type ComponentReviewBundleEvidence = {
  kind: 'local-preview' | 'validation';
  description: string;
  revision: string;
  command?: readonly string[];
  route?: string;
  stage?: ComponentProductionStageResult['id'];
};

export type ComponentReviewBundleSurface = {
  id: string;
  label: string;
  required: boolean;
  status: ComponentReviewBundleSurfaceStatus;
  platform?: ComponentPlatform;
  artifacts: readonly string[];
  missingArtifacts: readonly string[];
  evidence: readonly ComponentReviewBundleEvidence[];
};

export type ComponentReviewBundleReport = {
  schemaVersion: typeof COMPONENT_REVIEW_BUNDLE_SCHEMA_VERSION;
  componentName: string;
  revision: string | null;
  status: 'ready' | 'blocked';
  readyForHumanReview: boolean;
  surfaces: readonly ComponentReviewBundleSurface[];
  blockingFindings: readonly ComponentProductionFinding[];
};

export type ComponentReviewBundleResult = {
  report: ComponentReviewBundleReport;
  completenessStage: ComponentProductionStageResult;
};

type SurfaceSpec = {
  id: string;
  label: string;
  required?: boolean;
  platform?: ComponentPlatform;
  requiredPaths?: readonly string[];
  anyOfPaths?: readonly string[];
  contentRequirements?: readonly {
    path: string;
    includes: string;
  }[];
  anyOfContentRequirements?: readonly {
    path: string;
    includes?: string;
  }[];
  evidence?: readonly Omit<ComponentReviewBundleEvidence, 'revision'>[];
};

export type ComponentReviewBundleDependencies = {
  resolveRevision?: (root: string) => string | null;
};

export function runComponentReviewBundle(params: {
  root: string;
  input: ComponentProductionInputV1;
  completenessStage: ComponentProductionStageResult;
  dependencies?: ComponentReviewBundleDependencies;
}): ComponentReviewBundleResult {
  const root = path.resolve(params.root);
  const revision =
    params.dependencies?.resolveRevision?.(root) ?? resolveExactRevision(root);
  const specs = buildSurfaceSpecs(params.input);
  const surfaces = specs.map((spec) => evaluateSurface(root, spec, revision));
  const blockingFindings: ComponentProductionFinding[] = [];

  if (!revision) {
    blockingFindings.push({
      id: 'completeness:review-bundle:revision',
      stage: 'completeness',
      severity: 'blocking',
      message:
        'Component review bundle could not resolve the exact candidate Git revision.',
      ruleId: 'review-bundle.exact-revision',
    });
  }

  for (const surface of surfaces) {
    if (!surface.required || surface.status !== 'missing') {
      continue;
    }

    blockingFindings.push({
      id: `completeness:review-bundle:${normalizeId(surface.id)}`,
      stage: 'completeness',
      severity: 'blocking',
      message: `${surface.label} is missing required review-bundle evidence.`,
      ...(surface.platform ? { platform: surface.platform } : {}),
      ...(surface.missingArtifacts[0]
        ? { path: surface.missingArtifacts[0] }
        : {}),
      ruleId: 'review-bundle.required-surface',
    });
  }

  const ready = blockingFindings.length === 0;
  const report: ComponentReviewBundleReport = {
    schemaVersion: COMPONENT_REVIEW_BUNDLE_SCHEMA_VERSION,
    componentName: params.input.componentName,
    revision,
    status: ready ? 'ready' : 'blocked',
    readyForHumanReview: ready,
    surfaces,
    blockingFindings,
  };

  if (ready) {
    return {
      report,
      completenessStage: params.completenessStage,
    };
  }

  return {
    report,
    completenessStage: {
      ...params.completenessStage,
      status: 'blocked',
      summary:
        'Canonical component completeness passed, but the complete review bundle is not ready for human review.',
      findings: [
        ...params.completenessStage.findings,
        ...blockingFindings,
      ],
    },
  };
}

function buildSurfaceSpecs(input: ComponentProductionInputV1): SurfaceSpec[] {
  const componentName = input.componentName;
  const slug = slugifyComponentName(componentName);
  const lowerName = `${componentName[0]?.toLowerCase() ?? ''}${componentName.slice(1)}`;
  const platforms = selectedPlatforms(input);
  const websiteDir = `apps/website/src/component-catalog/components/${componentName}`;
  const specs: SurfaceSpec[] = [
    {
      id: 'canonical-metadata',
      label: 'Canonical component metadata',
      requiredPaths: [
        `packages/metadata/src/components/${componentName}.metadata.ts`,
      ],
      evidence: [validationEvidence('completeness')],
    },
    {
      id: 'public-types',
      label: 'Public type contract',
      anyOfPaths: [
        `packages/types/src/${lowerName}.ts`,
        ...platforms.map(
          ({ packageName }) =>
            `packages/${packageName}/src/${input.layer}/${componentName}/types.ts`
        ),
      ],
      evidence: [validationEvidence('public-api')],
    },
    {
      id: 'website-component-page',
      label: 'Website component page, playground, examples, API and accessibility',
      requiredPaths: [
        `${websiteDir}/index.ts`,
        `${websiteDir}/${componentName}Examples.tsx`,
        `${websiteDir}/${componentName}Playground.tsx`,
        `${websiteDir}/${componentName}Accessibility.tsx`,
        `${websiteDir}/${lowerName}Api.ts`,
        `${websiteDir}/metadata.ts`,
        ...(input.platform === 'web' || input.platform === 'both'
          ? [`${websiteDir}/${componentName}Demo.tsx`]
          : []),
        ...(input.platform === 'native' || input.platform === 'both'
          ? [`${websiteDir}/Native${componentName}Demo.tsx`]
          : []),
      ],
      evidence: [
        localEvidence(
          ['pnpm', 'website:dev'],
          `/components/${slug}`,
          'Review the exact candidate website component page locally.'
        ),
        validationEvidence('website'),
      ],
    },
    {
      id: 'catalog-registration',
      label: 'Public component catalog registration',
      requiredPaths: [
        'apps/website/src/component-catalog/registry/components.ts',
        'apps/website/src/component-catalog/registry/componentPages.ts',
      ],
      contentRequirements: [
        {
          path: 'apps/website/src/component-catalog/registry/components.ts',
          includes: `slug: '${slug}'`,
        },
        {
          path: 'apps/website/src/component-catalog/registry/componentPages.ts',
          includes: `name: '${componentName}'`,
        },
      ],
      evidence: [
        localEvidence(
          ['pnpm', 'website:dev'],
          '/components',
          'Review the exact candidate component catalog locally.'
        ),
        validationEvidence('website'),
      ],
    },
    {
      id: 'catalog-signature-preview',
      label: 'Public catalog signature preview',
      anyOfContentRequirements: [
        { path: `${websiteDir}/${componentName}CatalogPreview.tsx` },
        {
          path: 'apps/website/src/component-catalog/ComponentCatalogPreview.tsx',
          includes: `case '${slug}'`,
        },
      ],
      evidence: [validationEvidence('website')],
    },
    {
      id: 'validation-evidence',
      label: 'Completeness, quality, API, tooling, visual and smoke evidence',
      requiredPaths: [],
      evidence: [
        validationEvidence('completeness'),
        validationEvidence('quality'),
        validationEvidence('public-api'),
        validationEvidence('tooling'),
        validationEvidence('visual'),
        validationEvidence('smoke'),
      ],
    },
  ];

  for (const platform of platforms) {
    const componentDir = `packages/${platform.packageName}/src/${input.layer}/${componentName}`;
    const docsRoute = `/${platform.docsDirectory}/${slug}`;

    specs.push(
      {
        id: `implementation-${platform.packageName}`,
        label: `${platform.label} implementation and package export`,
        platform: platform.platform,
        requiredPaths: [
          `${componentDir}/${componentName}.tsx`,
          `${componentDir}/index.ts`,
          `packages/${platform.packageName}/src/index.ts`,
        ],
        evidence: [validationEvidence('build')],
      },
      {
        id: `tests-${platform.packageName}`,
        label: `${platform.label} tests and machine-readable coverage contract`,
        platform: platform.platform,
        requiredPaths: [
          `${componentDir}/${componentName}.test.tsx`,
          `${componentDir}/${componentName}.test-contract.json`,
        ],
        evidence: [
          validationEvidence('tests'),
          validationEvidence('completeness'),
        ],
      },
      {
        id: `storybook-${platform.packageName}`,
        label: `${platform.label} Storybook presentation`,
        platform: platform.platform,
        requiredPaths: [`${componentDir}/${componentName}.stories.tsx`],
        evidence:
          platform.platform === 'react'
            ? [
                localEvidence(
                  ['pnpm', 'storybook'],
                  `/?path=/story/${input.layer}-${slug}--default`,
                  'Review the exact candidate Storybook story locally.'
                ),
                validationEvidence('storybook'),
              ]
            : [
                localEvidence(
                  ['pnpm', 'storybook:native'],
                  undefined,
                  'Review the exact candidate native Storybook story locally.'
                ),
                validationEvidence('tests'),
              ],
      },
      {
        id: `docs-${platform.packageName}`,
        label: `${platform.label} VitePress documentation`,
        platform: platform.platform,
        requiredPaths: [
          `apps/docs/src/${platform.docsDirectory}/${slug}.md`,
        ],
        evidence: [
          localEvidence(
            ['pnpm', 'docs:dev'],
            docsRoute,
            'Review the exact candidate VitePress route locally instead of relying on the production docs URL before merge.'
          ),
          validationEvidence('docs'),
        ],
      }
    );
  }

  specs.push({
    id: 'native-playground',
    label: 'Native playground integration',
    required: false,
    platform: 'react-native',
    evidence: [
      localEvidence(
        ['pnpm', 'playground:native'],
        undefined,
        'Native playground evidence becomes required only when the canonical component contract declares that surface.'
      ),
    ],
  });

  return specs;
}

function evaluateSurface(
  root: string,
  spec: SurfaceSpec,
  revision: string | null
): ComponentReviewBundleSurface {
  const required = spec.required ?? true;
  const requiredPaths = spec.requiredPaths ?? [];
  const missingArtifacts = requiredPaths.filter(
    (filePath) => !fs.existsSync(path.join(root, filePath))
  );
  const anyOfPaths = spec.anyOfPaths ?? [];

  if (
    anyOfPaths.length > 0 &&
    !anyOfPaths.some((filePath) => fs.existsSync(path.join(root, filePath)))
  ) {
    missingArtifacts.push(`one-of:${anyOfPaths.join('|')}`);
  }

  const anyOfContentRequirements = spec.anyOfContentRequirements ?? [];

  if (
    anyOfContentRequirements.length > 0 &&
    !anyOfContentRequirements.some((requirement) => {
      const absolutePath = path.join(root, requirement.path);

      if (!fs.existsSync(absolutePath)) {
        return false;
      }

      return requirement.includes
        ? fs.readFileSync(absolutePath, 'utf8').includes(requirement.includes)
        : true;
    })
  ) {
    missingArtifacts.push(
      `one-of:${anyOfContentRequirements
        .map((requirement) =>
          requirement.includes
            ? `${requirement.path}#contains:${requirement.includes}`
            : requirement.path
        )
        .join('|')}`
    );
  }

  for (const requirement of spec.contentRequirements ?? []) {
    const absolutePath = path.join(root, requirement.path);

    if (
      !fs.existsSync(absolutePath) ||
      !fs.readFileSync(absolutePath, 'utf8').includes(requirement.includes)
    ) {
      missingArtifacts.push(
        `${requirement.path}#contains:${requirement.includes}`
      );
    }
  }

  const artifacts = [
    ...requiredPaths.filter((filePath) => fs.existsSync(path.join(root, filePath))),
    ...anyOfPaths.filter((filePath) => fs.existsSync(path.join(root, filePath))),
    ...anyOfContentRequirements
      .map((requirement) => requirement.path)
      .filter((filePath) => fs.existsSync(path.join(root, filePath))),
  ];

  const status: ComponentReviewBundleSurfaceStatus = !required
    ? 'not-applicable'
    : missingArtifacts.length === 0
      ? 'ready'
      : 'missing';

  return {
    id: spec.id,
    label: spec.label,
    required,
    status,
    ...(spec.platform ? { platform: spec.platform } : {}),
    artifacts: [...new Set(artifacts)].sort(),
    missingArtifacts: [...new Set(missingArtifacts)].sort(),
    evidence: (spec.evidence ?? []).map((item) => ({
      ...item,
      revision: revision ?? 'unresolved',
    })),
  };
}

function selectedPlatforms(input: ComponentProductionInputV1) {
  const platforms: Array<{
    packageName: 'react' | 'react-native';
    platform: ComponentPlatform;
    docsDirectory: 'react' | 'react-native';
    label: 'React' | 'React Native';
  }> = [];

  if (input.platform === 'web' || input.platform === 'both') {
    platforms.push({
      packageName: 'react',
      platform: 'react',
      docsDirectory: 'react',
      label: 'React',
    });
  }

  if (input.platform === 'native' || input.platform === 'both') {
    platforms.push({
      packageName: 'react-native',
      platform: 'react-native',
      docsDirectory: 'react-native',
      label: 'React Native',
    });
  }

  return platforms;
}

function validationEvidence(
  stage: ComponentProductionStageResult['id']
): Omit<ComponentReviewBundleEvidence, 'revision'> {
  return {
    kind: 'validation',
    stage,
    description: `Canonical ${stage} validation passed for this candidate revision.`,
  };
}

function localEvidence(
  command: readonly string[],
  route: string | undefined,
  description: string
): Omit<ComponentReviewBundleEvidence, 'revision'> {
  return {
    kind: 'local-preview',
    command,
    ...(route ? { route } : {}),
    description,
  };
}

function resolveExactRevision(root: string): string | null {
  const result = spawnSync('git', ['rev-parse', 'HEAD'], {
    cwd: root,
    encoding: 'utf8',
    shell: false,
  });
  const revision = result.status === 0 ? result.stdout.trim() : '';

  return /^[0-9a-f]{40}$/i.test(revision) ? revision : null;
}

function slugifyComponentName(componentName: string) {
  return componentName
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

function normalizeId(value: string) {
  return value.replace(/[^a-zA-Z0-9-]+/g, '-').toLowerCase();
}
