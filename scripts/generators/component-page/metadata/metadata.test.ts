import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  loadGeneratedComponentProfile,
  mergeComponentMetadata,
  validateComponentMetadataAgainstApi,
  validateComponentMetadata,
  validateRelatedComponentSlugs,
} from './metadata';
import {
  canonicalComponentSlugs,
  canonicalComponentSlugsFromEntries,
} from '../../../../apps/website/src/component-catalog/registry/componentIdentity';
import { deriveComponentCatalogEntries } from '../../../../apps/website/src/component-catalog/registry/deriveComponentCatalogEntries';
import type { ComponentCatalogPresentationEntry } from '../../../../apps/website/src/component-catalog/types';
import { NATIVE_TEXT_IMPORT } from '../../native-text-host';
import type { ExtractedProp } from '../model/types';
import {
  buildSemanticMetadataContract,
  COMPONENT_REGISTRY_PATH,
  METADATA_SCHEMA_PATH,
} from '../semantic-metadata-contract';

const roots: string[] = [];

function createFixture(profile: string) {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), 'vellira-component-profile-')
  );

  roots.push(root);

  const metadataDir = path.join(
    root,
    'packages',
    'metadata',
    'src',
    'components'
  );

  fs.mkdirSync(metadataDir, { recursive: true });

  fs.writeFileSync(
    path.join(metadataDir, 'Accordion.metadata.ts'),
    `export const accordionMetadata = {
  name: 'Accordion',
  profile: '${profile}',
};
`
  );

  return root;
}

function prop(
  name: string,
  kind: ExtractedProp['kind'] = 'string'
): ExtractedProp {
  if (kind === 'select') {
    return {
      name,
      kind,
      required: false,
      type: "'sm' | 'md'",
      description: '',
      options: ['sm', 'md'],
    };
  }

  return {
    name,
    kind,
    required: false,
    type: kind === 'boolean' ? 'boolean' : 'string',
    description: '',
  };
}

afterEach(() => {
  for (const root of roots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe('loadGeneratedComponentProfile', () => {
  it('loads the canonical compound profile', () => {
    const root = createFixture('compound');

    expect(
      loadGeneratedComponentProfile({
        root,
        componentName: 'Accordion',
      })
    ).toBe('compound');
  });

  it('maps Generator V2 base profile to website primitive profile', () => {
    const root = createFixture('base');

    expect(
      loadGeneratedComponentProfile({
        root,
        componentName: 'Accordion',
      })
    ).toBe('primitive');
  });
});

describe('mergeComponentMetadata', () => {
  it('preserves and deduplicates generated native imports when authored metadata adds imports', () => {
    const merged = mergeComponentMetadata(
      {
        native: {
          children:
            '<Example.Content><NativeText>Content</NativeText></Example.Content>',
          imports: [NATIVE_TEXT_IMPORT],
        },
      },
      {
        native: {
          imports: [NATIVE_TEXT_IMPORT, "import { useState } from 'react';"],
        },
      }
    );

    expect(merged.native?.imports).toEqual([
      NATIVE_TEXT_IMPORT,
      "import { useState } from 'react';",
    ]);
    expect(merged.native?.children).toContain(
      '<NativeText>Content</NativeText>'
    );
  });

  it('preserves and deduplicates generated platform setup when authored metadata adds setup', () => {
    const merged = mergeComponentMetadata(
      {
        native: {
          setup: ['const base = true;'],
        },
      },
      {
        native: {
          setup: ['const base = true;', 'const next = true;'],
        },
      }
    );

    expect(merged.native?.setup).toEqual([
      'const base = true;',
      'const next = true;',
    ]);
  });
});

describe('validateComponentMetadata', () => {
  it('accepts canonical related component slugs, including kebab-case slugs', () => {
    expect(
      validateRelatedComponentSlugs({
        componentName: 'Accordion',
        related: ['tabs', 'dropdown', 'popover', 'radio-group'],
      })
    ).toEqual([]);
  });

  it('preserves the current valid Accordion related metadata contract', () => {
    expect(() =>
      validateComponentMetadata({
        componentName: 'Accordion',
        metadata: {
          related: ['tabs', 'dropdown', 'popover'],
        },
      })
    ).not.toThrow();
  });

  it('rejects non-canonical case and PascalCase related component values', () => {
    expect(() =>
      validateComponentMetadata({
        componentName: 'Accordion',
        metadata: {
          related: ['Tabs', 'Dropdown', 'RadioGroup'],
        },
      })
    ).toThrow(
      /Accordion related\[0\] "Tabs".*unknown or non-canonical.*exact canonical public component slug.*lowercase kebab-case/s
    );
  });

  it('rejects unknown related component slugs', () => {
    expect(() =>
      validateComponentMetadata({
        componentName: 'Accordion',
        metadata: {
          related: ['unknown-component'],
        },
      })
    ).toThrow(
      /Accordion related\[0\] "unknown-component".*unknown or non-canonical/
    );
  });

  it('rejects duplicate related component slugs deterministically', () => {
    expect(() =>
      validateComponentMetadata({
        componentName: 'Accordion',
        metadata: {
          related: ['tabs', 'tabs'],
        },
      })
    ).toThrow(
      /Accordion related\[1\] "tabs" is invalid: duplicate related component slug "tabs"/
    );
  });

  it('rejects related component self-reference deterministically', () => {
    expect(() =>
      validateComponentMetadata({
        componentName: 'RadioGroup',
        metadata: {
          related: ['radio-group'],
        },
      })
    ).toThrow(
      /RadioGroup related\[0\] "radio-group" is invalid: related components must not reference the source component "radio-group"/
    );
  });

  it.each([
    ["import { Accordion } from '@vellira/react';", 'react'],
    ["import Accordion from '@example/accordion';", 'react'],
    ["import * as Accordion from '@example/accordion';", 'react-native'],
    ["import { Other as Accordion } from '@example/other';", 'react-native'],
  ])(
    'rejects imports that locally bind the generated component',
    (source, platform) => {
      const metadata =
        platform === 'react'
          ? { react: { imports: [source] } }
          : { native: { imports: [source] } };

      expect(() =>
        validateComponentMetadata({
          componentName: 'Accordion',
          metadata,
        })
      ).toThrow(/must not bind generated component "Accordion"/);
    }
  );

  it('allows additional imports that do not bind the generated component', () => {
    expect(() =>
      validateComponentMetadata({
        componentName: 'Accordion',
        metadata: {
          react: {
            imports: [
              "import { Plus } from '@vellira-ui/icons';",
              "import { Accordion as NestedAccordion } from '@vellira-ui/react';",
            ],
          },
          native: {
            imports: ["import { useState } from 'react';"],
          },
        },
      })
    ).not.toThrow();
  });

  it('rejects invalid import declarations in every metadata import channel', () => {
    expect(() =>
      validateComponentMetadata({
        componentName: 'Example',
        metadata: {
          react: {
            imports: ['const Icon = null;'],
          },
          examples: [
            {
              title: 'Basic',
              description: 'Example.',
              props: [],
              imports: ['import { Icon from "@example/icons";'],
              reactImports: [''],
            },
          ],
        },
      })
    ).toThrow(/must contain only import declarations|must not be empty/);
  });

  it('accepts ordinary demo static root props', () => {
    expect(() =>
      validateComponentMetadata({
        componentName: 'Accordion',
        metadata: {
          demo: {
            staticProps: {
              type: "'single'",
              collapsible: 'true',
            },
          },
          react: {
            children: '<Accordion.Item />',
          },
          native: {
            children: '<Accordion.Item />',
          },
        },
      })
    ).not.toThrow();
  });

  it('rejects malformed demo expressions', () => {
    expect(() =>
      validateComponentMetadata({
        componentName: 'Example',
        metadata: {
          react: {
            demoProps: "value='platform'",
          },
          demo: {
            staticProps: {
              icon: '<Icon',
            },
          },
        },
      })
    ).toThrow(/invalid TypeScript\/JSX expression syntax/);
  });

  it('rejects multiple sibling JSX roots where one expression is required', () => {
    expect(() =>
      validateComponentMetadata({
        componentName: 'Example',
        metadata: {
          demo: {
            staticProps: {
              icon: '<Icon /><Icon />',
            },
          },
        },
      })
    ).toThrow(/invalid TypeScript\/JSX expression syntax/);
  });

  it('rejects demo children in staticProps', () => {
    expect(() =>
      validateComponentMetadata({
        componentName: 'Accordion',
        metadata: {
          demo: {
            staticProps: {
              children: '<Accordion.Item />',
            },
          },
        },
      })
    ).toThrow(/use react\.children\/native\.children for inner JSX/);
  });

  it('rejects malformed and duplicate JSX prop fragments', () => {
    expect(() =>
      validateComponentMetadata({
        componentName: 'Example',
        metadata: {
          react: {
            demoProps: "size='md'\nsize='lg'",
          },
          examples: [
            {
              title: 'Basic',
              description: 'Example.',
              props: ['disabled', 'disabled'],
              reactProps: ['value={'],
            },
          ],
        },
      })
    ).toThrow(/duplicate prop|invalid JSX prop syntax/);
  });

  it('rejects whitespace prop fragments and JSX spread props', () => {
    expect(() =>
      validateComponentMetadata({
        componentName: 'Example',
        metadata: {
          examples: [
            {
              title: 'Spread',
              description: 'Example.',
              props: ['   ', '{...props}'],
            },
          ],
        },
      })
    ).toThrow(/must not be empty|must not use JSX spread attributes/);
  });

  it('rejects malformed JSX children and duplicate component roots', () => {
    expect(() =>
      validateComponentMetadata({
        componentName: 'Example',
        metadata: {
          react: {
            children: '<Example value="nested" />',
          },
          examples: [
            {
              title: 'Basic',
              description: 'Example.',
              props: [],
              nativeChildren: '<Example.Item',
            },
          ],
        },
      })
    ).toThrow(/second <Example> root|invalid JSX child syntax/);
  });

  it('rejects platform-only example fields for excluded platforms', () => {
    expect(() =>
      validateComponentMetadata({
        componentName: 'Example',
        metadata: {
          examples: [
            {
              title: 'React only',
              description: 'Example.',
              props: [],
              platforms: ['react'],
              nativeSetup: ["const nativeValue = 'ignored';"],
              nativeChildren: '<Example.Item />',
            },
          ],
        },
      })
    ).toThrow(/does not target react-native/);
  });

  it('accepts valid shared and platform-specific example setup', () => {
    expect(() =>
      validateComponentMetadata({
        componentName: 'Accordion',
        metadata: {
          examples: [
            {
              title: 'Controlled',
              description: 'Controlled example.',
              props: ['value={value}'],
              setup: ["const [value, setValue] = useState('account');"],
              reactSetup: ['void setValue;'],
              nativeSetup: ['void setValue;'],
            },
          ],
        },
      })
    ).not.toThrow();
  });

  it('rejects invalid platform setup syntax with a precise platform field', () => {
    expect(() =>
      validateComponentMetadata({
        componentName: 'Example',
        metadata: {
          native: {
            setup: ["const { theme: nativeTheme } = useTheme('broken';"],
          },
        },
      })
    ).toThrow(/react-native\.setup has invalid TypeScript syntax/);
  });

  it('rejects empty platform setup entries', () => {
    expect(() =>
      validateComponentMetadata({
        componentName: 'Example',
        metadata: {
          react: {
            setup: ['const value = true;', '   '],
          },
        },
      })
    ).toThrow(/react\.setup\[1\] must not be empty/);
  });

  it('accepts compound children and escaped primitive metadata values', () => {
    expect(() =>
      validateComponentMetadata({
        componentName: 'Example',
        metadata: {
          react: {
            children: `<Example.Item value={"can't"}>
  <Example.Trigger>{\`Account \${1}\`}</Example.Trigger>
  <Example.Content>Line one
Line two</Example.Content>
</Example.Item>`,
          },
          demo: {
            label: "Can't break `templates`",
            description: 'Line one\nLine two',
            staticProps: {
              placeholder: "`Choose ${'value'}`",
            },
          },
          examples: [
            {
              title: 'Form control',
              description: 'Primitive form metadata.',
              props: ["label={'Email'}", 'required'],
            },
          ],
        },
      })
    ).not.toThrow();
  });

  it('rejects invalid example setup syntax', () => {
    expect(() =>
      validateComponentMetadata({
        componentName: 'Accordion',
        metadata: {
          examples: [
            {
              title: 'Controlled',
              description: 'Controlled example.',
              props: [],
              setup: ["const [value, setValue] = useState('account';"],
            },
          ],
        },
      })
    ).toThrow(/setup has invalid TypeScript syntax/);
  });

  it('rejects invalid child prop binding syntax', () => {
    expect(() =>
      validateComponentMetadata({
        componentName: 'Example',
        metadata: {
          react: {
            children: '<ReactButton>Open</ReactButton>',
            childPropBindings: [
              {
                target: 'ReactButton',
                props: ['size={value.size}', 'size={value.otherSize}'],
              },
              {
                target: 'button-item',
                props: ['disabled'],
              },
            ],
          },
        },
      })
    ).toThrow(/duplicate prop "size"|target must be a JSX component name/);
  });
});

describe('semantic metadata contract', () => {
  it('exports the exact sorted canonical registry vocabulary and source digest', () => {
    const contract = buildSemanticMetadataContract({
      root: process.cwd(),
      componentName: 'Avatar',
    });
    const registryBytes = fs.readFileSync(
      path.join(process.cwd(), COMPONENT_REGISTRY_PATH)
    );

    expect(contract.schemaPath).toBe(METADATA_SCHEMA_PATH);
    expect(contract.metadataSchemaPath).toBe(METADATA_SCHEMA_PATH);
    expect(contract.relatedComponentRegistry.path).toBe(
      COMPONENT_REGISTRY_PATH
    );
    expect(contract.relatedComponentRegistry.sha256).toBe(
      crypto.createHash('sha256').update(registryBytes).digest('hex')
    );
    expect(contract.relatedComponentRegistry.slugs).toEqual(
      [...canonicalComponentSlugs].sort()
    );
    expect(contract.relatedComponentRegistry.slugs).toContain('radio-group');
    expect(contract.relatedComponentRegistry.slugs).toContain('form-field');
    expect(contract.sourceComponent).toEqual({
      name: 'Avatar',
      slug: 'avatar',
      isCanonical: false,
    });
    expect(contract.constraints).toEqual({
      relatedMustUseCanonicalSlug: true,
      relatedMustNotReferenceSelf: true,
      relatedMustBeUnique: true,
      relatedMustUseExactCase: true,
      relatedSlugFormat: 'lowercase-kebab-case',
    });
  });

  it('keeps exported vocabulary and validator acceptance in parity', () => {
    const contract = buildSemanticMetadataContract({
      root: process.cwd(),
      componentName: 'FutureComponent',
    });

    for (const slug of contract.relatedComponentRegistry.slugs) {
      expect(
        validateRelatedComponentSlugs({
          componentName: 'FutureComponent',
          related: [slug],
        }),
        slug
      ).toEqual([]);
    }

    expect(
      validateRelatedComponentSlugs({
        componentName: 'FutureComponent',
        related: ['Badge', 'Image', 'RadioGroup', 'FormField'],
      })
    ).toHaveLength(4);
  });

  it('preserves exact source self-reference semantics', () => {
    const contract = buildSemanticMetadataContract({
      root: process.cwd(),
      componentName: 'RadioGroup',
    });

    expect(contract.sourceComponent).toMatchObject({
      name: 'RadioGroup',
      slug: 'radio-group',
      isCanonical: true,
    });
    expect(
      validateRelatedComponentSlugs({
        componentName: contract.sourceComponent.name,
        related: [contract.sourceComponent.slug],
      })
    ).toEqual([
      'RadioGroup related[0] "radio-group" is invalid: related components must not reference the source component "radio-group"',
    ]);
  });

  it('fails closed on duplicate or malformed canonical registry evidence', () => {
    expect(() => canonicalComponentSlugsFromEntries([])).toThrow(
      'Canonical component registry is empty'
    );

    expect(() =>
      canonicalComponentSlugsFromEntries([
        { slug: 'radio-group' },
        { slug: 'radio-group' },
      ])
    ).toThrow('Duplicate canonical component slug');

    expect(() =>
      canonicalComponentSlugsFromEntries([{ slug: 'RadioGroup' }])
    ).toThrow('Invalid canonical component slug');

    const entry: ComponentCatalogPresentationEntry = {
      component: 'Button',
      slug: 'button',
      name: 'Button',
      description: 'Button.',
      category: 'general',
      order: 1,
      docs: {},
    };

    expect(() =>
      deriveComponentCatalogEntries([entry, { ...entry }], [])
    ).toThrow('Duplicate canonical component slug');
    expect(() =>
      deriveComponentCatalogEntries([{ ...entry, slug: 'Button' }], [])
    ).toThrow('Invalid canonical component slug');

    expect(() =>
      buildSemanticMetadataContract({
        root: process.cwd(),
        componentName: 'FutureComponent',
        components: [{ slug: 'radio-group' }, { slug: 'radio-group' }],
      })
    ).toThrow('Duplicate canonical component slug');

    expect(() =>
      buildSemanticMetadataContract({
        root: process.cwd(),
        componentName: 'Not A Component',
      })
    ).toThrow('Invalid canonical component slug in source component');
  });

  it('does not derive related slugs from display names', () => {
    expect(
      validateRelatedComponentSlugs({
        componentName: 'FutureComponent',
        related: ['RadioGroup', 'FormField', 'badge', 'image'],
      })
    ).toEqual(
      expect.arrayContaining([
        expect.stringContaining('"RadioGroup"'),
        expect.stringContaining('"FormField"'),
        expect.stringContaining('"badge"'),
        expect.stringContaining('"image"'),
      ])
    );
  });
});

describe('validateComponentMetadataAgainstApi', () => {
  it('rejects unknown and non-boolean bare example props before rendering', () => {
    expect(() =>
      validateComponentMetadataAgainstApi({
        componentName: 'Example',
        metadata: {
          examples: [
            {
              title: 'Invalid',
              description: 'Example.',
              props: ['value', 'missing'],
            },
          ],
        },
        platforms: ['react'],
        reactApiProps: [prop('value')],
        nativeApiProps: [],
      })
    ).toThrow(/non-boolean prop "value"|not present in the react API/);
  });

  it('rejects shared props that are unavailable on one target platform', () => {
    expect(() =>
      validateComponentMetadataAgainstApi({
        componentName: 'Example',
        metadata: {
          examples: [
            {
              title: 'Invalid',
              description: 'Example.',
              props: ['webOnly={true}'],
            },
          ],
        },
        platforms: ['react', 'react-native'],
        reactApiProps: [prop('webOnly', 'boolean')],
        nativeApiProps: [prop('nativeOnly', 'boolean')],
      })
    ).toThrow(/webOnly.*react-native API/);
  });

  it('allows platform-specific props, setup, imports, and children on the matching platform', () => {
    expect(() =>
      validateComponentMetadataAgainstApi({
        componentName: 'Example',
        metadata: {
          examples: [
            {
              title: 'Controlled',
              description: 'Example.',
              props: [],
              imports: ["import { useState } from 'react';"],
              setup: ["const [value, setValue] = useState('one');"],
              reactProps: ['value={value}', 'onValueChange={setValue}'],
              reactChildren: '<Example.Item value="one">One</Example.Item>',
              nativeProps: ['selectedValue={value}'],
              nativeChildren:
                '<Example.Item value="one" label="One">One</Example.Item>',
            },
          ],
        },
        platforms: ['react', 'react-native'],
        reactApiProps: [prop('value'), prop('onValueChange', 'other')],
        nativeApiProps: [prop('selectedValue')],
      })
    ).not.toThrow();
  });

  it('allows multiple examples to reuse local setup identifier names', () => {
    expect(() =>
      validateComponentMetadataAgainstApi({
        componentName: 'Example',
        metadata: {
          examples: [
            {
              title: 'First controlled',
              description: 'Example.',
              props: [],
              setup: ["const [value, setValue] = useState('one');"],
              imports: ["import { useState } from 'react';"],
              reactProps: ['value={value}', 'onValueChange={setValue}'],
            },
            {
              title: 'Second controlled',
              description: 'Example.',
              props: [],
              setup: ["const [value, setValue] = useState('two');"],
              imports: ["import { useState } from 'react';"],
              reactProps: ['value={value}', 'onValueChange={setValue}'],
            },
          ],
        },
        platforms: ['react'],
        reactApiProps: [prop('value'), prop('onValueChange', 'other')],
        nativeApiProps: [],
      })
    ).not.toThrow();
  });

  it('rejects shared static props that are unavailable on a target platform', () => {
    expect(() =>
      validateComponentMetadataAgainstApi({
        componentName: 'Example',
        metadata: {
          demo: {
            staticProps: {
              webOnly: 'true',
            },
          },
        },
        platforms: ['react', 'react-native'],
        reactApiProps: [prop('webOnly', 'boolean')],
        nativeApiProps: [prop('nativeOnly', 'boolean')],
      })
    ).toThrow(/demo\.staticProps\.webOnly.*react-native API/);
  });

  it('rejects dead default, initial value, excluded control, and satisfied prop names', () => {
    expect(() =>
      validateComponentMetadataAgainstApi({
        componentName: 'Example',
        metadata: {
          demo: {
            initialValues: {
              misspelledInitial: true,
            },
            excludeControls: ['misspelledControl'],
            satisfiedRequiredProps: ['misspelledRequired'],
          },
          defaults: {
            shared: {
              misspelledSharedDefault: true,
            },
            react: {
              nativeOnly: true,
            },
            native: {
              reactOnly: true,
            },
          },
        },
        platforms: ['react', 'react-native'],
        reactApiProps: [prop('reactOnly', 'boolean')],
        nativeApiProps: [prop('nativeOnly', 'boolean')],
      })
    ).toThrow(
      /misspelledInitial|misspelledControl|misspelledRequired|misspelledSharedDefault|defaults\.react\.nativeOnly|defaults\.native\.reactOnly/
    );
  });

  it('allows shared control metadata for props present on only one supported platform', () => {
    expect(() =>
      validateComponentMetadataAgainstApi({
        componentName: 'Example',
        metadata: {
          demo: {
            initialValues: {
              reactOnly: true,
            },
            excludeControls: ['nativeOnly'],
            satisfiedRequiredProps: ['reactOnly'],
          },
          defaults: {
            shared: {
              nativeOnly: false,
            },
            react: {
              reactOnly: true,
            },
            native: {
              nativeOnly: false,
            },
          },
        },
        platforms: ['react', 'react-native'],
        reactApiProps: [prop('reactOnly', 'boolean')],
        nativeApiProps: [prop('nativeOnly', 'boolean')],
      })
    ).not.toThrow();
  });
});
