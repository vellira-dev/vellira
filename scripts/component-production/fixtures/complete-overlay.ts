import fs from 'node:fs';
import path from 'node:path';

import { formatGeneratedContent } from '../../generators/format-generated-files';

// A synthetic nonmodal dialog: the fixture explicitly owns open state, a portal,
// Escape dismissal, initial focus and restoration to the invoking control.
export async function completeOverlayFixture(root: string, name: string) {
  const directory = path.join(root, 'packages/react/src/components', name);
  const files = {
    'internal/state.ts': `import { createContext, useContext } from 'react';
export const OverlayContext = createContext({ open: false, setOpen: (_open: boolean) => {}, closeOnEscape: true, restoreFocus: true });
export const useOverlayState = () => useContext(OverlayContext);`,
    [`Root/${name}Root.tsx`]: `import { useState } from 'react';
import { OverlayContext } from '../internal/state';
import type { ${name}Props } from '../types';
export function ${name}Root({ children, open, defaultOpen = false, onOpenChange, closeOnEscape = true, restoreFocus = true }: ${name}Props) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const resolvedOpen = open ?? uncontrolledOpen;
  const setOpen = (next: boolean) => { if (open === undefined) setUncontrolledOpen(next); onOpenChange?.(next); };
  return <OverlayContext.Provider value={{ open: resolvedOpen, setOpen, closeOnEscape, restoreFocus }}><div data-state={resolvedOpen ? 'open' : 'closed'}>{children}</div></OverlayContext.Provider>;
}`,
    [`Trigger/${name}Trigger.tsx`]: `import { useOverlayState } from '../internal/state';
import type { ${name}TriggerProps } from './types';
export function ${name}Trigger({ children, disabled = false }: ${name}TriggerProps) {
  const state = useOverlayState();
  return <button type='button' disabled={disabled} aria-haspopup='dialog' aria-expanded={state.open} onClick={() => state.setOpen(true)}>{children}</button>;
}`,
    [`Content/${name}Content.tsx`]: `import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useOverlayState } from '../internal/state';
import type { ${name}ContentProps } from './types';
export function ${name}Content({ children }: ${name}ContentProps) {
  const { open, setOpen, closeOnEscape, restoreFocus } = useOverlayState();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement;
    ref.current?.focus();
    return () => { if (restoreFocus && previous instanceof HTMLElement) previous.focus(); };
  }, [open, restoreFocus]);
  if (!open) return null;
  return createPortal(<div ref={ref} role='dialog' aria-label='Fixture dialog' tabIndex={-1} onKeyDown={(event) => { if (closeOnEscape && event.key === 'Escape') { event.stopPropagation(); setOpen(false); } }}>{children}</div>, document.body);
}`,
  };
  for (const [relative, source] of Object.entries(files)) {
    const file = path.join(directory, relative);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, await formatGeneratedContent(file, source));
  }
  const testFile = path.join(directory, `${name}.manual.test.tsx`);
  const marker = fs.readFileSync(testFile, 'utf8').split('\n')[0];
  const source = `${marker}
import { act } from 'react';
import { render } from '@test-utils/render';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ${name} } from './${name}';
afterEach(() => { document.body.innerHTML = ''; });
describe('overlay semantic completion', () => {
  it('opens an uncontrolled portal, focuses it and restores focus after Escape', async () => {
    const user = userEvent.setup();
    const { container, unmount } = render(<${name}><${name}.Trigger>Open</${name}.Trigger><${name}.Content>Portal content</${name}.Content></${name}>);
    const trigger = container.querySelector('button') as HTMLElement;
    trigger.focus();
    await user.keyboard('{Enter}');
    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog?.textContent).toContain('Portal content');
    expect(container.contains(dialog)).toBe(false);
    expect(document.activeElement).toBe(dialog);
    await user.keyboard('{Escape}');
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);
    unmount();
  });
  it('requests controlled state changes and keeps the supplied state', () => {
    const onOpenChange = vi.fn();
    const { container, unmount } = render(<${name} open={false} onOpenChange={onOpenChange}><${name}.Trigger>Open</${name}.Trigger><${name}.Content>Content</${name}.Content></${name}>);
    act(() => (container.querySelector('button') as HTMLElement).click());
    expect(onOpenChange).toHaveBeenCalledWith(true);
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    unmount();
  });
});`;
  fs.writeFileSync(testFile, await formatGeneratedContent(testFile, source));
}
