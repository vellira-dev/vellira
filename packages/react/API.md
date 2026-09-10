# Vellira Web Component API

API reference for `@vellira-ui/react`.

Import the package styles once in your application entry point:

```tsx
import '@vellira-ui/react/styles';
```

Then import public components from the package root:

```tsx
import {
  Button,
  Checkbox,
  Switch,
  Dropdown,
  FormField,
  Input,
  Modal,
  RadioGroup,
  Select,
  Tabs,
  ThemeProvider,
  Tooltip,
  useTheme,
} from '@vellira-ui/react';
```

## Contents

- Button
- Checkbox
- Switch
- Input
- FormField
- RadioGroup
- Select
- Dropdown
- Tabs
- Tooltip
- Modal
- ThemeProvider
- useTheme

## API Conventions

- Shared base contracts come from `@vellira-ui/types`.
- Web-only props such as `className`, `onClick`, DOM ids, and browser accessibility attributes stay in the web package.
- Text and icons that render React elements use `ReactNode`.
- Components that support both controlled and uncontrolled usage expose `value` or `checked` plus `defaultValue` or `defaultChecked`.
- `disabled` prevents user interaction where the component supports it.
- `error` is a display prop. Validation still belongs to the consuming app.

## Shared Types

| Type                | Values                                                                      |
| ------------------- | --------------------------------------------------------------------------- |
| `ButtonAppearance`  | `'solid'`, `'outline'`, `'ghost'`, `'soft'`, `'link'`                       |
| `ButtonColor`       | `'primary'`, `'neutral'`, `'success'`, `'warning'`, `'danger'`              |
| `ButtonShape`       | `'square'`, `'rounded'`, `'pill'`                                           |
| `ButtonSize`        | `'sm'`, `'md'`, `'lg'`                                                      |
| `InputSize`         | `'sm'`, `'md'`, `'lg'`                                                      |
| `InputType`         | `'text'`, `'email'`, `'password'`, `'number'`, `'search'`, `'tel'`, `'url'` |
| `Orientation`       | `'horizontal'`, `'vertical'`                                                |
| `TextWrap`          | `'nowrap'`, `'wrap'`, `'truncate'`                                          |
| `TabsVariant`       | `'line'`, `'pills'`, `'segmented'`                                          |
| `FloatingPlacement` | `'top'`, `'bottom'`, `'left'`, `'right'`                                    |
| `ThemeName`         | `'light'`, `'dark'`, `'high-contrast'`, `'highContrast'`                    |

### TooltipDelay

```ts
type TooltipDelay = {
  open?: number;
  close?: number;
};
```

## Button

Clickable action component with appearances, sizes, optional icons, loading state,
and full-width layout support.

```tsx
import { Search } from '@vellira-ui/icons';
import { Button } from '@vellira-ui/react';

<Button color='primary' appearance='solid' size='md' onClick={handleSave}>
  Save
</Button>;

<Button aria-label='Search' iconOnly iconStart={<Search />} />;
```

<!-- api-docgen:start web.ButtonProps.Button -->

| Prop          | Type                         | Required | Description                                                                             |
| ------------- | ---------------------------- | -------- | --------------------------------------------------------------------------------------- |
| `children`    | `ReactNode`                  | No       | Button content.                                                                         |
| `iconStart`   | `ReactNode`                  | No       | Icon rendered before content.                                                           |
| `iconEnd`     | `ReactNode`                  | No       | Icon rendered after content.                                                            |
| `fullWidth`   | `boolean`                    | No       | Makes the button fill its container width.                                              |
| `size`        | `ButtonSize`                 | No       | Button size.                                                                            |
| `disabled`    | `boolean`                    | No       | Disables interaction.                                                                   |
| `color`       | `ButtonColor`                | No       | Visual tone: primary, neutral, success, warning, or danger.                             |
| `loading`     | `boolean`                    | No       | Shows a spinner and disables interaction.                                               |
| `loadingText` | `string`                     | No       | Replaces visible content while loading.                                                 |
| `iconOnly`    | `boolean`                    | No       | Hides visible text for icon-only actions.                                               |
| `spinner`     | `ReactNode`                  | No       | Custom loading indicator.                                                               |
| `tooltip`     | `string`                     | No       | HTML title tooltip text for the button or composed child.                               |
| `badge`       | `ReactNode`                  | No       | Compact badge rendered after the label when not icon-only.                              |
| `shortcut`    | `ReactNode`                  | No       | Keyboard shortcut hint rendered after the label when not icon-only.                     |
| `asChild`     | `boolean`                    | No       | Composes Button behavior and styling onto a single child element.                       |
| `appearance`  | `ButtonAppearance \| 'bare'` | No       | Visual style: solid, outline, ghost, soft, link, or the web-only bare composition mode. |
| `shape`       | `ButtonShape`                | No       | Corner shape: square, rounded, or pill.                                                 |

<!-- api-docgen:end web.ButtonProps.Button -->

Icon-only buttons must provide the standard `aria-label` attribute. Web Button
does not expose a camelCase accessible-label alias. When `iconOnly` is enabled,
visible `children` are not rendered; use `aria-label` as the accessible action
name. Button also accepts standard `button` attributes such as `type`,
`className`, and `onClick`; its default `type` is `button`.

## Checkbox

Boolean input with controlled and uncontrolled modes, helper text, validation
state, and mixed selection support.

```tsx
import { Checkbox } from '@vellira-ui/react';

<Checkbox
  checked={accepted}
  onCheckedChange={setAccepted}
  label='Accept terms'
  description='Required to continue.'
/>;
```

```tsx
<Checkbox
  label='Marketing updates'
  description='Receive release notes and product emails.'
  checked={enabled}
  onCheckedChange={setEnabled}
  color='primary'
  size='md'
/>

<Checkbox label='Partially selected' indeterminate />

<Checkbox
  label='Required consent'
  required
  error='Accept terms to continue.'
/>
```

<!-- api-docgen:start web.CheckboxProps.Checkbox -->

| Prop                | Type                                                | Required | Description                                      |
| ------------------- | --------------------------------------------------- | -------- | ------------------------------------------------ |
| `label`             | `ReactNode`                                         | No       | Visible label rendered next to the control.      |
| `description`       | `ReactNode`                                         | No       | Helper text rendered below the checkbox row.     |
| `wrapperClassName`  | `string`                                            | No       | Extra CSS class for the clickable label wrapper. |
| `error`             | `string`                                            | No       | Error message rendered for invalid state.        |
| `checked`           | `boolean`                                           | No       | Controlled checked state.                        |
| `defaultChecked`    | `boolean`                                           | No       | Initial checked state for uncontrolled usage.    |
| `disabled`          | `boolean`                                           | No       | Disables interaction.                            |
| `required`          | `boolean`                                           | No       | Marks the checkbox as required.                  |
| `indeterminate`     | `boolean`                                           | No       | Displays and announces a mixed selection state.  |
| `size`              | `CheckboxSize`                                      | No       | Checkbox size.                                   |
| `onCheckedChange`   | `(checked: boolean) => void`                        | No       | Called when the user changes the state.          |
| `icon`              | `ReactNode`                                         | No       | Icon rendered inside the component.              |
| `indeterminateIcon` | `ReactNode`                                         | No       | —                                                |
| `color`             | `import("@vellira-ui/types").CheckboxColor`         | No       | —                                                |
| `labelPosition`     | `import("@vellira-ui/types").CheckboxLabelPosition` | No       | —                                                |

<!-- api-docgen:end web.CheckboxProps.Checkbox -->

Checkbox accepts standard `input[type="checkbox"]` attributes except the state
props controlled by Vellira (`checked`, `defaultChecked`, `onChange`, `type`,
and native `size`). `className` styles the root container; use
`wrapperClassName` for the clickable label row. When no visible `label` is
rendered, provide `aria-label` or `aria-labelledby`; the icon-only hit target
remains at least 44px square. `description` and `error` are associated through
`aria-describedby`.

## Switch

Boolean setting control for immediate on/off preferences.

```tsx
import { Switch } from '@vellira-ui/react';

<Switch accessibilityLabel='Enable notifications' defaultChecked />;
```

<!-- api-docgen:start web.SwitchProps.Switch -->

| Prop                 | Type                         | Required | Description                                        |
| -------------------- | ---------------------------- | -------- | -------------------------------------------------- |
| `accessibilityLabel` | `string`                     | No       | Accessible name announced by assistive technology. |
| `checked`            | `boolean`                    | No       | Controlled checked state.                          |
| `defaultChecked`     | `boolean`                    | No       | Initial checked state for uncontrolled usage.      |
| `disabled`           | `boolean`                    | No       | Disables interaction.                              |
| `required`           | `boolean`                    | No       | Marks the control as required.                     |
| `invalid`            | `boolean`                    | No       | Marks the control as invalid.                      |
| `onCheckedChange`    | `(checked: boolean) => void` | No       | Called when the checked state changes.             |

<!-- api-docgen:end web.SwitchProps.Switch -->

## Input

Labeled text input with shared value contract and web input attributes.

```tsx
import { Input } from '@vellira-ui/react';

<Input
  label='Email'
  value={email}
  onValueChange={setEmail}
  type='email'
  placeholder='name@example.com'
/>;
```

Clearable inputs use separate callbacks for typing and clear actions:

- typing into the input calls `onValueChange`;
- pressing the clear action calls `onClear`;
- controlled inputs should clear their value inside `onClear`;
- uncontrolled inputs clear their internal value and then call `onClear`.

`endIcon` is a decorative icon slot. Use clear, reveal, loading, prefix, suffix,
and addon props for built-in input affordances.

<!-- api-docgen:start web.InputProps.Input -->

| Prop               | Type                                    | Required | Description                                                                 |
| ------------------ | --------------------------------------- | -------- | --------------------------------------------------------------------------- |
| `id`               | `string`                                | No       | Input id. Generated internally when omitted.                                |
| `className`        | `string`                                | No       | Extra CSS class for the input element.                                      |
| `autoComplete`     | `string`                                | No       | HTML autocomplete value.                                                    |
| `name`             | `string`                                | No       | —                                                                           |
| `description`      | `string`                                | No       | Additional descriptive text.                                                |
| `clearIcon`        | `ReactNode`                             | No       | —                                                                           |
| `type`             | `HTMLInputTypeAttribute`                | No       | HTML input type.                                                            |
| `value`            | `string \| number \| readonly string[]` | No       | Controlled value.                                                           |
| `defaultValue`     | `string \| number \| readonly string[]` | No       | Initial uncontrolled value.                                                 |
| `label`            | `string`                                | No       | Visible label.                                                              |
| `placeholder`      | `string`                                | No       | Placeholder text.                                                           |
| `size`             | `InputSize`                             | No       | Input size.                                                                 |
| `disabled`         | `boolean`                               | No       | Disables interaction.                                                       |
| `readOnly`         | `boolean`                               | No       | Marks the input as read-only.                                               |
| `required`         | `boolean`                               | No       | Marks the field as required.                                                |
| `clearable`        | `boolean`                               | No       | Shows a clear action when the input has a value.                            |
| `onClear`          | `() => void`                            | No       | Called when the clear action is pressed.                                    |
| `error`            | `string`                                | No       | Error message rendered for invalid state.                                   |
| `clearIconTone`    | `InputAdornmentTone`                    | No       | Color tone for the clear icon.                                              |
| `onValueChange`    | `(value: string) => void`               | No       | Called when the value changes.                                              |
| `startIcon`        | `ReactNode`                             | No       | —                                                                           |
| `endIcon`          | `ReactNode`                             | No       | —                                                                           |
| `startAddon`       | `ReactNode`                             | No       | —                                                                           |
| `endAddon`         | `ReactNode`                             | No       | —                                                                           |
| `prefix`           | `ReactNode`                             | No       | —                                                                           |
| `suffix`           | `ReactNode`                             | No       | —                                                                           |
| `mask`             | `InputMask`                             | No       | —                                                                           |
| `format`           | `InputFormatter`                        | No       | —                                                                           |
| `parse`            | `InputParser`                           | No       | —                                                                           |
| `startIconTone`    | `InputAdornmentTone`                    | No       | Color tone for the start icon.                                              |
| `endIconTone`      | `InputAdornmentTone`                    | No       | Color tone for the end icon.                                                |
| `wrapperClassName` | `string`                                | No       | —                                                                           |
| `color`            | `InputColor`                            | No       | —                                                                           |
| `variant`          | `'bare' \| InputVariant`                | No       | Visual style: outline, filled, soft, or the web-only bare composition mode. |
| `invalid`          | `boolean`                               | No       | —                                                                           |
| `loading`          | `boolean`                               | No       | —                                                                           |
| `revealPassword`   | `boolean`                               | No       | —                                                                           |
| `showCounter`      | `boolean`                               | No       | —                                                                           |

<!-- api-docgen:end web.InputProps.Input -->

## FormField

Layout helper for labels, errors, and custom field controls.

```tsx
import { FormField, Input } from '@vellira-ui/react';

<FormField id='email' label='Email' error={error}>
  <Input id='email' />
</FormField>;
```

```tsx
<FormField
  label='Workspace'
  description='Connected through generated id and aria props.'
  error='Use lowercase letters, numbers and hyphens.'
  required
  bindControl
>
  <input placeholder='vellira-design' />
</FormField>

<FormField
  label='Horizontal field'
  description='Useful for dense settings rows.'
  orientation='horizontal'
  bindControl
>
  <input placeholder='workspace-slug' />
</FormField>
```

`FormField` uses `id` to connect the visible label and generated
`{id}-description` / `{id}-error` content with the control. Pass the same `id`
to the wrapped control and add `aria-describedby`, `aria-invalid`, `required`,
and `disabled` to that control when needed. The root wrapper does not receive the
`id`, which avoids duplicate DOM ids.

<!-- api-docgen:start web.FormFieldProps.FormField -->

| Prop                   | Type                         | Required | Description                                         |
| ---------------------- | ---------------------------- | -------- | --------------------------------------------------- |
| `id`                   | `string`                     | No       | ID used to connect the label with the control.      |
| `label`                | `ReactNode`                  | No       | Field label.                                        |
| `description`          | `ReactNode`                  | No       | Additional descriptive content.                     |
| `error`                | `ReactNode`                  | No       | Error message or custom validation content.         |
| `children`             | `ReactNode`                  | Yes      | Field control or custom content.                    |
| `required`             | `boolean`                    | No       | Marks the field as required.                        |
| `disabled`             | `boolean`                    | No       | Renders the disabled field state.                   |
| `controlClassName`     | `string`                     | No       | Extra CSS class for the control wrapper.            |
| `labelClassName`       | `string`                     | No       | Extra CSS class for the label element.              |
| `descriptionClassName` | `string`                     | No       | Extra CSS class for the description element.        |
| `errorClassName`       | `string`                     | No       | Extra CSS class for the validation message element. |
| `labelInfo`            | `ReactNode`                  | No       | —                                                   |
| `optionalText`         | `ReactNode`                  | No       | —                                                   |
| `bindControl`          | `boolean`                    | No       | —                                                   |
| `size`                 | `'sm' \| 'md' \| 'lg'`       | No       | Input size.                                         |
| `labelPosition`        | `'start' \| 'top'`           | No       | —                                                   |
| `invalid`              | `boolean`                    | No       | —                                                   |
| `orientation`          | `'vertical' \| 'horizontal'` | No       | —                                                   |
| `message`              | `ReactNode`                  | No       | —                                                   |
| `labelAction`          | `ReactNode`                  | No       | —                                                   |
| `messageClassName`     | `string`                     | No       | —                                                   |
| `messageTone`          | `FormFieldMessageTone`       | No       | —                                                   |
| `messageLive`          | `FormFieldMessageLive`       | No       | —                                                   |

<!-- api-docgen:end web.FormFieldProps.FormField -->

## RadioGroup

Single-selection group with controlled and uncontrolled modes.

```tsx
import { Radio, RadioGroup } from '@vellira-ui/react';

<RadioGroup
  name='plan'
  label='Plan'
  defaultValue='basic'
  orientation='vertical'
>
  <Radio value='basic' label='Basic' />
  <Radio value='pro' label='Pro' />
</RadioGroup>;
```

```tsx
<RadioGroup
  name='billing-plan'
  label='Billing plan'
  description='Choose one plan for this workspace.'
  value={plan}
  onValueChange={setPlan}
  color='primary'
  size='md'
>
  <Radio value='starter' label='Starter' />
  <Radio value='pro' label='Pro' />
  <Radio value='enterprise' label='Enterprise' />
</RadioGroup>

<RadioGroup
  name='delivery'
  label='Delivery'
  orientation='horizontal'
  color='success'
  defaultValue='standard'
>
  <Radio value='standard' label='Standard' />
  <Radio value='express' label='Express' />
  <Radio value='pickup' label='Pickup' disabled />
</RadioGroup>
```

### RadioGroup Props

<!-- api-docgen:start web.RadioGroupProps.RadioGroupProps -->

| Prop            | Type                          | Required | Description                           |
| --------------- | ----------------------------- | -------- | ------------------------------------- |
| `label`         | `ReactNode`                   | No       | Group label.                          |
| `name`          | `string`                      | No       | Radio input name.                     |
| `children`      | `ReactNode`                   | No       | Radio controls rendered by the group. |
| `error`         | `string`                      | No       | Error message.                        |
| `orientation`   | `RadioGroupOrientation`       | No       | Layout direction.                     |
| `value`         | `string`                      | No       | Controlled selected value.            |
| `defaultValue`  | `string`                      | No       | Initial value for uncontrolled usage. |
| `onValueChange` | `(value: RadioValue) => void` | No       | Called when selection changes.        |
| `required`      | `boolean`                     | No       | Marks the group as required.          |
| `disabled`      | `boolean`                     | No       | Disables the whole group.             |
| `description`   | `ReactNode`                   | No       | Additional descriptive text.          |
| `size`          | `RadioSize`                   | No       | Size inherited by child radios.       |
| `color`         | `RadioColor`                  | No       | —                                     |
| `invalid`       | `boolean`                     | No       | —                                     |

<!-- api-docgen:end web.RadioGroupProps.RadioGroupProps -->

### Radio Props

<!-- api-docgen:start web.RadioProps.RadioProps -->

| Prop               | Type                         | Required | Description                                           |
| ------------------ | ---------------------------- | -------- | ----------------------------------------------------- |
| `value`            | `string`                     | Yes      | Value submitted by the radio control.                 |
| `label`            | `ReactNode`                  | No       | Text label displayed next to the radio control.       |
| `description`      | `ReactNode`                  | No       | Additional supporting text displayed below the label. |
| `checked`          | `boolean`                    | No       | Current checked state for controlled usage.           |
| `defaultChecked`   | `boolean`                    | No       | Initial checked state for uncontrolled usage.         |
| `onCheckedChange`  | `(checked: boolean) => void` | No       | Called when the standalone checked state changes.     |
| `disabled`         | `boolean`                    | No       | Disables user interaction.                            |
| `required`         | `boolean`                    | No       | Marks the radio control as required.                  |
| `error`            | `string`                     | No       | Validation error message displayed under the radio.   |
| `size`             | `RadioSize`                  | No       | Radio control size.                                   |
| `wrapperClassName` | `string`                     | No       | Class name applied to the clickable label wrapper.    |
| `icon`             | `ReactNode`                  | No       | Icon rendered inside the component.                   |
| `color`            | `RadioColor`                 | No       | —                                                     |

<!-- api-docgen:end web.RadioProps.RadioProps -->

`RadioGroup color` sets the default selected color for child radios. Individual
`Radio` items can override it with their own `color`. Use `icon` on `Radio`
only when the default selected dot should be replaced by a product-specific
indicator.

## Select

Single-selection or multiple-selection dropdown field.

```tsx
import { Select } from '@vellira-ui/react';

<Select
  label='Country'
  value={country}
  onValueChange={setCountry}
  placeholder='Choose country'
>
  <Select.Item value='fr'>France</Select.Item>
  <Select.Item value='us'>United States</Select.Item>
</Select>;
```

### Select Usage Guidelines

Use `Select` when the user chooses one or more saved values from a compact list and the
available choices do not need to stay visible after selection. Use
`RadioGroup` when there are only a few choices and comparing them side by side
helps the decision. Use `Dropdown` for action menus such as copy, rename or
delete, not for form values.

### Select Accessibility Notes

Provide a visible `label` whenever possible. If the UI cannot show a label, pass
`aria-label` so the trigger has a stable accessible name. Error content is
connected to the trigger through `aria-describedby` and marks the trigger
invalid. Keyboard users can open the list with Enter, Space or Arrow keys,
navigate with ArrowUp/ArrowDown, jump with Home/End, type to search matching
options, select with Enter or Space, and close with Escape. Long lists reopen
with the selected option active and scrolled into view.

### Select Compound API

Use `Select.Item` to declare options. `Select.Trigger` and `Select.Content` are
available when the trigger or dropdown placement needs to be composed
explicitly. The public compound parts are `Select.Trigger`, `Select.Value`,
`Select.Icon`, `Select.Content`, `Select.Search`, `Select.Group`,
`Select.Label`, `Select.Item`, `Select.ItemIcon`,
`Select.ItemDescription`, `Select.ItemBadge`, `Select.Separator`,
`Select.Empty`, and `Select.Loading`.

```tsx
<Select value={country} onValueChange={setCountry}>
  <Select.Trigger />
  <Select.Content>
    <Select.Item value='fr'>France</Select.Item>
    <Select.Item value='de'>Germany</Select.Item>
  </Select.Content>
</Select>
```

Advanced usage can stay in the same component instead of switching to a
separate MultiSelect or AsyncSelect:

```tsx
<Select
  label='Teams'
  description='Choose teams by item or group.'
  value={teams}
  onValueChange={setTeams}
  multiple
  maxSelected={12}
  closeOnSelect={false}
  searchable
  clearable
  color='primary'
  variant='outline'
>
  <Select.Group label='Core teams' selectable selectLabel='All core teams'>
    <Select.Item value='product'>Product</Select.Item>
    <Select.Item value='engineering'>Engineering</Select.Item>
    <Select.Item value='design'>Design</Select.Item>
    <Select.Item value='research'>Research</Select.Item>
    <Select.Item value='data'>Data</Select.Item>
  </Select.Group>
  <Select.Separator />
  <Select.Group label='Operations' selectable>
    <Select.Item value='support'>Support</Select.Item>
    <Select.Item value='success'>Success</Select.Item>
    <Select.Item value='sales'>Sales</Select.Item>
    <Select.Item value='marketing'>Marketing</Select.Item>
    <Select.Item value='finance'>Finance</Select.Item>
  </Select.Group>
  <Select.Separator />
  <Select.Group label='Platform' selectable>
    <Select.Item value='infrastructure'>Infrastructure</Select.Item>
    <Select.Item value='security'>Security</Select.Item>
    <Select.Item value='devex'>Developer Experience</Select.Item>
    <Select.Item value='qa'>QA</Select.Item>
  </Select.Group>
</Select>
```

In multiple mode, `Select.Group selectable` adds a group-level action. The action
selects enabled group items until `maxSelected` is reached, reports mixed state
when only some group items are selected, and clears the group when all selectable
group items are selected. When more than 10 values are selected, the trigger
shows the first 10 labels and a `+N` overflow count.

### Select Props

<!-- api-docgen:start web.SelectProps.SelectProps -->

| Prop                | Type                                                                      | Required | Description                                      |
| ------------------- | ------------------------------------------------------------------------- | -------- | ------------------------------------------------ |
| `label`             | `ReactNode`                                                               | No       | Visible field label.                             |
| `id`                | `string`                                                                  | No       | Trigger id.                                      |
| `name`              | `string`                                                                  | No       | Field name.                                      |
| `placeholder`       | `string`                                                                  | No       | Text shown when no value is selected.            |
| `error`             | `ReactNode`                                                               | No       | Error message.                                   |
| `className`         | `string`                                                                  | No       | Extra CSS class for the root element.            |
| `value`             | `string \| null \| SelectMultipleValue`                                   | No       | Controlled selected value.                       |
| `defaultValue`      | `string \| null \| SelectMultipleValue`                                   | No       | Initial selected value for uncontrolled usage.   |
| `required`          | `boolean`                                                                 | No       | Marks the field as required.                     |
| `disabled`          | `boolean`                                                                 | No       | Disables interaction.                            |
| `description`       | `ReactNode`                                                               | No       | Additional descriptive text.                     |
| `placement`         | `'top' \| 'right' \| 'bottom' \| 'left'`                                  | No       | Preferred dropdown placement.                    |
| `matchTriggerWidth` | `boolean`                                                                 | No       | Matches the dropdown width to the trigger width. |
| `open`              | `boolean`                                                                 | No       | Controlled open state.                           |
| `defaultOpen`       | `boolean`                                                                 | No       | Initial uncontrolled open state.                 |
| `onOpenChange`      | `(open: boolean) => void`                                                 | No       | Called when the open state changes.              |
| `triggerClassName`  | `string`                                                                  | No       | Extra CSS class for the trigger element.         |
| `dropdownClassName` | `string`                                                                  | No       | Extra CSS class for the dropdown element.        |
| `size`              | `SelectSize`                                                              | No       | Select size.                                     |
| `aria-label`        | `string`                                                                  | No       | Accessible trigger label.                        |
| `onBlur`            | `FocusEventHandler<HTMLButtonElement>`                                    | No       | Called when the trigger loses focus.             |
| `onFocus`           | `FocusEventHandler<HTMLButtonElement>`                                    | No       | Called when the trigger receives focus.          |
| `aria-describedby`  | `string`                                                                  | No       | —                                                |
| `aria-labelledby`   | `string`                                                                  | No       | —                                                |
| `empty`             | `ReactNode`                                                               | No       | —                                                |
| `loadingText`       | `ReactNode`                                                               | No       | —                                                |
| `portal`            | `boolean`                                                                 | No       | —                                                |
| `onSearch`          | `(value: string) => void`                                                 | No       | —                                                |
| `onClear`           | `() => void`                                                              | No       | Called when the clear action is pressed.         |
| `startIcon`         | `ReactNode`                                                               | No       | —                                                |
| `endIcon`           | `ReactNode`                                                               | No       | —                                                |
| `prefix`            | `ReactNode`                                                               | No       | —                                                |
| `suffix`            | `ReactNode`                                                               | No       | —                                                |
| `renderValue`       | `(context: SelectRenderValueContext) => ReactNode`                        | No       | —                                                |
| `renderOption`      | `(context: SelectRenderOptionContext) => ReactNode`                       | No       | —                                                |
| `color`             | `SelectColor`                                                             | No       | —                                                |
| `invalid`           | `boolean`                                                                 | No       | —                                                |
| `onValueChange`     | `(value: string \| null) => void \| (value: SelectMultipleValue) => void` | No       | Called when the selected value changes.          |
| `variant`           | `SelectVariant`                                                           | No       | —                                                |
| `loading`           | `boolean`                                                                 | No       | —                                                |
| `clearable`         | `boolean`                                                                 | No       | Shows a clear action when the input has a value. |
| `searchable`        | `boolean`                                                                 | No       | —                                                |
| `multiple`          | `false \| true`                                                           | No       | —                                                |
| `maxSelected`       | `number`                                                                  | No       | —                                                |
| `closeOnSelect`     | `boolean`                                                                 | No       | —                                                |
| `children`          | `ReactNode`                                                               | No       | Content rendered inside the component.           |
| `virtual`           | `boolean \| SelectVirtualConfig`                                          | No       | —                                                |
| `avoidCollisions`   | `boolean`                                                                 | No       | —                                                |
| `modal`             | `boolean`                                                                 | No       | —                                                |
| `command`           | `boolean`                                                                 | No       | —                                                |

<!-- api-docgen:end web.SelectProps.SelectProps -->

### SelectOption

<!-- api-docgen:start web.SelectOption.SelectOption -->

| Prop          | Type          | Required | Description                         |
| ------------- | ------------- | -------- | ----------------------------------- |
| `label`       | `string`      | Yes      | Visible option label.               |
| `value`       | `string`      | Yes      | Option value.                       |
| `disabled`    | `boolean`     | No       | Disables this option.               |
| `icon`        | `ReactNode`   | No       | Icon rendered inside the component. |
| `color`       | `SelectColor` | No       | —                                   |
| `description` | `ReactNode`   | No       | Additional descriptive text.        |
| `badge`       | `ReactNode`   | No       | —                                   |
| `shortcut`    | `string`      | No       | —                                   |

<!-- api-docgen:end web.SelectOption.SelectOption -->

## Dropdown

Action menu component with compound trigger, content, item, group, checkbox,
radio, and submenu parts.

```tsx
import { Dropdown } from '@vellira-ui/react';

<Dropdown placement='bottom-end'>
  <Dropdown.Trigger>Actions</Dropdown.Trigger>
  <Dropdown.Content>
    <Dropdown.Group>
      <Dropdown.Label>File</Dropdown.Label>
      <Dropdown.Item onSelect={handleEdit}>Edit</Dropdown.Item>
    </Dropdown.Group>
    <Dropdown.Separator />
    <Dropdown.Item color='danger' onSelect={handleDelete}>
      Delete
    </Dropdown.Item>
  </Dropdown.Content>
</Dropdown>;
```

### Dropdown Usage Guidelines

Use `Dropdown` for contextual actions such as copy, rename, archive, delete or
account commands. It should not be used as a form value control. Use `Select`
when the user chooses one saved value from a compact list. Use `RadioGroup`
when a small set of choices should stay visible.

The menu open state can be controlled with `open` and `onOpenChange`, or left
uncontrolled with `defaultOpen`. Prefer `Dropdown.Trigger asChild` with
`Button` when the trigger needs Button styling.

### Dropdown Props

<!-- api-docgen:start web.DropdownProps.DropdownProps -->

| Prop                 | Type                      | Required | Description                                                                |
| -------------------- | ------------------------- | -------- | -------------------------------------------------------------------------- |
| `placement`          | `Placement`               | No       | Floating UI menu placement.                                                |
| `className`          | `string`                  | No       | Extra CSS class for the root element.                                      |
| `matchTriggerWidth`  | `boolean`                 | No       | Makes the menu match the trigger width.                                    |
| `disabled`           | `boolean`                 | No       | Disables the trigger.                                                      |
| `size`               | `DropdownSize`            | No       | Dropdown size.                                                             |
| `open`               | `boolean`                 | No       | Controlled open state.                                                     |
| `defaultOpen`        | `boolean`                 | No       | Initial uncontrolled open state.                                           |
| `onOpenChange`       | `(open: boolean) => void` | No       | Called when the open state changes.                                        |
| `children`           | `ReactNode`               | Yes      | Content rendered inside the component.                                     |
| `color`              | `DropdownColor`           | No       | Semantic palette for trigger, content, focus, and item interaction states. |
| `offset`             | `number`                  | No       | —                                                                          |
| `minWidth`           | `string \| number`        | No       | —                                                                          |
| `maxWidth`           | `string \| number`        | No       | —                                                                          |
| `portal`             | `boolean`                 | No       | —                                                                          |
| `avoidCollisions`    | `boolean`                 | No       | —                                                                          |
| `modal`              | `boolean`                 | No       | —                                                                          |
| `closeOnSelect`      | `boolean`                 | No       | —                                                                          |
| `loop`               | `boolean`                 | No       | Loops keyboard navigation from last to first and first to last.            |
| `loading`            | `boolean`                 | No       | —                                                                          |
| `loadingText`        | `ReactNode`               | No       | —                                                                          |
| `searchable`         | `boolean`                 | No       | —                                                                          |
| `command`            | `boolean`                 | No       | —                                                                          |
| `searchValue`        | `string`                  | No       | —                                                                          |
| `defaultSearchValue` | `string`                  | No       | —                                                                          |
| `searchPlaceholder`  | `string`                  | No       | —                                                                          |
| `onSearch`           | `(value: string) => void` | No       | —                                                                          |
| `empty`              | `ReactNode`               | No       | —                                                                          |
| `collisionPadding`   | `number`                  | No       | —                                                                          |
| `strategy`           | `Strategy`                | No       | —                                                                          |

<!-- api-docgen:end web.DropdownProps.DropdownProps -->

### Dropdown Parts

Use `Dropdown.Item onSelect` instead of `onClick`; it covers pointer, keyboard,
and touch selection. Use `Dropdown.CheckboxItem` for toggle actions and
`Dropdown.RadioGroup` with `Dropdown.RadioItem` for mutually exclusive menu
settings. Ordinary `Dropdown.Item` has no persistent selected state.

## Tabs

Compound tab navigation with keyboard support.

```tsx
import { Tabs } from '@vellira-ui/react';

<Tabs defaultValue='overview' orientation='horizontal' variant='line'>
  <Tabs.List aria-label='Settings sections'>
    <Tabs.Trigger value='overview'>Overview</Tabs.Trigger>
    <Tabs.Trigger value='settings'>Settings</Tabs.Trigger>
    <Tabs.Indicator />
  </Tabs.List>

  <Tabs.Content value='overview'>Overview content</Tabs.Content>
  <Tabs.Content value='settings'>Settings content</Tabs.Content>
</Tabs>;
```

Tabs use stable string values. `Tabs.Trigger value` must match
`Tabs.Content value`; the selected panel does not depend on render order. Use
`Tabs.List scrollable` for horizontally scrollable tab rows.

Keyboard navigation supports Arrow keys, `Home`, and `End`. In automatic mode,
focus selects the next tab; in manual mode, `Enter` or `Space` selects the
focused tab. `PageUp` and `PageDown` are intentionally not handled by Tabs.

Mounting defaults to only the active panel. `keepMounted`, `lazyMount`, and
`Tabs.Content forceMount` control panel lifetime when local state or expensive
content needs to be preserved.

### Tabs Props

<!-- api-docgen:start web.TabsProps.TabsProps -->

| Prop             | Type                         | Required | Description                                                                               |
| ---------------- | ---------------------------- | -------- | ----------------------------------------------------------------------------------------- |
| `children`       | `ReactNode`                  | Yes      | `Tabs.List`, `Tabs.Trigger`, and `Tabs.Content` content.                                  |
| `orientation`    | `Orientation`                | No       | Keyboard and layout orientation.                                                          |
| `value`          | `string`                     | No       | Controlled selected value.                                                                |
| `defaultValue`   | `string`                     | No       | Initial selected value for uncontrolled usage.                                            |
| `onValueChange`  | `(value: TabsValue) => void` | No       | Called when the selected value changes.                                                   |
| `activationMode` | `TabsActivationMode`         | No       | Keyboard activation mode: automatic selects on focus, manual selects with Enter or Space. |
| `loop`           | `boolean`                    | No       | Loops keyboard navigation from last to first and first to last.                           |
| `keepMounted`    | `boolean`                    | No       | Keeps all content mounted and hides inactive panels.                                      |
| `lazyMount`      | `boolean`                    | No       | Mounts content only after its value has been activated.                                   |
| `variant`        | `TabsVariant`                | No       | Visual style: line, pills, or segmented.                                                  |
| `color`          | `TabsColor`                  | No       | Visual tone: primary, neutral, success, warning, or danger.                               |
| `size`           | `TabsSize`                   | No       | Tabs size.                                                                                |
| `dir`            | `'ltr' \| 'rtl'`             | No       | Text direction used for horizontal keyboard navigation and indicator positioning.         |
| `disabled`       | `boolean`                    | No       | Disables interaction.                                                                     |
| `mode`           | `TabsMode`                   | No       | —                                                                                         |

<!-- api-docgen:end web.TabsProps.TabsProps -->

### Tabs.List Props

<!-- api-docgen:start web.TabsListProps.TabsListProps -->

| Prop         | Type        | Required | Description                                 |
| ------------ | ----------- | -------- | ------------------------------------------- |
| `children`   | `ReactNode` | Yes      | Tab triggers.                               |
| `scrollable` | `boolean`   | No       | Makes the tab list horizontally scrollable. |

<!-- api-docgen:end web.TabsListProps.TabsListProps -->

### Tabs.Indicator Props

<!-- api-docgen:start web.TabsIndicatorProps.TabsIndicatorProps -->

| Prop        | Type     | Required | Description                      |
| ----------- | -------- | -------- | -------------------------------- |
| `className` | `string` | No       | Extra CSS class for the element. |

<!-- api-docgen:end web.TabsIndicatorProps.TabsIndicatorProps -->

### Tabs.Trigger Props

<!-- api-docgen:start web.TabsTriggerProps.TabsTriggerProps -->

| Prop          | Type        | Required | Description                                                                  |
| ------------- | ----------- | -------- | ---------------------------------------------------------------------------- |
| `children`    | `ReactNode` | No       | Tab label content.                                                           |
| `icon`        | `ReactNode` | No       | Icon rendered before the label. Explicit Tabs.Icon children take precedence. |
| `disabled`    | `boolean`   | No       | Disables this trigger.                                                       |
| `value`       | `string`    | Yes      | Stable trigger value matched with Tabs.Content.                              |
| `badge`       | `ReactNode` | No       | Badge rendered after the label.                                              |
| `description` | `ReactNode` | No       | Secondary text rendered below the trigger label.                             |
| `asChild`     | `boolean`   | No       | —                                                                            |

<!-- api-docgen:end web.TabsTriggerProps.TabsTriggerProps -->

### Tabs.Icon and Tabs.Badge Props

`Tabs.Icon` and `Tabs.Badge` accept `children` and optional `className`. Use
these compound slots when trigger content needs custom ordering or richer
markup. If `Tabs.Trigger` receives both the `icon` prop and an explicit
`Tabs.Icon` child, the explicit compound slot takes precedence in development.

### Tabs.Content Props

<!-- api-docgen:start web.TabsContentProps.TabsContentProps -->

| Prop         | Type        | Required | Description                                                        |
| ------------ | ----------- | -------- | ------------------------------------------------------------------ |
| `children`   | `ReactNode` | Yes      | Tab content.                                                       |
| `value`      | `string`    | Yes      | Stable content value matched with Tabs.Trigger.                    |
| `forceMount` | `boolean`   | No       | Keeps this content mounted regardless of the root mounting policy. |

<!-- api-docgen:end web.TabsContentProps.TabsContentProps -->

## Tooltip

Floating helper text that appears around a target element. Compose web Tooltip
with `Tooltip.Trigger`, `Tooltip.Content`, and optional `withArrow`.
`Tooltip.Trigger asChild` should be used when the trigger already has its own
button or control semantics.

```tsx
import { Button, Portal, Tooltip } from '@vellira-ui/react';

<Tooltip placement='top'>
  <Tooltip.Trigger asChild>
    <Button aria-label='More actions'>...</Button>
  </Tooltip.Trigger>
  <Portal>
    <Tooltip.Content withArrow>More actions</Tooltip.Content>
  </Portal>
</Tooltip>;
```

<!-- api-docgen:start web.TooltipProps.Tooltip -->

| Prop                | Type                                                          | Required | Description                                                      |
| ------------------- | ------------------------------------------------------------- | -------- | ---------------------------------------------------------------- |
| `children`          | `ReactNode`                                                   | Yes      | Content rendered inside the component.                           |
| `open`              | `boolean`                                                     | No       | Controlled open state.                                           |
| `defaultOpen`       | `boolean`                                                     | No       | Initial uncontrolled open state.                                 |
| `onOpenChange`      | `(open: boolean) => void`                                     | No       | Called when the open state changes.                              |
| `delay`             | `number \| Partial<import("@vellira-ui/types").TooltipDelay>` | No       | Open delay in milliseconds, or explicit open/close delays.       |
| `skipDelay`         | `number`                                                      | No       | Delay window for future sibling tooltip delay skipping.          |
| `offset`            | `number`                                                      | No       | Distance between trigger and content in pixels.                  |
| `interactive`       | `boolean`                                                     | No       | Allows pointer interaction inside tooltip content.               |
| `portal`            | `boolean`                                                     | No       | Reserved for automatic portal rendering in higher-level helpers. |
| `avoidCollisions`   | `boolean`                                                     | No       | Allows the tooltip to flip or shift to stay in viewport.         |
| `matchTriggerWidth` | `boolean`                                                     | No       | Matches tooltip content width to the trigger width.              |
| `disabled`          | `boolean`                                                     | No       | Disables interaction.                                            |
| `placement`         | `FloatingPlacement`                                           | No       | Preferred tooltip placement.                                     |

<!-- api-docgen:end web.TooltipProps.Tooltip -->

### Tooltip.Trigger Props

<!-- api-docgen:start web.TooltipTriggerProps.TooltipTriggerProps -->

| Prop       | Type        | Required | Description                                            |
| ---------- | ----------- | -------- | ------------------------------------------------------ |
| `asChild`  | `boolean`   | No       | Composes trigger behavior onto a single child element. |
| `children` | `ReactNode` | Yes      | Trigger element or content.                            |
| `disabled` | `boolean`   | No       | Disables this trigger.                                 |

<!-- api-docgen:end web.TooltipTriggerProps.TooltipTriggerProps -->

### Tooltip.Content Props

<!-- api-docgen:start web.TooltipContentProps.TooltipContentProps -->

| Prop         | Type            | Required | Description                                                        |
| ------------ | --------------- | -------- | ------------------------------------------------------------------ |
| `children`   | `ReactNode`     | Yes      | Content rendered inside the component.                             |
| `forceMount` | `boolean`       | No       | Keeps the tooltip content mounted even when the tooltip is closed. |
| `className`  | `string`        | No       | Extra CSS class for the root element.                              |
| `style`      | `CSSProperties` | No       | Extra root style.                                                  |
| `withArrow`  | `boolean`       | No       | —                                                                  |

<!-- api-docgen:end web.TooltipContentProps.TooltipContentProps -->

## Portal

Shared primitive for rendering overlay layers into `#overlay-root`, `document.body`, a provider container, or an explicit container.

```tsx
import { Portal } from '@vellira-ui/react';

<Portal>
  <div role='dialog'>Content</div>
</Portal>;
```

| Prop        | Type                                  | Required | Description                              |
| ----------- | ------------------------------------- | -------- | ---------------------------------------- |
| `children`  | `ReactNode`                           | Yes      | Content rendered into the portal target. |
| `container` | `Element \| DocumentFragment \| null` | No       | Overrides the default portal target.     |

### PortalProvider

Sets a default portal container for nested `Portal` instances.

```tsx
import { PortalProvider } from '@vellira-ui/react';

<PortalProvider container={overlayRoot}>
  <App />
</PortalProvider>;
```

## Modal

Accessible compound dialog with backdrop, keyboard close behavior, focus management, and content sections.

```tsx
import { Button, Modal, Portal } from '@vellira-ui/react';

<Modal open={open} onOpenChange={setOpen}>
  <Modal.Trigger asChild>
    <Button>Open modal</Button>
  </Modal.Trigger>
  <Portal>
    <Modal.Overlay />
    <Modal.Content size='md' scrollBehavior='inside'>
      <Modal.Header>
        <div>
          <Modal.Title>Delete file</Modal.Title>
          <Modal.Description>This action cannot be undone.</Modal.Description>
        </div>
        <Modal.Close />
      </Modal.Header>
      <Modal.Body>Are you sure you want to delete this file?</Modal.Body>
      <Modal.Footer>
        <Modal.Close asChild>
          <Button color='neutral' appearance='ghost'>
            Cancel
          </Button>
        </Modal.Close>
      </Modal.Footer>
    </Modal.Content>
  </Portal>
</Modal>;
```

### Modal Props

<!-- api-docgen:start web.ModalProps.ModalProps -->

| Prop                   | Type                                   | Required | Description                           |
| ---------------------- | -------------------------------------- | -------- | ------------------------------------- |
| `children`             | `ReactNode`                            | Yes      | Modal content.                        |
| `open`                 | `boolean`                              | No       | Controls dialog visibility.           |
| `defaultOpen`          | `boolean`                              | No       | Initial uncontrolled open state.      |
| `onOpenChange`         | `(open: boolean) => void`              | No       | Called when the open state changes.   |
| `closeOnEscape`        | `boolean`                              | No       | Allows closing with Escape.           |
| `closeOnOutsidePress`  | `boolean`                              | No       | Allows closing by pressing outside.   |
| `preventScroll`        | `boolean`                              | No       | Locks background scroll while open.   |
| `restoreFocus`         | `boolean`                              | No       | Restores focus when the modal closes. |
| `trapFocus`            | `boolean`                              | No       | Keeps focus inside the dialog.        |
| `role`                 | `'dialog' \| 'alertdialog'`            | No       | Dialog semantic role.                 |
| `modal`                | `boolean`                              | No       | —                                     |
| `initialFocus`         | `RefObject<HTMLElement>`               | No       | —                                     |
| `finalFocus`           | `RefObject<HTMLElement>`               | No       | —                                     |
| `onOpenAutoFocus`      | `(event: ModalAutoFocusEvent) => void` | No       | —                                     |
| `onCloseAutoFocus`     | `(event: ModalAutoFocusEvent) => void` | No       | —                                     |
| `onEscapeKeyDown`      | `(event: KeyboardEvent) => void`       | No       | —                                     |
| `onPointerDownOutside` | `(event: ModalOutsideEvent) => void`   | No       | —                                     |
| `onInteractOutside`    | `(event: ModalOutsideEvent) => void`   | No       | —                                     |
| `className`            | `string`                               | No       | Extra CSS class for the root element. |
| `animation`            | `ModalAnimation`                       | No       | —                                     |
| `duration`             | `ModalAnimationDuration`               | No       | —                                     |
| `easing`               | `ModalAnimationEasing`                 | No       | —                                     |

<!-- api-docgen:end web.ModalProps.ModalProps -->

### Modal Compound Components

| Component           | Description              |
| ------------------- | ------------------------ |
| `Modal.Trigger`     | Opens the modal.         |
| `Modal.Overlay`     | Backdrop layer.          |
| `Modal.Content`     | Main dialog surface.     |
| `Modal.Header`      | Header/title section.    |
| `Modal.Title`       | Accessible dialog title. |
| `Modal.Description` | Accessible description.  |
| `Modal.Body`        | Body section.            |
| `Modal.Footer`      | Action/footer section.   |
| `Modal.Close`       | Closes the modal.        |

### Modal Accessibility

Use `Modal.Title` for a visible title or pass `ariaLabel` to `Modal.Content`. Use `Modal.Description` when the dialog needs descriptive text, especially for `alertdialog`.

## ThemeProvider

Provides theme context for all Vellira components.

```tsx
import '@vellira-ui/tokens/css';
import { ThemeProvider } from '@vellira-ui/react';

<ThemeProvider defaultTheme='dark'>
  <App />
</ThemeProvider>;
```

### ThemeProvider Props

<!-- api-docgen:start web.ThemeProviderProps.ThemeProvider -->

<!-- api-docgen:start web.ThemeProviderProps.ThemeProviderProps -->

| Prop            | Type                         | Required | Description                               |
| --------------- | ---------------------------- | -------- | ----------------------------------------- |
| `children`      | `ReactNode`                  | Yes      | Content wrapped by the provider.          |
| `theme`         | `ThemeName`                  | No       | Controlled theme value.                   |
| `defaultTheme`  | `ThemeName`                  | No       | Initial theme for uncontrolled usage.     |
| `onThemeChange` | `(theme: ThemeName) => void` | No       | Called whenever the active theme changes. |
| `syncDocument`  | `boolean`                    | No       | —                                         |

<!-- api-docgen:end web.ThemeProviderProps.ThemeProviderProps -->
<!-- api-docgen:end web.ThemeProviderProps.ThemeProvider -->

### Supported Themes

| Theme           | Description                         |
| --------------- | ----------------------------------- |
| `light`         | Default light theme.                |
| `dark`          | Dark theme.                         |
| `high-contrast` | High contrast theme.                |
| `highContrast`  | Alias accepted by the provider API. |

### Controlled

```tsx
import { useState } from 'react';

const [theme, setTheme] = useState('light');

<ThemeProvider theme={theme} onThemeChange={setTheme}>
  <App />
</ThemeProvider>;
```

### Uncontrolled

```tsx
<ThemeProvider defaultTheme='light'>
  <App />
</ThemeProvider>
```

The provider renders:

```html
<div data-vellira-theme="dark"></div>
```

## useTheme

Returns the current theme and a function to update it.

### Usage

```tsx
import { useTheme } from '@vellira-ui/react';

function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <button
      type='button'
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
    >
      Toggle theme
    </button>
  );
}
```

### Returns

| Property   | Type                         | Description               |
| ---------- | ---------------------------- | ------------------------- |
| `theme`    | `ThemeName`                  | Current active theme.     |
| `setTheme` | `(theme: ThemeName) => void` | Updates the active theme. |

> `useTheme` must be used inside `ThemeProvider`.

## Accessibility

All interactive components support:

- keyboard navigation
- focus management
- screen readers
- WAI-ARIA attributes where applicable

## Accordion

### Accordion Props

<!-- api-docgen:start web.AccordionProps.AccordionProps -->

| Prop            | Type                                                   | Required | Description                                                                 |
| --------------- | ------------------------------------------------------ | -------- | --------------------------------------------------------------------------- |
| `children`      | `ReactNode`                                            | No       | Content rendered inside the component.                                      |
| `type`          | `'single' \| 'multiple'`                               | No       | Selection mode: single allows one item, multiple allows several open items. |
| `value`         | `string \| string[]`                                   | No       | Controlled expanded value.                                                  |
| `defaultValue`  | `string \| string[]`                                   | No       | Initial expanded value for uncontrolled usage.                              |
| `onValueChange` | `(value: string) => void \| (value: string[]) => void` | No       | Called when the expanded value changes.                                     |
| `collapsible`   | `boolean`                                              | No       | Allows the open item to collapse in single mode.                            |
| `disabled`      | `boolean`                                              | No       | Disables every accordion item.                                              |

<!-- api-docgen:end web.AccordionProps.AccordionProps -->

### Accordion.Item Props

<!-- api-docgen:start web.AccordionItemProps.AccordionItemProps -->

| Prop       | Type        | Required | Description                            |
| ---------- | ----------- | -------- | -------------------------------------- |
| `children` | `ReactNode` | No       | Content rendered inside the component. |
| `value`    | `string`    | Yes      | Stable item value used by root state.  |
| `disabled` | `boolean`   | No       | Disables this item.                    |

<!-- api-docgen:end web.AccordionItemProps.AccordionItemProps -->

### Accordion.Trigger Props

<!-- api-docgen:start web.AccordionTriggerProps.AccordionTriggerProps -->

| Prop       | Type        | Required | Description                            |
| ---------- | ----------- | -------- | -------------------------------------- |
| `children` | `ReactNode` | No       | Content rendered inside the component. |
| `disabled` | `boolean`   | No       | Disables this trigger.                 |

<!-- api-docgen:end web.AccordionTriggerProps.AccordionTriggerProps -->

### Accordion.Content Props

<!-- api-docgen:start web.AccordionContentProps.AccordionContentProps -->

| Prop         | Type        | Required | Description                                                 |
| ------------ | ----------- | -------- | ----------------------------------------------------------- |
| `children`   | `ReactNode` | No       | Content rendered inside the component.                      |
| `forceMount` | `boolean`   | No       | Keeps this content mounted even when its item is collapsed. |

<!-- api-docgen:end web.AccordionContentProps.AccordionContentProps -->
