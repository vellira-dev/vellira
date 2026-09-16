import { describe, expect, it } from 'vitest';

import { renderStoryTemplate } from './component-story';

describe('component story templates', () => {
  it('derives compound representative stories from capabilities and parts', () => {
    const result = renderStoryTemplate({
      componentName: 'Disclosure',
      layer: 'components',
      isNative: false,
      profile: 'compound',
      control: 'value',
      capabilities: ['controlled', 'uncontrolled', 'disabled'],
      parts: ['Item', 'Trigger', 'Content'],
    });

    expect(result).toContain('export const Controlled');
    expect(result).toContain("value: 'item-1'");
    expect(result).toContain('onValueChange: () => undefined');
    expect(result).toContain('export const Uncontrolled');
    expect(result).toContain("defaultValue: 'item-1'");
    expect(result).toContain('export const Disabled');
    expect(result).toContain('disabled: true');
    expect(result).toContain('<Disclosure.Item');
    expect(result).toContain('<Disclosure.Trigger>');
    expect(result).toContain('<Disclosure.Content>');
  });

  it('keeps base component stories minimal', () => {
    const result = renderStoryTemplate({
      componentName: 'Avatar',
      layer: 'primitives',
      isNative: false,
      profile: 'base',
    });

    expect(result).toContain('export const Default');
    expect(result).not.toContain('export const Controlled');
    expect(result).not.toContain('export const Disabled');
  });

  it('wraps generator-owned native compound text with NativeText', () => {
    const params = {
      componentName: 'Disclosure',
      layer: 'components',
      isNative: true,
      profile: 'compound' as const,
      capabilities: ['controlled', 'uncontrolled', 'disabled'] as const,
      parts: ['Item', 'Trigger', 'Content'],
    };

    const result = renderStoryTemplate(params);

    expect(result).toContain(
      "import { Text as NativeText } from 'react-native';"
    );
    expect(result.match(/Text as NativeText/g)).toHaveLength(1);
    expect(result).toContain(
      '<Disclosure.Trigger><NativeText>Example section</NativeText></Disclosure.Trigger>'
    );
    expect(result).toContain(
      '<Disclosure.Content><NativeText>Example content</NativeText></Disclosure.Content>'
    );
    expect(result).not.toContain(
      '<Disclosure.Content>Example content</Disclosure.Content>'
    );
    expect(renderStoryTemplate(params)).toBe(result);
  });

  it('wraps generator-owned native base story text with NativeText', () => {
    const result = renderStoryTemplate({
      componentName: 'Avatar',
      layer: 'primitives',
      isNative: true,
      profile: 'base',
    });

    expect(result).toContain(
      "import { Text as NativeText } from 'react-native';"
    );
    expect(result).toContain(
      'children: (\n      <NativeText>Example content</NativeText>\n    )'
    );
  });

  it('renders form-control capability scenarios without placeholder copy', () => {
    const source = renderStoryTemplate({
      componentName: 'SwitchProbe',
      layer: 'primitives',
      isNative: false,
      profile: 'form-control',
      control: 'boolean',
      capabilities: [
        'controlled',
        'uncontrolled',
        'disabled',
        'required',
        'invalid',
      ],
    });

    expect(source).toContain('export const Controlled: Story');
    expect(source).toContain('export const Uncontrolled: Story');
    expect(source).toContain('export const Disabled: Story');
    expect(source).toContain('export const Required: Story');
    expect(source).toContain('export const Invalid: Story');
    expect(source).not.toContain('Describe when to use');
    expect(source).not.toContain('Replace this section');
  });

  it('renders overlay controlled and uncontrolled scenarios', () => {
    const source = renderStoryTemplate({
      componentName: 'DialogProbe',
      layer: 'components',
      isNative: false,
      profile: 'overlay',
      capabilities: [
        'controlled',
        'uncontrolled',
        'keyboard',
        'focus-management',
        'portal',
      ],
      parts: ['Root', 'Trigger', 'Content'],
    });

    expect(source).toContain('export const Controlled: Story');
    expect(source).toContain('open: true');
    expect(source).toContain('onOpenChange: () => undefined');
    expect(source).toContain('export const Uncontrolled: Story');
    expect(source).toContain('defaultOpen: true');
  });

  it('renders rich compound scenarios from reusable capabilities', () => {
    const source = renderStoryTemplate({
      componentName: 'DisclosureProbe',
      layer: 'components',
      isNative: false,
      profile: 'compound',
      control: 'value',
      capabilities: [
        'compound-api',
        'multiple',
        'controlled',
        'uncontrolled',
        'collapsible',
        'disabled',
      ],
      parts: ['Root', 'Item', 'Trigger', 'Content'],
    });

    expect(source).toContain('export const Multiple: Story');
    expect(source).toContain("type: 'multiple'");
    expect(source).toContain('export const Controlled: Story');
    expect(source).toContain('export const Uncontrolled: Story');
    expect(source).toContain('export const Collapsible: Story');
    expect(source).toContain('export const Disabled: Story');
    expect(source).toContain('export const RichContent: Story');
    expect(source).toContain('production-style example');
  });

  it('keeps Native compound scenario names comparable with Web', () => {
    const params = {
      componentName: 'DisclosureProbe',
      layer: 'components',
      profile: 'compound' as const,
      control: 'value' as const,
      capabilities: [
        'compound-api',
        'multiple',
        'controlled',
        'uncontrolled',
        'collapsible',
        'disabled',
      ] as const,
      parts: ['Root', 'Item', 'Trigger', 'Content'] as const,
    };
    const web = renderStoryTemplate({ ...params, isNative: false });
    const native = renderStoryTemplate({ ...params, isNative: true });

    for (const story of [
      'Default',
      'Multiple',
      'Controlled',
      'Uncontrolled',
      'Collapsible',
      'Disabled',
      'RichContent',
    ]) {
      expect(web).toContain(`export const ${story}: Story`);
      expect(native).toContain(`export const ${story}: Story`);
    }
  });
});
