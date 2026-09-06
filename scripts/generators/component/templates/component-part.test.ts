import { describe, expect, it } from 'vitest';

import {
  renderPartComponentTemplate,
  renderPartIndexTemplate,
  renderPartTypesTemplate,
} from './component-part';

describe('component part templates', () => {
  it('renders an interactive web Trigger part', () => {
    const result = renderPartComponentTemplate({
      componentName: 'Accordion',
      partName: 'Trigger',
      isNative: false,
    });

    expect(result).toContain('export function AccordionTrigger');
    expect(result).toContain('<button');
    expect(result).toContain('onClick={onActivate}');
  });

  it('renders an interactive native Trigger part', () => {
    const result = renderPartComponentTemplate({
      componentName: 'Accordion',
      partName: 'Trigger',
      isNative: true,
    });

    expect(result).toContain('<Pressable');
    expect(result).toContain("accessibilityRole='button'");
    expect(result).toContain('onPress={onActivate}');
  });

  it('renders a platform-aware Content part', () => {
    const web = renderPartComponentTemplate({
      componentName: 'Accordion',
      partName: 'Content',
      isNative: false,
    });
    const native = renderPartComponentTemplate({
      componentName: 'Accordion',
      partName: 'Content',
      isNative: true,
    });

    expect(web).toContain('<div hidden={hidden}>');
    expect(native).toContain('if (hidden)');
    expect(native).toContain('<View>{children}</View>');
  });

  it('keeps neutral parts generic', () => {
    const result = renderPartComponentTemplate({
      componentName: 'Accordion',
      partName: 'Item',
      isNative: false,
    });

    expect(result).toContain('export function AccordionItem');
    expect(result).toContain('<div>{children}</div>');
  });

  it('renders specialized Trigger types', () => {
    const result = renderPartTypesTemplate({
      componentName: 'Accordion',
      partName: 'Trigger',
      isNative: false,
    });

    expect(result).toContain(
      "import type { BaseAccordionTriggerProps } from '@vellira-ui/types';"
    );
    expect(result).toContain(
      'export type AccordionTriggerProps = BaseAccordionTriggerProps & {'
    );
    expect(result).toContain('children?: ReactNode');
    expect(result).not.toContain('disabled?: boolean');
    expect(result).not.toContain('onActivate?: () => void');
  });

  it('renders specialized Content types', () => {
    const result = renderPartTypesTemplate({
      componentName: 'Accordion',
      partName: 'Content',
      isNative: false,
    });

    expect(result).toContain(
      "import type { BaseAccordionContentProps } from '@vellira-ui/types';"
    );
    expect(result).toContain(
      'export type AccordionContentProps = BaseAccordionContentProps & {'
    );
    expect(result).toContain('children?: ReactNode');
    expect(result).not.toContain('hidden?: boolean');
  });

  it('renders part index', () => {
    const result = renderPartIndexTemplate({
      componentName: 'Accordion',
      partName: 'Item',
      isNative: false,
    });

    expect(result).toContain("export * from './AccordionItem';");
  });
});
