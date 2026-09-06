import { describe, expect, it } from 'vitest';

import {
  renderWebOverlayPartComponentTemplate,
  renderWebOverlayPartTypesTemplate,
} from './component-overlay-part-web';

describe('web overlay part templates', () => {
  it('routes overlay Root through the component-level public props contract', () => {
    const types = renderWebOverlayPartTypesTemplate({
      componentName: 'Dialog',
      partName: 'Root',
    });
    const root = renderWebOverlayPartComponentTemplate({
      componentName: 'Dialog',
      partName: 'Root',
    });

    expect(types).not.toContain('DialogRootProps');
    expect(root).toContain('DialogProps');
    expect(root).toContain("from '../types'");
  });

  it('renders a browser overlay Trigger', () => {
    const trigger = renderWebOverlayPartComponentTemplate({
      componentName: 'Dialog',
      partName: 'Trigger',
    });

    expect(trigger).toContain('export function DialogTrigger');
    expect(trigger).toContain('<button');
    expect(trigger).toContain("aria-haspopup='dialog'");
  });

  it('renders browser overlay Content semantics', () => {
    const content = renderWebOverlayPartComponentTemplate({
      componentName: 'Dialog',
      partName: 'Content',
    });

    expect(content).toContain('export function DialogContent');
    expect(content).toContain("role='dialog'");
    expect(content).toContain('tabIndex={-1}');
  });

  it('renders interactive Close semantics', () => {
    const types = renderWebOverlayPartTypesTemplate({
      componentName: 'Dialog',
      partName: 'Close',
    });
    const close = renderWebOverlayPartComponentTemplate({
      componentName: 'Dialog',
      partName: 'Close',
    });

    expect(types).toContain('onActivate?: () => void');
    expect(close).toContain('<button');
    expect(close).toContain('onClick={onActivate}');
  });

  it.each(['Overlay', 'Backdrop'])(
    'renders decorative %s semantics',
    (partName) => {
      const result = renderWebOverlayPartComponentTemplate({
        componentName: 'Dialog',
        partName,
      });

      expect(result).toContain("aria-hidden='true'");
    }
  );

  it('renders semantic Title and Description parts', () => {
    const title = renderWebOverlayPartComponentTemplate({
      componentName: 'Dialog',
      partName: 'Title',
    });
    const description = renderWebOverlayPartComponentTemplate({
      componentName: 'Dialog',
      partName: 'Description',
    });

    expect(title).toContain('<h2>');
    expect(description).toContain('<p>');
  });

  it('renders positioning-oriented Anchor and Arrow parts', () => {
    const anchor = renderWebOverlayPartComponentTemplate({
      componentName: 'Popover',
      partName: 'Anchor',
    });
    const arrow = renderWebOverlayPartComponentTemplate({
      componentName: 'Popover',
      partName: 'Arrow',
    });

    expect(anchor).toContain('<span>');
    expect(arrow).toContain("aria-hidden='true'");
  });
});
