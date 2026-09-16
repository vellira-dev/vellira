---
title: Dropdown – React Menu Component
description: Create accessible React dropdown menus with keyboard navigation, submenus, checkboxes, radio items, and TypeScript support.
---

# Dropdown

Dropdown is for contextual actions: commands that apply to the current object,
row, account, or page. It is not a form field and does not own a selected value.

<StorybookFrame
  story="dropdown.basic"
  title="Dropdown actions"
  :height="420"
/>

## When To Use

Use Dropdown when several actions share the same trigger and do not need to be
visible all the time. Use Select when the user is choosing a saved value.

```tsx
<Dropdown color='primary' placement='bottom-end'>
  <Dropdown.Trigger asChild>
    <Button appearance='outline' color='neutral'>
      Actions
    </Button>
  </Dropdown.Trigger>

  <Dropdown.Content>
    <Dropdown.Group>
      <Dropdown.Label>Report</Dropdown.Label>
      <Dropdown.Item onSelect={renameReport}>Rename</Dropdown.Item>
      <Dropdown.Item onSelect={duplicateReport}>Duplicate</Dropdown.Item>
    </Dropdown.Group>

    <Dropdown.Separator />

    <Dropdown.Item color='danger' onSelect={deleteReport}>
      Delete
    </Dropdown.Item>
  </Dropdown.Content>
</Dropdown>
```

## Contract

Dropdown executes actions. Do not add Select props such as `value`,
`defaultValue`, `onValueChange`, `placeholder`, `required`, `invalid`, or
`FormField` behavior.

Use `Dropdown.Item onSelect` instead of `onClick`. `onSelect` runs for pointer,
keyboard, and touch selection. Call `event.preventDefault()` to keep the menu
open.

```tsx
<Dropdown.Item
  onSelect={(event) => {
    event.preventDefault();
    openAdvancedDialog();
  }}
>
  Advanced action
</Dropdown.Item>
```

## Trigger Guidance

Use `Dropdown.Trigger asChild` with Button for most web triggers.

```tsx
import { MoreHorizontal } from '@vellira-ui/icons';
import { Button, Dropdown } from '@vellira-ui/react';

<Dropdown>
  <Dropdown.Trigger asChild>
    <Button
      aria-label='More invoice actions'
      iconOnly
      iconStart={<MoreHorizontal />}
    />
  </Dropdown.Trigger>

  <Dropdown.Content>
    <Dropdown.Item>Duplicate</Dropdown.Item>
    <Dropdown.Item color='danger'>Delete</Dropdown.Item>
  </Dropdown.Content>
</Dropdown>;
```

## Rich Items

Simple item metadata can be passed as props.

```tsx
<Dropdown.Item
  icon={<MoreHorizontal />}
  description='Creates a copy in the current workspace'
  badge='New'
  shortcut='⌘D'
  onSelect={duplicateReport}
>
  Duplicate
</Dropdown.Item>
```

For more control, use the explicit item slots. Prefer the current slot names:
`Dropdown.ItemIcon`, `Dropdown.ItemDescription`, `Dropdown.ItemBadge`, and
`Dropdown.ItemShortcut`.

```tsx
<Dropdown.Item onSelect={openSettings}>
  <Dropdown.ItemIcon>
    <MoreHorizontal />
  </Dropdown.ItemIcon>
  Settings
  <Dropdown.ItemBadge>Beta</Dropdown.ItemBadge>
</Dropdown.Item>
```

## Tokens

Dropdown uses semantic palettes from the root `color` prop:
`primary`, `neutral`, `success`, `warning`, and `danger`. The palette affects
trigger, content border, focus, and item interaction states. Item-level
`color='danger'` is reserved for destructive actions.

The web renderer consumes CSS variables generated from component tokens, while
the native renderer reads the same semantic token shape from
`theme.components.dropdown[color]`.

## Checkbox And Radio Items

Checkbox items are for toggleable menu settings and do not close by default.
Radio items store their value inside `Dropdown.RadioGroup`, not on the root.

```tsx
<Dropdown closeOnSelect={false}>
  <Dropdown.Trigger>Preferences</Dropdown.Trigger>
  <Dropdown.Content>
    <Dropdown.CheckboxItem checked={showGrid} onCheckedChange={setShowGrid}>
      Show grid
    </Dropdown.CheckboxItem>

    <Dropdown.RadioGroup value={theme} onValueChange={setTheme}>
      <Dropdown.RadioItem value='light'>Light</Dropdown.RadioItem>
      <Dropdown.RadioItem value='dark'>Dark</Dropdown.RadioItem>
      <Dropdown.RadioItem value='system'>System</Dropdown.RadioItem>
    </Dropdown.RadioGroup>
  </Dropdown.Content>
</Dropdown>
```

## Nested Dropdowns and Submenus

Use a submenu when a secondary set of actions belongs to a parent command, such
as choosing an export format. Keep primary actions in the top-level menu so
they remain easy to find. Use Select when the user is choosing a value, and use
Popover when the content needs explanation or a richer layout instead of an
action list. Avoid nesting unrelated commands or making users move through
many hidden levels.

This pattern uses the web React API. React Native Dropdown currently does not
expose `Dropdown.Sub`, `Dropdown.SubTrigger`, or `Dropdown.SubContent`.

```tsx
import { Button, Dropdown } from '@vellira-ui/react';

type ExportFormat = 'pdf' | 'csv';

type ExportMenuProps = {
  onCopyLink: () => void;
  onExport: (format: ExportFormat) => void;
};

export function ExportMenu({ onCopyLink, onExport }: ExportMenuProps) {
  return (
    <Dropdown>
      <Dropdown.Trigger asChild>
        <Button appearance='outline'>Export</Button>
      </Dropdown.Trigger>

      <Dropdown.Content>
        <Dropdown.Item onSelect={onCopyLink}>Copy link</Dropdown.Item>

        <Dropdown.Sub>
          <Dropdown.SubTrigger>Download</Dropdown.SubTrigger>
          <Dropdown.SubContent>
            <Dropdown.Item onSelect={() => onExport('pdf')}>PDF</Dropdown.Item>
            <Dropdown.Item onSelect={() => onExport('csv')}>CSV</Dropdown.Item>
          </Dropdown.SubContent>
        </Dropdown.Sub>
      </Dropdown.Content>
    </Dropdown>
  );
}
```

With the root menu open, move to the submenu trigger and press `ArrowRight`
to open its nested menu. `ArrowLeft` closes the nested menu. The web
implementation exposes the submenu trigger as a menu item with
`aria-haspopup="menu"` and `aria-expanded` state; `Escape` closes the menu and
returns focus to the root trigger.

## Accessibility

- Trigger uses `aria-haspopup="menu"`, `aria-expanded`, and `aria-controls`.
- Content uses `role="menu"`.
- Items use `role="menuitem"`, `menuitemcheckbox`, or `menuitemradio`.
- Do not use `role="listbox"` or `role="option"` for Dropdown.
- Disabled link items remove `href` and expose `aria-disabled`.

## See Also

- [Button](/react/button) for triggers and command buttons.
- [Select](/react/select) for value selection.
- [Popover](/react/popover) for contextual content that is not an action menu.
- [Modal](/react/modal) for confirmation flows.
