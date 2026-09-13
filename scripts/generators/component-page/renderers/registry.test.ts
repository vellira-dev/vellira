import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import type { GeneratedPageModel } from '../model/types';
import {
  updateCatalogPreviewFallback,
  updateCatalogRegistry,
} from './registry';

const model: GeneratedPageModel = {
  componentName: 'Switch',
  slug: 'switch',
  platforms: ['react', 'react-native'],
  demo: {
    staticProps: {},
    children: {},
    imports: {},
    responsivePresentation: false,
  },
  playground: {
    props: [],
    initialValues: {},
  },
  usage: {
    children: {},
  },
  examples: [],
  accessibility: {
    react: [],
    'react-native': [],
  },
  api: {
    react: {
      sections: [],
      inheritedProps: [],
    },
    'react-native': {
      sections: [],
      inheritedProps: [],
    },
  },
  related: [],
};

describe('component catalog registration', async () => {
  it('adds a generated page to the website component catalog once', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vellira-catalog-'));
    const componentsRegistryFile = path.join(root, 'components.ts');

    fs.writeFileSync(
      componentsRegistryFile,
      `import type { ComponentCatalogEntry } from '../types';\n\nexport const webComponents = [\n] as const satisfies readonly ComponentCatalogEntry[];\n`
    );

    await updateCatalogRegistry({
      root,
      force: false,
      check: false,
      checkFailures: [],
      componentsRegistryFile,
      model,
      catalogCategory: 'forms',
    });

    await updateCatalogRegistry({
      root,
      force: false,
      check: false,
      checkFailures: [],
      componentsRegistryFile,
      model,
      catalogCategory: 'forms',
    });

    const content = fs.readFileSync(componentsRegistryFile, 'utf8');

    expect(content.match(/slug: 'switch'/g)).toHaveLength(1);
    expect(content).toContain("category: 'forms'");
    expect(content).toContain("status: 'beta'");
    expect(content).toContain("'react-native'");
  });

  it('preserves an existing curated catalog entry with --force', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vellira-catalog-'));
    const componentsRegistryFile = path.join(root, 'components.ts');
    const curatedSource = `import type { ComponentCatalogEntry } from '../types';\n\nexport const webComponents = [\n  {\n    slug: 'switch',\n    name: 'Switch',\n    description: 'Curated description.',\n    category: 'general',\n    status: 'stable',\n    order: 42,\n    platforms: ['react'],\n    docs: {\n      react: 'https://docs.vellira.dev/react/switch',\n    },\n  },\n] as const satisfies readonly ComponentCatalogEntry[];\n`;

    fs.writeFileSync(componentsRegistryFile, curatedSource);

    await updateCatalogRegistry({
      root,
      force: true,
      check: false,
      checkFailures: [],
      componentsRegistryFile,
      model,
      catalogCategory: 'forms',
    });

    const content = fs.readFileSync(componentsRegistryFile, 'utf8');

    expect(content).toBe(curatedSource);
    expect(content).toContain('Curated description.');
    expect(content).toContain("status: 'stable'");
    expect(content).toContain('order: 42');
  });
});

describe('generated component catalog correction', async () => {
  it('updates an existing generated entry when its resolved category changes', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vellira-catalog-'));
    const componentsRegistryFile = path.join(root, 'components.ts');

    fs.writeFileSync(
      componentsRegistryFile,
      `import type { ComponentCatalogEntry } from '../types';

export const webComponents = [
  {
    slug: 'switch',
    name: 'Switch',
    description: 'Switch component for Vellira applications.',
    category: 'general',
    status: 'beta',
    order: 999,
    platforms: ['react', 'react-native'],
    docs: {
      react: 'https://docs.vellira.dev/react/switch',
      'react-native': 'https://docs.vellira.dev/react-native/switch',
    },
  },
] as const satisfies readonly ComponentCatalogEntry[];
`
    );

    await updateCatalogRegistry({
      root,
      force: true,
      check: false,
      checkFailures: [],
      componentsRegistryFile,
      model,
      catalogCategory: 'navigation',
    });

    const content = fs.readFileSync(componentsRegistryFile, 'utf8');

    expect(content.match(/slug: 'switch'/g)).toHaveLength(1);
    expect(content).toContain("category: 'navigation'");
    expect(content).not.toContain("category: 'general'");
  });
});

describe('component catalog preview registration', async () => {
  it('adds one generated React demo fallback when no curated preview exists', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vellira-preview-'));
    const catalogPreviewFile = path.join(root, 'ComponentCatalogPreview.tsx');
    const catalogPreviewFallbackFile = path.join(
      root,
      'generatedCatalogPreviews.tsx'
    );

    fs.writeFileSync(
      catalogPreviewFile,
      `switch (slug) {\n  case 'button':\n    return null;\n}\n`
    );
    fs.writeFileSync(
      catalogPreviewFallbackFile,
      `import { lazy } from 'react';\n\nexport const generatedCatalogPreviews = {\n  // component-catalog-preview-entries\n};\n`
    );

    for (let iteration = 0; iteration < 2; iteration += 1) {
      await updateCatalogPreviewFallback({
        root,
        check: false,
        checkFailures: [],
        catalogPreviewFile,
        catalogPreviewFallbackFile,
        model,
      });
    }

    const content = fs.readFileSync(catalogPreviewFallbackFile, 'utf8');

    expect(
      content.match(/\/\/ component-catalog-preview:switch/g)
    ).toHaveLength(1);
    expect(content).toContain("import('../../components/Switch')");
    expect(content).toContain('SwitchDemo');
  });

  it('keeps an explicit curated preview authoritative', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vellira-preview-'));
    const catalogPreviewFile = path.join(root, 'ComponentCatalogPreview.tsx');
    const catalogPreviewFallbackFile = path.join(
      root,
      'generatedCatalogPreviews.tsx'
    );
    const fallbackSource = `import { lazy } from 'react';\n\nexport const generatedCatalogPreviews = {\n  // component-catalog-preview-entries\n};\n`;

    fs.writeFileSync(
      catalogPreviewFile,
      `switch (slug) {\n  case 'switch':\n    return null;\n}\n`
    );
    fs.writeFileSync(catalogPreviewFallbackFile, fallbackSource);

    await updateCatalogPreviewFallback({
      root,
      check: false,
      checkFailures: [],
      catalogPreviewFile,
      catalogPreviewFallbackFile,
      model,
    });

    expect(fs.readFileSync(catalogPreviewFallbackFile, 'utf8')).toBe(
      fallbackSource
    );
  });
});

it('rejects duplicate curated and generated catalog preview ownership', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vellira-preview-'));
  const catalogPreviewFile = path.join(root, 'ComponentCatalogPreview.tsx');
  const catalogPreviewFallbackFile = path.join(
    root,
    'generatedCatalogPreviews.tsx'
  );

  fs.writeFileSync(
    catalogPreviewFile,
    `switch (slug) {\n  case 'switch':\n    return null;\n}\n`
  );
  fs.writeFileSync(
    catalogPreviewFallbackFile,
    `import { lazy } from 'react';\n\nexport const generatedCatalogPreviews = {\n  // component-catalog-preview-entries\n  // component-catalog-preview:switch\n  switch: lazy(() => import('../../components/Switch')),\n};\n`
  );

  await expect(
    updateCatalogPreviewFallback({
      root,
      check: true,
      checkFailures: [],
      catalogPreviewFile,
      catalogPreviewFallbackFile,
      model,
    })
  ).rejects.toThrow('Duplicate component catalog preview ownership');
});
