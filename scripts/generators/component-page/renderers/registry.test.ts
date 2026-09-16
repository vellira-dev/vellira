import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import type { GeneratedPageModel } from '../model/types';
import { updateCatalogRegistry } from './registry';

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
      `import type { ComponentCatalogPresentationEntry } from '../types';\n\nconst componentCatalogPresentation = [\n] as const satisfies readonly ComponentCatalogPresentationEntry[];\n`
    );

    await updateCatalogRegistry({
      root,
      force: false,
      check: false,
      checkFailures: [],
      componentPresentationRegistryFile: componentsRegistryFile,
      model,
      catalogCategory: 'forms',
    });

    await updateCatalogRegistry({
      root,
      force: false,
      check: false,
      checkFailures: [],
      componentPresentationRegistryFile: componentsRegistryFile,
      model,
      catalogCategory: 'forms',
    });

    const content = fs.readFileSync(componentsRegistryFile, 'utf8');

    expect(content.match(/slug: 'switch'/g)).toHaveLength(1);
    expect(content).toContain("component: 'Switch'");
    expect(content).toContain("category: 'forms'");
    expect(content).not.toContain('status:');
    expect(content).not.toContain('platforms:');
    expect(content).toContain("'react-native'");
  });

  it('preserves an existing curated catalog entry with --force', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vellira-catalog-'));
    const componentsRegistryFile = path.join(root, 'components.ts');
    const curatedSource = `import type { ComponentCatalogPresentationEntry } from '../types';\n\nconst componentCatalogPresentation = [\n  {\n    component: 'Switch',\n    slug: 'switch',\n    name: 'Switch',\n    description: 'Curated description.',\n    category: 'general',\n    order: 42,\n    docs: {\n      react: 'https://docs.vellira.dev/react/switch',\n    },\n  },\n] as const satisfies readonly ComponentCatalogPresentationEntry[];\n`;

    fs.writeFileSync(componentsRegistryFile, curatedSource);

    await updateCatalogRegistry({
      root,
      force: true,
      check: false,
      checkFailures: [],
      componentPresentationRegistryFile: componentsRegistryFile,
      model,
      catalogCategory: 'forms',
    });

    const content = fs.readFileSync(componentsRegistryFile, 'utf8');

    expect(content).toBe(curatedSource);
    expect(content).toContain('Curated description.');
    expect(content).not.toContain('status:');
    expect(content).toContain('order: 42');
  });
});

describe('generated component catalog correction', async () => {
  it('updates an existing generated entry when its resolved category changes', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vellira-catalog-'));
    const componentsRegistryFile = path.join(root, 'components.ts');

    fs.writeFileSync(
      componentsRegistryFile,
      `import type { ComponentCatalogPresentationEntry } from '../types';

const componentCatalogPresentation = [
  {
    component: 'Switch',
    slug: 'switch',
    name: 'Switch',
    description: 'Switch component for Vellira applications.',
    category: 'general',
    order: 999,
    docs: {
      react: 'https://docs.vellira.dev/react/switch',
      'react-native': 'https://docs.vellira.dev/react-native/switch',
    },
  },
] as const satisfies readonly ComponentCatalogPresentationEntry[];
`
    );

    await updateCatalogRegistry({
      root,
      force: true,
      check: false,
      checkFailures: [],
      componentPresentationRegistryFile: componentsRegistryFile,
      model,
      catalogCategory: 'navigation',
    });

    const content = fs.readFileSync(componentsRegistryFile, 'utf8');

    expect(content.match(/slug: 'switch'/g)).toHaveLength(1);
    expect(content).toContain("category: 'navigation'");
    expect(content).not.toContain("category: 'general'");
  });
});
