import { describe, expect, it, vi } from 'vitest';

import { createOverlayZIndexPolicy } from './policy.js';
import { createOverlayManagerStore } from './store.js';

type TestOverlayLevel = 'dropdown' | 'popover' | 'modal';

const policy = createOverlayZIndexPolicy<TestOverlayLevel>({
  defaultLevel: 'popover',
  levels: {
    dropdown: 100,
    popover: 200,
    modal: 1000,
  },
});

describe('createOverlayManagerStore', () => {
  it('registers overlays in stable stack order and exposes the topmost entry', () => {
    const store = createOverlayManagerStore({ policy });

    store.register({ id: 'popover', zIndexLevel: 'popover' });
    store.register({ id: 'dropdown', zIndexLevel: 'dropdown' });

    expect(store.getStack().map((entry) => entry.id)).toEqual([
      'popover',
      'dropdown',
    ]);
    expect(store.getTopmost()?.id).toBe('dropdown');
    expect(store.isTopmost('popover')).toBe(false);
    expect(store.isTopmost('dropdown')).toBe(true);
  });

  it('moves an existing overlay to the top when it registers again', () => {
    const store = createOverlayManagerStore({ policy });

    store.register({ id: 'first' });
    store.register({ id: 'second' });
    store.register({ id: 'first' });

    expect(store.getStack().map((entry) => entry.id)).toEqual([
      'second',
      'first',
    ]);
    expect(store.getTopmost()?.id).toBe('first');
  });

  it('removes overlays without disturbing the remaining order', () => {
    const store = createOverlayManagerStore({ policy });

    store.register({ id: 'first' });
    store.register({ id: 'second' });
    store.register({ id: 'third' });
    store.unregister('second');

    expect(store.getStack().map((entry) => entry.id)).toEqual([
      'first',
      'third',
    ]);
    expect(store.getTopmost()?.id).toBe('third');
  });

  it('calculates z-index from level base and stack order unless explicitly set', () => {
    const store = createOverlayManagerStore({ policy });

    store.register({ id: 'dropdown', zIndexLevel: 'dropdown' });
    store.register({ id: 'popover', zIndexLevel: 'popover' });
    store.register({ id: 'custom', zIndexLevel: 'modal', zIndex: 5000 });

    expect(store.getZIndex('dropdown')).toBe(100);
    expect(store.getZIndex('popover')).toBe(210);
    expect(store.getZIndex('custom')).toBe(5000);
  });

  it('places a newer dropdown above its open modal despite lower base level', () => {
    const store = createOverlayManagerStore({ policy });

    store.register({ id: 'modal', zIndexLevel: 'modal' });
    store.register({ id: 'select', zIndexLevel: 'dropdown' });
    store.register({ id: 'popover', zIndexLevel: 'popover' });

    expect(store.getZIndex('modal')).toBe(1000);
    expect(store.getZIndex('select')).toBe(1010);
    expect(store.getZIndex('popover')).toBe(1020);
    expect(store.getTopmost()?.id).toBe('popover');

    store.unregister('popover');
    store.unregister('select');

    expect(store.getZIndex('modal')).toBe(1000);
    expect(store.getZIndex('select')).toBeUndefined();

    store.register({ id: 'select-again', zIndexLevel: 'dropdown' });
    expect(store.getZIndex('select-again')).toBe(1010);
  });

  it('recalculates stacking when an earlier overlay is promoted', () => {
    const store = createOverlayManagerStore({ policy });

    store.register({ id: 'parent', zIndexLevel: 'popover' });
    store.register({ id: 'child', zIndexLevel: 'dropdown' });

    expect(store.getZIndex('child')).toBe(210);

    store.update({ id: 'parent', zIndexLevel: 'modal' });

    expect(store.getZIndex('parent')).toBe(1000);
    expect(store.getZIndex('child')).toBe(1010);
  });

  it('respects explicit stacking overrides while lifting subsequent defaults', () => {
    const store = createOverlayManagerStore({ policy });

    store.register({ id: 'explicit', zIndexLevel: 'modal', zIndex: 5000 });
    store.register({ id: 'select', zIndexLevel: 'dropdown' });

    expect(store.getZIndex('explicit')).toBe(5000);
    expect(store.getZIndex('select')).toBe(5010);

    store.update({ id: 'explicit', zIndexLevel: 'modal', zIndex: 8000 });
    expect(store.getZIndex('select')).toBe(8010);
  });

  it('updates z-index metadata without changing stack order', () => {
    const store = createOverlayManagerStore({ policy });

    store.register({ id: 'first', zIndexLevel: 'popover' });
    store.register({ id: 'second', zIndexLevel: 'dropdown' });
    store.update({ id: 'first', zIndexLevel: 'modal' });

    expect(store.getStack().map((entry) => entry.id)).toEqual([
      'first',
      'second',
    ]);
    expect(store.getZIndex('first')).toBe(1000);
    expect(store.getTopmost()?.id).toBe('second');
  });

  it('notifies subscribers after stack changes', () => {
    const store = createOverlayManagerStore({ policy });
    let calls = 0;
    const unsubscribe = store.subscribe(() => {
      calls += 1;
    });

    store.register({ id: 'first' });
    store.update({ id: 'first', zIndexLevel: 'modal' });
    store.unregister('first');
    unsubscribe();
    store.register({ id: 'second' });

    expect(calls).toBe(3);
  });

  it('reports duplicate registrations and unknown unregisters through diagnostics', () => {
    const duplicateRegistration = vi.fn();
    const unknownUnregister = vi.fn();
    const store = createOverlayManagerStore({
      policy,
      diagnostics: {
        duplicateRegistration,
        unknownUnregister,
      },
    });

    store.register({ id: 'overlay' });
    store.register({ id: 'overlay' });
    store.unregister('missing');

    expect(duplicateRegistration).toHaveBeenCalledWith('overlay');
    expect(unknownUnregister).toHaveBeenCalledWith('missing');
  });

  it('resets stack order after all overlays are cleared', () => {
    const store = createOverlayManagerStore({ policy });

    store.register({ id: 'first' });
    store.unregister('first');

    expect(store.register({ id: 'second' }).order).toBe(0);
  });
});
