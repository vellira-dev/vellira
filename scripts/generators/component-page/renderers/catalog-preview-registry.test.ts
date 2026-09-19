import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { generatedFileHeader } from '../helpers/paths';
import type { GeneratedPageModel, Platform } from '../model/types';
import {
  renderGeneratedCatalogPreview,
  renderGeneratedCatalogPreviewRegistry,
  requiresGeneratedCatalogPreview,
  synchronizeGeneratedCatalogPreview,
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

function createModel(
  componentName: string,
  slug: string,
  platforms: readonly Platform[] = ['react'],
  catalogPreview: GeneratedPageModel['catalogPreview'] = {}
) {
  return {
    componentName,
    slug,
    platforms,
    catalogPreview,
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
    component: '${componentName}',
    slug: '${slug}',
    name: '${componentName}',
    description: '${componentName} component for Vellira applications.',
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
        componentPresentationRegistryFile: componentsRegistryFile,
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
        componentPresentationRegistryFile: componentsRegistryFile,
        model: createModel('Accordion', 'accordion'),
      })
    ).toBe(true);
  });

  it('does not take ownership of a curated catalog entry', () => {
    const root = createRoot();
    const componentsRegistryFile = writeCatalog(
      root,
      `  {
    component: 'Button',
    slug: 'button',
    name: 'Button',
    description: 'Trigger an action.',
    order: 10,
  },`
    );

    expect(
      requiresGeneratedCatalogPreview({
        componentPresentationRegistryFile: componentsRegistryFile,
        model: createModel('Button', 'button'),
      })
    ).toBe(false);
  });

  it('renders a direct React component signature preview without Demo or Playground imports', () => {
    const source = renderGeneratedCatalogPreview({
      model: createModel('Avatar', 'avatar', ['react'], {
        layout: 'stack',
        props: ["size='sm'"],
        children: 'AB',
      }),
      generatedFileHeader,
    });

    expect(source).toContain("import { Avatar } from '@vellira-ui/react';");
    expect(source).toContain(
      "import styles from '../../shared/ComponentsCatalog/ComponentsCatalog.module.css';"
    );
    expect(source).toContain('<Avatar');
    expect(source).toContain("size='sm'");
    expect(source).toContain('AB');
    expect(source).not.toMatch(/Demo|Playground/);
  });

  it('accepts an explicit empty preview decision', () => {
    const source = renderGeneratedCatalogPreview({
      model: createModel('Avatar', 'avatar'),
      generatedFileHeader,
    });

    expect(source).toContain('<Avatar/>');
  });

  it('fails closed when generated preview metadata is absent or React is unavailable', () => {
    expect(() =>
      renderGeneratedCatalogPreview({
        model: {
          ...createModel('Avatar', 'avatar'),
          catalogPreview: undefined,
        },
        generatedFileHeader,
      })
    ).toThrow(/requires catalogPreview metadata or a hand-authored/);

    expect(() =>
      renderGeneratedCatalogPreview({
        model: createModel('NativeOnly', 'native-only', ['react-native']),
        generatedFileHeader,
      })
    ).toThrow(/requires React support or a hand-authored/);
  });

  it('leaves an incomplete scaffold without a generated preview or registry authority', async () => {
    const root = createRoot();
    const componentCatalogDir = path.join(root, 'components', 'Avatar');
    const componentsRegistryFile = writeCatalog(root, '');
    const previewFile = path.join(
      componentCatalogDir,
      'AvatarCatalogPreview.tsx'
    );

    fs.mkdirSync(componentCatalogDir, { recursive: true });

    await synchronizeGeneratedCatalogPreview({
      root,
      check: false,
      checkFailures: [],
      componentCatalogDir,
      componentPresentationRegistryFile: componentsRegistryFile,
      model: {
        ...createModel('Avatar', 'avatar'),
        catalogPreview: undefined,
      },
      generatedFileHeader,
    });

    expect(fs.existsSync(previewFile)).toBe(false);
  });

  it('materializes a missing generator-owned preview before registration', async () => {
    const root = createRoot();
    const componentCatalogDir = path.join(root, 'components', 'Avatar');
    const componentsRegistryFile = writeCatalog(root, '');
    const checkFailures: string[] = [];
    const previewFile = path.join(
      componentCatalogDir,
      'AvatarCatalogPreview.tsx'
    );

    fs.mkdirSync(componentCatalogDir, { recursive: true });

    await synchronizeGeneratedCatalogPreview({
      root,
      check: false,
      checkFailures,
      componentCatalogDir,
      componentPresentationRegistryFile: componentsRegistryFile,
      model: createModel('Avatar', 'avatar'),
      generatedFileHeader,
    });

    expect(checkFailures).toEqual([]);
    expect(fs.readFileSync(previewFile, 'utf8')).toContain(
      "import { Avatar } from '@vellira-ui/react';"
    );
  });

  it('preserves a curated preview instead of taking ownership', async () => {
    const root = createRoot();
    const componentCatalogDir = path.join(root, 'components', 'Accordion');
    const componentsRegistryFile = writeCatalog(
      root,
      generatedEntry('Accordion', 'accordion')
    );
    const previewFile = path.join(
      componentCatalogDir,
      'AccordionCatalogPreview.tsx'
    );
    const curated =
      "export function AccordionCatalogPreview() { return 'curated'; }\n";

    fs.mkdirSync(componentCatalogDir, { recursive: true });
    fs.writeFileSync(previewFile, curated);

    await synchronizeGeneratedCatalogPreview({
      root,
      check: false,
      checkFailures: [],
      componentCatalogDir,
      componentPresentationRegistryFile: componentsRegistryFile,
      model: createModel('Accordion', 'accordion'),
      generatedFileHeader,
    });

    expect(fs.readFileSync(previewFile, 'utf8')).toBe(curated);
  });

  it('reports a missing fallback preview in check mode without mutation', async () => {
    const root = createRoot();
    const componentCatalogDir = path.join(root, 'components', 'Avatar');
    const componentsRegistryFile = writeCatalog(root, '');
    const checkFailures: string[] = [];
    const previewFile = path.join(
      componentCatalogDir,
      'AvatarCatalogPreview.tsx'
    );

    fs.mkdirSync(componentCatalogDir, { recursive: true });

    await synchronizeGeneratedCatalogPreview({
      root,
      check: true,
      checkFailures,
      componentCatalogDir,
      componentPresentationRegistryFile: componentsRegistryFile,
      model: {
        ...createModel('Avatar', 'avatar'),
        catalogPreview: undefined,
      },
      generatedFileHeader,
    });

    expect(checkFailures).toEqual([path.relative(root, previewFile)]);
    expect(fs.existsSync(previewFile)).toBe(false);
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

    expect(checkFailures).toEqual([path.relative(root, generatedRegistryFile)]);
    expect(fs.readFileSync(generatedRegistryFile, 'utf8')).toBe(before);
  });
});
