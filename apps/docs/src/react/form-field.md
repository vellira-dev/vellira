---
title: FormField – React Form Component
description: Compose accessible React form fields with labels, helper text, validation messages, and consistent layouts.
---

# FormField

FormField provides shared field semantics for labels, descriptions, errors,
supporting messages, required state, disabled state, invalid state, generated
ids, and accessible relationships. It is the infrastructure layer used by Input
and the foundation for other form controls.

<StorybookFrame
  story="formField.complete"
  title="FormField with Input context"
  :height="520"
/>

## When To Use

Use FormField when a custom layout needs one field contract for label,
description, message, error, required, disabled, invalid, size, and
accessibility.
For ordinary text fields, prefer the Input shorthand API.

```tsx
<FormField
  label='Email'
  description='Used for login.'
  message='Email address is available.'
  messageTone='success'
  required
  size='sm'
>
  <Input value={email} onValueChange={setEmail} />
</FormField>
```

## Contract

FormField owns field layout and semantic wiring. Compatible Vellira controls
consume FormField context automatically.

| Responsibility              | Owner                          |
| --------------------------- | ------------------------------ |
| Label and layout            | `FormField`                    |
| Generated ids               | `FormField`                    |
| `aria-labelledby`           | `FormField` + compatible child |
| `aria-describedby`          | `FormField` + compatible child |
| `aria-invalid`              | `FormField` + compatible child |
| Value and validation logic  | App                            |
| Control-specific appearance | Child control                  |

FormField provides these values through context:

```tsx
{
  controlId,
  labelId,
  descriptionId,
  messageId,
  errorId,
  required,
  disabled,
  invalid,
  size,
  ariaLabelledBy,
  ariaDescribedBy,
}
```

## Web Notes

Input consumes FormField context automatically. Do not repeat `id`, `required`,
`disabled`, `invalid`, or `aria-describedby` unless you are building a custom
control.

```tsx
<FormField label='Workspace' required disabled invalid size='lg'>
  <Input placeholder='vellira-design' />
</FormField>
```

Child props still have clear precedence. For `size`, the child prop wins over
FormField context. For `required`, `disabled`, and `invalid`, FormField and the
child are combined so a child cannot accidentally unset a field-level state.

## Messages And Errors

Use `description` for guidance before input. Use `message` for supporting
feedback after input, with `messageTone` to communicate the result.

```tsx
<FormField
  label='Email'
  description='Used for account notifications.'
  message='Email address is available.'
  messageTone='success'
>
  <Input color='success' />
</FormField>
```

```tsx
<FormField
  label='API key'
  message='This key expires in 7 days.'
  messageTone='warning'
>
  <Input color='warning' />
</FormField>
```

`error` has priority over `message`. When `error` is present, FormField marks
the field invalid, links the error through `aria-describedby`, and renders it
with `role='alert'`.

```tsx
<FormField
  label='Project slug'
  message='Slug is available.'
  error='This slug is already used.'
>
  <Input invalid />
</FormField>
```

Supporting messages are quiet by default. Set `messageLive='polite'` only when a
non-error message should be announced after it changes.

## Optional And Info Content

Use `optionalText` instead of manually composing the label. Do not combine
`required` and `optionalText`.

```tsx
<FormField label='Display name' optionalText='Optional'>
  <Input />
</FormField>
```

Use `labelInfo` for an info affordance next to the label. FormField accepts a
ReactNode and does not create a tooltip by itself.

```tsx
<FormField label='API key' labelInfo={<InfoTooltip />}>
  <Input />
</FormField>
```

Use `labelAction` for an action such as "Forgot password?" or "Manage".
FormField renders this slot outside the label so interactive content is not
nested inside `<label>`.

```tsx
<FormField
  label='Password'
  labelAction={<Button appearance='link'>Forgot password?</Button>}
>
  <Input type='password' />
</FormField>
```

## Layout

Use vertical layout for most forms. Use horizontal layout for dense settings
surfaces.

```tsx
<FormField
  label='Workspace'
  description='Visible in audit logs.'
  orientation='horizontal'
  labelPosition='start'
>
  <Input />
</FormField>
```

## Custom Controls

For non-Vellira controls, FormField still provides layout and stable ids. The
custom control must consume the context or receive the relevant props from your
adapter.

```tsx
import { FormField, useFormFieldContext } from '@vellira-ui/react';

function FileUploadControl() {
  const field = useFormFieldContext();
  return (
    <input
      id={field?.controlId}
      type='file'
      aria-labelledby={field?.ariaLabelledBy}
      aria-describedby={field?.ariaDescribedBy}
      aria-invalid={field?.invalid || undefined}
      required={field?.required}
      disabled={field?.disabled}
    />
  );
}

<FormField label='Avatar' description='PNG or JPG up to 2 MB.'>
  <FileUploadControl />
</FormField>;
```

When `bindControl` is enabled, one direct non-Fragment React element receives
`id`, ARIA metadata, `required`, `disabled`, and invalid state automatically.
Fragments, multiple children, and `bindControl={false}` leave binding to your
custom control or adapter.

## Compound API

Use compound slots when the field markup is easier to read as ordered field
parts. The slots render through the same FormField layout, ids, message priority,
and accessibility wiring as the props API.

```tsx
<FormField id='email' required>
  <FormField.Label>Email</FormField.Label>
  <FormField.Description>Used for notifications.</FormField.Description>
  <FormField.Control>
    <Input />
  </FormField.Control>
  <FormField.Message tone='success'>Available</FormField.Message>
</FormField>
```

`FormField.Control` supports `bindControl={false}` on web for manually wired
controls.

```tsx
<FormField id='avatar'>
  <FormField.Label>Avatar</FormField.Label>
  <FormField.Control bindControl={false}>
    <FileUploadControl />
  </FormField.Control>
  <FormField.Message>PNG or JPG up to 2 MB.</FormField.Message>
</FormField>
```

## Native Notes

Native FormField keeps the same conceptual props. Native controls may support a
smaller layout surface in the first version, but the contract stays aligned
with web.

```tsx
<FormField
  label='Email'
  description='Used for login.'
  message='Email address is available.'
  messageTone='success'
  required
  disabled
  invalid
  size='md'
>
  <Input />
</FormField>
```

## See Also

- [Input](/react/input), [Select](/react/select), and
  [RadioGroup](/react/radio-group) for built-in field components.
