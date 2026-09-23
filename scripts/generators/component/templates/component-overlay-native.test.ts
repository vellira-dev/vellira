import { describe, expect, it } from 'vitest';

import {
  renderNativeOverlayComponentTemplate,
  renderNativeOverlayTypesTemplate,
} from './component-overlay-native';

describe('native overlay templates', () => {
  it('derives shared overlay state from @vellira-ui/types', () => {
    const result = renderNativeOverlayTypesTemplate({
      componentName: 'Dialog',
    });

    expect(result).toContain("from '@vellira-ui/types'");
    expect(result).toContain('BaseDialogProps');
    expect(result).not.toContain('open?: boolean');
    expect(result).not.toContain('defaultOpen?: boolean');
    expect(result).not.toContain('onOpenChange?: (open: boolean) => void');
  });

  it('keeps platform-specific overlay behavior props in the adapter', () => {
    const result = renderNativeOverlayTypesTemplate({
      componentName: 'Dialog',
    });

    expect(result).toContain('closeOnOutsidePress?: boolean');
    expect(result).toContain('restoreFocus?: boolean');
    expect(result).not.toContain('closeOnEscape?: boolean');
  });

  it('renders an overlay scaffold using the canonical state hook', () => {
    const result = renderNativeOverlayComponentTemplate({
      componentName: 'Dialog',
    });

    expect(result).toContain(
      "import { useControllableState } from '../../hooks'"
    );
    expect(result).toContain(
      'const [resolvedOpen, setOpen] = useControllableState('
    );
    expect(result).not.toContain('useState');
    expect(result).not.toContain('const setOpen =');
    expect(result).toContain('value: open');
    expect(result).toContain('defaultValue: defaultOpen');
    expect(result).toContain('onChange: onOpenChange');
    expect(result).toContain("import { View } from 'react-native'");
    expect(result).toContain('resolvedOpen ? children : null');
    expect(result).toContain('closeOnOutsidePress = true');
    expect(result).toContain('restoreFocus = true');
  });
});
