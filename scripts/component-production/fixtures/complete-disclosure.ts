import fs from 'node:fs';
import path from 'node:path';

import { formatGeneratedContent } from '../../generators/format-generated-files';

// Synthetic disclosure semantics for the production lifecycle fixture. The
// generator owns structure; this completion owns item state and its behavior.
export async function completeDisclosureFixture(root: string, name: string) {
  const sharedFile = path.join(
    root,
    'packages/types/src',
    `${name[0].toLowerCase()}${name.slice(1)}.ts`
  );
  const sharedSource = fs.readFileSync(sharedFile, 'utf8');
  const placeholder = `export type Base${name}ItemProps = unknown;`;
  if (!sharedSource.includes(placeholder))
    throw new Error('Expected generated item contract.');
  fs.writeFileSync(
    sharedFile,
    await formatGeneratedContent(
      sharedFile,
      sharedSource.replace(
        placeholder,
        `export type Base${name}ItemProps = {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
};`
      )
    )
  );

  for (const platform of ['react', 'react-native'] as const) {
    const native = platform === 'react-native';
    const directory = path.join(
      root,
      'packages',
      platform,
      'src/components',
      name
    );
    const files = {
      [`Item/${name}Item.tsx`]: `import { createContext, useContext, useState } from 'react';
${native ? "import { View } from 'react-native';" : ''}
import type { ${name}ItemProps } from './types';
const ItemContext = createContext({ open: true, setOpen: (_open: boolean) => {} });
export const useItemState = () => useContext(ItemContext);
export function ${name}Item({ children, open, defaultOpen = false, onOpenChange }: ${name}ItemProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const resolvedOpen = open ?? uncontrolledOpen;
  const setOpen = (next: boolean) => {
    if (open === undefined) setUncontrolledOpen(next);
    onOpenChange?.(next);
  };
  return <ItemContext.Provider value={{ open: resolvedOpen, setOpen }}><${native ? 'View' : 'div'}>{children}</${native ? 'View' : 'div'}></ItemContext.Provider>;
}`,
      [`Trigger/${name}Trigger.tsx`]: `${native ? "import { Pressable } from 'react-native';" : ''}
import { useItemState } from '../Item/${name}Item';
import type { ${name}TriggerProps } from './types';
export function ${name}Trigger({ children, disabled = false, onActivate }: ${name}TriggerProps) {
  const state = useItemState();
  const activate = () => { if (!disabled) { state.setOpen(!state.open); onActivate?.(); } };
  return ${
    native
      ? `<Pressable accessibilityRole='button' accessibilityState={{ disabled, expanded: state.open }} disabled={disabled} onPress={activate}>{children}</Pressable>`
      : `<button type='button' disabled={disabled} aria-expanded={state.open} onClick={activate}>{children}</button>`
  };
}`,
      [`Content/${name}Content.tsx`]: `${native ? "import { View } from 'react-native';" : ''}
import { useItemState } from '../Item/${name}Item';
import type { ${name}ContentProps } from './types';
export function ${name}Content({ children, hidden = false }: ${name}ContentProps) {
  const state = useItemState();
  if (hidden || !state.open) return null;
  return <${native ? 'View' : 'div'}>{children}</${native ? 'View' : 'div'}>;
}`,
    };
    for (const [relative, source] of Object.entries(files)) {
      const file = path.join(directory, relative);
      fs.writeFileSync(file, await formatGeneratedContent(file, source));
    }
    const testFile = path.join(directory, `${name}.manual.test.tsx`);
    const marker = fs.readFileSync(testFile, 'utf8').split('\n')[0];
    const tests = `${marker}
import { act } from 'react';
import { render } from '@test-utils/render';
import { afterEach, describe, expect, it, vi } from 'vitest';
${native ? '' : "import userEvent from '@testing-library/user-event';"}
import { ${name} } from './${name}';
afterEach(() => { document.body.innerHTML = ''; });
describe('disclosure semantic completion', () => {
  it('keeps uncontrolled item state and instance isolation', () => {
    const { container, unmount } = render(<${name}><${name}.Item><${name}.Trigger>First</${name}.Trigger><${name}.Content>First content</${name}.Content></${name}.Item><${name}.Item><${name}.Trigger>Second</${name}.Trigger><${name}.Content>Second content</${name}.Content></${name}.Item></${name}>);
    expect(container.textContent).not.toContain('First content');
    act(() => (container.querySelector('${native ? '[role="button"]' : 'button'}') as HTMLElement).click());
    expect(container.textContent).toContain('First content');
    expect(container.textContent).not.toContain('Second content');
    unmount();
  });
  it('requests controlled changes without changing controlled state', () => {
    const onOpenChange = vi.fn();
    const { container, unmount } = render(<${name}><${name}.Item open={false} onOpenChange={onOpenChange}><${name}.Trigger>Open</${name}.Trigger><${name}.Content>Content</${name}.Content></${name}.Item></${name}>);
    act(() => (container.querySelector('${native ? '[role="button"]' : 'button'}') as HTMLElement).click());
    expect(onOpenChange).toHaveBeenCalledWith(true);
    expect(container.textContent).not.toContain('Content');
    unmount();
  });
  it('preserves disabled triggers', () => {
    const onOpenChange = vi.fn();
    const { container, unmount } = render(<${name}><${name}.Item onOpenChange={onOpenChange}><${name}.Trigger disabled>Open</${name}.Trigger></${name}.Item></${name}>);
    act(() => (container.querySelector('${native ? '[role="button"]' : 'button'}') as HTMLElement).click());
    expect(onOpenChange).not.toHaveBeenCalled();
    unmount();
  });
${
  native
    ? ''
    : `  it('supports keyboard activation', async () => {
    const user = userEvent.setup();
    const { container, unmount } = render(<${name}><${name}.Item><${name}.Trigger>Open</${name}.Trigger><${name}.Content>Keyboard content</${name}.Content></${name}.Item></${name}>);
    (container.querySelector('button') as HTMLElement).focus();
    await user.keyboard('{Enter}');
    expect(container.textContent).toContain('Keyboard content');
    unmount();
  });`
}
});`;
    fs.writeFileSync(testFile, await formatGeneratedContent(testFile, tests));
  }
}
