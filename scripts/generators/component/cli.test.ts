import { describe, expect, it } from 'vitest';

import { componentGeneratorUsage, parseComponentGeneratorArgs } from './cli';

describe('component generator CLI', () => {
  it('parses a complete component command', () => {
    expect(
      parseComponentGeneratorArgs([
        'Avatar',
        'both',
        'primitives',
        'data-display',
      ])
    ).toEqual({
      componentName: 'Avatar',
      platform: 'both',
      layer: 'primitives',
      category: 'data-display',
      profile: 'base',
      control: 'value',
      capabilities: [],
      icons: [],
      tokens: [],
      parts: [],
      force: false,
      dryRun: false,
      check: false,
    });
  });

  it('parses --force', () => {
    expect(
      parseComponentGeneratorArgs([
        'Toast',
        'web',
        'components',
        'feedback',
        '--force',
      ])
    ).toMatchObject({
      componentName: 'Toast',
      force: true,
    });
  });

  it('parses --dry-run', () => {
    expect(
      parseComponentGeneratorArgs([
        'Avatar',
        'both',
        'primitives',
        'data-display',
        '--dry-run',
      ])
    ).toMatchObject({
      componentName: 'Avatar',
      dryRun: true,
    });
  });

  it('rejects missing arguments', () => {
    expect(() => parseComponentGeneratorArgs(['Avatar', 'both'])).toThrow(
      componentGeneratorUsage
    );
  });

  it.each(['avatar', 'avatar-item', 'Avatar_Item', '123Avatar'])(
    'rejects invalid component name "%s"',
    (name) => {
      expect(() =>
        parseComponentGeneratorArgs([
          name,
          'both',
          'primitives',
          'data-display',
        ])
      ).toThrow(
        'Component name must be PascalCase and contain only letters and numbers.'
      );
    }
  );

  it('rejects invalid platform', () => {
    expect(() =>
      parseComponentGeneratorArgs([
        'Avatar',
        'desktop',
        'primitives',
        'data-display',
      ])
    ).toThrow('Invalid platform "desktop"');
  });

  it('rejects invalid layer', () => {
    expect(() =>
      parseComponentGeneratorArgs(['Avatar', 'both', 'widgets', 'data-display'])
    ).toThrow('Invalid layer "widgets"');
  });

  it('rejects invalid category', () => {
    expect(() =>
      parseComponentGeneratorArgs(['Avatar', 'both', 'primitives', 'profile'])
    ).toThrow('Invalid category "profile"');
  });

  it('rejects unknown flags', () => {
    expect(() =>
      parseComponentGeneratorArgs([
        'Avatar',
        'both',
        'primitives',
        'data-display',
        '--overwrite',
      ])
    ).toThrow('Unknown option: --overwrite');
  });

  it('rejects unexpected positional arguments', () => {
    expect(() =>
      parseComponentGeneratorArgs([
        'Avatar',
        'both',
        'primitives',
        'data-display',
        'extra',
      ])
    ).toThrow('Unexpected arguments: extra');
  });

  it('uses base profile by default', () => {
    const result = parseComponentGeneratorArgs([
      'Avatar',
      'both',
      'primitives',
      'data-display',
    ]);

    expect(result.profile).toBe('base');
  });

  it('parses an explicit component profile', () => {
    const result = parseComponentGeneratorArgs([
      'Modal',
      'both',
      'components',
      'overlay',
      '--profile=overlay',
    ]);

    expect(result.profile).toBe('overlay');
  });

  it('parses explicit boolean form-control intent', () => {
    const result = parseComponentGeneratorArgs([
      'Switch',
      'both',
      'components',
      'form',
      '--profile=form-control',
      '--control=boolean',
    ]);

    expect(result.control).toBe('boolean');
  });

  it('parses explicit text form-control intent', () => {
    const result = parseComponentGeneratorArgs([
      'Textarea',
      'both',
      'components',
      'form',
      '--profile=form-control',
      '--control=text',
    ]);

    expect(result.control).toBe('text');
  });

  it('parses explicit metadata capabilities', () => {
    const result = parseComponentGeneratorArgs([
      'Accordion',
      'both',
      'components',
      'navigation',
      '--profile=compound',
      '--capabilities=controlled,uncontrolled,disabled,keyboard',
      '--parts=Root,Item,Trigger,Content',
    ]);

    expect(result.capabilities).toEqual([
      'controlled',
      'uncontrolled',
      'disabled',
      'keyboard',
    ]);
  });

  it('parses shared and platform semantic capabilities', () => {
    const result = parseComponentGeneratorArgs([
      'Textarea',
      'both',
      'primitives',
      'form',
      '--profile=form-control',
      '--control=text',
      '--semantic-capabilities=multiline,accessible-name',
      '--platform-semantic-capability=react:size-variants',
      '--platform-semantic-capability=react-native:accessible-value',
    ]);

    expect(result.semanticCapabilities).toEqual([
      'multiline',
      'accessible-name',
    ]);
    expect(result.platformSemanticCapabilities).toEqual({
      react: ['size-variants'],
      'react-native': ['accessible-value'],
    });
  });

  it('rejects invalid and unselected platform semantic capabilities', () => {
    expect(() =>
      parseComponentGeneratorArgs([
        'Textarea',
        'web',
        'primitives',
        'form',
        '--semantic-capabilities=multiline,not-real',
      ])
    ).toThrow('Invalid component semantic capabilities: not-real.');

    expect(() =>
      parseComponentGeneratorArgs([
        'Textarea',
        'web',
        'primitives',
        'form',
        '--platform-semantic-capability=react-native:accessible-name',
      ])
    ).toThrow(
      'Platform semantic capabilities target unselected platform "react-native".'
    );
  });

  it('parses one icon requirement with a semantic purpose containing spaces', () => {
    const result = parseComponentGeneratorArgs([
      'Accordion',
      'both',
      'components',
      'navigation',
      '--icon=ChevronDown:disclosure indicator',
    ]);

    expect(result.icons).toEqual([
      {
        name: 'ChevronDown',
        purpose: 'disclosure indicator',
      },
    ]);
  });

  it('parses multiple icon requirements', () => {
    const result = parseComponentGeneratorArgs([
      'Dialog',
      'web',
      'components',
      'overlay',
      '--icon=Close:dismiss action',
      '--icon=ChevronDown:disclosure indicator',
    ]);

    expect(result.icons).toEqual([
      {
        name: 'Close',
        purpose: 'dismiss action',
      },
      {
        name: 'ChevronDown',
        purpose: 'disclosure indicator',
      },
    ]);
  });

  it('parses token requirements', () => {
    const result = parseComponentGeneratorArgs([
      'Avatar',
      'web',
      'primitives',
      'data-display',
      '--token=semantic.text.primary',
      '--token=components.button.background.primary',
    ]);

    expect(result.tokens).toEqual([
      'semantic.text.primary',
      'components.button.background.primary',
    ]);
  });

  it('rejects malformed icon requirements', () => {
    expect(() =>
      parseComponentGeneratorArgs([
        'Accordion',
        'both',
        'components',
        'navigation',
        '--icon=ChevronDown',
      ])
    ).toThrow(
      '--icon must use the form <CanonicalIconName>:<semantic purpose>.'
    );
  });

  it('rejects empty icon names', () => {
    expect(() =>
      parseComponentGeneratorArgs([
        'Accordion',
        'both',
        'components',
        'navigation',
        '--icon=:disclosure indicator',
      ])
    ).toThrow('--icon requires a non-empty canonical icon name.');
  });

  it('rejects empty icon purposes', () => {
    expect(() =>
      parseComponentGeneratorArgs([
        'Accordion',
        'both',
        'components',
        'navigation',
        '--icon=ChevronDown:',
      ])
    ).toThrow('--icon requires a non-empty semantic purpose.');
  });

  it('rejects duplicate icon requirements', () => {
    expect(() =>
      parseComponentGeneratorArgs([
        'Accordion',
        'both',
        'components',
        'navigation',
        '--icon=ChevronDown:disclosure indicator',
        '--icon=ChevronDown:disclosure indicator',
      ])
    ).toThrow(
      'Icon requirements must not contain duplicate name/purpose pairs.'
    );
  });

  it('rejects duplicate token requirements', () => {
    expect(() =>
      parseComponentGeneratorArgs([
        'Avatar',
        'web',
        'primitives',
        'data-display',
        '--token=semantic.text.primary',
        '--token=semantic.text.primary',
      ])
    ).toThrow('Token requirements must not contain duplicates.');
  });

  it('rejects empty token requirements', () => {
    expect(() =>
      parseComponentGeneratorArgs([
        'Avatar',
        'web',
        'primitives',
        'data-display',
        '--token=',
      ])
    ).toThrow('--token requires a non-empty canonical token path.');
  });

  it('rejects token requirements with surrounding whitespace', () => {
    expect(() =>
      parseComponentGeneratorArgs([
        'Avatar',
        'web',
        'primitives',
        'data-display',
        '--token= semantic.text.primary',
      ])
    ).toThrow(
      '--token canonical token path must not include surrounding whitespace.'
    );
  });

  it('rejects invalid metadata capabilities', () => {
    expect(() =>
      parseComponentGeneratorArgs([
        'Accordion',
        'both',
        'components',
        'navigation',
        '--profile=compound',
        '--capabilities=keyboard,gesture',
      ])
    ).toThrow('Invalid component capabilities: gesture.');
  });

  it('rejects duplicate metadata capabilities', () => {
    expect(() =>
      parseComponentGeneratorArgs([
        'Accordion',
        'both',
        'components',
        'navigation',
        '--profile=compound',
        '--capabilities=keyboard,keyboard',
      ])
    ).toThrow('Component capabilities must not contain duplicates.');
  });

  it('rejects unsupported form-control intent', () => {
    expect(() =>
      parseComponentGeneratorArgs([
        'Switch',
        'both',
        'components',
        'form',
        '--profile=form-control',
        '--control=toggle',
      ])
    ).toThrow(
      'Invalid form-control kind "toggle". Expected value, boolean, or text.'
    );
  });

  it('rejects specialized control intent outside form-control profile', () => {
    expect(() =>
      parseComponentGeneratorArgs([
        'Switch',
        'both',
        'components',
        'form',
        '--control=boolean',
      ])
    ).toThrow('--control is only supported by the form-control profile.');
  });

  it('rejects an unsupported component profile', () => {
    expect(() =>
      parseComponentGeneratorArgs([
        'Avatar',
        'both',
        'primitives',
        'data-display',
        '--profile=unknown',
      ])
    ).toThrow(
      'Invalid component profile "unknown". Expected base, form-control, compound, or overlay.'
    );
  });

  it('parses component parts', () => {
    const result = parseComponentGeneratorArgs([
      'Tabs',
      'both',
      'components',
      'navigation',
      '--profile=compound',
      '--parts=Root,List,Trigger,Content',
    ]);

    expect(result.parts).toEqual(['Root', 'List', 'Trigger', 'Content']);
  });

  it('rejects invalid component parts', () => {
    expect(() =>
      parseComponentGeneratorArgs([
        'Tabs',
        'both',
        'components',
        'navigation',
        '--parts=Root,tab-trigger',
      ])
    ).toThrow(
      'Component parts must be PascalCase and contain only letters and numbers.'
    );
  });

  it('rejects duplicate component parts', () => {
    expect(() =>
      parseComponentGeneratorArgs([
        'Tabs',
        'both',
        'components',
        'navigation',
        '--parts=Root,Trigger,Trigger',
      ])
    ).toThrow('Component parts must not contain duplicates.');
  });
});

describe('component generator check mode', () => {
  it('parses --check as a read-only generator mode', () => {
    const result = parseComponentGeneratorArgs([
      'Avatar',
      'both',
      'primitives',
      'data-display',
      '--check',
    ]);

    expect(result.check).toBe(true);
    expect(result.dryRun).toBe(false);
  });

  it('rejects combining --check with --dry-run', () => {
    expect(() =>
      parseComponentGeneratorArgs([
        'Avatar',
        'both',
        'primitives',
        'data-display',
        '--check',
        '--dry-run',
      ])
    ).toThrow('--dry-run and --check cannot be used together.');
  });
});

describe('component token CLI intent', () => {
  it('parses explicit disclosure component-token intent', () => {
    expect(
      parseComponentGeneratorArgs([
        'Accordion',
        'both',
        'components',
        'navigation',
        '--profile=compound',
        '--component-tokens=disclosure',
      ])
    ).toMatchObject({
      componentTokens: 'disclosure',
    });
  });

  it('parses explicit tokenless component intent', () => {
    expect(
      parseComponentGeneratorArgs([
        'LayoutProbe',
        'both',
        'components',
        'layout',
        '--component-tokens=none',
      ])
    ).toMatchObject({
      componentTokens: false,
    });
  });

  it('rejects an unknown component-token contract', () => {
    expect(() =>
      parseComponentGeneratorArgs([
        'Accordion',
        'both',
        'components',
        'navigation',
        '--component-tokens=magic',
      ])
    ).toThrow('Invalid component token contract "magic"');
  });
});
