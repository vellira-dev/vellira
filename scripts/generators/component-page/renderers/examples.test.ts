import { describe, expect, it } from 'vitest';

import type { ExtractedProp, GeneratedExample, Platform } from '../model/types';
import { buildExamples, renderExamples } from './examples';

type PropKind = ExtractedProp['kind'];
type RenderConfig = Parameters<typeof renderExamples>[0]['componentConfig'];

type RenderParams = {
  componentName?: string;
  platforms?: readonly Platform[];
  generatedExamples?: readonly GeneratedExample[];
  reactApiProps?: readonly ExtractedProp[];
  nativeApiProps?: readonly ExtractedProp[];
  componentConfig?: RenderConfig;
};

function prop(name: string, kind: PropKind, type: string): ExtractedProp {
  if (kind === 'select') {
    return {
      name,
      kind,
      required: false,
      type,
      description: '',
      options: ['one', 'two'],
    };
  }

  return {
    name,
    kind,
    required: false,
    type,
    description: '',
  };
}

function render(params: RenderParams) {
  const generatedExamples: readonly GeneratedExample[] =
    params.generatedExamples ?? [
      {
        title: 'Basic',
        description: 'Basic example.',
        props: [],
      },
    ];

  return renderExamples({
    componentName: params.componentName ?? 'Accordion',
    platforms: params.platforms ?? ['react', 'react-native'],
    componentConfig: params.componentConfig ?? {},
    generatedExamples,
    generatedFileHeader: '',
    reactApiProps: params.reactApiProps ?? [],
    nativeApiProps: params.nativeApiProps ?? [],
    getDemoProps: () => '',
  });
}

describe('buildExamples', () => {
  it('does not duplicate the generic compound composition', () => {
    const examples = buildExamples({
      componentName: 'Accordion',
      componentConfig: {
        profile: 'compound',
        react: {
          children: `<Accordion.Item>
  <Accordion.Trigger>Section</Accordion.Trigger>
  <Accordion.Content>Section content</Accordion.Content>
</Accordion.Item>`,
        },
        native: {
          children: `<Accordion.Item>
  <Accordion.Trigger>Section</Accordion.Trigger>
  <Accordion.Content>Section content</Accordion.Content>
</Accordion.Item>`,
        },
      },
      componentProfile: 'compound',
      extractedProps: [
        {
          name: 'children',
          kind: 'other',
          required: false,
          type: 'ReactNode',
          description: '',
          sourceFilePath: '/tmp/Accordion/types.ts',
        },
      ],
      playgroundProps: [],
    });

    expect(examples.map((example) => example.title)).toEqual(['Basic']);
  });

  it('only generates bare shorthand for boolean props', () => {
    const examples = buildExamples({
      componentName: 'Accordion',
      componentConfig: {},
      componentProfile: 'compound',
      extractedProps: [prop('disabled', 'string', 'string')],
      playgroundProps: [],
    });

    expect(examples.map((example) => example.title)).toEqual(['Basic']);
  });
});

describe('renderExamples', () => {
  it.each(['react', 'react-native'] as const)(
    'renders overlay examples only for the supported %s platform',
    (platform) => {
      const otherPlatform = platform === 'react' ? 'react-native' : 'react';
      const apiProps = [
        prop('open', 'boolean', 'boolean'),
        prop('defaultOpen', 'boolean', 'boolean'),
      ];
      const content = render({
        componentName: 'Overlay',
        platforms: [platform],
        reactApiProps: platform === 'react' ? apiProps : [],
        nativeApiProps: platform === 'react-native' ? apiProps : [],
        componentConfig: {
          react: { imports: ["import { WebHelper } from 'web-helper';"] },
          native: {
            imports: ["import { NativeHelper } from 'native-helper';"],
          },
        },
        generatedExamples: [
          { title: 'Controlled', description: 'Controlled.', props: ['open'] },
          {
            title: 'Uncontrolled',
            description: 'Uncontrolled.',
            props: ['defaultOpen'],
          },
          {
            title: 'Unavailable',
            description: 'Other platform only.',
            props: ['missing'],
            platforms: [otherPlatform],
            imports: ["import { Unavailable } from 'unavailable';"],
          },
        ],
      });

      expect(content).toContain(`from '@vellira-ui/${platform}';`);
      expect(content).not.toContain(`from '@vellira-ui/${otherPlatform}';`);
      expect(content).toContain("title: 'Controlled'");
      expect(content).toContain("title: 'Uncontrolled'");
      expect(content).toContain('\n          open');
      expect(content).toContain('\n          defaultOpen');
      expect(content).not.toContain('Unavailable');
      expect(content).toContain(
        platform === 'react' ? 'WebHelper' : 'NativeHelper'
      );
      expect(content).not.toContain(
        platform === 'react' ? 'NativeHelper' : 'WebHelper'
      );
      expect(content).not.toContain(
        platform === 'react' ? '<NativeOverlay' : '<ReactOverlay'
      );
    }
  );

  it.each(['react', 'react-native'] as const)(
    'rejects an invalid shared fragment against the %s contract even when the other platform accepts it',
    (platform) => {
      expect(() =>
        render({
          generatedExamples: [
            {
              title: 'Controlled',
              description: 'Controlled.',
              props: ['open'],
            },
          ],
          reactApiProps:
            platform === 'react' ? [] : [prop('open', 'boolean', 'boolean')],
          nativeApiProps:
            platform === 'react-native'
              ? []
              : [prop('open', 'boolean', 'boolean')],
        })
      ).toThrow(
        `Example "Controlled" ${platform} prop fragment "open" does not match the component API`
      );
    }
  );

  it('validates intentional platform-specific fragments against their own APIs', () => {
    const content = render({
      generatedExamples: [
        {
          title: 'Platform states',
          description: 'Platform-specific states.',
          props: [],
          reactProps: ['open'],
          nativeProps: ['visible'],
        },
      ],
      reactApiProps: [prop('open', 'boolean', 'boolean')],
      nativeApiProps: [prop('visible', 'boolean', 'boolean')],
    });

    expect(content).toContain('<ReactAccordion\n          open');
    expect(content).toContain('<NativeAccordion\n          visible');
  });

  it('filters unavailable demo shortcuts', () => {
    const content = render({
      componentConfig: {
        demo: {
          label: 'Label',
          description: 'Help',
        },
      },
    });

    expect(content).not.toContain("label='Label'");
    expect(content).not.toContain("description='Help'");
  });

  it('keeps shortcuts exposed by the platform API', () => {
    const content = render({
      componentConfig: {
        demo: {
          label: 'Email',
        },
      },
      reactApiProps: [prop('label', 'string', 'string')],
    });

    expect(content).toContain("<ReactAccordion\n          label='Email'");
    expect(content).not.toContain("<NativeAccordion\n          label='Email'");
  });

  it('rejects bare non-boolean props', () => {
    const renderInvalid = () =>
      render({
        generatedExamples: [
          {
            title: 'Uncontrolled',
            description: 'Example.',
            props: ['defaultValue'],
            platforms: ['react'],
          },
        ],
        reactApiProps: [
          prop('defaultValue', 'other', 'string | string[] | undefined'),
        ],
      });

    expect(renderInvalid).toThrow(/non-boolean prop/);
  });

  it('allows bare boolean props', () => {
    const content = render({
      generatedExamples: [
        {
          title: 'Collapsible',
          description: 'Example.',
          props: ['collapsible'],
          platforms: ['react'],
        },
      ],
      reactApiProps: [prop('collapsible', 'boolean', 'boolean')],
    });

    expect(content).toContain('collapsible');
  });

  it('rejects nested component roots in children', () => {
    const renderInvalid = () =>
      render({
        generatedExamples: [
          {
            title: 'Controlled',
            description: 'Example.',
            props: [],
            reactChildren: `<Accordion value='billing'>
  <Accordion.Item value='billing'>Billing</Accordion.Item>
</Accordion>`,
            platforms: ['react'],
          },
        ],
      });

    expect(renderInvalid).toThrow(/second <Accordion> root/);
  });

  it('renders executable setup in isolated platform preview components', () => {
    const content = render({
      generatedExamples: [
        {
          title: 'Controlled',
          description: 'Controlled example.',
          imports: ["import { useState } from 'react';"],
          setup: ["const [value, setValue] = useState('account');"],
          props: ['value={value}', 'onValueChange={setValue}'],
          reactChildren: `<Accordion.Item value='account'>Account</Accordion.Item>`,
          nativeChildren: `<Accordion.Item value='account'>Account</Accordion.Item>`,
        },
      ],
    });

    expect(content).toContain('function ReactAccordionExample1Preview()');
    expect(content).toContain('function NativeAccordionExample1Preview()');
    expect(content).toContain("const [value, setValue] = useState('account');");
    expect(content).toContain('preview: <ReactAccordionExample1Preview />');
    expect(content).toContain('preview: <NativeAccordionExample1Preview />');
    expect(content).toContain('function Example()');
    expect(
      content.indexOf('function ReactAccordionExample1Preview()')
    ).toBeLessThan(content.indexOf('export function AccordionExamples'));
  });

  it('keeps platform-specific setup isolated', () => {
    const content = render({
      generatedExamples: [
        {
          title: 'Platform setup',
          description: 'Platform-specific example.',
          props: [],
          reactSetup: ["const platformValue = 'react';"],
          nativeSetup: ["const platformValue = 'react-native';"],
        },
      ],
    });

    expect(content).toContain("const platformValue = 'react';");
    expect(content).toContain("const platformValue = 'react-native';");
    expect(content).toContain('preview: <ReactAccordionExample1Preview />');
    expect(content).toContain('preview: <NativeAccordionExample1Preview />');
  });

  it('preserves inline previews for stateless examples', () => {
    const content = render({});

    expect(content).not.toContain('AccordionExample1Preview');
    expect(content).toContain('preview: (');
  });

  it('includes native platform setup before shared and native example setup in previews and displayed code', () => {
    const content = render({
      componentName: 'Example',
      componentConfig: {
        native: {
          imports: ["import { useTheme } from '@vellira-ui/react-native';"],
          setup: ['const { theme: nativeTheme } = useTheme();'],
          children:
            '<Example.Content tone={nativeTheme}>Content</Example.Content>',
        },
      },
      generatedExamples: [
        {
          title: 'Layered setup',
          description: 'Example.',
          props: [],
          setup: ['const sharedValue = nativeTheme.color.content;'],
          nativeSetup: ['const nativeValue = sharedValue;'],
          nativeProps: ['value={nativeValue}'],
          platforms: ['react-native'],
        },
      ],
      nativeApiProps: [prop('value', 'string', 'string')],
    });

    const platformSetup = 'const { theme: nativeTheme } = useTheme();';
    const sharedSetup = 'const sharedValue = nativeTheme.color.content;';
    const nativeSetup = 'const nativeValue = sharedValue;';
    const previewStart = content.indexOf(
      'function NativeExampleExample1Preview()'
    );
    const displayStart = content.indexOf('code: `');

    expect(content).toContain(platformSetup);
    expect(content).toContain(sharedSetup);
    expect(content).toContain(nativeSetup);
    expect(content).toContain('<NativeExample.Content tone={nativeTheme}>');
    expect(content).toContain('<Example.Content tone={nativeTheme}>');
    expect(previewStart).toBeGreaterThanOrEqual(0);
    expect(displayStart).toBeGreaterThanOrEqual(0);
    expect(content.indexOf(platformSetup, previewStart)).toBeLessThan(
      content.indexOf(sharedSetup, previewStart)
    );
    expect(content.indexOf(sharedSetup, previewStart)).toBeLessThan(
      content.indexOf(nativeSetup, previewStart)
    );
    expect(content.indexOf(platformSetup, displayStart)).toBeLessThan(
      content.indexOf(sharedSetup, displayStart)
    );
    expect(content.indexOf(sharedSetup, displayStart)).toBeLessThan(
      content.indexOf(nativeSetup, displayStart)
    );
    expect(content.split(platformSetup)).toHaveLength(3);
  });
});
