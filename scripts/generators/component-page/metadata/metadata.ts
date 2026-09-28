import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

import ts from 'typescript';

import type { ComponentPageMetadata } from '../../../../apps/website/src/component-catalog/metadata';
import {
  CANONICAL_RELATED_COMPONENT_CONSTRAINTS,
  canonicalComponentSlugs,
} from '../../../../apps/website/src/component-catalog/registry/componentIdentity';
import type { ExtractedProp, Platform } from '../model/types';
import { slugify } from '../helpers/format';

export type { ComponentPageMetadata };

export type ComponentPageProfile = NonNullable<
  ComponentPageMetadata['profile']
>;

export type ApiDescriptionAnalysis = 'available' | 'blocked';

const MAX_SEMANTIC_FINDINGS = 128;
const MAX_SEMANTIC_FINDING_LENGTH = 2_000;
const MAX_SEMANTIC_FINDINGS_LENGTH = 8_000;
const RESERVED_SEMANTIC_FINDINGS_LENGTH = 7_800;

function boundSemanticFinding(finding: string) {
  if (finding.length <= MAX_SEMANTIC_FINDING_LENGTH) return finding;

  const digest = createHash('sha256')
    .update(finding, 'utf8')
    .digest('hex')
    .slice(0, 16);
  const suffix = `… [sha256:${digest}]`;
  return `${finding.slice(0, MAX_SEMANTIC_FINDING_LENGTH - suffix.length)}${suffix}`;
}

function boundSemanticFindings(findings: readonly string[]) {
  const uniqueOriginalFindings = [...new Set(findings)];
  const orderedFindings: string[] = [];
  const emittedFindings = new Set<string>();
  let totalLength = 0;

  for (const finding of uniqueOriginalFindings) {
    const boundedFinding = boundSemanticFinding(finding);

    if (emittedFindings.has(boundedFinding)) continue;
    if (
      orderedFindings.length >= MAX_SEMANTIC_FINDINGS - 1 ||
      totalLength + boundedFinding.length > RESERVED_SEMANTIC_FINDINGS_LENGTH
    ) {
      continue;
    }

    emittedFindings.add(boundedFinding);
    orderedFindings.push(boundedFinding);
    totalLength += boundedFinding.length;
  }

  let omittedCount = uniqueOriginalFindings.length - orderedFindings.length;
  while (omittedCount > 0) {
    const sentinel = `${omittedCount} additional metadata finding(s) omitted by the bounded semantic protocol`;
    const collisionIndex = orderedFindings.indexOf(sentinel);
    if (collisionIndex >= 0) {
      totalLength -= orderedFindings[collisionIndex].length;
      orderedFindings.splice(collisionIndex, 1);
      omittedCount += 1;
      continue;
    }
    if (
      sentinel.length > MAX_SEMANTIC_FINDING_LENGTH ||
      totalLength + sentinel.length > MAX_SEMANTIC_FINDINGS_LENGTH
    ) {
      throw new Error(
        'Bounded semantic finding sentinel exceeds its protocol limits.'
      );
    }
    orderedFindings.push(sentinel);
    break;
  }

  return orderedFindings;
}

export class ComponentMetadataValidationError extends Error {
  readonly componentName: string;
  readonly findings: readonly string[];
  readonly analysisComplete: boolean;
  readonly apiDescriptionAnalysis: ApiDescriptionAnalysis;

  constructor(
    componentName: string,
    findings: readonly string[],
    options: {
      analysisComplete?: boolean;
      apiDescriptionAnalysis?: ApiDescriptionAnalysis;
    } = {}
  ) {
    const orderedFindings = boundSemanticFindings(findings);

    super(
      `Invalid component page metadata for ${componentName}:\n${orderedFindings
        .map((finding) => `  - ${finding}`)
        .join('\n')}`
    );
    this.name = 'ComponentMetadataValidationError';
    this.componentName = componentName;
    this.findings = orderedFindings;
    this.analysisComplete = options.analysisComplete ?? true;
    this.apiDescriptionAnalysis = options.apiDescriptionAnalysis ?? 'available';
  }
}

export function assertValidComponentMetadataFindings(params: {
  componentName: string;
  findings: readonly string[];
  analysisComplete?: boolean;
  apiDescriptionAnalysis?: ApiDescriptionAnalysis;
}) {
  if (params.findings.length > 0) {
    throw new ComponentMetadataValidationError(
      params.componentName,
      params.findings,
      {
        analysisComplete: params.analysisComplete,
        apiDescriptionAnalysis: params.apiDescriptionAnalysis,
      }
    );
  }
}

export function loadGeneratedComponentProfile(params: {
  root: string;
  componentName: string;
}): ComponentPageProfile | undefined {
  const metadataFile = path.join(
    params.root,
    'packages',
    'metadata',
    'src',
    'components',
    `${params.componentName}.metadata.ts`
  );

  if (!fs.existsSync(metadataFile)) {
    return undefined;
  }

  const source = fs.readFileSync(metadataFile, 'utf8');
  const match = source.match(
    /\bprofile:\s*['"](base|form-control|compound|overlay)['"]/
  );

  const profile = match?.[1];

  if (!profile) {
    return undefined;
  }

  return profile === 'base' ? 'primitive' : (profile as ComponentPageProfile);
}

export type GeneratedComponentCategory =
  | 'action'
  | 'form'
  | 'navigation'
  | 'overlay'
  | 'feedback'
  | 'data-display'
  | 'layout'
  | 'utility';

export function loadGeneratedComponentCategory(params: {
  root: string;
  componentName: string;
}): GeneratedComponentCategory | undefined {
  const metadataFile = path.join(
    params.root,
    'packages',
    'metadata',
    'src',
    'components',
    `${params.componentName}.metadata.ts`
  );

  if (!fs.existsSync(metadataFile)) {
    return undefined;
  }

  const source = fs.readFileSync(metadataFile, 'utf8');
  const match = source.match(
    /\bcategory:\s*['"](action|form|navigation|overlay|feedback|data-display|layout|utility)['"]/
  );

  return match?.[1] as GeneratedComponentCategory | undefined;
}

export function getComponentCatalogDir(params: {
  catalogComponentsRoot: string;
  componentName: string;
}) {
  return path.join(params.catalogComponentsRoot, params.componentName);
}

export function getComponentMetadataFile(params: {
  catalogComponentsRoot: string;
  componentName: string;
}) {
  return path.join(getComponentCatalogDir(params), 'metadata.ts');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function collectUnknownKeys(params: {
  value: Record<string, unknown>;
  path: string;
  allowed: readonly string[];
}) {
  const allowed = new Set(params.allowed);

  return Object.keys(params.value)
    .filter((key) => !allowed.has(key))
    .map((key) => `${params.path}.${key} is not a supported metadata field`);
}

function collectStringArrayShape(value: unknown, field: string) {
  if (!Array.isArray(value)) {
    return [`${field} must be an array`];
  }

  return value.flatMap((item, index) =>
    typeof item === 'string' ? [] : [`${field}[${index}] must be a string`]
  );
}

function collectPrimitiveRecordShape(params: {
  value: unknown;
  field: string;
  allowedTypes: readonly ('string' | 'boolean' | 'number')[];
}) {
  if (!isRecord(params.value)) {
    return [`${params.field} must be an object`];
  }

  return Object.entries(params.value).flatMap(([key, value]) =>
    params.allowedTypes.includes(
      typeof value as 'string' | 'boolean' | 'number'
    )
      ? []
      : [`${params.field}.${key} must be ${params.allowedTypes.join(', ')}`]
  );
}

function collectOptionalStringArray(
  value: Record<string, unknown>,
  key: string,
  path: string
) {
  return value[key] === undefined
    ? []
    : collectStringArrayShape(value[key], `${path}.${key}`);
}

function collectPlatformMetadataShape(value: unknown, path: string) {
  if (!isRecord(value)) {
    return [`${path} must be an object`];
  }

  const findings = collectUnknownKeys({
    value,
    path,
    allowed: [
      'demoProps',
      'children',
      'childPropBindings',
      'imports',
      'setup',
      'responsivePresentation',
    ],
  });

  for (const key of ['demoProps', 'children'] as const) {
    if (value[key] !== undefined && typeof value[key] !== 'string') {
      findings.push(`${path}.${key} must be a string`);
    }
  }

  for (const key of ['imports', 'setup'] as const) {
    findings.push(...collectOptionalStringArray(value, key, path));
  }

  if (
    value.responsivePresentation !== undefined &&
    typeof value.responsivePresentation !== 'boolean'
  ) {
    findings.push(`${path}.responsivePresentation must be a boolean`);
  }

  if (value.childPropBindings !== undefined) {
    if (!Array.isArray(value.childPropBindings)) {
      findings.push(`${path}.childPropBindings must be an array`);
    } else {
      for (const [index, binding] of value.childPropBindings.entries()) {
        const bindingPath = `${path}.childPropBindings[${index}]`;

        if (!isRecord(binding)) {
          findings.push(`${bindingPath} must be an object`);
          continue;
        }

        findings.push(
          ...collectUnknownKeys({
            value: binding,
            path: bindingPath,
            allowed: ['target', 'props'],
          })
        );

        if (typeof binding.target !== 'string') {
          findings.push(`${bindingPath}.target must be a string`);
        }

        findings.push(
          ...collectStringArrayShape(binding.props, `${bindingPath}.props`)
        );
      }
    }
  }

  return findings;
}

function collectExampleShape(value: unknown, path: string) {
  if (!isRecord(value)) {
    return [`${path} must be an object`];
  }

  const findings = collectUnknownKeys({
    value,
    path,
    allowed: [
      'title',
      'description',
      'props',
      'inheritDemoProps',
      'imports',
      'reactImports',
      'nativeImports',
      'setup',
      'reactSetup',
      'nativeSetup',
      'reactProps',
      'nativeProps',
      'reactChildren',
      'nativeChildren',
      'platforms',
    ],
  });

  for (const key of ['title', 'description'] as const) {
    if (typeof value[key] !== 'string') {
      findings.push(`${path}.${key} must be a string`);
    }
  }

  for (const key of [
    'props',
    'imports',
    'reactImports',
    'nativeImports',
    'setup',
    'reactSetup',
    'nativeSetup',
    'reactProps',
    'nativeProps',
    'platforms',
  ] as const) {
    if (key === 'props' || value[key] !== undefined) {
      findings.push(...collectStringArrayShape(value[key], `${path}.${key}`));
    }
  }

  for (const key of ['reactChildren', 'nativeChildren'] as const) {
    if (value[key] !== undefined && typeof value[key] !== 'string') {
      findings.push(`${path}.${key} must be a string`);
    }
  }

  if (
    value.inheritDemoProps !== undefined &&
    typeof value.inheritDemoProps !== 'boolean'
  ) {
    findings.push(`${path}.inheritDemoProps must be a boolean`);
  }

  return findings;
}

function collectAccessibilityEntriesShape(value: unknown, path: string) {
  if (!Array.isArray(value)) {
    return [`${path} must be an array`];
  }

  return value.flatMap((item, index) => {
    const itemPath = `${path}[${index}]`;

    if (!isRecord(item)) {
      return [`${itemPath} must be an object`];
    }

    const findings = collectUnknownKeys({
      value: item,
      path: itemPath,
      allowed: ['title', 'description', 'props'],
    });

    for (const key of ['title', 'description'] as const) {
      if (typeof item[key] !== 'string') {
        findings.push(`${itemPath}.${key} must be a string`);
      }
    }

    findings.push(...collectOptionalStringArray(item, 'props', itemPath));
    return findings;
  });
}

const COMPONENT_METADATA_KEYS = [
  'profile',
  'react',
  'native',
  'demo',
  'catalogPreview',
  'defaults',
  'discovery',
  'examples',
  'api',
  'accessibility',
  'related',
] as const;

export function collectComponentMetadataRuntimeShapeFindings(
  metadata: unknown
) {
  if (!isRecord(metadata)) {
    return ['metadata.ts must export a metadata object'];
  }

  const findings = collectUnknownKeys({
    value: metadata,
    path: 'metadata',
    allowed: COMPONENT_METADATA_KEYS,
  });

  if (
    metadata.profile !== undefined &&
    ![
      'primitive',
      'form-control',
      'selection-control',
      'compound',
      'overlay',
      'navigation',
    ].includes(metadata.profile as string)
  ) {
    findings.push('metadata.profile has an unsupported value');
  }

  for (const key of ['react', 'native'] as const) {
    if (metadata[key] !== undefined) {
      findings.push(...collectPlatformMetadataShape(metadata[key], key));
    }
  }

  if (metadata.demo !== undefined) {
    if (!isRecord(metadata.demo)) {
      findings.push('demo must be an object');
    } else {
      const demo = metadata.demo;
      findings.push(
        ...collectUnknownKeys({
          value: demo,
          path: 'demo',
          allowed: [
            'label',
            'description',
            'excludeControls',
            'initialValues',
            'staticProps',
            'satisfiedRequiredProps',
            'previewWidth',
          ],
        })
      );

      for (const key of ['label', 'description'] as const) {
        if (demo[key] !== undefined && typeof demo[key] !== 'string') {
          findings.push(`demo.${key} must be a string`);
        }
      }

      for (const key of [
        'excludeControls',
        'satisfiedRequiredProps',
      ] as const) {
        findings.push(...collectOptionalStringArray(demo, key, 'demo'));
      }

      if (demo.initialValues !== undefined) {
        findings.push(
          ...collectPrimitiveRecordShape({
            value: demo.initialValues,
            field: 'demo.initialValues',
            allowedTypes: ['string', 'boolean', 'number'],
          })
        );
      }

      if (demo.staticProps !== undefined) {
        findings.push(
          ...collectPrimitiveRecordShape({
            value: demo.staticProps,
            field: 'demo.staticProps',
            allowedTypes: ['string'],
          })
        );
      }

      if (
        demo.previewWidth !== undefined &&
        !['auto', 'field', 'full'].includes(demo.previewWidth as string)
      ) {
        findings.push('demo.previewWidth has an unsupported value');
      }
    }
  }

  if (metadata.catalogPreview !== undefined) {
    if (!isRecord(metadata.catalogPreview)) {
      findings.push('catalogPreview must be an object');
    } else {
      const preview = metadata.catalogPreview;
      findings.push(
        ...collectUnknownKeys({
          value: preview,
          path: 'catalogPreview',
          allowed: ['layout', 'props', 'children'],
        })
      );

      if (
        preview.layout !== undefined &&
        !['auto', 'field', 'column', 'stack'].includes(preview.layout as string)
      ) {
        findings.push('catalogPreview.layout has an unsupported value');
      }

      findings.push(
        ...collectOptionalStringArray(preview, 'props', 'catalogPreview')
      );
      if (
        preview.children !== undefined &&
        typeof preview.children !== 'string'
      ) {
        findings.push('catalogPreview.children must be a string');
      }
    }
  }

  if (metadata.defaults !== undefined) {
    if (!isRecord(metadata.defaults)) {
      findings.push('defaults must be an object');
    } else {
      findings.push(
        ...collectUnknownKeys({
          value: metadata.defaults,
          path: 'defaults',
          allowed: ['shared', 'react', 'native'],
        })
      );
      for (const key of ['shared', 'react', 'native'] as const) {
        if (metadata.defaults[key] !== undefined) {
          findings.push(
            ...collectPrimitiveRecordShape({
              value: metadata.defaults[key],
              field: `defaults.${key}`,
              allowedTypes: ['string', 'boolean', 'number'],
            })
          );
        }
      }
    }
  }

  if (metadata.discovery !== undefined) {
    if (!isRecord(metadata.discovery)) {
      findings.push('discovery must be an object');
    } else {
      const discovery = metadata.discovery;
      findings.push(
        ...collectUnknownKeys({
          value: discovery,
          path: 'discovery',
          allowed: [
            'status',
            'summary',
            'description',
            'whenToUse',
            'patterns',
            'platformNotes',
            'missingEvidence',
          ],
        })
      );
      if (
        discovery.status !== undefined &&
        !['complete', 'needs-authored-intent'].includes(
          discovery.status as string
        )
      ) {
        findings.push('discovery.status has an unsupported value');
      }
      for (const key of ['summary', 'description'] as const) {
        if (
          discovery[key] !== undefined &&
          typeof discovery[key] !== 'string'
        ) {
          findings.push(`discovery.${key} must be a string`);
        }
      }
      for (const key of ['whenToUse', 'missingEvidence'] as const) {
        findings.push(
          ...collectOptionalStringArray(discovery, key, 'discovery')
        );
      }
      if (discovery.patterns !== undefined) {
        if (!Array.isArray(discovery.patterns)) {
          findings.push('discovery.patterns must be an array');
        } else {
          for (const [index, pattern] of discovery.patterns.entries()) {
            const patternPath = `discovery.patterns[${index}]`;
            if (!isRecord(pattern)) {
              findings.push(`${patternPath} must be an object`);
              continue;
            }
            findings.push(
              ...collectUnknownKeys({
                value: pattern,
                path: patternPath,
                allowed: ['id', 'title', 'description'],
              })
            );
            for (const key of ['id', 'title', 'description'] as const) {
              if (typeof pattern[key] !== 'string') {
                findings.push(`${patternPath}.${key} must be a string`);
              }
            }
          }
        }
      }
      if (discovery.platformNotes !== undefined) {
        if (!isRecord(discovery.platformNotes)) {
          findings.push('discovery.platformNotes must be an object');
        } else {
          findings.push(
            ...collectUnknownKeys({
              value: discovery.platformNotes,
              path: 'discovery.platformNotes',
              allowed: ['react', 'react-native'],
            })
          );
          for (const key of ['react', 'react-native'] as const) {
            findings.push(
              ...collectOptionalStringArray(
                discovery.platformNotes,
                key,
                'discovery.platformNotes'
              )
            );
          }
        }
      }
    }
  }

  if (metadata.examples !== undefined) {
    if (!Array.isArray(metadata.examples)) {
      findings.push('examples must be an array');
    } else {
      for (const [index, example] of metadata.examples.entries()) {
        findings.push(...collectExampleShape(example, `examples[${index}]`));
      }
    }
  }

  if (metadata.api !== undefined) {
    if (!isRecord(metadata.api)) {
      findings.push('api must be an object');
    } else {
      const api = metadata.api;
      findings.push(
        ...collectUnknownKeys({
          value: api,
          path: 'api',
          allowed: ['sections', 'descriptions'],
        })
      );
      if (api.descriptions !== undefined) {
        findings.push(
          ...collectPrimitiveRecordShape({
            value: api.descriptions,
            field: 'api.descriptions',
            allowedTypes: ['string'],
          })
        );
      }
      if (api.sections !== undefined) {
        if (!Array.isArray(api.sections)) {
          findings.push('api.sections must be an array');
        } else {
          for (const [index, section] of api.sections.entries()) {
            const sectionPath = `api.sections[${index}]`;
            if (!isRecord(section)) {
              findings.push(`${sectionPath} must be an object`);
              continue;
            }
            findings.push(
              ...collectUnknownKeys({
                value: section,
                path: sectionPath,
                allowed: ['name', 'exportName'],
              })
            );
            if (typeof section.name !== 'string') {
              findings.push(`${sectionPath}.name must be a string`);
            }
            if (typeof section.exportName === 'string') {
              continue;
            }
            if (!isRecord(section.exportName)) {
              findings.push(
                `${sectionPath}.exportName must be a string or platform object`
              );
              continue;
            }
            findings.push(
              ...collectUnknownKeys({
                value: section.exportName,
                path: `${sectionPath}.exportName`,
                allowed: ['react', 'react-native'],
              })
            );
            for (const [platform, exportName] of Object.entries(
              section.exportName
            )) {
              if (typeof exportName !== 'string') {
                findings.push(
                  `${sectionPath}.exportName.${platform} must be a string`
                );
              }
            }
          }
        }
      }
    }
  }

  if (metadata.accessibility !== undefined) {
    if (!isRecord(metadata.accessibility)) {
      findings.push('accessibility must be an object');
    } else {
      findings.push(
        ...collectUnknownKeys({
          value: metadata.accessibility,
          path: 'accessibility',
          allowed: ['react', 'native'],
        })
      );
      for (const key of ['react', 'native'] as const) {
        if (metadata.accessibility[key] !== undefined) {
          findings.push(
            ...collectAccessibilityEntriesShape(
              metadata.accessibility[key],
              `accessibility.${key}`
            )
          );
        }
      }
    }
  }

  if (metadata.related !== undefined) {
    findings.push(...collectStringArrayShape(metadata.related, 'related'));
  }

  return findings;
}

export function collectComponentMetadataDecisionFindings(params: {
  metadata: Readonly<Record<string, unknown>>;
  requireRelatedDecision?: boolean;
  requireCatalogPreviewDecision?: boolean;
}) {
  const findings: string[] = [];

  if (params.requireRelatedDecision && params.metadata.related === undefined) {
    findings.push(
      'related must be explicitly defined; use related: [] when no related components are intended'
    );
  }

  if (
    params.requireCatalogPreviewDecision &&
    params.metadata.catalogPreview === undefined
  ) {
    findings.push(
      'catalogPreview must be explicitly defined; provide catalogPreview: {} or a hand-authored CatalogPreview'
    );
  }

  return findings;
}

export type ComponentMetadataAnalysis = {
  metadata: ComponentPageMetadata;
  apiDescriptionMetadata: ComponentPageMetadata;
  findings: readonly string[];
  decisionFindings: readonly string[];
  blockedPaths: ReadonlySet<string>;
  analysisComplete: boolean;
  apiDescriptionAnalysis: ApiDescriptionAnalysis;
};

function safelyAnalyzableMetadata(
  metadata: Readonly<Record<string, unknown>>
): {
  metadata: ComponentPageMetadata;
  apiDescriptionMetadata: ComponentPageMetadata;
  blockedKeys: ReadonlySet<(typeof COMPONENT_METADATA_KEYS)[number]>;
  blockedPaths: ReadonlySet<string>;
} {
  const safeMetadata: Record<string, unknown> = {};
  const blockedKeys = new Set<(typeof COMPONENT_METADATA_KEYS)[number]>();
  const blockedPaths = new Set<string>();

  function sanitizeValue(
    value: unknown,
    validate: (candidate: unknown) => boolean,
    valuePath: string
  ): unknown {
    if (validate(value)) return value;

    if (Array.isArray(value)) {
      if (!validate([])) {
        blockedPaths.add(valuePath);
        return undefined;
      }
      return value.map((item, index) =>
        sanitizeValue(
          item,
          (candidate) => validate([candidate]),
          `${valuePath}[${index}]`
        )
      );
    }

    if (isRecord(value)) {
      if (!validate({})) {
        blockedPaths.add(valuePath);
        return undefined;
      }
      const safeRecord: Record<string, unknown> = {};
      for (const [childKey, childValue] of Object.entries(value)) {
        const safeChild = sanitizeValue(
          childValue,
          (candidate) => validate({ [childKey]: candidate }),
          `${valuePath}.${childKey}`
        );
        if (safeChild !== undefined) safeRecord[childKey] = safeChild;
      }
      return safeRecord;
    }

    blockedPaths.add(valuePath);
    return undefined;
  }

  function sanitizeExample(value: unknown, index: number) {
    if (!isRecord(value)) return undefined;

    const path = `examples[${index}]`;
    const baseline: Record<string, unknown> = {
      title: '',
      description: '',
      props: [],
    };
    const safeExample: Record<string, unknown> = {};

    for (const [key, childValue] of Object.entries(value)) {
      const safeChild = sanitizeValue(
        childValue,
        (candidate) =>
          collectExampleShape({ ...baseline, [key]: candidate }, path)
            .length === 0,
        `${path}.${key}`
      );
      if (safeChild !== undefined) safeExample[key] = safeChild;
    }

    return safeExample;
  }

  function sanitizeChildPropBinding(
    value: unknown,
    platform: 'react' | 'native',
    index: number
  ) {
    if (!isRecord(value)) return undefined;

    const baseline: Record<string, unknown> = {
      target: '',
      props: [],
    };
    const safeBinding: Record<string, unknown> = {};

    for (const [key, childValue] of Object.entries(value)) {
      const safeChild = sanitizeValue(
        childValue,
        (candidate) =>
          collectPlatformMetadataShape(
            {
              childPropBindings: [{ ...baseline, [key]: candidate }],
            },
            platform
          ).length === 0,
        `${platform}.childPropBindings[${index}].${key}`
      );
      if (safeChild !== undefined) safeBinding[key] = safeChild;
    }

    return safeBinding;
  }

  function sanitizeApiSection(value: unknown, index: number) {
    if (!isRecord(value)) return undefined;

    const baseline: Record<string, unknown> = {
      name: '',
      exportName: '',
    };
    const safeSection: Record<string, unknown> = {};

    for (const [key, childValue] of Object.entries(value)) {
      const safeChild = sanitizeValue(
        childValue,
        (candidate) =>
          collectComponentMetadataRuntimeShapeFindings({
            api: { sections: [{ ...baseline, [key]: candidate }] },
          }).length === 0,
        `api.sections[${index}].${key}`
      );
      if (safeChild !== undefined) safeSection[key] = safeChild;
    }

    return safeSection;
  }

  for (const key of COMPONENT_METADATA_KEYS) {
    const value = metadata[key];
    if (value === undefined) continue;

    const keyFindings = collectComponentMetadataRuntimeShapeFindings({
      [key]: value,
    });
    if (keyFindings.length === 0) {
      safeMetadata[key] = value;
      continue;
    }

    blockedKeys.add(key);

    // A local shape failure cannot hide independent semantics in safe sibling
    // fields. The canonical shape collector defines which partial values can
    // be analyzed; no diagnostic strings or duplicate dependency map are used.
    if (key === 'examples' && Array.isArray(value)) {
      safeMetadata.examples = value.map((example, index) => {
        const safeExample = sanitizeExample(example, index);
        if (safeExample === undefined) blockedPaths.add(`examples[${index}]`);
        return safeExample;
      });
      continue;
    }

    let safeValue = sanitizeValue(
      value,
      (candidate) =>
        collectComponentMetadataRuntimeShapeFindings({
          [key]: candidate,
        }).length === 0,
      key
    );

    if (
      (key === 'react' || key === 'native') &&
      isRecord(value) &&
      Array.isArray(value.childPropBindings)
    ) {
      const safePlatform = isRecord(safeValue) ? safeValue : {};
      safePlatform.childPropBindings = value.childPropBindings.map(
        (binding, index) => {
          const safeBinding = sanitizeChildPropBinding(binding, key, index);
          if (safeBinding === undefined) {
            blockedPaths.add(`${key}.childPropBindings[${index}]`);
          }
          return safeBinding;
        }
      );
      safeValue = safePlatform;
    }

    if (key === 'api' && isRecord(value) && Array.isArray(value.sections)) {
      const safeApi = isRecord(safeValue) ? safeValue : {};
      safeApi.sections = value.sections.map((section, index) => {
        const safeSection = sanitizeApiSection(section, index);
        if (safeSection === undefined) {
          blockedPaths.add(`api.sections[${index}]`);
        }
        return safeSection;
      });
      safeValue = safeApi;
    }

    if (safeValue !== undefined) safeMetadata[key] = safeValue;
  }

  const apiDescriptionMetadata = { ...safeMetadata };
  if (isRecord(apiDescriptionMetadata.api)) {
    const safeApi = { ...apiDescriptionMetadata.api };
    if (isRecord(metadata.api) && Array.isArray(metadata.api.sections)) {
      safeApi.sections = metadata.api.sections.filter(
        (section) =>
          collectComponentMetadataRuntimeShapeFindings({
            api: { sections: [section] },
          }).length === 0
      );
    } else {
      delete safeApi.sections;
    }
    apiDescriptionMetadata.api = safeApi;
  }

  return {
    metadata: safeMetadata as ComponentPageMetadata,
    apiDescriptionMetadata: apiDescriptionMetadata as ComponentPageMetadata,
    blockedKeys,
    blockedPaths,
  };
}

export async function loadComponentMetadataAnalysis(params: {
  catalogComponentsRoot: string;
  componentName: string;
  requireRelatedDecision?: boolean;
  requireCatalogPreviewDecision?: boolean;
}): Promise<ComponentMetadataAnalysis> {
  const metadataFile = getComponentMetadataFile(params);

  if (!fs.existsSync(metadataFile)) {
    const metadata = {};
    return {
      metadata,
      apiDescriptionMetadata: metadata,
      findings: [],
      decisionFindings: collectComponentMetadataDecisionFindings({
        metadata,
        requireRelatedDecision: params.requireRelatedDecision,
        requireCatalogPreviewDecision: params.requireCatalogPreviewDecision,
      }),
      blockedPaths: new Set<string>(),
      analysisComplete: true,
      apiDescriptionAnalysis: 'available',
    };
  }

  let metadataModule: { default?: unknown; metadata?: unknown };

  try {
    metadataModule = (await import(pathToFileURL(metadataFile).href)) as {
      default?: unknown;
      metadata?: unknown;
    };
  } catch {
    throw new ComponentMetadataValidationError(
      params.componentName,
      ['metadata.ts could not be loaded as a TypeScript module'],
      { analysisComplete: false, apiDescriptionAnalysis: 'blocked' }
    );
  }

  const rawMetadata = metadataModule.default ?? metadataModule.metadata ?? {};
  const findings = collectComponentMetadataRuntimeShapeFindings(rawMetadata);
  if (!isRecord(rawMetadata)) {
    return {
      metadata: {},
      apiDescriptionMetadata: {},
      findings,
      decisionFindings: [],
      blockedPaths: new Set<string>(),
      analysisComplete: false,
      apiDescriptionAnalysis: 'blocked',
    };
  }

  const safe = safelyAnalyzableMetadata(rawMetadata);
  return {
    metadata: safe.metadata,
    apiDescriptionMetadata: safe.apiDescriptionMetadata,
    findings,
    decisionFindings: collectComponentMetadataDecisionFindings({
      metadata: rawMetadata,
      requireRelatedDecision: params.requireRelatedDecision,
      requireCatalogPreviewDecision: params.requireCatalogPreviewDecision,
    }),
    blockedPaths: safe.blockedPaths,
    analysisComplete: safe.blockedKeys.size === 0,
    apiDescriptionAnalysis:
      rawMetadata.api !== undefined && safe.metadata.api === undefined
        ? 'blocked'
        : 'available',
  };
}

export async function loadComponentMetadata(params: {
  catalogComponentsRoot: string;
  componentName: string;
}): Promise<ComponentPageMetadata> {
  const analysis = await loadComponentMetadataAnalysis(params);
  if (analysis.findings.length > 0) {
    throw new ComponentMetadataValidationError(
      params.componentName,
      analysis.findings,
      {
        analysisComplete: analysis.analysisComplete,
        apiDescriptionAnalysis: analysis.apiDescriptionAnalysis,
      }
    );
  }

  return analysis.metadata;
}

function mergeObject<T extends Record<string, unknown>>(
  base: T | undefined,
  override: T | undefined
) {
  return {
    ...(base ?? {}),
    ...(override ?? {}),
  } as T;
}

function mergePlatformMetadata(
  base: ComponentPageMetadata['react'],
  override: ComponentPageMetadata['react']
) {
  const overrideImports = override?.imports ?? [];
  const overrideSetup = override?.setup ?? [];
  const imports = overrideImports.some((entry) => entry === undefined)
    ? overrideImports
    : Array.from(new Set([...(base?.imports ?? []), ...overrideImports]));
  const setup = overrideSetup.some((entry) => entry === undefined)
    ? overrideSetup
    : Array.from(new Set([...(base?.setup ?? []), ...overrideSetup]));

  return {
    ...(base ?? {}),
    ...(override ?? {}),
    ...(imports.length > 0 ? { imports } : {}),
    ...(setup.length > 0 ? { setup } : {}),
  };
}

export function mergeComponentMetadata(
  base: ComponentPageMetadata,
  override: ComponentPageMetadata
): ComponentPageMetadata {
  return {
    ...base,
    ...override,
    react: mergePlatformMetadata(base.react, override.react),
    native: mergePlatformMetadata(base.native, override.native),
    demo: {
      ...(base.demo ?? {}),
      ...(override.demo ?? {}),
      initialValues: mergeObject(
        base.demo?.initialValues,
        override.demo?.initialValues
      ),
      staticProps: mergeObject(
        base.demo?.staticProps,
        override.demo?.staticProps
      ),
    },
    defaults: {
      ...(base.defaults ?? {}),
      ...(override.defaults ?? {}),
      shared: mergeObject(base.defaults?.shared, override.defaults?.shared),
      react: mergeObject(base.defaults?.react, override.defaults?.react),
      native: mergeObject(base.defaults?.native, override.defaults?.native),
    },
    api: {
      ...(base.api ?? {}),
      ...(override.api ?? {}),
      descriptions: mergeObject(
        base.api?.descriptions,
        override.api?.descriptions
      ),
      sections: override.api?.sections ?? base.api?.sections,
    },
    examples: override.examples ?? base.examples,
    accessibility: {
      ...(base.accessibility ?? {}),
      ...(override.accessibility ?? {}),
      react: override.accessibility?.react ?? base.accessibility?.react,
      native: override.accessibility?.native ?? base.accessibility?.native,
    },
    related: override.related ?? base.related,
  };
}

function importLocallyBindsName(source: string, localName: string) {
  const sourceFile = ts.createSourceFile(
    'component-page-metadata-import.ts',
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );

  return sourceFile.statements.some((statement) => {
    if (!ts.isImportDeclaration(statement) || !statement.importClause) {
      return false;
    }

    const { importClause } = statement;

    if (importClause.name?.text === localName) {
      return true;
    }

    const { namedBindings } = importClause;

    if (!namedBindings) {
      return false;
    }

    if (ts.isNamespaceImport(namedBindings)) {
      return namedBindings.name.text === localName;
    }

    return namedBindings.elements.some(
      (element) => element.name.text === localName
    );
  });
}

function getParseError(sourceFile: ts.SourceFile) {
  const diagnostics =
    (sourceFile as ts.SourceFile & { parseDiagnostics?: ts.Diagnostic[] })
      .parseDiagnostics ?? [];
  const diagnostic = diagnostics.find(
    (item) => item.category === ts.DiagnosticCategory.Error
  );

  return diagnostic
    ? ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')
    : null;
}

function validateImportDeclaration(source: string) {
  if (!source.trim()) {
    return 'must not be empty';
  }

  const sourceFile = ts.createSourceFile(
    'component-page-metadata-import.ts',
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );
  const parseError = getParseError(sourceFile);

  if (parseError) {
    return parseError;
  }

  if (
    sourceFile.statements.length === 0 ||
    sourceFile.statements.some(
      (statement) => !ts.isImportDeclaration(statement)
    )
  ) {
    return 'must contain only import declarations';
  }

  return null;
}

function getJsxAttributeNames(source: string) {
  const sourceFile = ts.createSourceFile(
    'component-page-metadata-props.tsx',
    `<Component ${source} />`,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );
  const parseError = getParseError(sourceFile);

  if (parseError) {
    return { error: parseError, names: [] as string[] };
  }

  const statement = sourceFile.statements[0];
  const expression = ts.isExpressionStatement(statement)
    ? statement.expression
    : null;

  if (!expression || !ts.isJsxSelfClosingElement(expression)) {
    return {
      error: 'must be valid JSX prop fragments',
      names: [] as string[],
    };
  }

  const names: string[] = [];

  for (const property of expression.attributes.properties) {
    if (ts.isJsxSpreadAttribute(property)) {
      return {
        error: 'must not use JSX spread attributes',
        names,
      };
    }

    if (!ts.isIdentifier(property.name)) {
      return {
        error: 'must use identifier prop names',
        names,
      };
    }

    names.push(property.name.text);
  }

  return { error: null, names };
}

function normalizePropFragments(props: readonly (string | undefined)[]) {
  return props.flatMap((prop) =>
    typeof prop === 'string'
      ? prop
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean)
      : []
  );
}

function validatePropFragments(params: {
  field: string;
  fragments: readonly (string | undefined)[];
  allowEmpty?: boolean;
}) {
  const errors: string[] = [];
  const fragments = normalizePropFragments(params.fragments);

  if (!params.allowEmpty) {
    params.fragments.forEach((fragment, index) => {
      if (typeof fragment === 'string' && !fragment.trim()) {
        errors.push(`${params.field}[${index}] must not be empty`);
      }
    });
  }

  if (fragments.length === 0) {
    return errors;
  }

  const { error, names } = getJsxAttributeNames(fragments.join('\n'));

  if (error) {
    errors.push(`${params.field} has invalid JSX prop syntax: ${error}`);
    return errors;
  }

  const seenNames = new Set<string>();

  for (const name of names) {
    if (seenNames.has(name)) {
      errors.push(`${params.field} contains duplicate prop "${name}"`);
    }

    seenNames.add(name);
  }

  return errors;
}

function validateExpression(params: { field: string; source: string }) {
  if (!params.source.trim()) {
    return `${params.field} must not be empty`;
  }

  const { error } = getJsxAttributeNames(`value={${params.source}}`);

  return error
    ? `${params.field} has invalid TypeScript/JSX expression syntax: ${error}`
    : null;
}

function containsGeneratedComponentRoot(source: string, componentName: string) {
  const marker = `<${componentName}`;
  let index = source.indexOf(marker);

  while (index !== -1) {
    const nextCharacter = source[index + marker.length];

    if (
      nextCharacter === '>' ||
      nextCharacter === '/' ||
      (nextCharacter !== undefined && nextCharacter.trim() === '')
    ) {
      return true;
    }

    index = source.indexOf(marker, index + marker.length);
  }

  return false;
}

function validateJsxChildren(params: {
  componentName: string;
  field: string;
  source: string;
}) {
  const sourceFile = ts.createSourceFile(
    'component-page-metadata-children.tsx',
    `<Component>${params.source}</Component>`,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );
  const parseError = getParseError(sourceFile);

  if (parseError) {
    return `${params.field} has invalid JSX child syntax: ${parseError}`;
  }

  if (containsGeneratedComponentRoot(params.source, params.componentName)) {
    return `${params.field} must contain inner child markup, not a second <${params.componentName}> root`;
  }

  return null;
}

function isBarePropFragment(fragment: string) {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(fragment);
}

function validateSetupSyntax(source: string) {
  const result = ts.transpileModule(
    `function ComponentExamplePreview() {\n${source}\n}`,
    {
      compilerOptions: {
        jsx: ts.JsxEmit.Preserve,
        target: ts.ScriptTarget.ES2022,
      },
      fileName: 'component-page-example-setup.tsx',
      reportDiagnostics: true,
    }
  );

  const diagnostic = result.diagnostics?.find(
    (item) => item.category === ts.DiagnosticCategory.Error
  );

  return diagnostic
    ? ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')
    : null;
}

const canonicalSlugSemantics =
  'expected an exact canonical public component slug from apps/website/src/component-catalog/registry/componentPresentation.ts, using lowercase kebab-case where applicable';

export function validateRelatedComponentSlugs(params: {
  componentName: string;
  related: readonly (string | undefined)[] | undefined;
}) {
  const errors: string[] = [];
  const related = params.related ?? [];
  const sourceSlug = slugify(params.componentName);
  const seen = new Set<string>();
  const canonicalComponentSlugSet = new Set(canonicalComponentSlugs);

  for (const [index, relatedSlug] of related.entries()) {
    if (relatedSlug === undefined) continue;

    const field = `related[${index}]`;
    const prefix = `${params.componentName} ${field} "${relatedSlug}"`;

    if (
      CANONICAL_RELATED_COMPONENT_CONSTRAINTS.relatedMustNotReferenceSelf &&
      relatedSlug === sourceSlug
    ) {
      errors.push(
        `${prefix} is invalid: related components must not reference the source component "${sourceSlug}"`
      );
    }

    if (
      CANONICAL_RELATED_COMPONENT_CONSTRAINTS.relatedMustBeUnique &&
      seen.has(relatedSlug)
    ) {
      errors.push(
        `${prefix} is invalid: duplicate related component slug "${relatedSlug}"`
      );
    }

    seen.add(relatedSlug);

    if (
      CANONICAL_RELATED_COMPONENT_CONSTRAINTS.relatedMustUseCanonicalSlug &&
      !canonicalComponentSlugSet.has(relatedSlug)
    ) {
      errors.push(
        `${prefix} is invalid: unknown or non-canonical related component slug; ${canonicalSlugSemantics}`
      );
    }
  }

  return errors;
}

export function collectComponentMetadataFindings(params: {
  componentName: string;
  metadata: ComponentPageMetadata;
  blockedPaths?: ReadonlySet<string>;
  requireRelatedDecision?: boolean;
  requireCatalogPreviewDecision?: boolean;
}) {
  const {
    componentName,
    metadata,
    blockedPaths = new Set<string>(),
    requireRelatedDecision = false,
    requireCatalogPreviewDecision = false,
  } = params;
  const errors: string[] = [];
  const exampleTitles = new Set<string>();
  const apiSections = new Set<string>();
  const isPathBlocked = (field: string) =>
    [...blockedPaths].some(
      (blockedPath) =>
        blockedPath === field ||
        blockedPath.startsWith(`${field}.`) ||
        blockedPath.startsWith(`${field}[`)
    );

  errors.push(
    ...collectComponentMetadataDecisionFindings({
      metadata: metadata as Readonly<Record<string, unknown>>,
      requireRelatedDecision,
      requireCatalogPreviewDecision,
    })
  );

  const catalogPreview = metadata.catalogPreview;

  if (catalogPreview) {
    errors.push(
      ...validatePropFragments({
        field: 'catalogPreview.props',
        fragments: catalogPreview.props ?? [],
      })
    );

    if (catalogPreview.children !== undefined) {
      const childrenError = validateJsxChildren({
        componentName,
        field: 'catalogPreview.children',
        source: catalogPreview.children,
      });

      if (childrenError) {
        errors.push(childrenError);
      }
    }
  }

  errors.push(
    ...validateRelatedComponentSlugs({
      componentName,
      related: metadata.related,
    })
  );

  if (
    Object.prototype.hasOwnProperty.call(
      metadata.demo?.staticProps ?? {},
      'children'
    )
  ) {
    errors.push(
      'demo.staticProps.children is not supported; use react.children/native.children for inner JSX'
    );
  }

  for (const [platform, platformMetadata] of [
    ['react', metadata.react],
    ['react-native', metadata.native],
  ] as const) {
    for (const [index, source] of (platformMetadata?.imports ?? []).entries()) {
      if (typeof source !== 'string') continue;

      const importError = validateImportDeclaration(source);

      if (importError) {
        errors.push(`${platform}.imports[${index}] ${importError}`);
      }

      if (importLocallyBindsName(source, componentName)) {
        errors.push(
          `${platform}.imports[${index}] must not bind generated component "${componentName}"`
        );
      }
    }

    for (const [index, source] of (platformMetadata?.setup ?? []).entries()) {
      if (typeof source !== 'string') continue;

      if (!source.trim()) {
        errors.push(`${platform}.setup[${index}] must not be empty`);
      }
    }

    const platformSetup = (platformMetadata?.setup ?? [])
      .flatMap((statement) =>
        typeof statement === 'string' ? [statement.trim()] : []
      )
      .filter(Boolean);

    if (platformSetup.length > 0) {
      const setupError = validateSetupSyntax(platformSetup.join('\n'));

      if (setupError) {
        errors.push(
          `${platform}.setup has invalid TypeScript syntax: ${setupError}`
        );
      }
    }

    errors.push(
      ...validatePropFragments({
        field: `${platform}.demoProps`,
        fragments: platformMetadata?.demoProps
          ? [platformMetadata.demoProps]
          : [],
        allowEmpty: true,
      })
    );

    if (platformMetadata?.children !== undefined) {
      const childrenError = validateJsxChildren({
        componentName,
        field: `${platform}.children`,
        source: platformMetadata.children,
      });

      if (childrenError) {
        errors.push(childrenError);
      }
    }

    for (const [bindingIndex, binding] of (
      platformMetadata?.childPropBindings ?? []
    ).entries()) {
      if (binding === undefined) continue;

      if (
        typeof binding.target === 'string' &&
        !/^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*$/.test(binding.target)
      ) {
        errors.push(
          `${platform}.childPropBindings[${bindingIndex}].target must be a JSX component name`
        );
      }

      errors.push(
        ...validatePropFragments({
          field: `${platform}.childPropBindings[${bindingIndex}].props`,
          fragments: binding.props ?? [],
        })
      );
    }
  }

  for (const [name, value] of Object.entries(
    metadata.demo?.staticProps ?? {}
  )) {
    const expressionError = validateExpression({
      field: `demo.staticProps.${name}`,
      source: value,
    });

    if (expressionError) {
      errors.push(expressionError);
    }
  }

  for (const [index, example] of (metadata.examples ?? []).entries()) {
    if (example === undefined) continue;

    if (typeof example.title === 'string' && exampleTitles.has(example.title)) {
      errors.push(`duplicate example title "${example.title}"`);
    }

    if (typeof example.title === 'string') exampleTitles.add(example.title);

    const platformsBlocked = isPathBlocked(`examples[${index}].platforms`);

    const knownPlatforms = (example.platforms ?? []).filter(
      (platform): platform is Platform => typeof platform === 'string'
    );

    for (const platform of knownPlatforms) {
      if (platform !== 'react' && platform !== 'react-native') {
        errors.push(
          `examples[${index}] has unsupported platform "${platform}"`
        );
      }
    }

    const platforms = new Set(
      platformsBlocked
        ? knownPlatforms
        : (example.platforms ?? ['react', 'react-native'])
    );

    if (!platformsBlocked && !platforms.has('react')) {
      for (const field of [
        'reactImports',
        'reactSetup',
        'reactProps',
        'reactChildren',
      ] as const) {
        if (example[field] !== undefined) {
          errors.push(
            `examples[${index}].${field} is set but the example does not target react`
          );
        }
      }
    }

    if (!platformsBlocked && !platforms.has('react-native')) {
      for (const field of [
        'nativeImports',
        'nativeSetup',
        'nativeProps',
        'nativeChildren',
      ] as const) {
        if (example[field] !== undefined) {
          errors.push(
            `examples[${index}].${field} is set but the example does not target react-native`
          );
        }
      }
    }

    for (const [field, imports] of [
      ['imports', example.imports],
      ['reactImports', example.reactImports],
      ['nativeImports', example.nativeImports],
    ] as const) {
      for (const [importIndex, source] of (imports ?? []).entries()) {
        if (typeof source !== 'string') continue;

        const importError = validateImportDeclaration(source);

        if (importError) {
          errors.push(
            `examples[${index}].${field}[${importIndex}] ${importError}`
          );
        }
      }
    }

    errors.push(
      ...validatePropFragments({
        field: `examples[${index}].props`,
        fragments: example.props ?? [],
      }),
      ...validatePropFragments({
        field: `examples[${index}].reactProps`,
        fragments: example.reactProps ?? [],
      }),
      ...validatePropFragments({
        field: `examples[${index}].nativeProps`,
        fragments: example.nativeProps ?? [],
      })
    );

    const sharedPropNames = getJsxAttributeNames(
      normalizePropFragments(example.props ?? []).join('\n')
    ).names;

    for (const [field, platformProps] of [
      ['reactProps', example.reactProps],
      ['nativeProps', example.nativeProps],
    ] as const) {
      const platformPropNames = getJsxAttributeNames(
        normalizePropFragments(platformProps ?? []).join('\n')
      ).names;

      for (const name of platformPropNames) {
        if (sharedPropNames.includes(name)) {
          errors.push(
            `examples[${index}].${field}.${name} conflicts with examples[${index}].props.${name}; use one owner for the generated root prop`
          );
        }
      }
    }

    for (const [field, children] of [
      ['reactChildren', example.reactChildren],
      ['nativeChildren', example.nativeChildren],
    ] as const) {
      if (children === undefined) {
        continue;
      }

      const childrenError = validateJsxChildren({
        componentName,
        field: `examples[${index}].${field}`,
        source: children,
      });

      if (childrenError) {
        errors.push(childrenError);
      }
    }

    for (const [platform, platformSetup] of [
      ['react', example.reactSetup],
      ['react-native', example.nativeSetup],
    ] as const) {
      const setup = [...(example.setup ?? []), ...(platformSetup ?? [])]
        .flatMap((statement) =>
          typeof statement === 'string' ? [statement.trim()] : []
        )
        .filter(Boolean);

      if (setup.length === 0) {
        continue;
      }

      const setupError = validateSetupSyntax(setup.join('\n'));

      if (setupError) {
        errors.push(
          `examples[${index}] ${platform} setup has invalid TypeScript syntax: ${setupError}`
        );
      }
    }
  }

  for (const section of metadata.api?.sections ?? []) {
    if (section === undefined || typeof section.name !== 'string') continue;

    if (apiSections.has(section.name)) {
      errors.push(`duplicate API section "${section.name}"`);
    }

    apiSections.add(section.name);
  }

  return errors;
}

export function validateComponentMetadata(params: {
  componentName: string;
  metadata: ComponentPageMetadata;
  requireRelatedDecision?: boolean;
  requireCatalogPreviewDecision?: boolean;
}) {
  assertValidComponentMetadataFindings({
    componentName: params.componentName,
    findings: collectComponentMetadataFindings(params),
  });
}

export function collectComponentMetadataAgainstApiFindings(params: {
  componentName: string;
  metadata: ComponentPageMetadata;
  blockedPaths?: ReadonlySet<string>;
  platforms: readonly Platform[];
  reactApiProps: readonly ExtractedProp[];
  nativeApiProps: readonly ExtractedProp[];
}) {
  const {
    componentName,
    metadata,
    blockedPaths = new Set<string>(),
    platforms,
  } = params;
  const errors: string[] = [];
  const isPathBlocked = (field: string) =>
    [...blockedPaths].some(
      (blockedPath) =>
        blockedPath === field ||
        blockedPath.startsWith(`${field}.`) ||
        blockedPath.startsWith(`${field}[`)
    );

  function getApiProps(platform: Platform) {
    return platform === 'react' ? params.reactApiProps : params.nativeApiProps;
  }

  function getApiProp(platform: Platform, propName: string) {
    return getApiProps(platform).find((prop) => prop.name === propName);
  }

  function hasAnyApiProp(propName: string) {
    return platforms.some((platform) =>
      Boolean(getApiProp(platform, propName))
    );
  }

  function validateAnyPlatformPropNames(params: {
    field: string;
    names: readonly (string | undefined)[];
  }) {
    for (const name of params.names) {
      if (typeof name !== 'string') continue;

      if (!hasAnyApiProp(name)) {
        errors.push(`${params.field}.${name} is not present in any target API`);
      }
    }
  }

  function validatePlatformPropNames(params: {
    platform: Platform;
    field: string;
    names: readonly string[];
  }) {
    if (!platforms.includes(params.platform)) {
      return;
    }

    for (const name of params.names) {
      if (!getApiProp(params.platform, name)) {
        errors.push(
          `${params.field}.${name} is not present in the ${params.platform} API`
        );
      }
    }
  }

  function validatePropNames(params: {
    platform: Platform;
    field: string;
    fragments: readonly string[];
  }) {
    const fragments = normalizePropFragments(params.fragments);

    if (fragments.length === 0) {
      return;
    }

    const { names } = getJsxAttributeNames(fragments.join('\n'));

    for (const name of names) {
      const apiProp = getApiProp(params.platform, name);

      if (!apiProp) {
        const fragment = fragments.find((item) => item.startsWith(name));
        const qualifier =
          fragment && isBarePropFragment(fragment)
            ? ' bare prop fragment'
            : ' prop fragment';

        errors.push(
          `${params.field}${qualifier} "${name}" is not present in the ${params.platform} API`
        );
        continue;
      }

      if (
        fragments.some((fragment) => fragment === name) &&
        apiProp.kind !== 'boolean'
      ) {
        errors.push(
          `${params.field} bare prop fragment "${name}" uses bare JSX syntax for non-boolean prop "${name}"`
        );
      }
    }
  }

  validateAnyPlatformPropNames({
    field: 'demo.initialValues',
    names: Object.keys(metadata.demo?.initialValues ?? {}),
  });
  validateAnyPlatformPropNames({
    field: 'demo.excludeControls',
    names: [...(metadata.demo?.excludeControls ?? [])],
  });
  validateAnyPlatformPropNames({
    field: 'demo.satisfiedRequiredProps',
    names: [...(metadata.demo?.satisfiedRequiredProps ?? [])],
  });
  validateAnyPlatformPropNames({
    field: 'defaults.shared',
    names: Object.keys(metadata.defaults?.shared ?? {}),
  });
  validatePlatformPropNames({
    platform: 'react',
    field: 'defaults.react',
    names: Object.keys(metadata.defaults?.react ?? {}),
  });
  validatePlatformPropNames({
    platform: 'react-native',
    field: 'defaults.native',
    names: Object.keys(metadata.defaults?.native ?? {}),
  });

  for (const platform of platforms) {
    const platformMetadata =
      platform === 'react' ? metadata.react : metadata.native;

    validatePropNames({
      platform,
      field: `${platform}.demoProps`,
      fragments: platformMetadata?.demoProps
        ? [platformMetadata.demoProps]
        : [],
    });

    for (const name of Object.keys(metadata.demo?.staticProps ?? {})) {
      if (!getApiProp(platform, name)) {
        errors.push(
          `demo.staticProps.${name} is not present in the ${platform} API`
        );
      }
    }

    for (const [bindingIndex, binding] of (
      platformMetadata?.childPropBindings ?? []
    ).entries()) {
      if (binding === undefined) continue;

      validatePropNames({
        platform,
        field: `${platform}.childPropBindings[${bindingIndex}].props`,
        fragments: binding.props ?? [],
      });
    }
  }

  for (const [index, example] of (metadata.examples ?? []).entries()) {
    if (example === undefined) continue;
    const platformsBlocked = isPathBlocked(`examples[${index}].platforms`);
    const targetPlatforms = platformsBlocked
      ? (example.platforms ?? []).filter(
          (platform): platform is Platform => typeof platform === 'string'
        )
      : (example.platforms ?? platforms);

    for (const platform of targetPlatforms) {
      if (!platforms.includes(platform)) {
        errors.push(
          `examples[${index}] targets ${platform}, but ${componentName} is not available on that platform`
        );
        continue;
      }

      validatePropNames({
        platform,
        field: `examples[${index}].props`,
        fragments: example.props ?? [],
      });

      validatePropNames({
        platform,
        field:
          platform === 'react'
            ? `examples[${index}].reactProps`
            : `examples[${index}].nativeProps`,
        fragments:
          platform === 'react'
            ? (example.reactProps ?? [])
            : (example.nativeProps ?? []),
      });
    }
  }

  return errors;
}

export function validateComponentMetadataAgainstApi(params: {
  componentName: string;
  metadata: ComponentPageMetadata;
  platforms: readonly Platform[];
  reactApiProps: readonly ExtractedProp[];
  nativeApiProps: readonly ExtractedProp[];
}) {
  assertValidComponentMetadataFindings({
    componentName: params.componentName,
    findings: collectComponentMetadataAgainstApiFindings(params),
  });
}
