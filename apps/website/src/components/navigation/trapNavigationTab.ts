// Shared keyboard containment for the existing workspace and Components drawers.
// The caller owns opening, closing, scroll lock and focus restoration.
export function trapNavigationTab(
  event: KeyboardEvent,
  surface: HTMLElement | null
) {
  if (event.key !== 'Tab' || !surface) return;

  const focusable = surface.querySelectorAll<HTMLElement>(
    'a[href], button:not([disabled])'
  );
  const first = focusable.item(0);
  const last = focusable.item(focusable.length - 1);
  if (!first || !last) return;

  const active = surface.ownerDocument.activeElement;
  if (event.shiftKey && active === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && active === last) {
    event.preventDefault();
    first.focus();
  }
}
