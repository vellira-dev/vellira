import { act } from 'react';

import { expectNoA11yViolations } from '@test-utils/a11y';
import { render } from '@test-utils/render';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Modal } from './Modal';

import { Button, Portal } from '#primitives';

function pressDocumentKey(key: string) {
  act(() => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key }));
  });
}

function pressOutside() {
  act(() => {
    document.dispatchEvent(new Event('pointerdown', { bubbles: true }));
  });
}

const textById = (id: string | null | undefined) =>
  id ? document.getElementById(id)?.textContent : undefined;

const waitForModalWarningCheck = () =>
  new Promise((resolve) => window.setTimeout(resolve, 0));

afterEach(() => {
  document.body.innerHTML = '';
  document.body.style.overflow = '';
});

describe('Modal', () => {
  it('renders compound dialog content and closes from Modal.Close', () => {
    const onOpenChange = vi.fn();
    const { unmount } = render(
      <Modal open onOpenChange={onOpenChange}>
        <Portal>
          <Modal.Overlay />
          <Modal.Content>
            <Modal.Header>
              <div>
                <Modal.Title>Delete file</Modal.Title>
                <Modal.Description>Are you sure?</Modal.Description>
              </div>
              <Modal.Close />
            </Modal.Header>
            <Modal.Footer>
              <Modal.Close asChild>
                <button type='button'>Cancel</button>
              </Modal.Close>
            </Modal.Footer>
          </Modal.Content>
        </Portal>
      </Modal>
    );

    const dialog = document.querySelector('[role="dialog"]');
    const closeButton = document.querySelector<HTMLButtonElement>(
      '[aria-label="Close dialog"]'
    );

    expect(dialog).not.toBeNull();
    expect(dialog?.getAttribute('aria-modal')).toBe('true');
    expect(dialog?.textContent).toContain('Cancel');
    expect(
      (dialog as HTMLElement).style.getPropertyValue('--z-index-modal')
    ).toBe('1000');

    act(() => closeButton?.click());
    expect(onOpenChange).toHaveBeenCalledWith(false);

    unmount();
  });

  it('connects title and description for accessibility', async () => {
    const { unmount } = render(
      <Modal open>
        <Portal>
          <Modal.Overlay />
          <Modal.Content>
            <Modal.Header>
              <Modal.Title>Delete file</Modal.Title>
              <Modal.Description>Are you sure?</Modal.Description>
            </Modal.Header>
            <Modal.Body>Body content</Modal.Body>
          </Modal.Content>
        </Portal>
      </Modal>
    );

    await expectNoA11yViolations(document.body);

    const dialog = document.querySelector('[role="dialog"]');
    const titleId = dialog?.getAttribute('aria-labelledby');
    const descriptionId = dialog?.getAttribute('aria-describedby');

    expect(titleId).toBeTruthy();
    expect(descriptionId).toBeTruthy();
    expect(textById(titleId)).toBe('Delete file');
    expect(textById(descriptionId)).toBe('Are you sure?');

    unmount();
  });

  it('does not warn when Modal.Content contains Modal.Title', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { unmount } = render(
      <Modal open>
        <Portal>
          <Modal.Overlay />
          <Modal.Content>
            <Modal.Header>
              <Modal.Title>Delete file</Modal.Title>
            </Modal.Header>
            <Modal.Body>Body content</Modal.Body>
          </Modal.Content>
        </Portal>
      </Modal>
    );

    await waitForModalWarningCheck();

    expect(warn).not.toHaveBeenCalledWith(
      'Modal.Content requires Modal.Title or ariaLabel.'
    );

    unmount();
    warn.mockRestore();
  });

  it('does not warn when Modal.Content has ariaLabel without Modal.Title', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { unmount } = render(
      <Modal open>
        <Portal>
          <Modal.Overlay />
          <Modal.Content ariaLabel='Settings'>
            <Modal.Body>Body content</Modal.Body>
          </Modal.Content>
        </Portal>
      </Modal>
    );

    await waitForModalWarningCheck();

    expect(warn).not.toHaveBeenCalledWith(
      'Modal.Content requires Modal.Title or ariaLabel.'
    );

    unmount();
    warn.mockRestore();
  });

  it('warns when Modal.Content has no Modal.Title or ariaLabel', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { unmount } = render(
      <Modal open>
        <Portal>
          <Modal.Overlay />
          <Modal.Content>
            <Modal.Body>Body content</Modal.Body>
          </Modal.Content>
        </Portal>
      </Modal>
    );

    await waitForModalWarningCheck();

    expect(warn).toHaveBeenCalledWith(
      'Modal.Content requires Modal.Title or ariaLabel.'
    );

    unmount();
    warn.mockRestore();
  });

  it('supports Trigger asChild without rendering an extra button', () => {
    const { container, unmount } = render(
      <Modal>
        <Modal.Trigger asChild>
          <Button>Open modal</Button>
        </Modal.Trigger>
        <Portal>
          <Modal.Overlay />
          <Modal.Content ariaLabel='Settings'>
            <Modal.Body>Settings body</Modal.Body>
          </Modal.Content>
        </Portal>
      </Modal>
    );

    expect(document.querySelector('[role="dialog"]')).toBeNull();

    const trigger = container.querySelector<HTMLButtonElement>('button');
    act(() => trigger?.click());

    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    expect(container.querySelectorAll('button')).toHaveLength(1);

    unmount();
  });

  it('applies configurable animation settings to overlay and content', () => {
    const { unmount } = render(
      <Modal open animation='slide' duration={{ open: 220, close: 140 }}>
        <Portal>
          <Modal.Overlay />
          <Modal.Content ariaLabel='Animated'>
            <Modal.Body>Animated body</Modal.Body>
          </Modal.Content>
        </Portal>
      </Modal>
    );

    const overlay = document.querySelector(
      '[aria-hidden="true"][data-animation="slide"]'
    );
    const dialog = document.querySelector('[role="dialog"]');

    expect(overlay?.getAttribute('data-animation')).toBe('slide');
    expect(dialog?.getAttribute('data-animation')).toBe('slide');
    expect(
      (dialog as HTMLElement).style.getPropertyValue(
        '--modal-animation-open-duration'
      )
    ).toBe('220ms');
    expect(
      (dialog as HTMLElement).style.getPropertyValue(
        '--modal-animation-close-duration'
      )
    ).toBe('140ms');

    unmount();
  });

  it('keeps modal mounted until the close animation completes', () => {
    vi.useFakeTimers();

    function ModalHarness({ open }: { open: boolean }) {
      return (
        <Modal open={open}>
          <Portal>
            <Modal.Overlay />
            <Modal.Content ariaLabel='Animated close'>
              <Modal.Body>Animated close body</Modal.Body>
            </Modal.Content>
          </Portal>
        </Modal>
      );
    }

    const { rerender, unmount } = render(<ModalHarness open />);

    rerender(<ModalHarness open={false} />);

    expect(document.querySelector('[role="dialog"]')).not.toBeNull();

    act(() => {
      vi.advanceTimersByTime(149);
    });

    expect(document.querySelector('[role="dialog"]')).not.toBeNull();

    act(() => {
      vi.advanceTimersByTime(1);
    });

    expect(document.querySelector('[role="dialog"]')).toBeNull();

    unmount();
    vi.useRealTimers();
  });

  it('moves focus into the dialog and restores it to the opener on close', async () => {
    function ModalHarness({ open }: { open: boolean }) {
      return (
        <>
          <button type='button'>Open modal</button>
          <Modal open={open}>
            <Portal>
              <Modal.Overlay />
              <Modal.Content>
                <Modal.Header>
                  <Modal.Title>Delete file</Modal.Title>
                  <Modal.Close />
                </Modal.Header>
              </Modal.Content>
            </Portal>
          </Modal>
        </>
      );
    }

    const { container, rerender, unmount } = render(
      <ModalHarness open={false} />
    );
    const opener = container.querySelector<HTMLButtonElement>('button');

    opener?.focus();
    expect(document.activeElement).toBe(opener);

    rerender(<ModalHarness open />);
    await new Promise<void>((resolve) => {
      queueMicrotask(() => resolve());
    });

    const closeButton = document.querySelector<HTMLButtonElement>(
      'button[aria-label="Close dialog"]'
    );

    expect(document.activeElement).toBe(closeButton);

    rerender(<ModalHarness open={false} />);
    await new Promise<void>((resolve) => {
      queueMicrotask(() => resolve());
    });

    expect(document.activeElement).toBe(opener);

    unmount();
  });

  it('restores focus to Modal.Trigger when pointer activation does not focus it', async () => {
    const { container, unmount } = render(
      <Modal>
        <Modal.Trigger>Open modal</Modal.Trigger>
        <Portal>
          <Modal.Overlay />
          <Modal.Content>
            <Modal.Header>
              <Modal.Title>Delete file</Modal.Title>
              <Modal.Close />
            </Modal.Header>
          </Modal.Content>
        </Portal>
      </Modal>
    );
    const trigger = container.querySelector<HTMLButtonElement>('button');

    expect(document.activeElement).not.toBe(trigger);

    act(() => trigger?.click());

    await new Promise<void>((resolve) => {
      queueMicrotask(() => resolve());
    });

    expect(document.activeElement).toBe(
      document.querySelector('button[aria-label="Close dialog"]')
    );

    pressDocumentKey('Escape');

    await new Promise<void>((resolve) => {
      queueMicrotask(() => resolve());
    });

    expect(document.activeElement).toBe(trigger);

    unmount();
  });

  it('locks body scroll while open and restores the previous overflow', () => {
    document.body.style.overflow = 'auto';

    const { unmount } = render(
      <Modal open>
        <Portal>
          <Modal.Overlay />
          <Modal.Content ariaLabel='Locked'>
            <Modal.Body>Locked body</Modal.Body>
          </Modal.Content>
        </Portal>
      </Modal>
    );

    expect(document.body.style.overflow).toBe('hidden');

    unmount();

    expect(document.body.style.overflow).toBe('auto');
  });

  it('does not lock body scroll when preventScroll is disabled', () => {
    document.body.style.overflow = 'auto';

    const { unmount } = render(
      <Modal open preventScroll={false}>
        <Portal>
          <Modal.Overlay />
          <Modal.Content ariaLabel='Unlocked'>
            <Modal.Body>Unlocked body</Modal.Body>
          </Modal.Content>
        </Portal>
      </Modal>
    );

    expect(document.body.style.overflow).toBe('auto');

    unmount();
  });

  it('does not loop tab focus when trapFocus is disabled', async () => {
    const { unmount } = render(
      <Modal open trapFocus={false}>
        <Portal>
          <Modal.Overlay />
          <Modal.Content ariaLabel='Non modal focus'>
            <button type='button'>First</button>
            <button type='button'>Last</button>
          </Modal.Content>
        </Portal>
      </Modal>
    );

    await new Promise<void>((resolve) => {
      queueMicrotask(() => resolve());
    });

    const buttons = Array.from(
      document.querySelectorAll<HTMLButtonElement>('button')
    );
    const firstButton = buttons.find(
      (button) => button.textContent === 'First'
    );
    const lastButton = buttons.find((button) => button.textContent === 'Last');
    const tabEvent = new KeyboardEvent('keydown', {
      bubbles: true,
      cancelable: true,
      key: 'Tab',
    });

    act(() => {
      lastButton?.focus();
      document.dispatchEvent(tabEvent);
    });

    expect(tabEvent.defaultPrevented).toBe(false);
    expect(document.activeElement).toBe(lastButton);
    expect(document.activeElement).not.toBe(firstButton);

    unmount();
  });

  it('closes on Escape and outside press when enabled', () => {
    const onOpenChange = vi.fn();
    const { unmount } = render(
      <Modal open onOpenChange={onOpenChange}>
        <Portal>
          <Modal.Overlay />
          <Modal.Content ariaLabel='Confirm'>
            <Modal.Body>Confirm body</Modal.Body>
          </Modal.Content>
        </Portal>
      </Modal>
    );

    pressDocumentKey('Escape');
    pressOutside();

    expect(onOpenChange).toHaveBeenCalledWith(false);

    unmount();
  });

  it('does not close on Escape or outside press when disabled', () => {
    const onOpenChange = vi.fn();
    const { unmount } = render(
      <Modal
        open
        closeOnEscape={false}
        closeOnOutsidePress={false}
        onOpenChange={onOpenChange}
      >
        <Portal>
          <Modal.Overlay />
          <Modal.Content ariaLabel='Confirm'>
            <Modal.Body>Confirm body</Modal.Body>
          </Modal.Content>
        </Portal>
      </Modal>
    );

    pressDocumentKey('Escape');
    pressOutside();

    expect(onOpenChange).not.toHaveBeenCalled();

    unmount();
  });

  it('renders nothing in the portal when closed', () => {
    const { unmount } = render(
      <Modal open={false}>
        <Portal>
          <Modal.Overlay />
          <Modal.Content ariaLabel='Closed'>
            <Modal.Body>Closed body</Modal.Body>
          </Modal.Content>
        </Portal>
      </Modal>
    );

    expect(document.querySelector('[role="dialog"]')).toBeNull();

    unmount();
  });
});
