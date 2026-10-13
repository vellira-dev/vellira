---
title: Checkbox – React Checkbox Component
description: Accessible React checkbox component with indeterminate state, validation, descriptions, keyboard support, and TypeScript integration.
---

# Checkbox

Checkbox represents an independent boolean choice. It works for agreements,
settings, row selection, and mixed selection summaries.

<StorybookFrame
  story="checkbox.states"
  title="Checkbox states"
  :height="520"
/>

## When To Use

Use Checkbox when each option can be turned on or off without requiring another
option to turn off. Use RadioGroup when exactly one option must be selected.
Use Button for commands and Toggle-like buttons for transient pressed state.

```tsx
<Checkbox
  checked={accepted}
  onCheckedChange={setAccepted}
  color='primary'
  size='md'
  label='Accept terms'
  description='Required before creating the workspace.'
/>
```

## API Shape

Use `checked` with `onCheckedChange` for controlled state, or
`defaultChecked` for uncontrolled state. `color` changes the selected intent,
while `labelPosition` controls whether the visible label sits before or after
the checkbox.

```tsx
<Checkbox
  checked={enabled}
  onCheckedChange={setEnabled}
  color='success'
  labelPosition='start'
  label='Enable automation'
  description='Runs workspace rules when new records arrive.'
/>
```

Use `icon` and `indeterminateIcon` only when the default checkmark or mixed mark
does not match the surrounding product language.

```tsx
<Checkbox
  defaultChecked
  icon={<span aria-hidden='true'>✓</span>}
  indeterminateIcon={<span aria-hidden='true'>−</span>}
  label='Custom indicator'
/>
```

## Props

| Prop                | Purpose                                                  |
| ------------------- | -------------------------------------------------------- |
| `checked`           | Controlled checked state.                                |
| `defaultChecked`    | Initial checked state for uncontrolled use.              |
| `onCheckedChange`   | Receives the next boolean checked state.                 |
| `size`              | `sm`, `md`, or `lg`.                                     |
| `color`             | `primary`, `neutral`, `success`, `warning`, or `danger`. |
| `label`             | Visible label text or content.                           |
| `description`       | Helper text rendered below the row.                      |
| `error`             | Validation message and invalid state.                    |
| `required`          | Marks the input as required.                             |
| `disabled`          | Prevents interaction.                                    |
| `indeterminate`     | Shows and announces a mixed state.                       |
| `labelPosition`     | `end` or `start`.                                        |
| `icon`              | Custom checked-state icon.                               |
| `indeterminateIcon` | Custom mixed-state icon.                                 |
| `className`         | Root class name on web.                                  |
| `wrapperClassName`  | Clickable row class name on web.                         |

## Common Patterns

### Settings Row

```tsx
<Checkbox
  defaultChecked
  label='Email product updates'
  description='Receive important release and billing updates.'
/>
```

### Select All with an Indeterminate React Checkbox

A select-all checkbox summarizes a group: unchecked when none are selected,
indeterminate when only some are selected, and checked when every item is
selected. Keep the selected item IDs as the single source of truth. Derive
`checked` and `indeterminate` instead of saving an independent third value.

The example below is a complete React pattern, including the individual
checkboxes that control the mixed state. It uses the existing Vellira
`checked` and `onCheckedChange` API without adding a form library.

```tsx
import { useState } from 'react';
import { Checkbox } from '@vellira-ui/react';

const PROJECTS = [
  { id: 'design', name: 'Design system' },
  { id: 'docs', name: 'Documentation' },
  { id: 'website', name: 'Website' },
] as const;

type ProjectId = (typeof PROJECTS)[number]['id'];

export function ProjectSelection() {
  const [selectedIds, setSelectedIds] = useState<ProjectId[]>(['design']);
  const allSelected = selectedIds.length === PROJECTS.length;
  const someSelected = selectedIds.length > 0;

  function toggleAll(checked: boolean) {
    setSelectedIds(checked ? PROJECTS.map((project) => project.id) : []);
  }

  function toggleOne(id: ProjectId, checked: boolean) {
    setSelectedIds((current) =>
      checked
        ? current.includes(id)
          ? current
          : [...current, id]
        : current.filter((value) => value !== id)
    );
  }

  return (
    <fieldset>
      <legend>Projects</legend>
      <Checkbox
        label='Select all projects'
        checked={allSelected}
        indeterminate={someSelected && !allSelected}
        onCheckedChange={toggleAll}
      />
      {PROJECTS.map((project) => (
        <Checkbox
          key={project.id}
          label={project.name}
          checked={selectedIds.includes(project.id)}
          onCheckedChange={(checked) => toggleOne(project.id, checked)}
        />
      ))}
    </fieldset>
  );
}
```

The mixed indicator represents **partial selection**, not a third submitted
checkbox value. If the parent does not need to coordinate the rows,
`defaultChecked` may be simpler than controlled state. For mutually exclusive
choices, use [RadioGroup](/react/radio-group) instead.

Try the [live Checkbox playground](https://vellira.dev/components/checkbox)
or compare the [React Native Checkbox](/react-native/checkbox) API.

### Error State

```tsx
<Checkbox
  required
  checked={accepted}
  onCheckedChange={setAccepted}
  label='I accept the data processing agreement'
  error='Accept the agreement to continue.'
/>
```

## Real Example: Notification Preferences

```tsx
import { Button, Checkbox } from '@vellira-ui/react';
import { useState } from 'react';

export function NotificationPreferences() {
  const [security, setSecurity] = useState(true);
  const [product, setProduct] = useState(false);
  const [billing, setBilling] = useState(true);

  return (
    <form onSubmit={savePreferences}>
      <Checkbox
        checked={security}
        onCheckedChange={setSecurity}
        label='Security alerts'
        description='Required for sign-in, password, and permission changes.'
        disabled
      />
      <Checkbox
        checked={billing}
        onCheckedChange={setBilling}
        label='Billing updates'
        description='Invoices, payment failures, and plan changes.'
      />
      <Checkbox
        checked={product}
        onCheckedChange={setProduct}
        label='Product updates'
        description='New components, migration notes, and release summaries.'
      />
      <Button type='submit'>Save preferences</Button>
    </form>
  );
}
```

## Accessibility

- Keep the label close to the control and make it descriptive.
- Use `description` for durable context, not hover-only help.
- When no visible label is rendered, provide `aria-label` on web or
  `accessibilityLabel` on native.
- Do not use indeterminate as a third submitted value. It is a visual and
  accessibility state for partial selection.

## See Also

- [RadioGroup](/react/radio-group) for mutually exclusive choices.
- [FormField](/react/form-field) for custom field layout.
