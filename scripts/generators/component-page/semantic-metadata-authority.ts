import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { generatedFileHeader, getCatalogPaths } from './helpers/paths';
import { requiresGeneratedCatalogPreview } from './renderers/catalog-preview-registry';

export const SEMANTIC_METADATA_AUTHORITY_SCHEMA_VERSION = '1' as const;

export const SEMANTIC_METADATA_VALIDATION_SOURCE_PATHS = [
  'apps/website/src/component-catalog/metadata.ts',
  'apps/website/src/component-catalog/registry/canonicalComponentSlugs.ts',
  'apps/website/src/component-catalog/registry/componentIdentity.ts',
  'scripts/generators/component-page/metadata/metadata.ts',
  'scripts/generators/component-page/model/resolve-page-input.ts',
  'scripts/generators/component-page/create-component-page.ts',
  'scripts/generators/component-page/renderers/catalog-preview-registry.ts',
  'scripts/generators/component-page/semantic-metadata-authority.ts',
] as const;

export type SemanticMetadataDecision = {
  path: string;
  kind: 'explicit-decision';
  allowedEmptyValue: 'array' | 'object';
  reason: string;
};

export type SemanticMetadataDecisionAuthority = {
  schemaVersion: typeof SEMANTIC_METADATA_AUTHORITY_SCHEMA_VERSION;
  mode: 'production-check';
  requiredDecisions: SemanticMetadataDecision[];
  validationSources: Array<{ path: string; sha256: string }>;
};

const MAX_AUTHORITY_SOURCE_BYTES = 512 * 1024;

export function buildSemanticMetadataDecisionAuthority(params: {
  root: string;
  componentName: string;
}): SemanticMetadataDecisionAuthority {
  const root = path.resolve(params.root);
  const { componentCatalogDir, componentPresentationRegistryFile, slug } =
    getCatalogPaths({ root, componentName: params.componentName });
  const catalogPreviewFile = path.join(
    componentCatalogDir,
    `${params.componentName}CatalogPreview.tsx`
  );
  const hasHandAuthoredCatalogPreview =
    fs.existsSync(catalogPreviewFile) &&
    !fs
      .readFileSync(catalogPreviewFile, 'utf8')
      .startsWith(generatedFileHeader);
  const generatedCatalogPreviewRequired = requiresGeneratedCatalogPreview({
    componentPresentationRegistryFile,
    model: { componentName: params.componentName, slug },
  });
  const requiredDecisions: SemanticMetadataDecision[] = [
    {
      path: 'related',
      kind: 'explicit-decision',
      allowedEmptyValue: 'array',
      reason:
        'Production checks require an explicit related-component decision; use [] when none are intended.',
    },
  ];

  if (generatedCatalogPreviewRequired && !hasHandAuthoredCatalogPreview) {
    requiredDecisions.push({
      path: 'catalogPreview',
      kind: 'explicit-decision',
      allowedEmptyValue: 'object',
      reason:
        'The generated catalog preview requires explicit metadata; use {} for the canonical generated default.',
    });
  }

  return {
    schemaVersion: SEMANTIC_METADATA_AUTHORITY_SCHEMA_VERSION,
    mode: 'production-check',
    requiredDecisions,
    validationSources: SEMANTIC_METADATA_VALIDATION_SOURCE_PATHS.map(
      (relativePath) => ({
        path: relativePath,
        sha256: sha256(readBoundedRegularFile(root, relativePath)),
      })
    ),
  };
}

export function semanticMetadataDecisionRequired(
  authority: SemanticMetadataDecisionAuthority,
  path: string
) {
  return authority.requiredDecisions.some((decision) => decision.path === path);
}

function readBoundedRegularFile(root: string, relativePath: string) {
  const absolutePath = path.resolve(root, relativePath);

  if (!absolutePath.startsWith(`${root}${path.sep}`)) {
    throw new Error(
      'Semantic metadata authority source escapes repository root.'
    );
  }

  const stat = fs.lstatSync(absolutePath);

  if (!stat.isFile() || stat.isSymbolicLink()) {
    throw new Error(
      `Semantic metadata authority source is not a regular file: ${relativePath}`
    );
  }

  const bytes = fs.readFileSync(absolutePath);

  if (bytes.byteLength > MAX_AUTHORITY_SOURCE_BYTES) {
    throw new Error(
      `Semantic metadata authority source exceeds the bounded size: ${relativePath}`
    );
  }

  return bytes;
}

function sha256(bytes: Buffer) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}
