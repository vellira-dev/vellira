import { act, memo } from 'react';

import { expectNoA11yViolations } from '@test-utils/a11y';
import { render } from '@test-utils/render';
import { waitFor } from '@testing-library/react';
import { copyCompoundSlotMetadata } from '@vellira-ui/core';
import type { ComponentProps } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Dropdown } from './Dropdown';

import contentStyles from './Content/DropdownContent.module.scss';
import itemStyles from './Item/DropdownItem.module.scss';
import triggerStyles from './Trigger/DropdownTrigger.module.scss';

import { Button } from '#primitives/Button';
import { Portal } from '#primitives/Portal';

function pressKey(target: EventTarget, key: string) {
  act(() => {
    target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
  });
}

function renderActions(props: Partial<ComponentProps<typeof Dropdown>> = {}) {
  const onEdit = vi.fn();
  const onDelete = vi.fn();
  const result = render(
    <Dropdown {...props}>
      <Dropdown.Trigger>Actions</Dropdown.Trigger>
      <Dropdown.Content>
        <Dropdown.Item onSelect={onEdit}>Edit</Dropdown.Item>
        <Dropdown.Item disabled>Archive</Dropdown.Item>
        <Dropdown.Separator />
        <Dropdown.Item color='danger' onSelect={onDelete}>
          Delete
        </Dropdown.Item>
      </Dropdown.Content>
    </Dropdown>
  );

  return { ...result, onDelete, onEdit };
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('Dropdown', () => {
  it('opens menu and selects an enabled action item', () => {
    const { container, onEdit, unmount } = renderActions();
    const trigger = container.querySelector<HTMLButtonElement>('button');

    act(() => trigger?.click());

    expect(trigger?.getAttribute('aria-haspopup')).toBe('menu');
    expect(trigger?.getAttribute('aria-expanded')).toBe('true');
    expect(document.querySelector('[role="menu"]')).not.toBeNull();
    expect(
      document.querySelector<HTMLElement>('[role="menu"]')?.style.zIndex
    ).toBe('100');
    expect(document.querySelector('[role="option"]')).toBeNull();

    act(() => {
      Array.from(document.querySelectorAll<HTMLElement>('[role="menuitem"]'))
        .find((item) => item.textContent?.includes('Archive'))
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(onEdit).not.toHaveBeenCalled();
    expect(document.querySelector('[role="menu"]')).not.toBeNull();

    act(() => {
      document
        .querySelector<HTMLElement>('[role="menuitem"]')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(document.querySelector('[role="menu"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);

    unmount();
  });

  it('locks body scroll for modal menus and restores focus on Escape', () => {
    const { container, unmount } = render(
      <Dropdown modal>
        <Dropdown.Trigger>Actions</Dropdown.Trigger>
        <Dropdown.Content>
          <Dropdown.Item>Edit</Dropdown.Item>
        </Dropdown.Content>
      </Dropdown>
    );
    const trigger = container.querySelector<HTMLButtonElement>('button');

    pressKey(trigger!, 'Enter');

    const menu = document.querySelector<HTMLElement>('[role="menu"]');

    expect(document.body.style.overflow).toBe('hidden');

    pressKey(menu!, 'Escape');

    expect(document.body.style.overflow).toBe('');
    expect(document.activeElement).toBe(trigger);

    unmount();
  });

  it('recognizes wrapped compound slots', () => {
    const MemoTrigger = memo(Dropdown.Trigger);
    const MemoContent = memo(Dropdown.Content);
    const MemoItem = memo(Dropdown.Item);
    const MemoItemDescription = memo(Dropdown.ItemDescription);

    const { container, unmount } = render(
      <Dropdown>
        <MemoTrigger>Actions</MemoTrigger>
        <MemoContent>
          <MemoItem>
            Edit
            <MemoItemDescription>Update workspace details</MemoItemDescription>
          </MemoItem>
        </MemoContent>
      </Dropdown>
    );

    act(() => container.querySelector<HTMLButtonElement>('button')?.click());

    expect(document.querySelector('[role="menu"]')).not.toBeNull();
    expect(document.querySelector('[role="menuitem"]')?.textContent).toContain(
      'Edit'
    );
    expect(document.querySelector('[role="menuitem"]')?.textContent).toContain(
      'Update workspace details'
    );

    unmount();
  });

  it('recognizes copied compound slot metadata on wrapper components', () => {
    const WrappedItem = copyCompoundSlotMetadata(
      Dropdown.Item,
      (props: ComponentProps<typeof Dropdown.Item>) => (
        <Dropdown.Item {...props} />
      )
    );
    const WrappedDescription = copyCompoundSlotMetadata(
      Dropdown.ItemDescription,
      (props: ComponentProps<typeof Dropdown.ItemDescription>) => (
        <Dropdown.ItemDescription {...props} />
      )
    );

    const { container, unmount } = render(
      <Dropdown>
        <Dropdown.Trigger>Actions</Dropdown.Trigger>
        <Dropdown.Content>
          <WrappedItem>
            Edit
            <WrappedDescription>Update workspace details</WrappedDescription>
          </WrappedItem>
        </Dropdown.Content>
      </Dropdown>
    );

    act(() => container.querySelector<HTMLButtonElement>('button')?.click());

    expect(document.querySelector('[role="menuitem"]')?.textContent).toContain(
      'Edit'
    );
    expect(document.querySelector('[role="menuitem"]')?.textContent).toContain(
      'Update workspace details'
    );

    unmount();
  });

  it('opens and selects the active item from keyboard', async () => {
    const { container, onDelete, unmount } = renderActions();
    const trigger = container.querySelector<HTMLButtonElement>('button');

    pressKey(trigger!, 'Enter');

    const menu = document.querySelector<HTMLElement>('[role="menu"]');

    await expectNoA11yViolations(document.body);

    expect(document.activeElement).toBe(menu);
    expect(menu?.getAttribute('aria-activedescendant')).toBe(
      `${menu?.id}-item-0`
    );

    pressKey(menu!, 'ArrowDown');

    expect(menu?.getAttribute('aria-activedescendant')).toBe(
      `${menu?.id}-item-2`
    );

    pressKey(menu!, 'Enter');

    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(trigger?.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(trigger);

    unmount();
  });

  it('keeps the menu open when onSelect prevents default', () => {
    const onSelect = vi.fn((event) => event.preventDefault());
    const { container, unmount } = render(
      <Dropdown>
        <Dropdown.Trigger>Actions</Dropdown.Trigger>
        <Dropdown.Content>
          <Dropdown.Item onSelect={onSelect}>Advanced</Dropdown.Item>
        </Dropdown.Content>
      </Dropdown>
    );
    const trigger = container.querySelector<HTMLButtonElement>('button');

    act(() => trigger?.click());
    act(() => {
      document
        .querySelector<HTMLElement>('[role="menuitem"]')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(document.querySelector('[role="menu"]')).not.toBeNull();

    unmount();
  });

  it('supports Item asChild and respects child preventDefault', () => {
    const onEdit = vi.fn();
    const onArchive = vi.fn();
    const childClick = vi.fn();
    const { container, unmount } = render(
      <Dropdown>
        <Dropdown.Trigger>Actions</Dropdown.Trigger>
        <Dropdown.Content>
          <Dropdown.Item asChild onSelect={onEdit}>
            <button type='button' data-testid='edit-action'>
              Custom edit
            </button>
          </Dropdown.Item>
          <Dropdown.Item asChild onSelect={onArchive}>
            <button
              type='button'
              data-testid='archive-action'
              onClick={(event) => {
                childClick();
                event.preventDefault();
              }}
            >
              Custom archive
            </button>
          </Dropdown.Item>
        </Dropdown.Content>
      </Dropdown>
    );
    const trigger = container.querySelector<HTMLButtonElement>('button');

    act(() => trigger?.click());

    const edit = document.querySelector<HTMLButtonElement>(
      '[data-testid="edit-action"]'
    );
    const archive = document.querySelector<HTMLButtonElement>(
      '[data-testid="archive-action"]'
    );

    expect(edit?.getAttribute('role')).toBe('menuitem');
    expect(edit?.tabIndex).toBe(0);

    act(() => {
      archive?.click();
    });

    expect(childClick).toHaveBeenCalledTimes(1);
    expect(onArchive).not.toHaveBeenCalled();
    expect(document.querySelector('[role="menu"]')).not.toBeNull();

    act(() => {
      edit?.click();
    });

    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(document.querySelector('[role="menu"]')).toBeNull();

    unmount();
  });

  it('supports Trigger asChild without rendering an extra button', () => {
    const { container, unmount } = render(
      <Dropdown>
        <Dropdown.Trigger asChild>
          <Button appearance='outline' color='neutral'>
            Actions
          </Button>
        </Dropdown.Trigger>
        <Dropdown.Content>
          <Dropdown.Item>Edit</Dropdown.Item>
        </Dropdown.Content>
      </Dropdown>
    );

    expect(container.querySelectorAll('button')).toHaveLength(1);

    act(() => {
      container.querySelector('button')?.click();
    });

    expect(document.querySelector('[role="menu"]')).not.toBeNull();

    unmount();
  });

  it('supports link items and secures blank targets', () => {
    const { container, unmount } = render(
      <Dropdown>
        <Dropdown.Trigger>Actions</Dropdown.Trigger>
        <Dropdown.Content>
          <Dropdown.Item href='/settings' target='_blank'>
            Settings
          </Dropdown.Item>
          <Dropdown.Item href='/disabled' disabled>
            Disabled link
          </Dropdown.Item>
        </Dropdown.Content>
      </Dropdown>
    );

    act(() => {
      container.querySelector('button')?.click();
    });

    const links =
      document.querySelectorAll<HTMLAnchorElement>('a[role="menuitem"]');

    expect(links[0]?.getAttribute('href')).toBe('/settings');
    expect(links[0]?.getAttribute('rel')).toBe('noreferrer noopener');
    expect(links[1]?.hasAttribute('href')).toBe(false);
    expect(links[1]?.getAttribute('aria-disabled')).toBe('true');

    unmount();
  });

  it('supports checkbox and radio action items', () => {
    const onCheckedChange = vi.fn();
    const onValueChange = vi.fn();
    const { container, unmount } = render(
      <Dropdown closeOnSelect={false}>
        <Dropdown.Trigger>Actions</Dropdown.Trigger>
        <Dropdown.Content>
          <Dropdown.CheckboxItem
            defaultChecked
            onCheckedChange={onCheckedChange}
          >
            Show grid
          </Dropdown.CheckboxItem>
          <Dropdown.RadioGroup
            defaultValue='light'
            onValueChange={onValueChange}
          >
            <Dropdown.RadioItem value='light'>Light</Dropdown.RadioItem>
            <Dropdown.RadioItem value='dark'>Dark</Dropdown.RadioItem>
          </Dropdown.RadioGroup>
        </Dropdown.Content>
      </Dropdown>
    );

    act(() => {
      container.querySelector('button')?.click();
    });

    const checkbox = document.querySelector<HTMLElement>(
      '[role="menuitemcheckbox"]'
    );
    const radios = document.querySelectorAll<HTMLElement>(
      '[role="menuitemradio"]'
    );

    expect(checkbox?.getAttribute('aria-checked')).toBe('true');
    expect(radios[0]?.getAttribute('aria-checked')).toBe('true');

    act(() => checkbox?.click());
    act(() => radios[1]?.click());

    expect(onCheckedChange).toHaveBeenCalledWith(false);
    expect(onValueChange).toHaveBeenCalledWith('dark');
    expect(document.querySelector('[role="menu"]')).not.toBeNull();

    unmount();
  });

  it('supports controlled radio groups', () => {
    const onValueChange = vi.fn();
    const { container, unmount } = render(
      <Dropdown closeOnSelect={false}>
        <Dropdown.Trigger>Actions</Dropdown.Trigger>
        <Dropdown.Content>
          <Dropdown.RadioGroup value='dark' onValueChange={onValueChange}>
            <Dropdown.RadioItem value='light'>Light</Dropdown.RadioItem>
            <Dropdown.RadioItem value='dark'>Dark</Dropdown.RadioItem>
          </Dropdown.RadioGroup>
        </Dropdown.Content>
      </Dropdown>
    );

    act(() => {
      container.querySelector('button')?.click();
    });

    const radios = document.querySelectorAll<HTMLElement>(
      '[role="menuitemradio"]'
    );

    expect(radios[0]?.getAttribute('aria-checked')).toBe('false');
    expect(radios[1]?.getAttribute('aria-checked')).toBe('true');

    act(() => radios[0]?.click());

    expect(onValueChange).toHaveBeenCalledWith('light');

    unmount();
  });

  it('renders groups, labels, separators, metadata, empty, and loading states', () => {
    const { container, rerender, unmount } = render(
      <Dropdown defaultOpen>
        <Dropdown.Trigger>Actions</Dropdown.Trigger>
        <Dropdown.Content>
          <Dropdown.Group>
            <Dropdown.Label>Project</Dropdown.Label>
            <Dropdown.Item
              icon={<span data-testid='icon' />}
              description='Change details'
              badge='New'
              shortcut='⌘E'
            >
              Edit
            </Dropdown.Item>
          </Dropdown.Group>
          <Dropdown.Separator />
        </Dropdown.Content>
      </Dropdown>
    );

    expect(document.body.textContent).toContain('Project');
    expect(document.body.textContent).toContain('Change details');
    expect(document.body.textContent).toContain('New');
    expect(document.body.textContent).toContain('⌘E');
    expect(document.querySelector('[data-testid="icon"]')).not.toBeNull();
    expect(document.querySelector('[role="separator"]')).not.toBeNull();

    rerender(
      <Dropdown defaultOpen>
        <Dropdown.Trigger>Actions</Dropdown.Trigger>
        <Dropdown.Content>
          <Dropdown.Empty>No actions</Dropdown.Empty>
        </Dropdown.Content>
      </Dropdown>
    );

    expect(document.body.textContent).toContain('No actions');

    rerender(
      <Dropdown defaultOpen loading loadingText='Loading actions'>
        <Dropdown.Trigger>Actions</Dropdown.Trigger>
        <Dropdown.Content />
      </Dropdown>
    );

    expect(document.body.textContent).toContain('Loading actions');
    expect(container.querySelector('button')).not.toBeNull();

    unmount();
  });

  it('supports controlled open state, disabled root, and className', () => {
    const onOpenChange = vi.fn();
    const { container, rerender, unmount } = render(
      <Dropdown open={false} onOpenChange={onOpenChange} className='root-test'>
        <Dropdown.Trigger>Actions</Dropdown.Trigger>
        <Dropdown.Content>
          <Dropdown.Item>Edit</Dropdown.Item>
        </Dropdown.Content>
      </Dropdown>
    );

    act(() => {
      container.querySelector('button')?.click();
    });

    expect(onOpenChange).toHaveBeenCalledWith(true);
    expect(document.querySelector('[role="menu"]')).toBeNull();
    expect(container.querySelector('.root-test')).not.toBeNull();

    rerender(
      <Dropdown disabled>
        <Dropdown.Trigger>Actions</Dropdown.Trigger>
        <Dropdown.Content>
          <Dropdown.Item>Edit</Dropdown.Item>
        </Dropdown.Content>
      </Dropdown>
    );

    act(() => {
      container.querySelector('button')?.click();
    });

    expect(document.querySelector('[role="menu"]')).toBeNull();

    unmount();
  });

  it('applies content className and style from the compound slot', () => {
    const { container, unmount } = render(
      <Dropdown>
        <Dropdown.Trigger>Actions</Dropdown.Trigger>
        <Dropdown.Content className='content-test' style={{ width: 321 }}>
          <Dropdown.Item>Edit</Dropdown.Item>
        </Dropdown.Content>
      </Dropdown>
    );

    act(() => {
      container.querySelector('button')?.click();
    });

    const menu = document.querySelector<HTMLElement>('[role="menu"]');

    expect(menu?.className).toContain('content-test');
    expect(menu?.style.width).toBe('321px');

    unmount();
  });

  it('applies semantic color token classes to trigger, content, and items', () => {
    const { container, unmount } = render(
      <Dropdown defaultOpen color='success'>
        <Dropdown.Trigger>Actions</Dropdown.Trigger>
        <Dropdown.Content>
          <Dropdown.Item color='success'>Edit</Dropdown.Item>
        </Dropdown.Content>
      </Dropdown>
    );

    const trigger = container.querySelector<HTMLButtonElement>('button');
    const menu = document.querySelector<HTMLElement>('[role="menu"]');
    const item = document.querySelector<HTMLElement>('[role="menuitem"]');

    expect(trigger?.className).toContain(triggerStyles.success);
    expect(menu?.className).toContain(contentStyles.success);
    expect(menu?.dataset.color).toBe('success');
    expect(item?.className).toContain(itemStyles.success);

    unmount();
  });

  it('supports item-level close behavior overrides', () => {
    const onPersist = vi.fn();
    const onClose = vi.fn();
    const { container, unmount } = render(
      <Dropdown>
        <Dropdown.Trigger>Actions</Dropdown.Trigger>
        <Dropdown.Content>
          <Dropdown.Item closeOnSelect={false} onSelect={onPersist}>
            Keep open
          </Dropdown.Item>
          <Dropdown.Item onSelect={onClose}>Close</Dropdown.Item>
        </Dropdown.Content>
      </Dropdown>
    );

    act(() => {
      container.querySelector('button')?.click();
    });

    const items = document.querySelectorAll<HTMLElement>('[role="menuitem"]');

    act(() => items[0]?.click());

    expect(onPersist).toHaveBeenCalledTimes(1);
    expect(document.querySelector('[role="menu"]')).not.toBeNull();

    act(() => items[1]?.click());

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(document.querySelector('[role="menu"]')).toBeNull();

    unmount();
  });

  it('opens submenu from keyboard and returns with ArrowLeft', () => {
    const onEmail = vi.fn();
    const { container, unmount } = render(
      <Dropdown>
        <Dropdown.Trigger>Actions</Dropdown.Trigger>
        <Dropdown.Content>
          <Dropdown.Sub>
            <Dropdown.SubTrigger>Share</Dropdown.SubTrigger>
            <Dropdown.SubContent>
              <Dropdown.Item onSelect={onEmail}>Email</Dropdown.Item>
              <Dropdown.Item>Copy link</Dropdown.Item>
            </Dropdown.SubContent>
          </Dropdown.Sub>
        </Dropdown.Content>
      </Dropdown>
    );

    const trigger = container.querySelector<HTMLButtonElement>('button');
    pressKey(trigger!, 'Enter');

    const menu = document.querySelector<HTMLElement>('[role="menu"]');
    const subTrigger = document.querySelector<HTMLElement>('[role="menuitem"]');

    expect(subTrigger?.getAttribute('aria-haspopup')).toBe('menu');
    expect(subTrigger?.getAttribute('aria-expanded')).toBe('false');

    pressKey(menu!, 'ArrowRight');

    const menus = document.querySelectorAll('[role="menu"]');

    expect(menus).toHaveLength(2);
    expect(subTrigger?.getAttribute('aria-expanded')).toBe('true');
    expect(document.body.textContent).toContain('Email');

    pressKey(menu!, 'ArrowLeft');

    expect(document.querySelectorAll('[role="menu"]')).toHaveLength(1);

    pressKey(menu!, 'ArrowRight');

    const email = Array.from(
      document.querySelectorAll<HTMLElement>('[role="menuitem"]')
    ).find((item) => item.textContent?.includes('Email'));

    act(() => email?.click());

    expect(onEmail).toHaveBeenCalledTimes(1);
    expect(document.querySelector('[role="menu"]')).toBeNull();

    unmount();
  });

  it('opens submenu from click and cancels delayed hover opening on leave', () => {
    vi.useFakeTimers();

    const { container, unmount } = render(
      <Dropdown>
        <Dropdown.Trigger>Actions</Dropdown.Trigger>
        <Dropdown.Content>
          <Dropdown.Sub>
            <Dropdown.SubTrigger>Export</Dropdown.SubTrigger>
            <Dropdown.SubContent>
              <Dropdown.Item>Export as PDF</Dropdown.Item>
            </Dropdown.SubContent>
          </Dropdown.Sub>
          <Dropdown.Item>Rename</Dropdown.Item>
        </Dropdown.Content>
      </Dropdown>
    );

    act(() => {
      container.querySelector('button')?.click();
    });

    const subTrigger = document.querySelector<HTMLElement>('[role="menuitem"]');

    act(() => {
      subTrigger?.dispatchEvent(
        new MouseEvent('mouseover', {
          bubbles: true,
          relatedTarget: document.body,
        })
      );
      subTrigger?.dispatchEvent(
        new MouseEvent('mouseout', {
          bubbles: true,
          relatedTarget: document.body,
        })
      );
      vi.advanceTimersByTime(120);
    });

    expect(document.querySelectorAll('[role="menu"]')).toHaveLength(1);

    act(() => subTrigger?.click());

    expect(document.querySelectorAll('[role="menu"]')).toHaveLength(2);

    unmount();
    vi.useRealTimers();
  });

  it('opens rich submenu from hover and renders submenu structure', () => {
    vi.useFakeTimers();

    const onCheckedChange = vi.fn();
    const onValueChange = vi.fn();
    const { container, unmount } = render(
      <Dropdown closeOnSelect={false}>
        <Dropdown.Trigger>Actions</Dropdown.Trigger>
        <Dropdown.Content>
          <Dropdown.Sub>
            <Dropdown.SubTrigger>
              <Dropdown.ItemIcon>
                <span data-testid='share-icon' />
              </Dropdown.ItemIcon>
              Share
              <Dropdown.ItemShortcut>⌘S</Dropdown.ItemShortcut>
            </Dropdown.SubTrigger>
            <Dropdown.SubContent>
              <Dropdown.Label>Share via</Dropdown.Label>
              <Dropdown.Separator />
              <Dropdown.Item>
                <Dropdown.ItemIcon>
                  <span data-testid='email-icon' />
                </Dropdown.ItemIcon>
                Email
                <Dropdown.ItemDescription>
                  Send an invitation
                </Dropdown.ItemDescription>
                <Dropdown.ItemBadge>New</Dropdown.ItemBadge>
                <Dropdown.ItemShortcut>⌘E</Dropdown.ItemShortcut>
              </Dropdown.Item>
              <Dropdown.CheckboxItem
                defaultChecked
                onCheckedChange={onCheckedChange}
              >
                Include notes
              </Dropdown.CheckboxItem>
              <Dropdown.RadioGroup
                defaultValue='public'
                onValueChange={onValueChange}
              >
                <Dropdown.RadioItem value='private'>Private</Dropdown.RadioItem>
                <Dropdown.RadioItem value='public'>Public</Dropdown.RadioItem>
              </Dropdown.RadioGroup>
            </Dropdown.SubContent>
          </Dropdown.Sub>
        </Dropdown.Content>
      </Dropdown>
    );

    act(() => {
      container.querySelector('button')?.click();
    });

    const subTrigger = document.querySelector<HTMLElement>('[role="menuitem"]');

    act(() => {
      subTrigger?.dispatchEvent(
        new MouseEvent('mouseover', {
          bubbles: true,
          relatedTarget: document.body,
        })
      );
      vi.advanceTimersByTime(120);
    });

    expect(document.querySelectorAll('[role="menu"]')).toHaveLength(2);
    expect(document.body.textContent).toContain('Share via');
    expect(document.body.textContent).toContain('Email');
    expect(document.body.textContent).toContain('Send an invitation');
    expect(document.body.textContent).toContain('New');
    expect(document.body.textContent).toContain('⌘E');
    expect(document.querySelector('[data-testid="email-icon"]')).not.toBeNull();
    expect(document.querySelectorAll('[role="separator"]')).toHaveLength(1);

    const checkbox = document.querySelector<HTMLElement>(
      '[role="menuitemcheckbox"]'
    );
    const radios = document.querySelectorAll<HTMLElement>(
      '[role="menuitemradio"]'
    );

    expect(checkbox?.getAttribute('aria-checked')).toBe('true');
    expect(radios[1]?.getAttribute('aria-checked')).toBe('true');

    act(() => checkbox?.click());
    act(() => radios[0]?.click());

    expect(onCheckedChange).toHaveBeenCalledWith(false);
    expect(onValueChange).toHaveBeenCalledWith('private');

    const subMenu = document.querySelectorAll<HTMLElement>('[role="menu"]')[1];

    act(() => {
      subMenu?.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    });

    expect(document.querySelectorAll('[role="menu"]')).toHaveLength(2);

    unmount();
    vi.useRealTimers();
  });

  it('prevents disabled submenu item selection', () => {
    vi.useFakeTimers();

    const onSelect = vi.fn();
    const { container, unmount } = render(
      <Dropdown>
        <Dropdown.Trigger>Actions</Dropdown.Trigger>
        <Dropdown.Content>
          <Dropdown.Sub>
            <Dropdown.SubTrigger>Export</Dropdown.SubTrigger>
            <Dropdown.SubContent>
              <Dropdown.Item disabled onSelect={onSelect}>
                Export disabled
              </Dropdown.Item>
            </Dropdown.SubContent>
          </Dropdown.Sub>
        </Dropdown.Content>
      </Dropdown>
    );

    act(() => {
      container.querySelector('button')?.click();
    });

    const subTrigger = document.querySelector<HTMLElement>('[role="menuitem"]');

    act(() => {
      subTrigger?.dispatchEvent(
        new MouseEvent('mouseover', {
          bubbles: true,
          relatedTarget: document.body,
        })
      );
      vi.advanceTimersByTime(120);
    });

    const disabledItem = Array.from(
      document.querySelectorAll<HTMLElement>('[role="menuitem"]')
    ).find((item) => item.textContent?.includes('Export disabled'));
    const clickEvent = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
    });

    act(() => {
      disabledItem?.dispatchEvent(clickEvent);
    });

    expect(clickEvent.defaultPrevented).toBe(true);
    expect(onSelect).not.toHaveBeenCalled();
    expect(document.querySelectorAll('[role="menu"]')).toHaveLength(2);

    unmount();
    vi.useRealTimers();
  });

  it('filters searchable menu items and renders empty text', () => {
    const onSearch = vi.fn();
    const { container, unmount } = render(
      <Dropdown searchable empty='Nothing matches' onSearch={onSearch}>
        <Dropdown.Trigger>Actions</Dropdown.Trigger>
        <Dropdown.Content>
          <Dropdown.Item>Edit profile</Dropdown.Item>
          <Dropdown.Item>Invite member</Dropdown.Item>
          <Dropdown.Item>Delete workspace</Dropdown.Item>
        </Dropdown.Content>
      </Dropdown>
    );

    act(() => {
      container.querySelector('button')?.click();
    });

    const search = document.querySelector<HTMLInputElement>(
      'input[aria-label="Search actions..."]'
    );

    expect(search).not.toBeNull();
    expect(document.body.textContent).toContain('Edit profile');
    expect(document.body.textContent).toContain('Invite member');

    act(() => {
      search!.value = 'delete';
      search!.dispatchEvent(new Event('input', { bubbles: true }));
      search!.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(onSearch).toHaveBeenCalledWith('delete');
    expect(document.body.textContent).not.toContain('Edit profile');
    expect(document.body.textContent).toContain('Delete workspace');

    act(() => {
      search!.value = 'missing';
      search!.dispatchEvent(new Event('input', { bubbles: true }));
      search!.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(document.body.textContent).toContain('Nothing matches');
    expect(document.querySelector('[aria-activedescendant]')).toBeNull();

    unmount();
  });

  it('supports compound Search inside Content', () => {
    const { unmount } = render(
      <Dropdown defaultOpen empty='No command found'>
        <Dropdown.Trigger>Actions</Dropdown.Trigger>
        <Dropdown.Content>
          <Dropdown.Search
            placeholder='Find command'
            aria-label='Find project command'
          />
          <Dropdown.Item>Open settings</Dropdown.Item>
          <Dropdown.Item>Copy link</Dropdown.Item>
        </Dropdown.Content>
      </Dropdown>
    );

    const search = document.querySelector<HTMLInputElement>(
      'input[aria-label="Find project command"]'
    );

    expect(search?.getAttribute('placeholder')).toBe('Find command');
    expect(document.body.textContent).toContain('Open settings');

    act(() => {
      search!.value = 'copy';
      search!.dispatchEvent(new Event('input', { bubbles: true }));
    });

    expect(document.body.textContent).not.toContain('Open settings');
    expect(document.body.textContent).toContain('Copy link');

    unmount();
  });

  it('supports explicit Portal and item slots', () => {
    const { container, unmount } = render(
      <Dropdown defaultOpen>
        <Dropdown.Trigger>Actions</Dropdown.Trigger>
        <Portal>
          <Dropdown.Content>
            <Dropdown.Arrow className='dropdown-arrow' />
            <Dropdown.Item>
              <Dropdown.ItemIcon>
                <span data-testid='copy-icon' />
              </Dropdown.ItemIcon>
              Copy
              <Dropdown.ItemDescription>
                Copy current selection
              </Dropdown.ItemDescription>
              <Dropdown.ItemBadge>New</Dropdown.ItemBadge>
              <Dropdown.ItemShortcut>⌘C</Dropdown.ItemShortcut>
            </Dropdown.Item>
          </Dropdown.Content>
        </Portal>
      </Dropdown>
    );

    expect(container.querySelector('[role="menu"]')).toBeNull();
    expect(document.querySelector('[role="menu"]')).not.toBeNull();
    expect(document.body.textContent).toContain('Copy current selection');
    expect(document.body.textContent).toContain('New');
    expect(document.body.textContent).toContain('⌘C');
    expect(document.querySelector('.dropdown-arrow')).not.toBeNull();

    unmount();
  });

  it('supports explicit Portal container', async () => {
    const portalContainer = document.createElement('div');

    document.body.appendChild(portalContainer);

    const { unmount } = render(
      <Dropdown defaultOpen>
        <Dropdown.Trigger>Actions</Dropdown.Trigger>
        <Portal container={portalContainer}>
          <Dropdown.Content>
            <Dropdown.Item>Move to archive</Dropdown.Item>
          </Dropdown.Content>
        </Portal>
      </Dropdown>
    );

    await waitFor(() => {
      expect(portalContainer.querySelector('[role="menu"]')).not.toBeNull();
    });

    expect(portalContainer.textContent).toContain('Move to archive');

    unmount();
    portalContainer.remove();
  });

  it('supports command mode on Content', () => {
    const { unmount } = render(
      <Dropdown defaultOpen>
        <Dropdown.Trigger>Actions</Dropdown.Trigger>
        <Dropdown.Content command>
          <Dropdown.Item>Rename project</Dropdown.Item>
        </Dropdown.Content>
      </Dropdown>
    );

    expect(
      document.querySelector<HTMLInputElement>(
        'input[aria-label="Type a command..."]'
      )
    ).not.toBeNull();

    unmount();
  });
});
