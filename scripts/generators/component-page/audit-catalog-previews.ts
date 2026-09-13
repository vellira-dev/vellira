import fs from 'node:fs';
import path from 'node:path';

import { getCatalogPreviewFindings } from './catalog-preview-contract';

const root = process.cwd();
const catalogRoot = path.join(
  root,
  'apps',
  'website',
  'src',
  'component-catalog'
);

const findings = getCatalogPreviewFindings({
  componentsRegistrySource: fs.readFileSync(
    path.join(catalogRoot, 'registry', 'components.ts'),
    'utf8'
  ),
  legacyPreviewSource: fs.readFileSync(
    path.join(
      catalogRoot,
      'shared',
      'ComponentsCatalog',
      'ComponentCatalogPreview.tsx'
    ),
    'utf8'
  ),
  generatedPreviewRegistrySource: fs.readFileSync(
    path.join(catalogRoot, 'registry', 'generatedCatalogPreviews.ts'),
    'utf8'
  ),
});

if (findings.length > 0) {
  console.error('Component catalog signature preview audit failed:');

  for (const finding of findings) {
    console.error(`  - ${finding.code} [${finding.slug}]: ${finding.message}`);
  }

  process.exit(1);
}

console.log('Component catalog signature preview audit passed.');
