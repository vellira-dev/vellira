import fs from 'node:fs';
import path from 'node:path';

import type {
  ComponentCapability,
  ComponentMetadata,
} from '@vellira-ui/metadata';

import { qualityRoot } from '../root';

import type {
  ComponentQualityRule,
  ComponentQualityRuleContext,
} from '../types';

import { createRuleFinding as finding } from './finding';
import { collectFiles, componentDirectory } from './source-files';

type SourceCorpus = {
  files: readonly string[];
  source: string;
};

function readCorpus(files: readonly string[]): SourceCorpus {
  return {
    files,
    source: files.map((file) => fs.readFileSync(file, 'utf8')).join('\n'),
  };
}

function stripNonBehavioralCoverageMarkers(source: string) {
  return source
    .split('\n')
    .filter((line) => !/^\s*\/\/\s*Coverage contract:/.test(line))
    .join('\n');
}

function relativeEvidence(
  context: ComponentQualityRuleContext,
  files: readonly string[]
) {
  return files
    .slice(0, 6)
    .map((file) => path.relative(qualityRoot(context), file));
}

function hasAny(source: string, patterns: readonly RegExp[]) {
  return patterns.some((pattern) => pattern.test(source));
}

const sharedTestSignals: Partial<
  Record<ComponentCapability, readonly RegExp[]>
> = {
  controlled: [
    /\bcontrolled\b/i,
    /\bopen\b[\s\S]{0,120}\bonOpenChange\b/i,
    /\bvalue\b[\s\S]{0,120}\bonValueChange\b/i,
    /\bchecked\b[\s\S]{0,120}\bonCheckedChange\b/i,
  ],
  uncontrolled: [
    /\buncontrolled\b/i,
    /\bdefaultOpen\b/i,
    /\bdefaultValue\b/i,
    /\bdefaultChecked\b/i,
  ],
  indeterminate: [/\bindeterminate\b/i],
  disabled: [/\bdisabled\b/i],
  required: [/\brequired\b/i],
  invalid: [/\binvalid\b/i, /\berror\b/i, /\baria-invalid\b/i],
  loading: [/\bloading\b/i],
  'compound-api': [/\.(?:Root|Item|Trigger|Content)\b/, /\bcompound\b/i],
  multiple: [/\bmultiple\b/i, /type\s*=\s*['"]multiple['"]/],
  collapsible: [/\bcollapsible\b/i],
  responsive: [/\bresponsive\b/i, /\buseWindowDimensions\b/, /\bresize\b/i],
};

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function hasInteractionDrivenUncontrolledCoverage(
  context: ComponentQualityRuleContext,
  source: string
) {
  const componentName = escapeRegExp(context.metadata.name);
  const uncontrolledRoot = new RegExp(
    `<${componentName}(?![^>]*\\b(?:open|value|checked)\\s*=)[^>]*>`,
    's'
  );
  const interactionEvidence =
    /\.(?:click|focus)\(\)|\bmouseenter\b|\bfocusin\b|\bfireEvent\.press\b|\buserEvent\b[\s\S]{0,80}\bpress\b/i;
  const observableStateEvidence =
    /\bnot\.toBeNull\(\)|\btoContain\(|\bnot\.toContain\(|\bdata-state\b|\brole=["'](?:dialog|tooltip)["']/i;

  return (
    uncontrolledRoot.test(source) &&
    interactionEvidence.test(source) &&
    observableStateEvidence.test(source)
  );
}

function missingTestCoverage(
  context: ComponentQualityRuleContext,
  source: string
): string[] {
  const capabilities = context.metadata.capabilities ?? [];
  const missing: string[] = [];

  for (const capability of capabilities) {
    const shared = sharedTestSignals[capability];

    if (!shared) continue;

    if (
      capability === 'uncontrolled' &&
      (hasAny(source, shared) ||
        hasInteractionDrivenUncontrolledCoverage(context, source))
    ) {
      continue;
    }

    if (!hasAny(source, shared)) {
      missing.push(capability);
    }
  }

  return [...new Set(missing)];
}

export const testCoverageRule: ComponentQualityRule = {
  definition: {
    id: 'coverage.tests',
    dimension: 'tests',
    severity: 'required',
    evaluation: 'automated',
    description:
      'Checks executable tests, assertions, and platform-appropriate deterministic coverage for important declared contracts.',
  },
  evaluate(context) {
    if (!context.metadata.requirements.tests) {
      return finding(
        testCoverageRule,
        context,
        'not-applicable',
        'Canonical metadata does not require tests.'
      );
    }

    const componentDir = componentDirectory(
      qualityRoot(context),
      context.metadata,
      context.platform
    );
    const files = collectFiles(componentDir, (fileName) =>
      /(?:\.test|\.spec)\.(?:ts|tsx)$/.test(fileName)
    );
    const corpus = readCorpus(files);

    if (
      files.length === 0 ||
      !/\b(?:it|test)\s*\(/.test(corpus.source) ||
      !/\bexpect\s*\(/.test(corpus.source)
    ) {
      return finding(
        testCoverageRule,
        context,
        'fail',
        'Tests are required, but no executable test/assertion evidence was found.',
        [path.relative(qualityRoot(context), componentDir)]
      );
    }

    const missing = missingTestCoverage(
      context,
      stripNonBehavioralCoverageMarkers(corpus.source)
    );

    if (missing.length > 0) {
      return finding(
        testCoverageRule,
        context,
        'fail',
        `Important contracts are missing deterministic test coverage evidence: ${missing.join(', ')}.`,
        relativeEvidence(context, files)
      );
    }
    return finding(
      testCoverageRule,
      context,
      'pass',
      undefined,
      relativeEvidence(context, files)
    );
  },
};

const representativeStorySignals: Partial<
  Record<ComponentCapability, readonly RegExp[]>
> = {
  controlled: [
    /\bControlled\b/,
    /\bopen\b[\s\S]{0,120}\bonOpenChange\b/,
    /\bvalue\b[\s\S]{0,120}\bonValueChange\b/,
  ],
  uncontrolled: [
    /\bUncontrolled\b/,
    /\bdefaultOpen\b/,
    /\bdefaultValue\b/,
    /\bdefaultChecked\b/,
  ],
  indeterminate: [/\bIndeterminate\b/, /\bindeterminate\b/],
  disabled: [/\bDisabled\b/, /\bdisabled\b/],
  required: [/\bRequired\b/, /\brequired\b/],
  invalid: [/\bInvalid\b/, /\bError\b/, /\binvalid\b/, /\berror\b/],
  loading: [/\bLoading\b/, /\bloading\b/],
};

function missingStoryCoverage(
  metadata: ComponentMetadata,
  source: string
): string[] {
  const missing: string[] = [];

  for (const capability of metadata.capabilities ?? []) {
    const patterns = representativeStorySignals[capability];
    if (patterns && !hasAny(source, patterns)) {
      missing.push(capability);
    }
  }

  return missing;
}

export const storybookCoverageRule: ComponentQualityRule = {
  definition: {
    id: 'coverage.storybook',
    dimension: 'storybook',
    severity: 'recommended',
    evaluation: 'automated',
    description:
      'Checks exported stories and representative user-facing states without requiring internal implementation details.',
  },
  evaluate(context) {
    if (!context.metadata.requirements.storybook) {
      return finding(
        storybookCoverageRule,
        context,
        'not-applicable',
        'Canonical metadata does not require Storybook.'
      );
    }

    const componentDir = componentDirectory(
      qualityRoot(context),
      context.metadata,
      context.platform
    );
    const files = collectFiles(componentDir, (fileName) =>
      /\.stories\.(?:ts|tsx)$/.test(fileName)
    );
    const corpus = readCorpus(files);

    if (files.length === 0 || !/\bexport const\b/.test(corpus.source)) {
      return finding(
        storybookCoverageRule,
        context,
        'warn',
        'Storybook coverage is expected, but no exported story evidence was found.',
        [path.relative(qualityRoot(context), componentDir)]
      );
    }

    const missing = missingStoryCoverage(context.metadata, corpus.source);

    if (missing.length > 0) {
      return finding(
        storybookCoverageRule,
        context,
        'warn',
        `Representative Storybook coverage is missing deterministic evidence for: ${missing.join(', ')}.`,
        relativeEvidence(context, files)
      );
    }

    return finding(
      storybookCoverageRule,
      context,
      'pass',
      undefined,
      relativeEvidence(context, files)
    );
  },
};

function documentationDirectory(rootDir: string, metadata: ComponentMetadata) {
  return path.join(
    rootDir,
    'apps',
    'website',
    'src',
    'component-catalog',
    'components',
    metadata.name
  );
}

function hasSubstantialFile(filePath: string, minimumLength = 80) {
  return (
    fs.existsSync(filePath) &&
    fs.readFileSync(filePath, 'utf8').trim().length >= minimumLength
  );
}

function findApiDocumentationFile(docsDir: string) {
  if (!fs.existsSync(docsDir)) return undefined;

  return fs
    .readdirSync(docsDir)
    .filter((fileName) => /Api\.ts$/.test(fileName))
    .sort()[0];
}

export const documentationCoverageRule: ComponentQualityRule = {
  definition: {
    id: 'coverage.documentation',
    dimension: 'documentation',
    severity: 'required',
    evaluation: 'automated',
    description:
      'Checks deterministic usage, examples, API, platform, and accessibility documentation surfaces.',
  },
  evaluate(context) {
    if (!context.metadata.requirements.docs) {
      return finding(
        documentationCoverageRule,
        context,
        'not-applicable',
        'Canonical metadata does not require public documentation.'
      );
    }

    const docsDir = documentationDirectory(
      qualityRoot(context),
      context.metadata
    );
    const name = context.metadata.name;
    const apiFileName = findApiDocumentationFile(docsDir);
    const expected = [
      path.join(docsDir, `${name}Usage.tsx`),
      path.join(docsDir, `${name}Examples.tsx`),
    ];

    if (apiFileName) {
      expected.push(path.join(docsDir, apiFileName));
    }

    if (context.metadata.requirements.accessibility) {
      expected.push(path.join(docsDir, `${name}Accessibility.tsx`));
    }

    if (context.metadata.platforms.includes('react-native')) {
      expected.push(path.join(docsDir, `Native${name}Demo.tsx`));
    }

    const missing: string[] = [];

    if (!apiFileName) {
      missing.push('*Api.ts');
    }

    for (const file of expected) {
      if (!hasSubstantialFile(file)) {
        missing.push(path.basename(file));
      }
    }

    if (missing.length > 0) {
      return finding(
        documentationCoverageRule,
        context,
        'fail',
        `Required documentation surfaces are missing or too thin: ${[
          ...new Set(missing),
        ].join(', ')}.`,
        expected.map((file) => path.relative(qualityRoot(context), file))
      );
    }

    const combined = expected
      .map((file) => fs.readFileSync(file, 'utf8'))
      .join('\n');

    if (
      context.metadata.platforms.includes('react-native') &&
      !/\b(?:react-native|native|platform)\b/i.test(combined)
    ) {
      return finding(
        documentationCoverageRule,
        context,
        'fail',
        'Cross-platform component documentation does not contain deterministic platform-specific evidence.',
        relativeEvidence(context, expected)
      );
    }

    return finding(
      documentationCoverageRule,
      context,
      'pass',
      undefined,
      relativeEvidence(context, expected)
    );
  },
};

export const coverageQualityRules: readonly ComponentQualityRule[] = [
  testCoverageRule,
  storybookCoverageRule,
  documentationCoverageRule,
];
