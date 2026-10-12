import { describe, expect, it } from 'vitest';

import { renderUsage } from './usage';

import type { ComponentPageMetadata } from '../metadata/metadata';
import type { ExtractedProp } from '../model/types';

const orientation: ExtractedProp = {
  name: 'orientation',
  kind: 'select',
  options: ['horizontal', 'vertical'],
  required: false,
  type: "'horizontal' | 'vertical'",
  description: '',
};

const activationMode: ExtractedProp = {
  name: 'activationMode',
  kind: 'select',
  options: ['automatic', 'manual'],
  required: false,
  type: "'automatic' | 'manual'",
  description: '',
};

const dir: ExtractedProp = {
  name: 'dir',
  kind: 'select',
  options: ['ltr', 'rtl'],
  required: false,
  type: "'ltr' | 'rtl'",
  description: '',
};

const loop: ExtractedProp = {
  name: 'loop',
  kind: 'boolean',
  required: false,
  type: 'boolean',
  description: '',
};

const label: ExtractedProp = {
  name: 'label',
  kind: 'string',
  required: false,
  type: 'string',
  description: '',
};

const description: ExtractedProp = {
  name: 'description',
  kind: 'string',
  required: false,
  type: 'string',
  description: '',
};

const playgroundProps = [
  orientation,
  activationMode,
  dir,
  loop,
] satisfies ExtractedProp[];

const componentConfig = {
  demo: {
    initialValues: {
      orientation: 'horizontal',
      activationMode: 'automatic',
      dir: 'ltr',
      loop: true,
    },
  },
  defaults: {
    shared: { orientation: 'horizontal' },
    react: { activationMode: 'automatic', dir: 'ltr' },
  },
} satisfies ComponentPageMetadata;

describe('renderUsage', () => {
  it('guards platform-specific playground props', () => {
    const result = renderUsage({
      componentName: 'Tabs',
      componentConfig,
      playgroundProps,
      reactApiProps: playgroundProps,
      nativeApiProps: [orientation],
      generatedFileHeader: '',
      getDemoProps: () => '',
    });

    expect(result.content).toContain(
      "if (platform === 'react' && value.activationMode !== 'automatic')"
    );

    expect(result.content).toContain(
      "if (platform === 'react' && value.dir !== 'ltr')"
    );

    expect(result.content).toContain("if (platform === 'react' && value.loop)");

    expect(result.content).toContain("if (value.orientation !== 'horizontal')");
  });

  it('does not emit an unused playground value when there are no controls', () => {
    const result = renderUsage({
      componentName: 'Switch',
      componentConfig: {},
      playgroundProps: [],
      reactApiProps: [],
      nativeApiProps: [],
      generatedFileHeader: '',
      getDemoProps: () => '',
    });

    expect(result.content).toMatch(
      /function createSwitchCode\(\s*platform: ComponentPlatform\s*\)/
    );
    expect(result.content).toContain(
      'const code = createSwitchCode(platform);'
    );
    expect(result.content).not.toContain('const [value] =');
  });

  it('emits demo shortcut props only on platforms whose root API supports them', () => {
    const result = renderUsage({
      componentName: 'Accordion',
      componentConfig: {
        demo: {
          label: 'Account settings',
          description: 'Expand a section to review its settings.',
        },
      },
      playgroundProps: [],
      reactApiProps: [label],
      nativeApiProps: [description],
      generatedFileHeader: '',
      getDemoProps: () => '',
    });

    expect(result.content).toContain(
      "platform === 'react'\n      ? [\n        `label='Account settings'`,\n        ]\n      : [\n        `description='Expand a section to review its settings.'`,\n        ];"
    );
  });

  it('does not emit unsupported or duplicate demo shortcut props', () => {
    const unsupported = renderUsage({
      componentName: 'Accordion',
      componentConfig: {
        demo: {
          label: 'Account settings',
          description: 'Expand a section to review its settings.',
        },
      },
      playgroundProps: [],
      reactApiProps: [],
      nativeApiProps: [],
      generatedFileHeader: '',
      getDemoProps: () => '',
    });

    expect(unsupported.content).not.toContain("label='Account settings'");
    expect(unsupported.content).not.toContain(
      "description='Expand a section to review its settings.'"
    );

    const deduplicated = renderUsage({
      componentName: 'Input',
      componentConfig: {
        demo: {
          label: 'Email',
          description: 'Work email',
        },
      },
      playgroundProps: [],
      reactApiProps: [label, description],
      nativeApiProps: [label, description],
      generatedFileHeader: '',
      getDemoProps: () => "label='Email'\ndescription='Work email'",
    });

    expect(deduplicated.content.match(/label='Email'/g)).toHaveLength(2);
    expect(
      deduplicated.content.match(/description='Work email'/g)
    ).toHaveLength(2);
  });

  it('wraps native usage with platform setup in a function scope', () => {
    const result = renderUsage({
      componentName: 'Example',
      componentConfig: {
        native: {
          imports: [
            "import { Text as NativeText } from 'react-native';",
            "import { useTheme } from '@vellira-ui/react-native';",
          ],
          setup: ['const { theme: nativeTheme } = useTheme();'],
          children:
            '<Example.Content><NativeText style={{ color: nativeTheme.color.content }}>Content</NativeText></Example.Content>',
        },
      },
      playgroundProps: [],
      reactApiProps: [],
      nativeApiProps: [],
      generatedFileHeader: '',
      getDemoProps: () => '',
    });

    expect(result.content).toContain('function Example() {');
    expect(result.content).toContain(
      '${setup}\n\n  return (\n${indentedRoot}\n  );'
    );
    expect(result.content).toContain(
      'const { theme: nativeTheme } = useTheme();'
    );
    expect(result.content).toContain(
      '<Example.Content><NativeText style={{ color: nativeTheme.color.content }}>Content</NativeText></Example.Content>'
    );
    expect(result.content.indexOf('${setup}')).toBeLessThan(
      result.content.indexOf('return (')
    );
  });

  it('keeps no-setup usage on the simple snippet path', () => {
    const result = renderUsage({
      componentName: 'Example',
      componentConfig: {
        native: {
          children: '<Example.Content>Content</Example.Content>',
        },
      },
      playgroundProps: [],
      reactApiProps: [],
      nativeApiProps: [],
      generatedFileHeader: '',
      getDemoProps: () => '',
    });

    expect(result.content).not.toContain('const setup =');
    expect(result.content).not.toContain('if (setup) {');
    expect(result.content).not.toContain('function Example() {');
    expect(result.content).toContain(
      "return `import { Example } from '${packageName}';"
    );
  });

  it('uses the omission default, not the initial playground selection', () => {
    const size: ExtractedProp = {
      name: 'size',
      kind: 'select',
      type: "'sm' | 'md' | 'lg'",
      options: ['sm', 'md', 'lg'],
      required: false,
      description: '',
    };
    const result = renderUsage({
      componentName: 'IdentityBadge',
      componentConfig: {
        demo: { initialValues: { size: 'sm' } },
        defaults: { shared: { size: 'md' } },
      },
      playgroundProps: [size],
      reactApiProps: [size],
      nativeApiProps: [size],
      generatedFileHeader: '',
      getDemoProps: () => '',
    });
    expect(result.content).toContain("if (value.size !== 'md')");
    expect(result.content).not.toContain("value.size !== 'sm'");
    expect(result.content).toContain('JSON.stringify(value.size)');
  });

  it('always represents required strings and disables copying invalid empty controls', () => {
    const name: ExtractedProp = {
      name: 'name',
      kind: 'string',
      type: 'string',
      required: true,
      description: '',
    };
    const result = renderUsage({
      componentName: 'IdentityBadge',
      componentConfig: { defaults: { shared: { name: 'Sample user' } } },
      playgroundProps: [name],
      reactApiProps: [name],
      nativeApiProps: [name],
      generatedFileHeader: '',
      getDemoProps: () => '',
    });
    expect(result.content).toContain('JSON.stringify(value.name)');
    expect(result.content).toContain('!value.name.trim()');
    expect(result.content).toContain('copyEnabled={!hasMissingRequiredValue}');
    expect(result.content).toContain("role='alert'");
    expect(result.content).not.toContain('if (value.name)');
  });

  it('uses distinct platform omission defaults without losing selected values', () => {
    const placement: ExtractedProp = {
      name: 'placement',
      kind: 'select',
      type: "'top' | 'bottom'",
      options: ['top', 'bottom'],
      required: false,
      description: '',
    };
    const result = renderUsage({
      componentName: 'IdentityBadge',
      componentConfig: {
        demo: { initialValues: { placement: 'bottom' } },
        defaults: {
          react: { placement: 'bottom' },
          native: { placement: 'top' },
        },
      },
      playgroundProps: [placement],
      reactApiProps: [placement],
      nativeApiProps: [placement],
      generatedFileHeader: '',
      getDemoProps: () => '',
    });
    expect(result.content).toContain("platform === 'react' ? value.placement !== 'bottom' : value.placement !== 'top'");
  });

  it('does not treat an unknown default as the current demo value', () => {
    const amount: ExtractedProp = {
      name: 'amount',
      kind: 'number',
      type: 'number',
      required: false,
      description: '',
    };
    const result = renderUsage({
      componentName: 'IdentityBadge',
      componentConfig: { demo: { initialValues: { amount: 0 } } },
      playgroundProps: [amount],
      reactApiProps: [amount],
      nativeApiProps: [amount],
      generatedFileHeader: '',
      getDemoProps: () => '',
    });
    expect(result.content).toContain('props.push(`amount={${JSON.stringify(value.amount)}}`);');
    expect(result.content).not.toContain('value.amount !== 0');
  });
});
