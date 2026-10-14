import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import type {
  ComponentMetadata,
  ComponentPlatform,
} from '@vellira-ui/metadata';

import type { ComponentDocsContract } from '../../../apps/docs/src/component-docs';

import {
  createGeneratedComponentDocsSidebarItems,
  resolveComponentDocsRoot,
} from '../../../apps/docs/src/component-docs';
import {
  authoredRegionEndMarker,
  defaultAuthoredRegionPlaceholder,
  authoredRegionStartMarker,
} from './authored-region';
import { generateComponentDocs } from './generate-component-docs';
import { inspectComponentDocAuthority } from './legacy-adoption';
import { generatedComponentDocsHeader } from './render';

const tempRoots: string[] = [];

afterEach(() => {
  for (const tempRoot of tempRoots.splice(0)) {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

describe('generateComponentDocs', () => {
  it('generates React and React Native pages for a cross-platform component', async () => {
    const fixture = createFixture({
      componentName: 'FixtureSwitch',
      platforms: ['react', 'react-native'],
    });

    const result = await generateComponentDocs({
      root: fixture.root,
      docsRoot: fixture.docsRoot,
      metadata: [fixture.metadata],
      contracts: [fixture.contract],
    });

    expect(result.status).toBe('updated');
    expect(fs.existsSync(fixture.reactDoc)).toBe(true);
    expect(fs.existsSync(fixture.nativeDoc)).toBe(true);
  });

  it('generates only the React page for a React-only component', async () => {
    const fixture = createFixture({
      componentName: 'FixtureSwitch',
      platforms: ['react'],
    });

    await generateComponentDocs({
      root: fixture.root,
      docsRoot: fixture.docsRoot,
      metadata: [fixture.metadata],
      contracts: [fixture.contract],
    });

    expect(fs.existsSync(fixture.reactDoc)).toBe(true);
    expect(fs.existsSync(fixture.nativeDoc)).toBe(false);
  });

  it('generates only the React Native page for a React Native-only component', async () => {
    const fixture = createFixture({
      componentName: 'FixtureSwitch',
      platforms: ['react-native'],
    });

    await generateComponentDocs({
      root: fixture.root,
      docsRoot: fixture.docsRoot,
      metadata: [fixture.metadata],
      contracts: [fixture.contract],
    });

    expect(fs.existsSync(fixture.reactDoc)).toBe(false);
    expect(fs.existsSync(fixture.nativeDoc)).toBe(true);
  });

  it('does not generate unsupported platform pages', async () => {
    const fixture = createFixture({
      componentName: 'FixtureSwitch',
      platforms: ['react'],
    });

    const result = await generateComponentDocs({
      root: fixture.root,
      docsRoot: fixture.docsRoot,
      metadata: [fixture.metadata],
      contracts: [fixture.contract],
    });

    expect(result.changedFiles).toEqual([
      'apps/docs/src/react/fixture-switch.md',
    ]);
    expect(fs.existsSync(fixture.nativeDoc)).toBe(false);
  });

  it('keeps simple generated API output to one root block', async () => {
    const fixture = createFixture({
      componentName: 'FixtureSwitch',
      platforms: ['react'],
    });

    await generateComponentDocs({
      root: fixture.root,
      docsRoot: fixture.docsRoot,
      metadata: [fixture.metadata],
      contracts: [fixture.contract],
    });

    const content = fs.readFileSync(fixture.reactDoc, 'utf8');

    expect(content.match(/api-docgen:start/g)).toHaveLength(1);
    expect(content).toContain(
      '<!-- api-docgen:start web.FixtureSwitchProps.FixtureSwitch -->'
    );
    expect(content).not.toContain('### FixtureSwitch Props');
  });

  it('renders compound React API sections in public docgen order', async () => {
    const fixture = createFixture({
      componentName: 'FixtureTabs',
      platforms: ['react'],
      layer: 'components',
      category: 'navigation',
      profile: 'compound',
      compoundParts: {
        react: ['List', 'Trigger', 'Content'],
      },
    });

    await generateComponentDocs({
      root: fixture.root,
      docsRoot: fixture.docsRoot,
      metadata: [fixture.metadata],
      contracts: [fixture.contract],
    });

    const content = fs.readFileSync(fixture.reactDoc, 'utf8');

    expect(markerOrder(content)).toEqual([
      'web.FixtureTabsProps.FixtureTabsProps',
      'web.FixtureTabsListProps.FixtureTabsListProps',
      'web.FixtureTabsTriggerProps.FixtureTabsTriggerProps',
      'web.FixtureTabsContentProps.FixtureTabsContentProps',
    ]);
    expect(content).toContain('### FixtureTabs Props');
    expect(content).toContain('### FixtureTabs.List Props');
    expect(content).toContain('### FixtureTabs.Trigger Props');
    expect(content).toContain('### FixtureTabs.Content Props');
  });

  it('discovers compound prop types exported from a separate public types module', async () => {
    const fixture = createFixture({
      componentName: 'FixtureDropdown',
      platforms: ['react'],
      layer: 'components',
      category: 'overlay',
      profile: 'compound',
      compoundParts: {
        react: ['Trigger', 'Content', 'Item'],
      },
      apiParts: {
        react: ['Trigger', 'Content'],
      },
      typeExportSuffix: '/types',
      extraApiBlocks: {
        react: [
          renderApiFixtureBlock({
            apiId: 'web.FixtureDropdownItemProps.FixtureDropdownItemProps',
            propName: 'item',
            description: 'Non-public item API.',
          }),
          renderApiFixtureBlock({
            apiId:
              'web.FixtureDropdownInternalProps.FixtureDropdownInternalProps',
            propName: 'internal',
            description: 'Internal API.',
          }),
        ],
      },
    });
    const packageIndexFile = path.join(
      fixture.root,
      'packages/react/src/index.ts'
    );

    fs.writeFileSync(
      packageIndexFile,
      fs
        .readFileSync(packageIndexFile, 'utf8')
        .replace('FixtureDropdownItemProps, ', '')
    );

    await generateComponentDocs({
      root: fixture.root,
      docsRoot: fixture.docsRoot,
      metadata: [fixture.metadata],
      contracts: [fixture.contract],
    });

    const content = fs.readFileSync(fixture.reactDoc, 'utf8');

    expect(markerOrder(content)).toEqual([
      'web.FixtureDropdownProps.FixtureDropdownProps',
      'web.FixtureDropdownTriggerProps.FixtureDropdownTriggerProps',
      'web.FixtureDropdownContentProps.FixtureDropdownContentProps',
    ]);
    expect(content).not.toContain('FixtureDropdownItemProps');
    expect(content).not.toContain('FixtureDropdownInternalProps');
  });

  it('renders compound React Native API sections where native part APIs exist', async () => {
    const fixture = createFixture({
      componentName: 'FixtureTabs',
      platforms: ['react-native'],
      layer: 'components',
      category: 'navigation',
      profile: 'compound',
      compoundParts: {
        'react-native': ['List', 'Trigger', 'Content'],
      },
    });

    await generateComponentDocs({
      root: fixture.root,
      docsRoot: fixture.docsRoot,
      metadata: [fixture.metadata],
      contracts: [fixture.contract],
    });

    const content = fs.readFileSync(fixture.nativeDoc, 'utf8');

    expect(markerOrder(content)).toEqual([
      'native.FixtureTabsProps.FixtureTabsProps',
      'native.FixtureTabsListProps.FixtureTabsListProps',
      'native.FixtureTabsTriggerProps.FixtureTabsTriggerProps',
      'native.FixtureTabsContentProps.FixtureTabsContentProps',
    ]);
  });

  it('allows platform-divergent compound part API sections', async () => {
    const fixture = createFixture({
      componentName: 'FixtureTabs',
      platforms: ['react', 'react-native'],
      layer: 'components',
      category: 'navigation',
      profile: 'compound',
      compoundParts: {
        react: ['List', 'Trigger', 'Content'],
        'react-native': ['List', 'Content'],
      },
    });

    await generateComponentDocs({
      root: fixture.root,
      docsRoot: fixture.docsRoot,
      metadata: [fixture.metadata],
      contracts: [fixture.contract],
    });

    expect(markerOrder(fs.readFileSync(fixture.reactDoc, 'utf8'))).toEqual([
      'web.FixtureTabsProps.FixtureTabsProps',
      'web.FixtureTabsListProps.FixtureTabsListProps',
      'web.FixtureTabsTriggerProps.FixtureTabsTriggerProps',
      'web.FixtureTabsContentProps.FixtureTabsContentProps',
    ]);
    expect(markerOrder(fs.readFileSync(fixture.nativeDoc, 'utf8'))).toEqual([
      'native.FixtureTabsProps.FixtureTabsProps',
      'native.FixtureTabsListProps.FixtureTabsListProps',
      'native.FixtureTabsContentProps.FixtureTabsContentProps',
    ]);
  });

  it('fails clearly when an expected public compound part API block is missing', async () => {
    const fixture = createFixture({
      componentName: 'FixtureTabs',
      platforms: ['react'],
      layer: 'components',
      category: 'navigation',
      profile: 'compound',
      compoundParts: {
        react: ['List', 'Trigger', 'Content'],
      },
      apiParts: {
        react: ['List', 'Content'],
      },
    });

    await expect(
      generateComponentDocs({
        root: fixture.root,
        docsRoot: fixture.docsRoot,
        metadata: [fixture.metadata],
        contracts: [fixture.contract],
      })
    ).rejects.toThrow(
      'Cannot resolve API information for FixtureTabs react: expected exactly one public FixtureTabsTriggerProps API block in packages/react/API.md.'
    );
  });

  it('fails clearly when an expected public API block marker is duplicated', async () => {
    const duplicateBlock = renderApiFixtureBlock({
      apiId: 'web.FixtureTabsTriggerProps.FixtureTabsTriggerProps',
      propName: 'duplicate',
      description: 'Duplicate trigger API.',
    });
    const fixture = createFixture({
      componentName: 'FixtureTabs',
      platforms: ['react'],
      layer: 'components',
      category: 'navigation',
      profile: 'compound',
      compoundParts: {
        react: ['List', 'Trigger'],
      },
      extraApiBlocks: {
        react: [duplicateBlock],
      },
    });

    await expect(
      generateComponentDocs({
        root: fixture.root,
        docsRoot: fixture.docsRoot,
        metadata: [fixture.metadata],
        contracts: [fixture.contract],
      })
    ).rejects.toThrow(
      'Cannot resolve API information for FixtureTabs react: expected exactly one web.FixtureTabsTriggerProps.FixtureTabsTriggerProps block in packages/react/API.md.'
    );
  });

  it('fails clearly when an expected public API block marker is malformed', async () => {
    const fixture = createFixture({
      componentName: 'FixtureTabs',
      platforms: ['react'],
      layer: 'components',
      category: 'navigation',
      profile: 'compound',
      compoundParts: {
        react: ['List'],
      },
    });
    const apiFile = path.join(fixture.root, 'packages/react/API.md');
    const content = fs.readFileSync(apiFile, 'utf8');
    const validBlock = renderApiFixtureBlock({
      apiId: 'web.FixtureTabsListProps.FixtureTabsListProps',
      propName: 'list',
      description: 'List public API.',
    });

    fs.writeFileSync(
      apiFile,
      content.replace(
        validBlock,
        [
          '<!-- api-docgen:end web.FixtureTabsListProps.FixtureTabsListProps -->',
          '',
          '| Prop | Type | Required | Description |',
          '| ---- | ---- | -------- | ----------- |',
          '| `list` | `boolean` | No | List public API. |',
          '',
          '<!-- api-docgen:start web.FixtureTabsListProps.FixtureTabsListProps -->',
        ].join('\n')
      )
    );

    await expect(
      generateComponentDocs({
        root: fixture.root,
        docsRoot: fixture.docsRoot,
        metadata: [fixture.metadata],
        contracts: [fixture.contract],
      })
    ).rejects.toThrow(
      'Cannot resolve API information for FixtureTabs react: malformed web.FixtureTabsListProps.FixtureTabsListProps block in packages/react/API.md.'
    );
  });

  it('does not sweep unrelated public or internal API blocks into compound docs', async () => {
    const fixture = createFixture({
      componentName: 'FixtureTabs',
      platforms: ['react'],
      layer: 'components',
      category: 'navigation',
      profile: 'compound',
      compoundParts: {
        react: ['List'],
      },
      extraApiBlocks: {
        react: [
          renderApiFixtureBlock({
            apiId: 'web.FixtureTabsSlotProps.FixtureTabsSlotProps',
            propName: 'slot',
            description: 'Slot helper API.',
          }),
          renderApiFixtureBlock({
            apiId:
              'web.FixtureTabsListInternalProps.FixtureTabsListInternalProps',
            propName: 'internal',
            description: 'Internal API.',
          }),
        ],
      },
    });

    await generateComponentDocs({
      root: fixture.root,
      docsRoot: fixture.docsRoot,
      metadata: [fixture.metadata],
      contracts: [fixture.contract],
    });

    const content = fs.readFileSync(fixture.reactDoc, 'utf8');

    expect(markerOrder(content)).toEqual([
      'web.FixtureTabsProps.FixtureTabsProps',
      'web.FixtureTabsListProps.FixtureTabsListProps',
    ]);
    expect(content).not.toContain('FixtureTabsSlotProps');
    expect(content).not.toContain('FixtureTabsListInternalProps');
  });

  it('includes a React generated page in React navigation', async () => {
    const fixture = createFixture({
      componentName: 'FixtureSwitch',
      platforms: ['react'],
    });

    await generateComponentDocs({
      root: fixture.root,
      docsRoot: fixture.docsRoot,
      metadata: [fixture.metadata],
      contracts: [fixture.contract],
    });

    expect(
      createGeneratedComponentDocsSidebarItems({
        docsRoot: fixture.docsRoot,
        platform: 'react',
        metadata: [fixture.metadata],
        contracts: [fixture.contract],
      })
    ).toEqual([
      {
        text: 'FixtureSwitch',
        link: '/react/fixture-switch',
      },
    ]);
  });

  it('includes a React Native generated page in React Native navigation', async () => {
    const fixture = createFixture({
      componentName: 'FixtureSwitch',
      platforms: ['react-native'],
    });

    await generateComponentDocs({
      root: fixture.root,
      docsRoot: fixture.docsRoot,
      metadata: [fixture.metadata],
      contracts: [fixture.contract],
    });

    expect(
      createGeneratedComponentDocsSidebarItems({
        docsRoot: fixture.docsRoot,
        platform: 'react-native',
        metadata: [fixture.metadata],
        contracts: [fixture.contract],
      })
    ).toEqual([
      {
        text: 'FixtureSwitch',
        link: '/react-native/fixture-switch',
      },
    ]);
  });

  it('includes cross-platform generated pages in both navigation groups', async () => {
    const fixture = createFixture({
      componentName: 'FixtureSwitch',
      platforms: ['react', 'react-native'],
    });

    await generateComponentDocs({
      root: fixture.root,
      docsRoot: fixture.docsRoot,
      metadata: [fixture.metadata],
      contracts: [fixture.contract],
    });

    expect(
      createGeneratedComponentDocsSidebarItems({
        docsRoot: fixture.docsRoot,
        platform: 'react',
        metadata: [fixture.metadata],
        contracts: [fixture.contract],
      })
    ).toEqual([{ text: 'FixtureSwitch', link: '/react/fixture-switch' }]);
    expect(
      createGeneratedComponentDocsSidebarItems({
        docsRoot: fixture.docsRoot,
        platform: 'react-native',
        metadata: [fixture.metadata],
        contracts: [fixture.contract],
      })
    ).toEqual([
      { text: 'FixtureSwitch', link: '/react-native/fixture-switch' },
    ]);
  });

  it('omits React-only generated pages from React Native navigation', async () => {
    const fixture = createFixture({
      componentName: 'FixtureSwitch',
      platforms: ['react'],
    });

    await generateComponentDocs({
      root: fixture.root,
      docsRoot: fixture.docsRoot,
      metadata: [fixture.metadata],
      contracts: [fixture.contract],
    });

    expect(
      createGeneratedComponentDocsSidebarItems({
        docsRoot: fixture.docsRoot,
        platform: 'react-native',
        metadata: [fixture.metadata],
        contracts: [fixture.contract],
      })
    ).toEqual([]);
  });

  it('omits React Native-only generated pages from React navigation', async () => {
    const fixture = createFixture({
      componentName: 'FixtureSwitch',
      platforms: ['react-native'],
    });

    await generateComponentDocs({
      root: fixture.root,
      docsRoot: fixture.docsRoot,
      metadata: [fixture.metadata],
      contracts: [fixture.contract],
    });

    expect(
      createGeneratedComponentDocsSidebarItems({
        docsRoot: fixture.docsRoot,
        platform: 'react',
        metadata: [fixture.metadata],
        contracts: [fixture.contract],
      })
    ).toEqual([]);
  });

  it('never emits navigation links to nonexistent generated pages', () => {
    const fixture = createFixture({
      componentName: 'FixtureSwitch',
      platforms: ['react'],
    });

    expect(() =>
      createGeneratedComponentDocsSidebarItems({
        docsRoot: fixture.docsRoot,
        platform: 'react',
        metadata: [fixture.metadata],
        contracts: [fixture.contract],
      })
    ).toThrow(
      'Cannot create component docs navigation for FixtureSwitch react: missing generated docs page react/fixture-switch.md.'
    );
  });

  it('orders generated navigation by canonical metadata order', async () => {
    const zulu = createFixture({
      componentName: 'FixtureZulu',
      platforms: ['react'],
    });
    const alpha = createFixture({
      componentName: 'FixtureAlpha',
      platforms: ['react'],
      root: zulu.root,
      docsRoot: zulu.docsRoot,
    });

    await generateComponentDocs({
      root: zulu.root,
      docsRoot: zulu.docsRoot,
      metadata: [zulu.metadata, alpha.metadata],
      contracts: [alpha.contract, zulu.contract],
    });

    expect(
      createGeneratedComponentDocsSidebarItems({
        docsRoot: zulu.docsRoot,
        platform: 'react',
        metadata: [zulu.metadata, alpha.metadata],
        contracts: [alpha.contract, zulu.contract],
      })
    ).toEqual([
      { text: 'FixtureZulu', link: '/react/fixture-zulu' },
      { text: 'FixtureAlpha', link: '/react/fixture-alpha' },
    ]);
  });

  it('resolves generated navigation independently of process cwd', async () => {
    const fixture = createFixture({
      componentName: 'FixtureSwitch',
      platforms: ['react', 'react-native'],
    });
    const otherCwd = fs.mkdtempSync(
      path.join(os.tmpdir(), 'vellira-component-docs-cwd-')
    );
    tempRoots.push(otherCwd);

    await generateComponentDocs({
      root: fixture.root,
      docsRoot: fixture.docsRoot,
      metadata: [fixture.metadata],
      contracts: [fixture.contract],
    });

    const configModuleUrl = pathToFileURL(
      path.join(fixture.docsRoot, '.vitepress', 'config.ts')
    ).href;
    const originalCwd = process.cwd();

    try {
      process.chdir(fixture.root);
      const rootResolvedFromFixtureRoot =
        resolveComponentDocsRoot(configModuleUrl);
      const reactFromFixtureRoot = createGeneratedComponentDocsSidebarItems({
        docsRoot: rootResolvedFromFixtureRoot,
        platform: 'react',
        metadata: [fixture.metadata],
        contracts: [fixture.contract],
      });
      const nativeFromFixtureRoot = createGeneratedComponentDocsSidebarItems({
        docsRoot: rootResolvedFromFixtureRoot,
        platform: 'react-native',
        metadata: [fixture.metadata],
        contracts: [fixture.contract],
      });

      process.chdir(otherCwd);
      const rootResolvedFromOtherCwd =
        resolveComponentDocsRoot(configModuleUrl);
      const reactFromOtherCwd = createGeneratedComponentDocsSidebarItems({
        docsRoot: rootResolvedFromOtherCwd,
        platform: 'react',
        metadata: [fixture.metadata],
        contracts: [fixture.contract],
      });
      const nativeFromOtherCwd = createGeneratedComponentDocsSidebarItems({
        docsRoot: rootResolvedFromOtherCwd,
        platform: 'react-native',
        metadata: [fixture.metadata],
        contracts: [fixture.contract],
      });

      expect(rootResolvedFromOtherCwd).toBe(rootResolvedFromFixtureRoot);
      expect(reactFromOtherCwd).toEqual(reactFromFixtureRoot);
      expect(nativeFromOtherCwd).toEqual(nativeFromFixtureRoot);
    } finally {
      process.chdir(originalCwd);
    }
  });

  it('check mode detects missing generated pages needed by navigation without writing', async () => {
    const fixture = createFixture({
      componentName: 'FixtureSwitch',
      platforms: ['react'],
    });

    await expect(
      generateComponentDocs({
        root: fixture.root,
        docsRoot: fixture.docsRoot,
        check: true,
        metadata: [fixture.metadata],
        contracts: [fixture.contract],
      })
    ).rejects.toThrow(
      'Cannot create component docs navigation for FixtureSwitch react: missing generated docs page react/fixture-switch.md.'
    );
    expect(fs.existsSync(fixture.reactDoc)).toBe(false);
  });

  it('does not invent Switch-specific usage for other components', async () => {
    const fixture = createFixture({
      componentName: 'FixtureButton',
      platforms: ['react'],
    });

    await generateComponentDocs({
      root: fixture.root,
      docsRoot: fixture.docsRoot,
      metadata: [fixture.metadata],
      contracts: [fixture.contract],
    });

    const content = fs.readFileSync(fixture.reactDoc, 'utf8');

    expect(content).not.toContain('defaultChecked');
    expect(content).not.toContain('accessibilityLabel');
    expect(content).not.toContain('## Basic Usage');
  });

  it('fails clearly when required platform docs metadata is missing', async () => {
    const fixture = createFixture({
      componentName: 'FixtureSwitch',
      platforms: ['react', 'react-native'],
      contractPlatforms: ['react'],
    });

    await expect(
      generateComponentDocs({
        root: fixture.root,
        docsRoot: fixture.docsRoot,
        metadata: [fixture.metadata],
        contracts: [fixture.contract],
      })
    ).rejects.toThrow(
      'Cannot generate docs for FixtureSwitch react-native: missing editorial docs for supported platform.'
    );
  });

  it('fails clearly when required editorial fields are malformed', async () => {
    const fixture = createFixture({
      componentName: 'FixtureSwitch',
      platforms: ['react'],
    });
    const reactDocs = fixture.contract.platforms.react;

    if (!reactDocs) {
      throw new Error('React docs fixture is required.');
    }

    const malformedContract: ComponentDocsContract = {
      ...fixture.contract,
      platforms: {
        react: {
          ...reactDocs,
          title: '',
        },
      },
    };

    await expect(
      generateComponentDocs({
        root: fixture.root,
        docsRoot: fixture.docsRoot,
        metadata: [fixture.metadata],
        contracts: [malformedContract],
      })
    ).rejects.toThrow(
      'FixtureSwitch: platforms.react.title must be a non-empty string.'
    );
  });

  it('is idempotent after a successful generation', async () => {
    const fixture = createFixture({
      componentName: 'FixtureSwitch',
      platforms: ['react', 'react-native'],
    });

    await generateComponentDocs({
      root: fixture.root,
      docsRoot: fixture.docsRoot,
      metadata: [fixture.metadata],
      contracts: [fixture.contract],
    });

    const firstReactContent = fs.readFileSync(fixture.reactDoc, 'utf8');
    const firstNativeContent = fs.readFileSync(fixture.nativeDoc, 'utf8');
    const result = await generateComponentDocs({
      root: fixture.root,
      docsRoot: fixture.docsRoot,
      metadata: [fixture.metadata],
      contracts: [fixture.contract],
    });

    expect(result).toMatchObject({
      status: 'up-to-date',
      changedFiles: [],
    });
    expect(fs.readFileSync(fixture.reactDoc, 'utf8')).toBe(firstReactContent);
    expect(fs.readFileSync(fixture.nativeDoc, 'utf8')).toBe(firstNativeContent);
  });

  it('--check detects stale output without mutating files', async () => {
    const fixture = createFixture({
      componentName: 'FixtureSwitch',
      platforms: ['react'],
    });
    const staleContent = [
      '# Stale',
      generatedComponentDocsHeader,
      authoredRegionStartMarker,
      'Keep this content.',
      authoredRegionEndMarker,
      '',
    ].join('\n');

    fs.mkdirSync(path.dirname(fixture.reactDoc), { recursive: true });
    fs.writeFileSync(fixture.reactDoc, staleContent);

    const result = await generateComponentDocs({
      root: fixture.root,
      docsRoot: fixture.docsRoot,
      check: true,
      metadata: [fixture.metadata],
      contracts: [fixture.contract],
    });

    expect(result.status).toBe('stale');
    expect(result.changedFiles).toEqual([
      'apps/docs/src/react/fixture-switch.md',
    ]);
    expect(fs.readFileSync(fixture.reactDoc, 'utf8')).toBe(staleContent);
  });

  it('preserves authored regions across regeneration', async () => {
    const fixture = createFixture({
      componentName: 'FixtureSwitch',
      platforms: ['react'],
    });

    await generateComponentDocs({
      root: fixture.root,
      docsRoot: fixture.docsRoot,
      metadata: [fixture.metadata],
      contracts: [fixture.contract],
    });

    const authoredContent =
      '\n## Local Guidance\n\nKeep this hand-authored note.\n';
    const generatedContent = fs.readFileSync(fixture.reactDoc, 'utf8');
    const nextContent = generatedContent.replace(
      `${authoredRegionStartMarker}\n${defaultAuthoredRegionPlaceholder}\n${authoredRegionEndMarker}`,
      `${authoredRegionStartMarker}${authoredContent}${authoredRegionEndMarker}`
    );

    fs.writeFileSync(fixture.reactDoc, nextContent);

    await generateComponentDocs({
      root: fixture.root,
      docsRoot: fixture.docsRoot,
      metadata: [fixture.metadata],
      contracts: [fixture.contract],
    });

    expect(fs.readFileSync(fixture.reactDoc, 'utf8')).toContain(
      'Keep this hand-authored note.'
    );
  });

  it('refuses destructive --force on existing unmarked legacy content', async () => {
    const fixture = createFixture({
      componentName: 'FixtureSwitch',
      platforms: ['react'],
    });
    const original = [
      '---',
      'title: Original React Switch guide',
      '---',
      '',
      '# FixtureSwitch',
      '',
      'Important authored examples and platform guidance.',
      '',
    ].join('\n');
    fs.mkdirSync(path.dirname(fixture.reactDoc), { recursive: true });
    fs.writeFileSync(fixture.reactDoc, original);

    await expect(
      generateComponentDocs({
        root: fixture.root,
        docsRoot: fixture.docsRoot,
        force: true,
        metadata: [fixture.metadata],
        contracts: [fixture.contract],
      })
    ).rejects.toThrow('Refusing destructive overwrite even with --force');

    expect(fs.readFileSync(fixture.reactDoc, 'utf8')).toBe(original);
  });

  it('preflights both platforms before touching any document', async () => {
    const fixture = createFixture({
      componentName: 'FixtureSwitch',
      platforms: ['react', 'react-native'],
    });
    await generateComponentDocs({
      root: fixture.root,
      docsRoot: fixture.docsRoot,
      metadata: [fixture.metadata],
      contracts: [fixture.contract],
    });

    const staleReact = fs
      .readFileSync(fixture.reactDoc, 'utf8')
      .replace('## Import', '## Old Import');
    const nativeLegacy = '# Native content\n\nPreserve this native example.\n';
    fs.writeFileSync(fixture.reactDoc, staleReact);
    fs.writeFileSync(fixture.nativeDoc, nativeLegacy);

    await expect(
      generateComponentDocs({
        root: fixture.root,
        docsRoot: fixture.docsRoot,
        force: true,
        metadata: [fixture.metadata],
        contracts: [fixture.contract],
      })
    ).rejects.toThrow('Refusing destructive overwrite even with --force');

    expect(fs.readFileSync(fixture.reactDoc, 'utf8')).toBe(staleReact);
    expect(fs.readFileSync(fixture.nativeDoc, 'utf8')).toBe(nativeLegacy);
  });

  it('refuses marker-only documents without generated ownership evidence', async () => {
    const fixture = createFixture({
      componentName: 'FixtureSwitch',
      platforms: ['react'],
    });
    const original = [
      '# Legacy page',
      authoredRegionStartMarker,
      'Guidance preserved inside the markers.',
      authoredRegionEndMarker,
      '',
    ].join('\n');
    fs.mkdirSync(path.dirname(fixture.reactDoc), { recursive: true });
    fs.writeFileSync(fixture.reactDoc, original);

    await expect(
      generateComponentDocs({
        root: fixture.root,
        docsRoot: fixture.docsRoot,
        force: true,
        metadata: [fixture.metadata],
        contracts: [fixture.contract],
      })
    ).rejects.toThrow('no generated docs ownership header');

    expect(fs.readFileSync(fixture.reactDoc, 'utf8')).toBe(original);
  });

  it('provides deterministic read-only legacy source evidence', () => {
    const fixture = createFixture({
      componentName: 'FixtureSwitch',
      platforms: ['react'],
    });
    const original = '# FixtureSwitch\n\nA hand-authored example.\n';
    fs.mkdirSync(path.dirname(fixture.reactDoc), { recursive: true });
    fs.writeFileSync(fixture.reactDoc, original);

    const audit = inspectComponentDocAuthority({
      content: fs.readFileSync(fixture.reactDoc, 'utf8'),
      filePath: fixture.reactDoc,
    });

    expect(audit.state).toBe('legacy');
    expect(audit.sourceSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(audit.bytes).toBe(Buffer.byteLength(original, 'utf8'));
    expect(fs.readFileSync(fixture.reactDoc, 'utf8')).toBe(original);
  });

  it('fails safely when authored-region markers are malformed', async () => {
    const fixture = createFixture({
      componentName: 'FixtureSwitch',
      platforms: ['react'],
    });

    fs.mkdirSync(path.dirname(fixture.reactDoc), { recursive: true });
    fs.writeFileSync(
      fixture.reactDoc,
      [
        authoredRegionStartMarker,
        authoredRegionStartMarker,
        'Ambiguous content.',
        authoredRegionEndMarker,
        '',
      ].join('\n')
    );

    await expect(
      generateComponentDocs({
        root: fixture.root,
        docsRoot: fixture.docsRoot,
        force: true,
        metadata: [fixture.metadata],
        contracts: [fixture.contract],
      })
    ).rejects.toThrow(
      'apps/docs/src/react/fixture-switch.md contains multiple authored region start markers.'
    );
  });

  it('fails safely when authored-region end markers are duplicated', async () => {
    const fixture = createFixture({
      componentName: 'FixtureSwitch',
      platforms: ['react'],
    });

    fs.mkdirSync(path.dirname(fixture.reactDoc), { recursive: true });
    fs.writeFileSync(
      fixture.reactDoc,
      [
        authoredRegionStartMarker,
        'Ambiguous content.',
        authoredRegionEndMarker,
        authoredRegionEndMarker,
        '',
      ].join('\n')
    );

    await expect(
      generateComponentDocs({
        root: fixture.root,
        docsRoot: fixture.docsRoot,
        metadata: [fixture.metadata],
        contracts: [fixture.contract],
      })
    ).rejects.toThrow(
      'apps/docs/src/react/fixture-switch.md contains multiple authored region end markers.'
    );
  });

  it('fails safely when authored-region start marker is unmatched', async () => {
    const fixture = createFixture({
      componentName: 'FixtureSwitch',
      platforms: ['react'],
    });

    fs.mkdirSync(path.dirname(fixture.reactDoc), { recursive: true });
    fs.writeFileSync(
      fixture.reactDoc,
      [authoredRegionStartMarker, 'Unmatched content.', ''].join('\n')
    );

    await expect(
      generateComponentDocs({
        root: fixture.root,
        docsRoot: fixture.docsRoot,
        metadata: [fixture.metadata],
        contracts: [fixture.contract],
      })
    ).rejects.toThrow(
      'apps/docs/src/react/fixture-switch.md contains unmatched authored region markers.'
    );
  });

  it('fails safely when authored-region end marker is unmatched', async () => {
    const fixture = createFixture({
      componentName: 'FixtureSwitch',
      platforms: ['react'],
    });

    fs.mkdirSync(path.dirname(fixture.reactDoc), { recursive: true });
    fs.writeFileSync(
      fixture.reactDoc,
      ['Unmatched content.', authoredRegionEndMarker, ''].join('\n')
    );

    await expect(
      generateComponentDocs({
        root: fixture.root,
        docsRoot: fixture.docsRoot,
        metadata: [fixture.metadata],
        contracts: [fixture.contract],
      })
    ).rejects.toThrow(
      'apps/docs/src/react/fixture-switch.md contains unmatched authored region markers.'
    );
  });

  it('fails safely when authored-region markers are reversed', async () => {
    const fixture = createFixture({
      componentName: 'FixtureSwitch',
      platforms: ['react'],
    });

    fs.mkdirSync(path.dirname(fixture.reactDoc), { recursive: true });
    fs.writeFileSync(
      fixture.reactDoc,
      [
        authoredRegionEndMarker,
        'Reversed content.',
        authoredRegionStartMarker,
        '',
      ].join('\n')
    );

    await expect(
      generateComponentDocs({
        root: fixture.root,
        docsRoot: fixture.docsRoot,
        metadata: [fixture.metadata],
        contracts: [fixture.contract],
      })
    ).rejects.toThrow(
      'apps/docs/src/react/fixture-switch.md contains an authored region end marker before its start marker.'
    );
  });
});

function createFixture(params: {
  componentName: string;
  platforms: readonly ComponentPlatform[];
  contractPlatforms?: readonly ComponentPlatform[];
  layer?: ComponentMetadata['layer'];
  category?: ComponentMetadata['category'];
  profile?: ComponentMetadata['profile'];
  compoundParts?: Partial<Record<ComponentPlatform, readonly string[]>>;
  apiParts?: Partial<Record<ComponentPlatform, readonly string[]>>;
  extraApiBlocks?: Partial<Record<ComponentPlatform, readonly string[]>>;
  typeExportSuffix?: string;
  root?: string;
  docsRoot?: string;
}) {
  const {
    componentName,
    platforms,
    contractPlatforms = platforms,
    layer = 'primitives',
    category = 'form',
    profile = 'form-control',
    compoundParts = {},
    apiParts = {},
    extraApiBlocks = {},
    typeExportSuffix = '',
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'vellira-component-docs-')),
    docsRoot = path.join(root, 'apps', 'docs', 'src'),
  } = params;
  const slug = slugifyComponentName(componentName);
  const metadata: ComponentMetadata = {
    name: componentName,
    layer,
    category,
    platforms,
    profile,
    status: 'experimental',
    capabilities: ['controlled'],
    requirements: {
      tests: true,
      storybook: true,
      docs: true,
      accessibility: true,
    },
  };
  const contract: ComponentDocsContract = {
    component: componentName,
    platforms: Object.fromEntries(
      contractPlatforms.map((platform) => [
        platform,
        {
          title:
            platform === 'react'
              ? `${componentName} - React Component`
              : `React Native ${componentName}`,
          description: `Generated docs for ${componentName} on ${platform}.`,
          summary: `${componentName} toggles an immediate boolean setting.`,
          whenToUse: ['Use for immediate settings.'],
          accessibility: ['Provide an accessible name.'],
          notes: ['Do not use for submitted form selections.'],
          storybook:
            platform === 'react'
              ? {
                  story: 'Default',
                  title: `Primitives/${componentName}`,
                }
              : undefined,
          seeAlso: [
            {
              component: 'Checkbox',
              label: 'Use for submitted form selections.',
            },
          ],
        },
      ])
    ),
  };

  if (!tempRoots.includes(root)) {
    tempRoots.push(root);
  }
  writeApiFixtures({
    root,
    componentName,
    layer,
    platforms,
    compoundParts,
    apiParts,
    extraApiBlocks,
    typeExportSuffix,
  });

  return {
    root,
    docsRoot,
    metadata,
    contract,
    reactDoc: path.join(docsRoot, 'react', `${slug}.md`),
    nativeDoc: path.join(docsRoot, 'react-native', `${slug}.md`),
  };
}

function writeApiFixtures(params: {
  root: string;
  componentName: string;
  layer: ComponentMetadata['layer'];
  platforms: readonly ComponentPlatform[];
  compoundParts: Partial<Record<ComponentPlatform, readonly string[]>>;
  apiParts: Partial<Record<ComponentPlatform, readonly string[]>>;
  extraApiBlocks: Partial<Record<ComponentPlatform, readonly string[]>>;
  typeExportSuffix: string;
}) {
  const {
    root,
    componentName,
    layer,
    platforms,
    compoundParts,
    apiParts,
    extraApiBlocks,
    typeExportSuffix,
  } = params;

  for (const platform of platforms) {
    const packageDir =
      platform === 'react' ? 'packages/react' : 'packages/react-native';
    const apiPrefix = platform === 'react' ? 'web' : 'native';
    const platformCompoundParts = compoundParts[platform] ?? [];
    const platformApiParts = apiParts[platform] ?? platformCompoundParts;
    const apiFile = path.join(root, packageDir, 'API.md');
    const rootApiId =
      platformApiParts.length > 0
        ? `${apiPrefix}.${componentName}Props.${componentName}Props`
        : `${apiPrefix}.${componentName}Props.${componentName}`;

    fs.mkdirSync(path.dirname(apiFile), { recursive: true });
    const existingContent = fs.existsSync(apiFile)
      ? fs.readFileSync(apiFile, 'utf8')
      : `# ${platform} API\n\n`;

    fs.writeFileSync(
      apiFile,
      [
        existingContent.trimEnd(),
        renderApiFixtureBlock({
          apiId: rootApiId,
          propName: 'checked',
          description: 'Controlled checked state.',
        }),
        ...platformApiParts.map((partName) =>
          renderApiFixtureBlock({
            apiId: `${apiPrefix}.${componentName}${partName}Props.${componentName}${partName}Props`,
            propName: partName.toLowerCase(),
            description: `${partName} public API.`,
          })
        ),
        ...(extraApiBlocks[platform] ?? []),
        '',
      ].join('\n')
    );

    writePublicComponentSource({
      root,
      packageDir,
      componentName,
      layer,
      compoundParts: platformCompoundParts,
      typeExportSuffix,
    });
  }
}

function renderApiFixtureBlock(params: {
  apiId: string;
  propName: string;
  description: string;
}) {
  return [
    `<!-- api-docgen:start ${params.apiId} -->`,
    '',
    '| Prop | Type | Required | Description |',
    '| ---- | ---- | -------- | ----------- |',
    `| \`${params.propName}\` | \`boolean\` | No | ${params.description} |`,
    '',
    `<!-- api-docgen:end ${params.apiId} -->`,
  ].join('\n');
}

function writePublicComponentSource(params: {
  root: string;
  packageDir: string;
  componentName: string;
  layer: ComponentMetadata['layer'];
  compoundParts: readonly string[];
  typeExportSuffix: string;
}) {
  const {
    root,
    packageDir,
    componentName,
    layer,
    compoundParts,
    typeExportSuffix,
  } = params;
  const packageSourceRoot = path.join(root, packageDir, 'src');
  const componentRoot = path.join(packageSourceRoot, layer, componentName);
  const componentExportPath = `./${layer}/${componentName}`;
  const typeExportPath = `${componentExportPath}${typeExportSuffix}`;
  const publicTypeNames = [
    `${componentName}Props`,
    ...compoundParts.map((partName) => `${componentName}${partName}Props`),
    `${componentName}InternalProps`,
  ];

  fs.mkdirSync(componentRoot, { recursive: true });
  fs.writeFileSync(
    path.join(packageSourceRoot, 'index.ts'),
    [
      fs.existsSync(path.join(packageSourceRoot, 'index.ts'))
        ? fs
            .readFileSync(path.join(packageSourceRoot, 'index.ts'), 'utf8')
            .trimEnd()
        : '',
      `export type { ${publicTypeNames.join(', ')} } from '${typeExportPath}';`,
      `export { ${componentName} } from '${componentExportPath}';`,
      '',
    ]
      .filter(Boolean)
      .join('\n')
  );
  fs.writeFileSync(
    path.join(componentRoot, `${componentName}.tsx`),
    compoundParts.length > 0
      ? [
          `const ${componentName}Root = () => null;`,
          ...compoundParts.map(
            (partName) => `const ${componentName}${partName} = () => null;`
          ),
          '',
          `export const ${componentName} = Object.assign(${componentName}Root, {`,
          ...compoundParts.map(
            (partName) => `  ${partName}: ${componentName}${partName},`
          ),
          '});',
          '',
        ].join('\n')
      : `export function ${componentName}() {
  return null;
}
`
  );
}

function slugifyComponentName(componentName: string) {
  return componentName
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

function markerOrder(content: string) {
  return [...content.matchAll(/<!-- api-docgen:start ([^ ]+) -->/g)].map(
    (match) => match[1]
  );
}
