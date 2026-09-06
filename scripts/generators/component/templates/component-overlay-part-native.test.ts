import { describe, expect, it } from 'vitest';

import {
  renderNativeOverlayPartComponentTemplate,
  renderNativeOverlayPartTypesTemplate,
} from './component-overlay-part-native';

describe('native overlay part templates', () => {
  it('routes overlay Root through the component-level public props contract', () => {
    const types = renderNativeOverlayPartTypesTemplate({
      componentName: 'Dialog',
      partName: 'Root',
    });
    const root = renderNativeOverlayPartComponentTemplate({
      componentName: 'Dialog',
      partName: 'Root',
    });

    expect(types).not.toContain('DialogRootProps');
    expect(root).toContain('DialogProps');
    expect(root).toContain("from '../types'");
  });

  it('renders a native overlay Trigger', () => {
    const trigger = renderNativeOverlayPartComponentTemplate({
      componentName: 'Dialog',
      partName: 'Trigger',
    });

    expect(trigger).toContain('export function DialogTrigger');
    expect(trigger).toContain('<Pressable');
    expect(trigger).toContain("accessibilityRole='button'");
  });

  it('renders native overlay Content semantics', () => {
    const content = renderNativeOverlayPartComponentTemplate({
      componentName: 'Dialog',
      partName: 'Content',
    });

    expect(content).toContain('export function DialogContent');
    expect(content).toContain('accessibilityViewIsModal');
    expect(content).not.toContain("role='dialog'");
  });

  it('renders touch-first Close semantics', () => {
    const types = renderNativeOverlayPartTypesTemplate({
      componentName: 'Dialog',
      partName: 'Close',
    });
    const close = renderNativeOverlayPartComponentTemplate({
      componentName: 'Dialog',
      partName: 'Close',
    });

    expect(types).toContain('accessibilityLabel?: string');
    expect(types).toContain('onActivate?: () => void');
    expect(close).toContain('<Pressable');
    expect(close).toContain('onPress={onActivate}');
    expect(close).not.toContain('onClick');
  });

  it.each(['Overlay', 'Backdrop'])(
    'keeps decorative %s out of the native accessibility tree',
    (partName) => {
      const result = renderNativeOverlayPartComponentTemplate({
        componentName: 'Dialog',
        partName,
      });

      expect(result).toContain('accessibilityElementsHidden');
      expect(result).toContain(
        "importantForAccessibility='no-hide-descendants'"
      );
      expect(result).not.toContain('aria-hidden');
    }
  );

  it('renders native Title and Description without DOM elements', () => {
    const title = renderNativeOverlayPartComponentTemplate({
      componentName: 'Dialog',
      partName: 'Title',
    });
    const description = renderNativeOverlayPartComponentTemplate({
      componentName: 'Dialog',
      partName: 'Description',
    });

    expect(title).toContain('<Text');
    expect(title).toContain("accessibilityRole='header'");
    expect(description).toContain('<Text>');
    expect(title).not.toContain('<h2>');
    expect(description).not.toContain('<p>');
  });

  it('renders native Anchor and Arrow without browser positioning markup', () => {
    const anchor = renderNativeOverlayPartComponentTemplate({
      componentName: 'Popover',
      partName: 'Anchor',
    });
    const arrow = renderNativeOverlayPartComponentTemplate({
      componentName: 'Popover',
      partName: 'Arrow',
    });

    expect(anchor).toContain('<View>');
    expect(arrow).toContain('accessible={false}');
    expect(anchor).not.toContain('<span>');
    expect(arrow).not.toContain('aria-hidden');
  });
});
