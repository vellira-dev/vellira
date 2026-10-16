import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type {
  ComponentMetadata,
  ComponentPlatform,
} from '@vellira-ui/metadata';

import { validateComponentDocs } from './validateComponentDocs';
import type { ComponentDocsContract } from './types';

export interface ComponentDocsSidebarItem {
  text: string;
  link: string;
}

const docsDirectoryByPlatform = {
  react: 'react',
  'react-native': 'react-native',
} as const satisfies Record<ComponentPlatform, string>;

export function resolveComponentDocsRoot(configModuleUrl: string) {
  return path.resolve(path.dirname(fileURLToPath(configModuleUrl)), '..');
}

/**
 * Fail closed if a manual sidebar entry shadows a generated component page.
 * The same invariant applies during the real VitePress build and unit tests.
 */
export function assertUniqueComponentDocsSidebarItems(params: {
  platform: ComponentPlatform;
  items: readonly ComponentDocsSidebarItem[];
}): ComponentDocsSidebarItem[] {
  const { platform, items } = params;
  const links = new Set<string>();
  const duplicates = new Set<string>();

  for (const item of items) {
    if (links.has(item.link)) {
      duplicates.add(item.link);
    }
    links.add(item.link);
  }

  if (duplicates.size > 0) {
    throw new Error(
      `Duplicate ${platform} component docs navigation links: ${[...duplicates]
        .sort(compareCodeUnit)
        .join(', ')}.`
    );
  }

  return [...items];
}

// Generated component-doc navigation follows the canonical metadata array order.
// That keeps React and React Native sidebars stable without introducing a second
// generated-doc component registry.
export function createGeneratedComponentDocsSidebarItems(params: {
  docsRoot: string;
  platform: ComponentPlatform;
  metadata: readonly ComponentMetadata[];
  contracts: readonly ComponentDocsContract[];
}): ComponentDocsSidebarItem[] {
  const { docsRoot, platform, metadata, contracts } = params;
  const metadataByName = new Map(
    metadata.map((item, index) => [item.name, { item, index }] as const)
  );
  const errors: string[] = [];
  const items: Array<ComponentDocsSidebarItem & { order: number }> = [];

  for (const contract of contracts) {
    const metadataEntry = metadataByName.get(contract.component);

    if (!metadataEntry) {
      errors.push(
        `Cannot create component docs navigation for ${contract.component}: missing ComponentMetadata.`
      );
      continue;
    }

    const validation = validateComponentDocs(contract, metadataEntry.item);

    if (!validation.valid) {
      errors.push(
        ...validation.errors.map((error) => `${contract.component}: ${error}`)
      );
      continue;
    }

    if (!metadataEntry.item.platforms.includes(platform)) {
      continue;
    }

    const platformDocs = contract.platforms[platform];

    if (!platformDocs) {
      errors.push(
        `Cannot create component docs navigation for ${contract.component} ${platform}: missing editorial docs for supported platform.`
      );
      continue;
    }

    const slug = slugifyComponentName(contract.component);
    const relativeFilePath = path.join(
      docsDirectoryByPlatform[platform],
      `${slug}.md`
    );
    const filePath = path.join(docsRoot, relativeFilePath);

    if (!fs.existsSync(filePath)) {
      errors.push(
        `Cannot create component docs navigation for ${contract.component} ${platform}: missing generated docs page ${relativeFilePath}.`
      );
      continue;
    }

    items.push({
      order: metadataEntry.index,
      text: contract.component,
      link: `/${docsDirectoryByPlatform[platform]}/${slug}`,
    });
  }

  if (errors.length > 0) {
    throw new Error(errors.sort().join('\n'));
  }

  return items
    .sort((a, b) => a.order - b.order || compareCodeUnit(a.text, b.text))
    .map((item) => ({
      text: item.text,
      link: item.link,
    }));
}

function slugifyComponentName(componentName: string) {
  return componentName
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

function compareCodeUnit(a: string, b: string) {
  return a < b ? -1 : a > b ? 1 : 0;
}
