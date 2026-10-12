import { runInNewContext } from 'node:vm';

import ts from 'typescript';
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

  it('does not duplicate a controlled label or description in copyable JSX', () => {
    const result = renderUsage({
      componentName: 'IdentityBadge',
      componentConfig: {
        demo: {
          label: 'Profile',
          description: 'Owner',
          initialValues: { label: 'Profile', description: 'Owner' },
        },
      },
      playgroundProps: [label, description],
      reactApiProps: [label, description],
      nativeApiProps: [label, description],
      generatedFileHeader: '',
      getDemoProps: () => '',
    });

    expect(result.content).not.toContain("label='Profile'");
    expect(result.content).not.toContain("description='Owner'");
    expect(result.content).toContain('JSON.stringify(value.label)');
    expect(result.content).toContain('JSON.stringify(value.description)');
  });

  it('escapes apostrophes and entities in static demo shortcuts', () => {
    const generated = renderUsage({
      componentName: 'IdentityBadge',
      componentConfig: {
        demo: { label: "O'Connor", description: 'One & two' },
      },
      playgroundProps: [],
      reactApiProps: [label, description],
      nativeApiProps: [label, description],
      generatedFileHeader: '',
      getDemoProps: () => '',
    });
    expect(generated.content).toContain('label={"O\'Connor"}');
    expect(generated.content).toContain('description={"One & two"}');
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
    expect(result.content).toContain(
      "platform === 'react' ? value.placement !== 'bottom' : value.placement !== 'top'"
    );
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
    expect(result.content).toContain(
      'props.push(`amount={${JSON.stringify(value.amount)}}`);'
    );
    expect(result.content).not.toContain('value.amount !== 0');
  });

  it('omits a cleared optional string, matching the playground undefined binding', () => {
    const placeholder: ExtractedProp = {
      name: 'placeholder',
      kind: 'string',
      required: false,
      type: 'string',
      description: '',
    };
    const result = renderUsage({
      componentName: 'IdentityBadge',
      componentConfig: {
        demo: { initialValues: { placeholder: 'Sample' } },
        defaults: { shared: { placeholder: 'Runtime placeholder' } },
      },
      playgroundProps: [placeholder],
      reactApiProps: [placeholder],
      nativeApiProps: [placeholder],
      generatedFileHeader: '',
      getDemoProps: () => '',
    });
    expect(result.content).toContain('if (value.placeholder)');
    expect(result.content).not.toContain(
      "value.placeholder !== 'Runtime placeholder'"
    );
  });

  it('preserves required select values even when equal to metadata defaults', () => {
    const mode: ExtractedProp = {
      name: 'mode',
      kind: 'select',
      options: ['enabled', 'disabled'],
      required: true,
      type: "'enabled' | 'disabled'",
      description: '',
    };
    const result = renderUsage({
      componentName: 'IdentityBadge',
      componentConfig: {
        demo: { initialValues: { mode: 'enabled' } },
        defaults: { shared: { mode: 'enabled' } },
      },
      playgroundProps: [mode],
      reactApiProps: [mode],
      nativeApiProps: [mode],
      generatedFileHeader: '',
      getDemoProps: () => '',
    });
    expect(result.content).toContain('JSON.stringify(value.mode)');
    expect(result.content).not.toContain("value.mode !== 'enabled'");
  });

  it('honors required select on one platform and optional on the other', () => {
    const mode: ExtractedProp = {
      name: 'mode',
      kind: 'select',
      options: ['enabled', 'disabled'],
      required: true,
      type: "'enabled' | 'disabled'",
      description: '',
    };
    const result = renderUsage({
      componentName: 'IdentityBadge',
      componentConfig: {
        defaults: { react: { mode: 'enabled' }, native: { mode: 'disabled' } },
      },
      playgroundProps: [mode],
      reactApiProps: [mode],
      nativeApiProps: [{ ...mode, required: false }],
      generatedFileHeader: '',
      getDemoProps: () => '',
    });
    expect(result.content).toContain("platform === 'react' ||");
  });

  it('executes generated snippets and checks hostile strings as real JSX', () => {
    const name: ExtractedProp = {
      name: 'name',
      kind: 'string',
      required: true,
      type: 'string',
      description: '',
    };
    const fallback: ExtractedProp = {
      name: 'fallback',
      kind: 'string',
      required: true,
      type: 'string',
      description: '',
    };
    const size: ExtractedProp = {
      name: 'size',
      kind: 'select',
      required: false,
      type: "'sm' | 'md' | 'lg'",
      options: ['sm', 'md', 'lg'],
      description: '',
    };
    const content = renderUsage({
      componentName: 'IdentityBadge',
      componentConfig: {
        demo: { initialValues: { size: 'sm' } },
        defaults: { shared: { size: 'md' } },
      },
      playgroundProps: [name, fallback, size],
      reactApiProps: [name, fallback, size],
      nativeApiProps: [name, fallback, size],
      generatedFileHeader: '',
      getDemoProps: () => '',
    }).content;
    const start = content.indexOf('function createIdentityBadgeCode(');
    const end = content.indexOf('export function IdentityBadgeUsage', start);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);

    const executable = ts.transpileModule(content.slice(start, end), {
      compilerOptions: {
        module: ts.ModuleKind.None,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText;

    const unsafeName =
      'O\'Connor\nLine two \u0060tag\u0060 \x24{attack} {braces} "quote"';
    const rendered = runInNewContext(
      executable + '\ncreateIdentityBadgeCode(platform, value)',
      {
        platform: 'react-native',
        value: { name: unsafeName, fallback: 'JD', size: 'sm' },
      }
    ) as string;

    expect(rendered).toContain('name={' + JSON.stringify(unsafeName) + '}');
    expect(rendered).toContain('fallback={"JD"}');
    expect(rendered).toContain('size={"sm"}');

    const parsed = ts.transpileModule(rendered, {
      fileName: 'usage-example.tsx',
      reportDiagnostics: true,
      compilerOptions: {
        jsx: ts.JsxEmit.Preserve,
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
      },
    });
    expect(
      parsed.diagnostics?.filter(
        (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error
      )
    ).toHaveLength(0);
  });
});
