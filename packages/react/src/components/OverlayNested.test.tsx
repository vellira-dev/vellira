import { act } from 'react';

import { render } from '@test-utils/render';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Dropdown } from './Dropdown';
import { Modal } from './Modal';
import { Popover } from './Popover';
import { Select } from './Select';
import { Tooltip } from './Tooltip';

import { Portal } from '#primitives';

function pressDocumentKey(key: string) {
  act(() => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key }));
  });
}

afterEach(() => {
  document.body.innerHTML = '';
  document.body.style.overflow = '';
  vi.useRealTimers();
});

describe('nested overlays', () => {
  it('closes only a dropdown nested in a modal on Escape', () => {
    const onModalOpenChange = vi.fn();
    const onDropdownOpenChange = vi.fn();

    const { unmount } = render(
      <Modal open onOpenChange={onModalOpenChange}>
        <Portal>
          <Modal.Overlay />
          <Modal.Content ariaLabel='Account settings'>
            <Dropdown open onOpenChange={onDropdownOpenChange}>
              <Dropdown.Trigger>Actions</Dropdown.Trigger>
              <Dropdown.Content>
                <Dropdown.Item>Edit</Dropdown.Item>
              </Dropdown.Content>
            </Dropdown>
          </Modal.Content>
        </Portal>
      </Modal>
    );

    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    expect(document.querySelector('[role="menu"]')).not.toBeNull();

    pressDocumentKey('Escape');

    expect(onDropdownOpenChange).toHaveBeenCalledWith(false);
    expect(onModalOpenChange).not.toHaveBeenCalled();

    unmount();
  });

  it('renders a portaled Select above its parent Modal when opened by the user', () => {
    const onModalOpenChange = vi.fn();
    const onValueChange = vi.fn();

    const { unmount } = render(
      <Modal open onOpenChange={onModalOpenChange}>
        <Portal>
          <Modal.Overlay />
          <Modal.Content ariaLabel='Create project'>
            <Select
              label='Status'
              id='project-status'
              defaultValue='planned'
              onValueChange={onValueChange}
            >
              <Select.Item value='planned'>Planned</Select.Item>
              <Select.Item value='active'>In progress</Select.Item>
            </Select>
          </Modal.Content>
        </Portal>
      </Modal>
    );

    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    const trigger = dialog?.querySelector<HTMLButtonElement>(
      '[role="combobox"]'
    );
    expect(trigger).not.toBeNull();

    act(() => {
      trigger?.click();
    });

    const listbox = document.querySelector('[role="listbox"]');
    const dropdown = listbox?.parentElement as HTMLElement | undefined;
    expect(dropdown).toBeDefined();
    expect(dropdown?.parentElement).not.toBe(dialog);
    expect(Number(dropdown?.style.zIndex)).toBeGreaterThan(
      Number(dialog?.style.getPropertyValue('--z-index-modal')) + 1
    );

    act(() => {
      document.getElementById('project-status-listbox-option-1')?.click();
    });

    expect(onValueChange).toHaveBeenCalledWith('active');
    expect(onModalOpenChange).not.toHaveBeenCalled();
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    expect(document.querySelector('[role="listbox"]')).toBeNull();

    unmount();
  });

  it('closes only a select nested in a modal on Escape', () => {
    const onModalOpenChange = vi.fn();
    const onSelectOpenChange = vi.fn();

    const { unmount } = render(
      <Modal open onOpenChange={onModalOpenChange}>
        <Portal>
          <Modal.Overlay />
          <Modal.Content ariaLabel='Profile settings'>
            <Select open id='country' onOpenChange={onSelectOpenChange}>
              <Select.Item value='fr'>France</Select.Item>
              <Select.Item value='de'>Germany</Select.Item>
            </Select>
          </Modal.Content>
        </Portal>
      </Modal>
    );

    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    expect(document.querySelector('[role="listbox"]')).not.toBeNull();

    pressDocumentKey('Escape');

    expect(onSelectOpenChange).toHaveBeenCalledWith(false);
    expect(onModalOpenChange).not.toHaveBeenCalled();

    unmount();
  });

  it('closes only a popover nested in a modal on Escape', () => {
    const onModalOpenChange = vi.fn();
    const onPopoverOpenChange = vi.fn();

    const { unmount } = render(
      <Modal open onOpenChange={onModalOpenChange}>
        <Portal>
          <Modal.Overlay />
          <Modal.Content ariaLabel='Workspace settings'>
            <Popover open onOpenChange={onPopoverOpenChange}>
              <Popover.Trigger>Open help</Popover.Trigger>
              <Popover.Content>
                <Popover.Title>Help</Popover.Title>
                <Popover.Description>Nested help content.</Popover.Description>
              </Popover.Content>
            </Popover>
          </Modal.Content>
        </Portal>
      </Modal>
    );

    expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(2);

    pressDocumentKey('Escape');

    expect(onPopoverOpenChange).toHaveBeenCalledWith(
      false,
      expect.objectContaining({ reason: 'escape-key' })
    );
    expect(onModalOpenChange).not.toHaveBeenCalled();

    unmount();
  });

  it('closes only a tooltip nested in a popover on Escape', () => {
    const onPopoverOpenChange = vi.fn();
    const onTooltipOpenChange = vi.fn();

    const { unmount } = render(
      <Popover open onOpenChange={onPopoverOpenChange}>
        <Popover.Trigger>Open popover</Popover.Trigger>
        <Popover.Content>
          <Popover.Title>Details</Popover.Title>
          <Popover.Description>Nested tooltip host.</Popover.Description>
          <Tooltip open onOpenChange={onTooltipOpenChange}>
            <Tooltip.Trigger>Info</Tooltip.Trigger>
            <Portal>
              <Tooltip.Content>Helpful detail</Tooltip.Content>
            </Portal>
          </Tooltip>
        </Popover.Content>
      </Popover>
    );

    expect(document.querySelector('[role="tooltip"]')).not.toBeNull();
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();

    pressDocumentKey('Escape');

    expect(onTooltipOpenChange).toHaveBeenCalledWith(false);
    expect(onPopoverOpenChange).not.toHaveBeenCalled();

    unmount();
  });

  it('closes only a tooltip nested in a dropdown on Escape', () => {
    const onDropdownOpenChange = vi.fn();
    const onTooltipOpenChange = vi.fn();

    const { unmount } = render(
      <Dropdown open onOpenChange={onDropdownOpenChange}>
        <Dropdown.Trigger>Actions</Dropdown.Trigger>
        <Dropdown.Content>
          <Dropdown.Item>
            <Tooltip open onOpenChange={onTooltipOpenChange}>
              <Tooltip.Trigger>Archive</Tooltip.Trigger>
              <Tooltip.Content>Moves this item to archive</Tooltip.Content>
            </Tooltip>
          </Dropdown.Item>
        </Dropdown.Content>
      </Dropdown>
    );

    expect(document.querySelector('[role="tooltip"]')).not.toBeNull();
    expect(document.querySelector('[role="menu"]')).not.toBeNull();

    pressDocumentKey('Escape');

    expect(onTooltipOpenChange).toHaveBeenCalledWith(false);
    expect(onDropdownOpenChange).not.toHaveBeenCalled();

    unmount();
  });

  it('keeps modal open when select inside modal closes from outside press', () => {
    const onModalOpenChange = vi.fn();
    const onSelectOpenChange = vi.fn();

    const { unmount } = render(
      <Modal open onOpenChange={onModalOpenChange}>
        <Portal>
          <Modal.Overlay />
          <Modal.Content ariaLabel='Profile settings'>
            <Select open id='country' onOpenChange={onSelectOpenChange}>
              <Select.Item value='fr'>France</Select.Item>
              <Select.Item value='de'>Germany</Select.Item>
            </Select>
          </Modal.Content>
        </Portal>
      </Modal>
    );

    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    expect(document.querySelector('[role="listbox"]')).not.toBeNull();

    act(() => {
      document.dispatchEvent(
        new PointerEvent('pointerdown', { bubbles: true })
      );
    });

    expect(onSelectOpenChange).toHaveBeenCalledWith(false);
    expect(onModalOpenChange).not.toHaveBeenCalled();

    unmount();
  });

  it('keeps modal open when dropdown inside modal closes from outside press', () => {
    const onModalOpenChange = vi.fn();
    const onDropdownOpenChange = vi.fn();

    const { unmount } = render(
      <Modal open onOpenChange={onModalOpenChange}>
        <Portal>
          <Modal.Overlay />
          <Modal.Content ariaLabel='Actions'>
            <Dropdown open onOpenChange={onDropdownOpenChange}>
              <Dropdown.Trigger>Actions</Dropdown.Trigger>
              <Dropdown.Content>
                <Dropdown.Item>Edit</Dropdown.Item>
              </Dropdown.Content>
            </Dropdown>
          </Modal.Content>
        </Portal>
      </Modal>
    );

    act(() => {
      document.dispatchEvent(
        new PointerEvent('pointerdown', { bubbles: true })
      );
    });

    expect(onDropdownOpenChange).toHaveBeenCalledWith(false);
    expect(onModalOpenChange).not.toHaveBeenCalled();

    unmount();
  });
});
