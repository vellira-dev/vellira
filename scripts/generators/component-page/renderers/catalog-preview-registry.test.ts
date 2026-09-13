import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import type { GeneratedPageModel } from '../model/types';
import {
  renderGeneratedCatalogPreviewRegistry,
  requiresGeneratedCatalogPreview,
  synchronizeGeneratedCatalogPreviewRegistry,
} from './catalog-preview-registry';

const tempRoots: string[] = [];

function createRoot() {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), 'vellira-catalog-preview-registry-')
  );
  tempRoots.push(root);
  return root;
}

function createModel(componentName: string, slug: string) {
  return {
    componentName,
    slug,
  } as GeneratedPageModel;
}

function writeCatalog(root: string, entry: string) {
  const file = path.join(root, 'registry', 'components.ts');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(
    file,
    `export const webComponents = [\n${entry}\n] as const;\n`
  );
  return file;
}

function generatedEntry(componentName: string, slug: string) {
  return `  {
    slug: '${slug}',
    name: '${componentName}',
    description: '${componentName} component for Vellira applications.',
    status: 'beta',
    order: 999,
  },`;
}

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe('generated catalog preview registry', () => {
  it('requires a preview for a new catalog entry', () => {
    const root = createRoot();
    const componentsRegistryFile = writeCatalog(root, '');

    expect(
      requiresGeneratedCatalogPreview({
        componentsRegistryFile,
        model: createModel('Accordion', 'accordion'),
      })
    ).toBe(true);
  });

  it('requires a preview for a generator-owned catalog entry', () => {
    const root = createRoot();
    const componentsRegistryFile = writeCatalog(
      root,
      generatedEntry('Accordion', 'accordion')
    );

    expect(
      requiresGeneratedCatalogPreview({
        componentsRegistryFile,
        model: createModel('Accordion', 'accordion'),
      })
    ).toBe(true);
  });

  it('does not take ownership of a curated catalog entry', () => {
    const root = createRoot();
    const componentsRegistryFile = writeCatalog(
      root,
      `  {
    slug: 'button',
    name: 'Button',
    description: 'Trigger an action.',
    status: 'stable',
    order: 10,
  },`
    );

    expect(
      requiresGeneratedCatalogPreview({
        componentsRegistryFile,
        model: createModel('Button', 'button'),
      })
    ).toBe(false);
  });

  it('renders component-local previews in deterministic slug order', () => {
    const root = createRoot();
    const componentsRoot = path.join(root, 'components');

    for (const componentName of ['Switch', 'Accordion']) {
      const componentDir = path.join(componentsRoot, componentName);
      fs.mkdirSync(componentDir, { recursive: true });
      fs.writeFileSync(
        path.join(componentDir, `${componentName}CatalogPreview.tsx`),
        'export {};\n'
      );
    }

    const source = renderGeneratedCatalogPreviewRegistry({ componentsRoot });

    expect(source.indexOf('AccordionCatalogPreview')).toBeLessThan(
      source.indexOf('SwitchCatalogPreview')
    );
    expect(source).toContain('accordion: AccordionCatalogPreview');
    expect(source).toContain('switch: SwitchCatalogPreview');
  });

  it('reports registry drift in check mode without mutation', async () => {
    const root = createRoot();
    const componentsRoot = path.join(root, 'components');
    const componentCatalogDir = path.join(componentsRoot, 'Accordion');
    const componentsRegistryFile = writeCatalog(
      root,
      generatedEntry('Accordion', 'accordion')
    );
    const generatedRegistryFile = path.join(
      root,
      'registry',
      'generatedCatalogPreviews.ts'
    );
    const before = '// stale\n';
    const checkFailures: string[] = [];

    fs.mkdirSync(componentCatalogDir, { recursive: true });
    fs.writeFileSync(
      path.join(componentCatalogDir, 'AccordionCatalogPreview.tsx'),
      'export {};\n'
    );
    fs.writeFileSync(generatedRegistryFile, before);

    await synchronizeGeneratedCatalogPreviewRegistry({
      root,
      check: true,
      checkFailures,
      componentCatalogDir,
      componentsRegistryFile,
    });

    expect(checkFailures).toEqual([
      path.relative(root, generatedRegistryFile),
    ]);
    expect(fs.readFileSync(generatedRegistryFile, 'utf8')).toBe(before);
  });
});
