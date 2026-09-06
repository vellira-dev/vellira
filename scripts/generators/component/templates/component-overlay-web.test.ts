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

  it('keeps browser-specific overlay behavior props in the web adapter', () => {
    const result = renderWebOverlayTypesTemplate({
      componentName: 'Dialog',
    });

    expect(result).toContain('closeOnEscape?: boolean');
    expect(result).toContain('closeOnOutsidePress?: boolean');
    expect(result).toContain('restoreFocus?: boolean');
  });

  it('renders a web overlay root scaffold', () => {
    const result = renderWebOverlayComponentTemplate({
      componentName: 'Dialog',
    });

    expect(result).toContain("import { useState } from 'react'");
    expect(result).toContain('<div');
    expect(result).toContain("data-state={resolvedOpen ? 'open' : 'closed'}");
    expect(result).toContain('closeOnEscape = true');
    expect(result).toContain('closeOnOutsidePress = true');
    expect(result).toContain('restoreFocus = true');
  });
});
