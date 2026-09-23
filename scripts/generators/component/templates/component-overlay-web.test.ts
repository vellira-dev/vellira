import { describe, expect, it } from 'vitest';

import {
  renderWebOverlayComponentTemplate,
  renderWebOverlayTypesTemplate,
} from './component-overlay-web';

describe('web overlay templates', () => {
  it('derives shared overlay state from @vellira-ui/types', () => {
    const result = renderWebOverlayTypesTemplate({
      componentName: 'Dialog',
    });

    expect(result).toContain("from '@vellira-ui/types'");
    expect(result).toContain('BaseDialogProps');
    expect(result).not.toContain('open?: boolean');
    expect(result).not.toContain('defaultOpen?: boolean');
    expect(result).not.toContain('onOpenChange?: (open: boolean) => void');
  });

  it('keeps platform-specific overlay behavior props in the adapter', () => {
    const result = renderWebOverlayTypesTemplate({
      componentName: 'Dialog',
    });

    expect(result).toContain('closeOnOutsidePress?: boolean');
    expect(result).toContain('restoreFocus?: boolean');
    expect(result).toContain('closeOnEscape?: boolean');
  });

  it('renders an overlay scaffold using the canonical state hook', () => {
    const result = renderWebOverlayComponentTemplate({
      componentName: 'Dialog',
    });

    expect(result).toContain("import { useControllableState } from '#hooks'");
    expect(result).toContain(
      'const [resolvedOpen, setOpen] = useControllableState('
    );
    expect(result).not.toContain('useState');
    expect(result).not.toContain('const setOpen =');
    expect(result).toContain('value: open');
    expect(result).toContain('defaultValue: defaultOpen');
    expect(result).toContain('onChange: onOpenChange');
    expect(result).toContain('<div');
    expect(result).toContain("data-state={resolvedOpen ? 'open' : 'closed'}");
    expect(result).toContain('closeOnEscape = true');
    expect(result).toContain('closeOnOutsidePress = true');
    expect(result).toContain('restoreFocus = true');
  });
});
