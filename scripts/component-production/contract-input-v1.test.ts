import { describe, expect, it } from 'vitest';

import {
  createComponentProductionGeneratorOptions,
  parseComponentProductionInput,
} from './contracts';

describe('Component Production Contract input V1', () => {
  it('parses and forwards exact governed GitHub work-item provenance', () => {
    const input = parseComponentProductionInput({
      schemaVersion: '1',
      componentName: 'EvidenceProbe',
      platform: 'both',
      layer: 'components',
      category: 'feedback',
      profile: 'base',
      componentTokens: 'standard',
      workItem: {
        provider: 'github',
        repository: 'vellira-dev/vellira',
        issue: '#1283',
      },
    });

    expect(input.workItem).toEqual({
      provider: 'github',
      repository: 'vellira-dev/vellira',
      issue: '#1283',
    });
    expect(createComponentProductionGeneratorOptions(input).workItem).toEqual(
      input.workItem
    );
  });

  it('rejects malformed or extensible work-item provenance', () => {
    const base = {
      schemaVersion: '1',
      componentName: 'EvidenceProbe',
      platform: 'both',
      layer: 'components',
      category: 'feedback',
      profile: 'base',
      componentTokens: 'standard',
    };

    expect(() =>
      parseComponentProductionInput({
        ...base,
        workItem: {
          provider: 'github',
          repository: 'vellira-dev/vellira',
          issue: '1283',
        },
      })
    ).toThrow('must use canonical #<number> form');

    expect(() =>
      parseComponentProductionInput({
        ...base,
        workItem: {
          provider: 'github',
          repository: 'vellira-dev/vellira',
          issue: '#1283',
          title: 'untrusted issue body text',
        },
      })
    ).toThrow('must contain exactly provider, repository, and issue');
  });

  it('parses and forwards canonical dependency and resource intent', () => {
    const input = parseComponentProductionInput({
      schemaVersion: '1',
      componentName: 'Disclosure',
      platform: 'both',
      layer: 'components',
      category: 'navigation',
      profile: 'compound',
      capabilities: ['compound-api', 'controlled'],
      dependencies: {
        packages: ['@vellira-ui/core'],
        components: ['Tooltip'],
        platforms: {
          react: {
            packages: ['@vellira-ui/icons'],
          },
          'react-native': {
            packages: ['@vellira-ui/assets'],
          },
        },
      },
      icons: [
        {
          name: 'ChevronDown',
          purpose: 'disclosure indicator',
        },
      ],
      tokens: ['semantic.text.primary'],
      assets: [
        {
          path: 'styles/disclosure.css',
          purpose: 'canonical disclosure surface',
        },
      ],
      componentTokens: 'disclosure',
      parts: ['Root', 'Trigger', 'Content'],
    });

    expect(input).toMatchObject({
      dependencies: {
        packages: ['@vellira-ui/core'],
        components: ['Tooltip'],
        platforms: {
          react: { packages: ['@vellira-ui/icons'] },
          'react-native': { packages: ['@vellira-ui/assets'] },
        },
      },
      assets: [
        {
          path: 'styles/disclosure.css',
          purpose: 'canonical disclosure surface',
        },
      ],
      componentTokens: 'disclosure',
    });

    expect(createComponentProductionGeneratorOptions(input)).toMatchObject({
      dependencies: input.dependencies,
      icons: input.icons,
      tokens: input.tokens,
      assets: input.assets,
      componentTokens: 'disclosure',
      force: false,
      dryRun: false,
      check: false,
    });
  });

  it('parses and forwards shared and platform semantic capability evidence', () => {
    const input = parseComponentProductionInput({
      schemaVersion: '1',
      componentName: 'Textarea',
      platform: 'both',
      layer: 'primitives',
      category: 'form',
      profile: 'form-control',
      control: 'text',
      semanticCapabilities: ['multiline', 'accessible-name'],
      platformSemanticCapabilities: {
        react: ['size-variants'],
        'react-native': ['accessible-value'],
      },
      componentTokens: 'standard',
    });

    expect(input).toMatchObject({
      semanticCapabilities: ['multiline', 'accessible-name'],
      platformSemanticCapabilities: {
        react: ['size-variants'],
        'react-native': ['accessible-value'],
      },
    });

    expect(createComponentProductionGeneratorOptions(input)).toMatchObject({
      semanticCapabilities: ['multiline', 'accessible-name'],
      platformSemanticCapabilities: {
        react: ['size-variants'],
        'react-native': ['accessible-value'],
      },
    });
  });

  it('rejects invalid, duplicate, and unselected semantic capability evidence', () => {
    const base = {
      schemaVersion: '1',
      componentName: 'Textarea',
      platform: 'web',
      layer: 'primitives',
      category: 'form',
      profile: 'form-control',
      control: 'text',
    };

    expect(() =>
      parseComponentProductionInput({
        ...base,
        semanticCapabilities: ['multiline', 'not-real'],
      })
    ).toThrow('contains unsupported semantic capabilities: not-real');

    expect(() =>
      parseComponentProductionInput({
        ...base,
        semanticCapabilities: ['multiline', 'multiline'],
      })
    ).toThrow('semanticCapabilities" must not contain duplicates');

    expect(() =>
      parseComponentProductionInput({
        ...base,
        platformSemanticCapabilities: {
          'react-native': ['accessible-name'],
        },
      })
    ).toThrow(
      'platformSemanticCapabilities.react-native" targets an unselected platform'
    );
  });

  it('preserves explicit no-component-token intent', () => {
    const input = parseComponentProductionInput({
      schemaVersion: '1',
      componentName: 'Avatar',
      platform: 'web',
      layer: 'primitives',
      category: 'data-display',
      profile: 'base',
      componentTokens: false,
    });

    expect(input.componentTokens).toBe(false);
    expect(
      createComponentProductionGeneratorOptions(input).componentTokens
    ).toBe(false);
  });

  it('rejects unknown dependency fields and unsupported platform scopes', () => {
    expect(() =>
      parseComponentProductionInput({
        schemaVersion: '1',
        componentName: 'Avatar',
        platform: 'web',
        layer: 'primitives',
        category: 'data-display',
        profile: 'base',
        dependencies: {
          package: ['@vellira-ui/core'],
        },
      })
    ).toThrow(
      'Unknown component production dependency field "package" at dependencies.'
    );

    expect(() =>
      parseComponentProductionInput({
        schemaVersion: '1',
        componentName: 'Avatar',
        platform: 'web',
        layer: 'primitives',
        category: 'data-display',
        profile: 'base',
        dependencies: {
          platforms: {
            web: {
              packages: ['@vellira-ui/core'],
            },
          },
        },
      })
    ).toThrow(
      'Component production input field "dependencies.platforms" contains unsupported platform "web".'
    );
  });

  it('rejects duplicate dependencies and asset requirements', () => {
    expect(() =>
      parseComponentProductionInput({
        schemaVersion: '1',
        componentName: 'Avatar',
        platform: 'web',
        layer: 'primitives',
        category: 'data-display',
        profile: 'base',
        dependencies: {
          packages: ['@vellira-ui/core', '@vellira-ui/core'],
        },
      })
    ).toThrow(
      'Component production input field "dependencies.packages" must not contain duplicates.'
    );

    expect(() =>
      parseComponentProductionInput({
        schemaVersion: '1',
        componentName: 'Avatar',
        platform: 'web',
        layer: 'primitives',
        category: 'data-display',
        profile: 'base',
        assets: [
          { path: 'styles/avatar.css', purpose: 'avatar surface' },
          { path: 'styles/avatar.css', purpose: 'avatar surface' },
        ],
      })
    ).toThrow(
      'Component production asset requirements must not contain duplicate path/purpose pairs.'
    );
  });
});
