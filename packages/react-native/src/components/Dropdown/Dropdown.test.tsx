import { act } from 'react';

import { copyCompoundSlotMetadata } from '@vellira-ui/core';
import type { ComponentProps, ReactNode } from 'react';
import { Pressable, Text } from 'react-native';
import { afterEach, describe, expect, it, vi } from 'vitest';

import * as managers from '../../managers';
import { Button } from '../../primitives/Button';
import { Portal } from '../../primitives/Portal';
import { render } from '../../test-utils/render';
import { nativeThemes, ThemeProvider } from '../../theme';

import { getDropdownBackdropBackgroundColor } from './Content/DropdownContent.styles';
import { Dropdown } from './Dropdown';

function renderActionContent({
  editIcon,
  deleteIcon,
  onEdit,
}: {
  editIcon?: ReactNode;
  deleteIcon?: ReactNode;
  onEdit?: () => void;
} = {}) {
  return (
    <Dropdown.Content>
      <Dropdown.Item value='edit' icon={editIcon} onSelect={onEdit}>
        Edit
      </Dropdown.Item>
      <Dropdown.Item value='delete' color='danger' icon={deleteIcon}>
        Delete
      </Dropdown.Item>
    </Dropdown.Content>
  );
}

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

const changeInputValue = (input: HTMLInputElement | null, value: string) => {
  if (!input) return;

  Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    'value'
  )?.set?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
};

const toCssColor = (color: string) => {
  if (!color.startsWith('#')) return color;

  const value = color.replace('#', '');
  const red = parseInt(value.slice(0, 2), 16);
  const green = parseInt(value.slice(2, 4), 16);
  const blue = parseInt(value.slice(4, 6), 16);

  return `rgb(${red}, ${green}, ${blue})`;
};

const pressNativeElement = (element: HTMLElement | undefined) => {
  element?.dispatchEvent(new Event('pointerdown', { bubbles: true }));
  element?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
};

describe('Native Dropdown', () => {
  it('keeps popover outside-press backdrop visually transparent across dark themes', () => {
    expect(
      getDropdownBackdropBackgroundColor(nativeThemes.dark, 'popover')
    ).toBe('transparent');
    expect(
      getDropdownBackdropBackgroundColor(nativeThemes.highContrast, 'popover')
    ).toBe('transparent');
    expect(getDropdownBackdropBackgroundColor(nativeThemes.dark, 'modal')).toBe(
      nativeThemes.dark.semantic.overlay.backdrop
    );
    expect(
      getDropdownBackdropBackgroundColor(nativeThemes.highContrast, 'sheet')
    ).toBe(nativeThemes.highContrast.semantic.overlay.backdrop);
  });

  it('supports compound trigger, content, and item selection', () => {
    const onSelect = vi.fn();
    const { container, unmount } = render(
      <Dropdown label='Actions'>
        <Dropdown.Trigger>
          <Button>Actions</Button>
        </Dropdown.Trigger>
        <Dropdown.Content presentation='modal'>
          <Dropdown.Label>Project</Dropdown.Label>
          <Dropdown.Item value='edit' onSelect={onSelect}>
            Edit
          </Dropdown.Item>
          <Dropdown.Separator />
          <Dropdown.Item value='delete' color='danger'>
            Delete
          </Dropdown.Item>
        </Dropdown.Content>
      </Dropdown>
    );

    const trigger =
      container.querySelector<HTMLButtonElement>('[role="button"]');

    act(() => trigger?.click());

    expect(container.textContent).toContain('Project');
    expect(container.querySelector('[role="menu"]')).not.toBeNull();
    expect(container.querySelector('[role="heading"]')?.textContent).toContain(
      'Project'
    );

    const editItem = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent?.includes('Edit')
    );

    act(() => editItem?.click());

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(container.textContent).not.toContain('Edit');

    unmount();
  });

  it('recognizes copied compound slot metadata on wrapper components', () => {
    const WrappedContent = copyCompoundSlotMetadata(
      Dropdown.Content,
      (props: ComponentProps<typeof Dropdown.Content>) => (
        <Dropdown.Content {...props} />
      )
    );
    const WrappedItem = copyCompoundSlotMetadata(
      Dropdown.Item,
      (props: ComponentProps<typeof Dropdown.Item>) => (
        <Dropdown.Item {...props} />
      )
    );

    const { container, unmount } = render(
      <Dropdown label='Actions'>
        <WrappedContent>
          <WrappedItem value='edit'>Edit</WrappedItem>
        </WrappedContent>
      </Dropdown>
    );

    act(() =>
      container.querySelector<HTMLButtonElement>('[role="button"]')?.click()
    );

    expect(container.textContent).toContain('Edit');
    expect(container.querySelector('[role="menuitem"]')).not.toBeNull();

    unmount();
  });

  it('keeps compound content open when selection prevents default', () => {
    const onSelect = vi.fn((event) => event.preventDefault());
    const { container, unmount } = render(
      <Dropdown label='Actions'>
        <Dropdown.Trigger>Actions</Dropdown.Trigger>
        <Dropdown.Content>
          <Dropdown.Item value='advanced' onSelect={onSelect}>
            Advanced
          </Dropdown.Item>
        </Dropdown.Content>
      </Dropdown>
    );

    const trigger =
      container.querySelector<HTMLButtonElement>('[role="button"]');

    act(() => trigger?.click());

    const item = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent?.includes('Advanced')
    );

    act(() => item?.click());

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain('Advanced');

    unmount();
  });

  it('supports Item asChild without rendering a second item surface', () => {
    const onSelect = vi.fn();
    const { container, unmount } = render(
      <Dropdown label='Actions'>
        <Dropdown.Trigger>Actions</Dropdown.Trigger>
        <Dropdown.Content>
          <Dropdown.Item value='edit' asChild onSelect={onSelect}>
            <Pressable>
              <Text>Custom edit</Text>
            </Pressable>
          </Dropdown.Item>
        </Dropdown.Content>
      </Dropdown>
    );

    act(() =>
      container.querySelector<HTMLButtonElement>('[role="button"]')?.click()
    );

    const item =
      container.querySelector<HTMLButtonElement>('[role="menuitem"]');

    expect(item?.textContent).toContain('Custom edit');

    act(() => item?.click());

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(container.textContent).not.toContain('Custom edit');

    unmount();
  });

  it('renders compound loading and empty states through FlatList content', () => {
    const { container, rerender, unmount } = render(
      <Dropdown label='Actions' defaultOpen loading loadingText='Loading menu'>
        <Dropdown.Trigger>Actions</Dropdown.Trigger>
        <Dropdown.Content presentation='sheet'>
          <Dropdown.Item value='edit'>Edit</Dropdown.Item>
        </Dropdown.Content>
      </Dropdown>
    );

    expect(container.textContent).toContain('Loading menu');
    expect(container.textContent).not.toContain('Edit');

    rerender(
      <Dropdown label='Actions' defaultOpen>
        <Dropdown.Trigger>Actions</Dropdown.Trigger>
        <Dropdown.Content presentation='popover'>
          <Dropdown.Empty>No actions</Dropdown.Empty>
        </Dropdown.Content>
      </Dropdown>
    );

    expect(container.textContent).toContain('No actions');
    expect(container.querySelectorAll('[role="menuitem"]')).toHaveLength(0);

    unmount();
  });

  it('filters searchable menu content and renders empty text', () => {
    const onSearch = vi.fn();
    const { container, unmount } = render(
      <Dropdown
        label='Actions'
        searchable
        empty='Nothing matches'
        onSearch={onSearch}
      >
        <Dropdown.Trigger>Actions</Dropdown.Trigger>
        <Dropdown.Content presentation='modal'>
          <Dropdown.Item value='edit'>Edit profile</Dropdown.Item>
          <Dropdown.Item value='invite'>Invite member</Dropdown.Item>
          <Dropdown.Item value='delete'>Delete workspace</Dropdown.Item>
        </Dropdown.Content>
      </Dropdown>
    );

    const trigger =
      container.querySelector<HTMLButtonElement>('[role="button"]');

    act(() => trigger?.click());

    const searchInput = document.body.querySelector<HTMLInputElement>('input');

    expect(searchInput?.getAttribute('aria-label')).toBe('Search actions...');
    expect(container.textContent).toContain('Edit profile');
    expect(container.textContent).toContain('Invite member');

    act(() => {
      changeInputValue(searchInput, 'delete');
    });

    expect(onSearch).toHaveBeenCalledWith('delete');
    expect(container.textContent).not.toContain('Edit profile');
    expect(container.textContent).toContain('Delete workspace');

    act(() => {
      changeInputValue(searchInput, 'missing');
    });

    expect(container.textContent).toContain('Nothing matches');
    expect(container.querySelectorAll('[role="menuitem"]')).toHaveLength(0);

    unmount();
  });

  it('supports compound Search inside Content', () => {
    const { container, unmount } = render(
      <Dropdown label='Actions' defaultOpen empty='No command found'>
        <Dropdown.Trigger>Actions</Dropdown.Trigger>
        <Dropdown.Content presentation='modal'>
          <Dropdown.Search
            placeholder='Find command'
            accessibilityLabel='Find project command'
          />
          <Dropdown.Item value='settings'>Open settings</Dropdown.Item>
          <Dropdown.Item value='copy'>Copy link</Dropdown.Item>
        </Dropdown.Content>
      </Dropdown>
    );

    const searchInput = document.body.querySelector<HTMLInputElement>('input');

    expect(searchInput?.getAttribute('aria-label')).toBe(
      'Find project command'
    );
    expect(searchInput?.getAttribute('placeholder')).toBe('Find command');

    act(() => {
      changeInputValue(searchInput, 'copy');
    });

    expect(container.textContent).not.toContain('Open settings');
    expect(container.textContent).toContain('Copy link');

    unmount();
  });

  it('supports command mode on Content', () => {
    const { unmount } = render(
      <Dropdown label='Actions' defaultOpen>
        <Dropdown.Trigger>Actions</Dropdown.Trigger>
        <Dropdown.Content command>
          <Dropdown.Item value='rename'>Rename project</Dropdown.Item>
        </Dropdown.Content>
      </Dropdown>
    );

    expect(
      document.body.querySelector<HTMLInputElement>(
        'input[aria-label="Type a command..."]'
      )
    ).not.toBeNull();

    unmount();
  });

  it('supports explicit Portal structure', () => {
    const { container, unmount } = render(
      <Dropdown label='Actions' defaultOpen>
        <Dropdown.Trigger>Actions</Dropdown.Trigger>
        <Portal>
          <Dropdown.Content presentation='modal'>
            <Dropdown.Item value='archive'>Move to archive</Dropdown.Item>
          </Dropdown.Content>
        </Portal>
      </Dropdown>
    );

    expect(container.textContent).toContain('Move to archive');
    expect(container.querySelector('[role="menu"]')).not.toBeNull();

    unmount();
  });

  it('opens and selects an item', () => {
    const onSelect = vi.fn();
    const { container, unmount } = render(
      <Dropdown label='Actions'>
        {renderActionContent({ onEdit: () => onSelect('edit') })}
      </Dropdown>
    );

    const trigger =
      container.querySelector<HTMLButtonElement>('[role="button"]');
    act(() => trigger?.click());

    expect(container.textContent).toContain('Edit');

    const editItem = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent?.includes('Edit')
    );
    act(() => editItem?.click());

    expect(onSelect).toHaveBeenCalledWith('edit');

    unmount();
  });

  it('renders a text trigger safely', () => {
    const { container, unmount } = render(
      <Dropdown label='Actions' trigger='Actions'>
        {renderActionContent()}
      </Dropdown>
    );

    const trigger =
      container.querySelector<HTMLButtonElement>('[role="button"]');

    expect(trigger?.textContent).toContain('Actions');

    unmount();
  });

  it('wraps custom trigger prop content in an interactive trigger', () => {
    const { container, unmount } = render(
      <Dropdown label='Actions' trigger={<span>Custom trigger</span>}>
        {renderActionContent()}
      </Dropdown>
    );

    const trigger =
      container.querySelector<HTMLButtonElement>('[role="button"]');

    expect(trigger?.textContent).toContain('Custom trigger');

    act(() => trigger?.click());

    expect(container.textContent).toContain('Edit');

    unmount();
  });

  it('applies the configured trigger size', () => {
    const { container, unmount } = render(
      <Dropdown label='Actions' trigger='Actions' size='lg'>
        {renderActionContent()}
      </Dropdown>
    );

    const trigger =
      container.querySelector<HTMLButtonElement>('[role="button"]');

    expect(trigger?.style.minHeight).toBe('52px');

    unmount();
  });

  it('renders grouped menu content and ignores disabled item presses', () => {
    const onSelect = vi.fn();
    const { container, unmount } = render(
      <Dropdown label='Actions'>
        <Dropdown.Content>
          <Dropdown.Label>File</Dropdown.Label>
          <Dropdown.Item value='archive' disabled>
            Archive
          </Dropdown.Item>
          <Dropdown.Separator />
          <Dropdown.Item
            value='duplicate'
            textWrap='wrap'
            onSelect={() => onSelect('duplicate')}
          >
            Duplicate
          </Dropdown.Item>
        </Dropdown.Content>
      </Dropdown>
    );

    const trigger =
      container.querySelector<HTMLButtonElement>('[role="button"]');
    act(() => trigger?.click());

    expect(container.textContent).toContain('File');
    expect(container.textContent).toContain('Archive');
    expect(container.querySelector('[role="heading"]')?.textContent).toContain(
      'File'
    );

    const archiveItem = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent?.includes('Archive')
    );
    const duplicateItem = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent?.includes('Duplicate')
    );

    expect(archiveItem?.disabled).toBe(true);

    act(() => archiveItem?.click());
    expect(onSelect).not.toHaveBeenCalled();

    act(() => duplicateItem?.click());
    expect(onSelect).toHaveBeenCalledWith('duplicate');

    unmount();
  });

  it('does not open when disabled and closes from backdrop', () => {
    const { container, rerender, unmount } = render(
      <Dropdown disabled label='Actions'>
        {renderActionContent()}
      </Dropdown>
    );

    let trigger = container.querySelector<HTMLButtonElement>('[role="button"]');

    act(() => trigger?.click());

    expect(container.textContent).not.toContain('Edit');
    expect(trigger?.getAttribute('aria-expanded')).toBe('false');

    rerender(
      <Dropdown
        label='Actions'
        icon={<span data-testid='trigger-icon' />}
        showArrow={false}
      >
        {renderActionContent()}
      </Dropdown>
    );

    trigger = container.querySelector<HTMLButtonElement>('[role="button"]');
    expect(
      container.querySelector('[data-testid="trigger-icon"]')
    ).not.toBeNull();

    act(() => trigger?.click());
    expect(container.textContent).toContain('Edit');

    const closeButton = Array.from(container.querySelectorAll('button')).find(
      (button) => button.getAttribute('aria-label') === 'Close menu'
    );

    act(() => closeButton?.click());

    expect(container.textContent).not.toContain('Edit');

    unmount();
  });

  it('supports controlled open state and reports open changes', () => {
    const onOpenChange = vi.fn();
    const { container, rerender, unmount } = render(
      <Dropdown label='Actions' open={false} onOpenChange={onOpenChange}>
        {renderActionContent()}
      </Dropdown>
    );

    const trigger =
      container.querySelector<HTMLButtonElement>('[role="button"]');

    act(() => trigger?.click());

    expect(onOpenChange).toHaveBeenCalledWith(true);
    expect(container.textContent).not.toContain('Edit');

    rerender(
      <Dropdown label='Actions' open onOpenChange={onOpenChange}>
        {renderActionContent()}
      </Dropdown>
    );

    expect(container.textContent).toContain('Edit');

    const editItem = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent?.includes('Edit')
    );

    act(() => editItem?.click());

    expect(onOpenChange).toHaveBeenLastCalledWith(false);

    unmount();
  });

  it('passes accessibility label and hint to the trigger', () => {
    const { container, unmount } = render(
      <Dropdown
        label='Actions'
        accessibilityLabel='Project actions'
        accessibilityHint='Opens project action menu'
      >
        {renderActionContent()}
      </Dropdown>
    );

    const trigger =
      container.querySelector<HTMLButtonElement>('[role="button"]');

    expect(trigger?.getAttribute('aria-label')).toBe('Project actions');
    expect(trigger?.getAttribute('aria-description')).toBe(
      'Opens project action menu'
    );

    unmount();
  });

  it('labels the menu and falls back to item values for complex labels', () => {
    const { container, unmount } = render(
      <Dropdown
        label={<span>Actions</span>}
        accessibilityLabel='Project actions'
      >
        <Dropdown.Content>
          <Dropdown.Item value='copy-link'>
            <span data-testid='complex-label'>Copy link</span>
          </Dropdown.Item>
        </Dropdown.Content>
      </Dropdown>
    );

    const trigger =
      container.querySelector<HTMLButtonElement>('[role="button"]');
    act(() => trigger?.click());

    const menu = container.querySelector('[role="menu"]');
    const menuItem = container.querySelector('[role="menuitem"]');

    expect(menu?.getAttribute('aria-label')).toBe('Project actions');
    expect(menuItem?.getAttribute('aria-label')).toBe('copy-link');

    unmount();
  });

  it('renders repeated values with stable menuitem semantics', () => {
    const onSelect = vi.fn();
    const { container, unmount } = render(
      <Dropdown label='Actions'>
        <Dropdown.Content>
          <Dropdown.Item value='copy' onSelect={() => onSelect('copy')}>
            Copy link
          </Dropdown.Item>
          <Dropdown.Item value='copy' onSelect={() => onSelect('copy')}>
            Copy markdown
          </Dropdown.Item>
        </Dropdown.Content>
      </Dropdown>
    );

    const trigger =
      container.querySelector<HTMLButtonElement>('[role="button"]');
    act(() => trigger?.click());

    const menuItems = container.querySelectorAll('[role="menuitem"]');

    expect(menuItems).toHaveLength(2);
    expect(menuItems[0]?.textContent).toContain('Copy link');
    expect(menuItems[1]?.textContent).toContain('Copy markdown');

    act(() => (menuItems[1] as HTMLButtonElement | undefined)?.click());

    expect(onSelect).toHaveBeenCalledWith('copy');

    unmount();
  });

  it('maps textWrap values to native text truncation behavior', () => {
    const { container, unmount } = render(
      <Dropdown label='Actions'>
        <Dropdown.Content>
          <Dropdown.Item value='truncate'>Truncate label</Dropdown.Item>
          <Dropdown.Item value='nowrap' textWrap='nowrap'>
            No wrap label
          </Dropdown.Item>
          <Dropdown.Item value='wrap' textWrap='wrap'>
            Wrapped label
          </Dropdown.Item>
        </Dropdown.Content>
      </Dropdown>
    );

    const trigger =
      container.querySelector<HTMLButtonElement>('[role="button"]');
    act(() => trigger?.click());

    const truncateLabel = Array.from(container.querySelectorAll('span')).find(
      (element) => element.textContent === 'Truncate label'
    );
    const nowrapLabel = Array.from(container.querySelectorAll('span')).find(
      (element) => element.textContent === 'No wrap label'
    );
    const wrapLabel = Array.from(container.querySelectorAll('span')).find(
      (element) => element.textContent === 'Wrapped label'
    );

    expect(truncateLabel?.getAttribute('data-number-of-lines')).toBe('1');
    expect(truncateLabel?.getAttribute('data-ellipsize-mode')).toBe('tail');
    expect(nowrapLabel?.getAttribute('data-number-of-lines')).toBe('1');
    expect(nowrapLabel?.getAttribute('data-ellipsize-mode')).toBe('clip');
    expect(wrapLabel?.getAttribute('data-number-of-lines')).toBeNull();
    expect(wrapLabel?.getAttribute('data-ellipsize-mode')).toBe('clip');

    unmount();
  });

  it('supports empty items and content styles', () => {
    const { container, unmount } = render(
      <Dropdown
        label='Empty actions'
        contentStyle={{ borderTopLeftRadius: 24 }}
      >
        <Dropdown.Content />
      </Dropdown>
    );

    const trigger =
      container.querySelector<HTMLButtonElement>('[role="button"]');

    act(() => trigger?.click());

    const closeButton = Array.from(document.querySelectorAll('button')).find(
      (button) => button.getAttribute('aria-label') === 'Close menu'
    );
    const styledContent = Array.from(
      document.querySelectorAll<HTMLElement>('*')
    ).find((element) => element.style.borderTopLeftRadius === '24px');

    expect(closeButton).not.toBeNull();
    expect(document.querySelectorAll('[role="menuitem"]')).toHaveLength(0);
    expect(styledContent).not.toBeNull();

    unmount();
  });

  it('keeps disabled menus closed', () => {
    const onOpenChange = vi.fn();
    const { container, unmount } = render(
      <Dropdown disabled label='Disabled actions' onOpenChange={onOpenChange}>
        {renderActionContent()}
      </Dropdown>
    );

    const trigger =
      container.querySelector<HTMLButtonElement>('[role="button"]');

    act(() => trigger?.click());

    expect(container.textContent).not.toContain('Edit');
    expect(onOpenChange).not.toHaveBeenCalled();

    unmount();
  });

  it('colors item icons from dropdown item state tokens', () => {
    const Icon = ({ color }: { color?: string }) => (
      <span data-color={color} data-testid='item-icon' />
    );

    const { container, unmount } = render(
      <Dropdown label='Actions'>
        <Dropdown.Content>
          <Dropdown.Item value='edit' icon={<Icon />}>
            Edit
          </Dropdown.Item>
          <Dropdown.Item value='delete' color='danger' icon={<Icon />}>
            Delete
          </Dropdown.Item>
          <Dropdown.Item value='archive' disabled icon={<Icon />}>
            Archive
          </Dropdown.Item>
        </Dropdown.Content>
      </Dropdown>
    );

    const trigger =
      container.querySelector<HTMLButtonElement>('[role="button"]');
    act(() => trigger?.click());

    const icons = Array.from(
      container.querySelectorAll<HTMLElement>('[data-testid="item-icon"]')
    );

    expect(icons.map((icon) => icon.dataset.color)).toEqual([
      nativeThemes.light.components.dropdown.item.default.fg,
      nativeThemes.light.components.dropdown.item.danger.default.fg,
      nativeThemes.light.components.dropdown.item.disabled.fg,
    ]);

    unmount();
  });

  it('keeps item icons and labels in sync with pressed colors', () => {
    const Icon = ({ color }: { color?: string }) => (
      <span data-color={color} data-testid='item-icon' />
    );

    const { container, unmount } = render(
      <Dropdown label='Actions'>
        {renderActionContent({ editIcon: <Icon />, deleteIcon: <Icon /> })}
      </Dropdown>
    );

    const trigger =
      container.querySelector<HTMLButtonElement>('[role="button"]');
    act(() => trigger?.click());

    const editItem = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent?.includes('Edit')
    );
    const deleteItem = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent?.includes('Delete')
    );

    act(() => {
      pressNativeElement(editItem);
      pressNativeElement(deleteItem);
    });

    const [editIcon, deleteIcon] = Array.from(
      container.querySelectorAll<HTMLElement>('[data-testid="item-icon"]')
    );

    expect(editIcon?.dataset.color).toBe(
      nativeThemes.light.components.dropdown.primary.item.pressed.fg
    );
    expect(deleteIcon?.dataset.color).toBe(
      nativeThemes.light.components.dropdown.item.danger.default.fg
    );

    unmount();
  });

  it.each([
    ['dark', nativeThemes.dark.components.dropdown.item.default.fg],
    [
      'highContrast',
      nativeThemes.highContrast.components.dropdown.item.default.fg,
    ],
  ] as const)(
    'uses readable action icon colors in the %s theme',
    (themeName, expectedColor) => {
      const Icon = ({ color }: { color?: string }) => (
        <span data-color={color} data-testid='item-icon' />
      );

      const { container, unmount } = render(
        <ThemeProvider defaultTheme={themeName}>
          <Dropdown label='Actions'>
            <Dropdown.Content>
              <Dropdown.Item value='edit' icon={<Icon />}>
                Edit
              </Dropdown.Item>
            </Dropdown.Content>
          </Dropdown>
        </ThemeProvider>
      );

      const trigger =
        container.querySelector<HTMLButtonElement>('[role="button"]');
      act(() => trigger?.click());

      const icon = container.querySelector<HTMLElement>(
        '[data-testid="item-icon"]'
      );

      expect(icon?.dataset.color).toBe(expectedColor);

      unmount();
    }
  );

  it('uses the primary color palette for high contrast default trigger and content', () => {
    const Icon = ({ color }: { color?: string }) => (
      <span data-color={color} data-testid='trigger-icon' />
    );

    const { container, unmount } = render(
      <ThemeProvider defaultTheme='highContrast'>
        <Dropdown label='Actions' icon={<Icon />}>
          <Dropdown.Content>
            <Dropdown.Item value='edit'>Edit</Dropdown.Item>
          </Dropdown.Content>
        </Dropdown>
      </ThemeProvider>
    );

    const trigger =
      container.querySelector<HTMLButtonElement>('[role="button"]');
    const icon = container.querySelector<HTMLElement>(
      '[data-testid="trigger-icon"]'
    );

    expect(icon?.dataset.color).toBe(
      nativeThemes.highContrast.components.dropdown.primary.trigger.default.fg
    );

    act(() => trigger?.click());

    const menu = container.querySelector<HTMLElement>('[role="menu"]');

    expect(menu?.style.borderColor).toBe(
      toCssColor(
        nativeThemes.highContrast.components.dropdown.primary.content.border
      )
    );

    unmount();
  });

  it('uses the configured semantic color palette for trigger and content', () => {
    const Icon = ({ color }: { color?: string }) => (
      <span data-color={color} data-testid='colored-icon' />
    );

    const { container, unmount } = render(
      <Dropdown label='Actions' color='success' icon={<Icon />}>
        <Dropdown.Content>
          <Dropdown.Item value='edit'>Edit</Dropdown.Item>
        </Dropdown.Content>
      </Dropdown>
    );

    const trigger =
      container.querySelector<HTMLButtonElement>('[role="button"]');
    const triggerIcon = container.querySelector<HTMLElement>(
      '[data-testid="colored-icon"]'
    );

    expect(triggerIcon?.dataset.color).toBe(
      nativeThemes.light.components.dropdown.success.trigger.default.fg
    );

    act(() => trigger?.click());

    const menu = container.querySelector<HTMLElement>('[role="menu"]');

    expect(menu?.style.borderColor).toBe(
      toCssColor(nativeThemes.light.components.dropdown.success.content.border)
    );

    unmount();
  });

  it('integrates an injected blur-like background with the anchored popover without changing item actions', () => {
    const onEdit = vi.fn();
    const { container, unmount } = render(
      <Dropdown
        defaultOpen
        presentation='popover'
        contentStyle={{
          width: 216,
          borderRadius: 22,
        }}
        popoverBackground={
          <Text testID='native-blur-background'>Blur material</Text>
        }
      >
        <Dropdown.Trigger>Actions</Dropdown.Trigger>
        <Dropdown.Content>
          <Dropdown.Item value='edit' onSelect={onEdit}>
            Edit
          </Dropdown.Item>
        </Dropdown.Content>
      </Dropdown>
    );

    const menu = container.querySelector<HTMLElement>('[role="menu"]');
    const material = document.querySelector(
      '[data-testid="native-blur-background"]'
    );
    const edit = document.querySelector<HTMLElement>('[role="menuitem"]');

    expect(menu).not.toBeNull();
    expect(menu?.style.overflow).toBe('visible');
    expect(menu?.style.backgroundColor).toBe('transparent');
    expect(menu?.style.width).toBe('216px');
    expect(material).not.toBeNull();
    expect(menu?.contains(material)).toBe(true);
    expect(edit?.textContent).toContain('Edit');

    act(() => edit?.click());
    expect(onEdit).toHaveBeenCalledTimes(1);

    unmount();
  });

  it('positions popover content using FloatingManager', () => {
    const updatePosition = vi.fn();
    const onFloatingLayout = vi.fn();

    vi.spyOn(managers, 'useNativeFloatingPosition').mockReturnValue({
      isPositioned: true,
      position: {
        top: 120,
        left: 80,
      },
      arrowPosition: {},
      placement: 'bottom-start',
      updatePosition,
      onFloatingLayout,
    });

    const { container, unmount } = render(
      <Dropdown defaultOpen presentation='popover'>
        <Dropdown.Trigger>Actions</Dropdown.Trigger>
        <Dropdown.Content>
          <Dropdown.Item value='edit'>Edit</Dropdown.Item>
        </Dropdown.Content>
      </Dropdown>
    );

    const menu = container.querySelector<HTMLElement>('[role="menu"]');

    expect(menu?.style.position).toBe('absolute');
    expect(menu?.style.top).toBe('120px');
    expect(menu?.style.left).toBe('80px');

    expect(updatePosition).toHaveBeenCalled();

    unmount();
  });
});
