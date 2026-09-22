# Vellira Native Component API

API reference for `@vellira-ui/react-native`.

Import public components from the package root:

```tsx
import {
  Button,
  Checkbox,
  Switch,
  Input,
  Modal,
  Portal,
  Select,
  ThemeProvider,
  useTheme,
} from '@vellira-ui/react-native';
```

The native package uses React Native `StyleSheet` styles and consumes shared design tokens from `@vellira-ui/tokens`.

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
- Portal
- Modal
- ThemeProvider
- useTheme

## API Conventions

- Shared base contracts come from `@vellira-ui/types`.
- Native-only props such as `onPress`, `style`, `textStyle`, `ViewStyle`, and `TextStyle` stay in the native package.
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

`TooltipDelay` uses this shape:

```ts
type TooltipDelay = {
  open?: number;
  close?: number;
};
```

## Button

Pressable action component with appearances, sizes, optional icons, loading state,
and full-width layout support.

```tsx
import { Search } from '@vellira-ui/icons';
import { Button } from '@vellira-ui/react-native';

<Button color='primary' appearance='solid' size='md' onPress={handleSave}>
  Save
</Button>;

<Button accessibilityLabel='Search' iconOnly iconStart={<Search />} />;
```

<!-- api-docgen:start native.ButtonProps.Button -->

| Prop                 | Type                                     | Required | Description                                                         |
| -------------------- | ---------------------------------------- | -------- | ------------------------------------------------------------------- |
| `children`           | `ReactNode`                              | No       | Button content.                                                     |
| `iconStart`          | `ButtonIconElement`                      | No       | Icon rendered before content.                                       |
| `iconEnd`            | `ButtonIconElement`                      | No       | Icon rendered after content.                                        |
| `fullWidth`          | `boolean`                                | No       | Makes the component fill its container width.                       |
| `onPress`            | `(event: GestureResponderEvent) => void` | No       | React Native press handler.                                         |
| `style`              | `StyleProp<ViewStyle>`                   | No       | Extra root style.                                                   |
| `accessibilityLabel` | `string`                                 | No       | Accessible label for screen readers.                                |
| `iconSize`           | `number`                                 | No       | Overrides the size-derived icon size in pixels.                     |
| `size`               | `ButtonSize`                             | No       | Button size.                                                        |
| `disabled`           | `boolean`                                | No       | Disables interaction.                                               |
| `textStyle`          | `StyleProp<TextStyle>`                   | No       | Extra text style.                                                   |
| `testID`             | `string`                                 | No       | Test identifier.                                                    |
| `color`              | `ButtonColor`                            | No       | Visual tone: primary, neutral, success, warning, or danger.         |
| `loading`            | `boolean`                                | No       | Shows an activity indicator and disables interaction.               |
| `loadingText`        | `string`                                 | No       | Replaces visible content while loading.                             |
| `iconOnly`           | `boolean`                                | No       | Hides visible text for icon-only actions.                           |
| `badge`              | `ReactNode`                              | No       | Compact badge rendered after the label when not icon-only.          |
| `shortcut`           | `ReactNode`                              | No       | Keyboard shortcut hint rendered after the label when not icon-only. |
| `appearance`         | `ButtonAppearance`                       | No       | Visual style: solid, outline, ghost, soft, or link.                 |
| `shape`              | `ButtonShape`                            | No       | Corner shape: square, rounded, or pill.                             |

<!-- api-docgen:end native.ButtonProps.Button -->

Icon-only buttons must provide `accessibilityLabel`. Icons should be Vellira icon
elements such as `<Search />`; Button injects the current icon `color` and
`size`. When `iconOnly` is enabled, visible `children` are not rendered; use
`accessibilityLabel` as the accessible action name.

## Checkbox

Boolean input with controlled and uncontrolled modes, helper text, validation
state, and mixed selection support.

```tsx
import { Checkbox } from '@vellira-ui/react-native';

<Checkbox
  checked={accepted}
  onCheckedChange={setAccepted}
  label='Accept terms'
  description='Required to continue.'
/>;
```

<!-- api-docgen:start native.CheckboxProps.Checkbox -->

| Prop                | Type                                                | Required | Description                                   |
| ------------------- | --------------------------------------------------- | -------- | --------------------------------------------- |
| `label`             | `string`                                            | No       | Visible label rendered next to the control.   |
| `description`       | `string`                                            | No       | Helper text rendered below the checkbox row.  |
| `style`             | `StyleProp<ViewStyle>`                              | No       | Extra style for the clickable wrapper.        |
| `error`             | `string`                                            | No       | Error message rendered for invalid state.     |
| `checked`           | `boolean`                                           | No       | Controlled checked state.                     |
| `defaultChecked`    | `boolean`                                           | No       | Initial checked state for uncontrolled usage. |
| `disabled`          | `boolean`                                           | No       | Disables interaction.                         |
| `required`          | `boolean`                                           | No       | Marks the checkbox as required.               |
| `indeterminate`     | `boolean`                                           | No       | Displays a mixed selection state.             |
| `size`              | `CheckboxSize`                                      | No       | Checkbox size.                                |
| `onCheckedChange`   | `(checked: boolean) => void`                        | No       | Called when the user changes the state.       |
| `icon`              | `ReactNode`                                         | No       | Icon rendered inside the component.           |
| `indeterminateIcon` | `ReactNode`                                         | No       | —                                             |
| `color`             | `import("@vellira-ui/types").CheckboxColor`         | No       | —                                             |
| `labelPosition`     | `import("@vellira-ui/types").CheckboxLabelPosition` | No       | —                                             |

<!-- api-docgen:end native.CheckboxProps.Checkbox -->

`style` applies to the clickable `Pressable` row. When no visible `label` is
rendered, provide `accessibilityLabel`; the icon-only touch target remains at
least 44px square. `description`, `error`, and any explicit
`accessibilityHint` are merged into the resolved accessibility hint so
settings-style rows remain useful without wrapping the checkbox in `FormField`.

## Switch

Boolean setting control for immediate on/off preferences.

```tsx
import { Switch } from '@vellira-ui/react-native';

<Switch accessibilityLabel='Enable notifications' defaultChecked />;
```

<!-- api-docgen:start native.SwitchProps.Switch -->

| Prop                 | Type                         | Required | Description                                        |
| -------------------- | ---------------------------- | -------- | -------------------------------------------------- |
| `accessibilityLabel` | `string`                     | No       | Accessible name announced by assistive technology. |
| `checked`            | `boolean`                    | No       | Controlled checked state.                          |
| `defaultChecked`     | `boolean`                    | No       | Initial checked state for uncontrolled usage.      |
| `disabled`           | `boolean`                    | No       | Disables interaction.                              |
| `required`           | `boolean`                    | No       | Marks the control as required.                     |
| `invalid`            | `boolean`                    | No       | Marks the control as invalid.                      |
| `onCheckedChange`    | `(checked: boolean) => void` | No       | Called when the checked state changes.             |

<!-- api-docgen:end native.SwitchProps.Switch -->

## Input

Labeled native text input with shared value contract.

```tsx
import { Input } from '@vellira-ui/react-native';

<Input
  label='Email'
  value={email}
  onValueChange={setEmail}
  type='email'
  placeholder='name@example.com'
/>;
```

`Input` also accepts React Native `TextInputProps`, except `value`, `onChange`, `onChangeText`, and `editable`, which are controlled by the Vellira API.

Clearable inputs use separate callbacks for typing and clear actions:

- typing into the input calls `onValueChange`;
- pressing the clear action calls `onClear`;
- controlled inputs should clear their value inside `onClear`;
- uncontrolled inputs clear their internal value and then call `onClear`.

Native Input accessibility should be verified on real devices with VoiceOver and
TalkBack for focus visibility, read-only announcement and styling, and
description/error announcement behavior.

<!-- api-docgen:start native.InputProps.Input -->

| Prop              | Type                      | Required | Description                                      |
| ----------------- | ------------------------- | -------- | ------------------------------------------------ |
| `type`            | `InputType`               | No       | Semantic input type used by the component.       |
| `containerStyle`  | `StyleProp<ViewStyle>`    | No       | Extra style for the field container.             |
| `inputStyle`      | `StyleProp<TextStyle>`    | No       | Extra style for the input element.               |
| `value`           | `string`                  | No       | Controlled value.                                |
| `iconSize`        | `number`                  | No       | Icon size in pixels.                             |
| `clearIcon`       | `InputIconElement`        | No       | —                                                |
| `testID`          | `string`                  | No       | —                                                |
| `keyboardType`    | `KeyboardTypeOptions`     | No       | —                                                |
| `secureTextEntry` | `boolean`                 | No       | —                                                |
| `defaultValue`    | `string`                  | No       | Initial uncontrolled value.                      |
| `label`           | `string`                  | No       | Visible label.                                   |
| `placeholder`     | `string`                  | No       | Placeholder text.                                |
| `size`            | `InputSize`               | No       | Input size.                                      |
| `disabled`        | `boolean`                 | No       | Disables interaction.                            |
| `readOnly`        | `boolean`                 | No       | Marks the input as read-only.                    |
| `required`        | `boolean`                 | No       | Marks the field as required.                     |
| `clearable`       | `boolean`                 | No       | Shows a clear action when the input has a value. |
| `onClear`         | `() => void`              | No       | Called when the clear action is pressed.         |
| `error`           | `string`                  | No       | Error message rendered for invalid state.        |
| `description`     | `string`                  | No       | Additional descriptive text.                     |
| `clearIconTone`   | `InputAdornmentTone`      | No       | Color tone for the clear icon.                   |
| `onValueChange`   | `(value: string) => void` | No       | Called when the value changes.                   |
| `startIcon`       | `InputIconElement`        | No       | —                                                |
| `endIcon`         | `InputIconElement`        | No       | —                                                |
| `startIconTone`   | `InputAdornmentTone`      | No       | Color tone for the start icon.                   |
| `endIconTone`     | `InputAdornmentTone`      | No       | Color tone for the end icon.                     |
| `color`           | `InputColor`              | No       | —                                                |
| `variant`         | `InputVariant`            | No       | —                                                |
| `invalid`         | `boolean`                 | No       | —                                                |
| `loading`         | `boolean`                 | No       | —                                                |
| `revealPassword`  | `boolean`                 | No       | —                                                |
| `showCounter`     | `boolean`                 | No       | —                                                |
| `mask`            | `InputMask`               | No       | —                                                |
| `format`          | `InputFormatter`          | No       | —                                                |
| `parse`           | `InputParser`             | No       | —                                                |

<!-- api-docgen:end native.InputProps.Input -->

## FormField

Layout helper for labels, errors, and custom field controls.

```tsx
import { FormField } from '@vellira-ui/react-native';
import { TextInput } from 'react-native';

<FormField label='Email' error={error}>
  <TextInput accessibilityLabel='Email' value={email} onChangeText={setEmail} />
</FormField>;
```

`FormField` is a presentational wrapper. The wrapped control remains
responsible for its own `accessibilityLabel`, role, disabled/editable state, and
interaction behavior. Error text is announced with a polite live region, and the
root exposes disabled state when `disabled` is set.

<!-- api-docgen:start native.FormFieldProps.FormField -->

| Prop               | Type                         | Required | Description                       |
| ------------------ | ---------------------------- | -------- | --------------------------------- |
| `label`            | `ReactNode`                  | No       | Field label.                      |
| `error`            | `ReactNode`                  | No       | Error message.                    |
| `children`         | `ReactNode`                  | Yes      | Field control or custom content.  |
| `style`            | `StyleProp<ViewStyle>`       | No       | Extra container style.            |
| `labelStyle`       | `StyleProp<TextStyle>`       | No       | Extra label text style.           |
| `errorStyle`       | `StyleProp<TextStyle>`       | No       | Extra error text style.           |
| `required`         | `boolean`                    | No       | Marks the field as required.      |
| `disabled`         | `boolean`                    | No       | Renders the disabled field state. |
| `description`      | `ReactNode`                  | No       | Additional descriptive text.      |
| `controlStyle`     | `StyleProp<ViewStyle>`       | No       | Extra control wrapper style.      |
| `descriptionStyle` | `StyleProp<TextStyle>`       | No       | Extra description text style.     |
| `labelInfo`        | `ReactNode`                  | No       | —                                 |
| `optionalText`     | `ReactNode`                  | No       | —                                 |
| `size`             | `'sm' \| 'md' \| 'lg'`       | No       | Input size.                       |
| `labelPosition`    | `'top' \| 'start'`           | No       | —                                 |
| `invalid`          | `boolean`                    | No       | —                                 |
| `orientation`      | `'vertical' \| 'horizontal'` | No       | —                                 |
| `message`          | `ReactNode`                  | No       | —                                 |
| `labelAction`      | `ReactNode`                  | No       | —                                 |
| `messageStyle`     | `StyleProp<TextStyle>`       | No       | —                                 |
| `messageTone`      | `FormFieldMessageTone`       | No       | —                                 |
| `messageLive`      | `FormFieldMessageLive`       | No       | —                                 |

<!-- api-docgen:end native.FormFieldProps.FormField -->

## RadioGroup

Single-selection group with controlled and uncontrolled modes.

```tsx
import { Radio, RadioGroup } from '@vellira-ui/react-native';

<RadioGroup label='Plan' defaultValue='basic' orientation='vertical'>
  <Radio value='basic' label='Basic' />
  <Radio value='pro' label='Pro' />
</RadioGroup>;
```

### RadioGroup Props

<!-- api-docgen:start native.RadioGroupProps.RadioGroupProps -->

| Prop               | Type                          | Required | Description                           |
| ------------------ | ----------------------------- | -------- | ------------------------------------- |
| `label`            | `ReactNode`                   | No       | Group label.                          |
| `children`         | `ReactNode`                   | No       | Radio controls rendered by the group. |
| `error`            | `string`                      | No       | Error message.                        |
| `orientation`      | `RadioGroupOrientation`       | No       | Layout direction.                     |
| `style`            | `StyleProp<ViewStyle>`        | No       | Extra group style.                    |
| `itemsStyle`       | `StyleProp<ViewStyle>`        | No       | Extra items wrapper style.            |
| `labelStyle`       | `StyleProp<TextStyle>`        | No       | Extra label text style.               |
| `value`            | `string`                      | No       | Controlled selected value.            |
| `defaultValue`     | `string`                      | No       | Initial value for uncontrolled usage. |
| `onValueChange`    | `(value: RadioValue) => void` | No       | Called when selection changes.        |
| `required`         | `boolean`                     | No       | Marks the group as required.          |
| `disabled`         | `boolean`                     | No       | Disables the whole group.             |
| `description`      | `ReactNode`                   | No       | Additional descriptive text.          |
| `size`             | `RadioSize`                   | No       | Size inherited by child radios.       |
| `descriptionStyle` | `StyleProp<TextStyle>`        | No       | —                                     |
| `errorStyle`       | `StyleProp<TextStyle>`        | No       | —                                     |
| `color`            | `RadioColor`                  | No       | —                                     |
| `invalid`          | `boolean`                     | No       | —                                     |

<!-- api-docgen:end native.RadioGroupProps.RadioGroupProps -->

### Radio Props

<!-- api-docgen:start native.RadioProps.RadioProps -->

| Prop               | Type                         | Required | Description                                            |
| ------------------ | ---------------------------- | -------- | ------------------------------------------------------ |
| `value`            | `string`                     | Yes      | Value represented by the radio control.                |
| `label`            | `ReactNode`                  | No       | Visible label displayed next to the radio control.     |
| `description`      | `ReactNode`                  | No       | Supporting text displayed below the label.             |
| `checked`          | `boolean`                    | No       | Current checked state for controlled usage.            |
| `defaultChecked`   | `boolean`                    | No       | Initial checked state for uncontrolled usage.          |
| `onCheckedChange`  | `(checked: boolean) => void` | No       | Called when the checked state changes.                 |
| `disabled`         | `boolean`                    | No       | Disables interaction with the radio control.           |
| `required`         | `boolean`                    | No       | Marks the radio control as required for accessibility. |
| `error`            | `string`                     | No       | Validation error displayed below the radio control.    |
| `size`             | `RadioSize`                  | No       | Radio control size.                                    |
| `containerStyle`   | `StyleProp<ViewStyle>`       | No       | Extra root container style.                            |
| `labelStyle`       | `StyleProp<TextStyle>`       | No       | Extra label text style.                                |
| `descriptionStyle` | `StyleProp<TextStyle>`       | No       | Extra description text style.                          |
| `errorStyle`       | `StyleProp<TextStyle>`       | No       | Extra error text style.                                |
| `icon`             | `ReactNode`                  | No       | Icon rendered inside the component.                    |
| `color`            | `RadioColor`                 | No       | —                                                      |

<!-- api-docgen:end native.RadioProps.RadioProps -->

`RadioGroup color` sets the default selected color for child radios. Individual
`Radio` items can override it with their own `color`. Use `icon` on `Radio`
only when the default selected dot should be replaced by a product-specific
indicator.

## Select

Native selection field with children-first options and sheet/modal/popover
presentation.

```tsx
import { Select } from '@vellira-ui/react-native';

<Select
  label='Country'
  value={country}
  onValueChange={(nextCountry) => setCountry(nextCountry)}
  placeholder='Choose country'
  searchable
  clearable
>
  <Select.Item value='fr' label='France' />
  <Select.Item value='us' label='United States' />
</Select>;
```

### Select Usage Guidelines

Use `Select` when the user chooses one value from a compact list and the
choices can live in a native sheet, modal, or popover. Use `RadioGroup` when
there are only a few choices and keeping them visible helps comparison. Use
`Dropdown` for action menus, not for form values.

### Select Native Behavior

Native `Select` opens a native content surface. `presentation='auto'` uses a
bottom sheet on small screens and an anchored popover on wider screens.
`presentation='sheet'`, `presentation='modal'`, and `presentation='popover'`
are available for explicit control. Options render through `FlatList`; the
`virtual` prop customizes list rendering.

### Select Accessibility Notes

Provide a visible `label` whenever possible. If the UI cannot show a label, pass
`accessibilityLabel`. Required and invalid states are reflected on the trigger,
and error text is announced through the field error region. Use
`accessibilityHint` when the surrounding screen needs more guidance than the
default list hint.

### Select Compound API

```tsx
<Select label='Country' placeholder='Choose country'>
  <Select.Trigger />
  <Select.Content>
    <Select.Search placeholder='Search country...' />
    <Select.Group label='Europe'>
      <Select.Item value='fr' label='France' description='Paris' badge='EU' />
      <Select.Item value='de' label='Germany' description='Berlin' badge='EU' />
    </Select.Group>
    <Select.Separator />
    <Select.Empty>No countries found</Select.Empty>
    <Select.Loading>Searching...</Select.Loading>
  </Select.Content>
</Select>
```

Selectable groups are available in multiple mode. A selectable group renders a
group action row that selects or clears all enabled items in that group. The
action respects disabled options and `maxSelected`; when the limit is reached,
only the values that still fit are added.

```tsx
<Select
  label='Teams'
  multiple
  maxSelected={10}
  closeOnSelect={false}
  defaultValue={['product', 'engineering']}
>
  <Select.Group label='Core teams' selectable selectLabel='All core'>
    <Select.Item value='product' label='Product' />
    <Select.Item value='engineering' label='Engineering' />
    <Select.Item value='design' label='Design' />
  </Select.Group>
  <Select.Group label='Operations' selectable selectLabel='All operations'>
    <Select.Item value='support' label='Support' />
    <Select.Item value='success' label='Success' />
    <Select.Item value='sales' label='Sales' />
  </Select.Group>
</Select>
```

### Select Group Props

| Prop          | Type        | Required | Description                                                     |
| ------------- | ----------- | -------- | --------------------------------------------------------------- |
| `label`       | `string`    | No       | Group heading. Also used as the group action label by default.  |
| `selectable`  | `boolean`   | No       | Renders a group select/clear action in `multiple` Select usage. |
| `selectLabel` | `string`    | No       | Accessible and visible label for the selectable group action.   |
| `children`    | `ReactNode` | No       | Grouped `Select.Item` children.                                 |

### Select Props

<!-- api-docgen:start native.SelectProps.SelectProps -->

| Prop                     | Type                                                               | Required | Description                                                           |
| ------------------------ | ------------------------------------------------------------------ | -------- | --------------------------------------------------------------------- |
| `label`                  | `string`                                                           | No       | Visible field label.                                                  |
| `description`            | `string`                                                           | No       | Additional descriptive text.                                          |
| `error`                  | `ReactNode`                                                        | No       | Error message or custom error content.                                |
| `children`               | `ReactNode`                                                        | No       | `Select.Item`, `Select.Group`, and related compound slots.            |
| `options`                | `SelectOption[]`                                                   | No       | Simple option array alternative to compound items.                    |
| `value`                  | `string \| null \| string[]`                                       | No       | Controlled selected value.                                            |
| `defaultValue`           | `string \| null \| string[]`                                       | No       | Initial selected value for uncontrolled usage.                        |
| `onValueChange`          | `((value: string \| null) => void) \| ((value: string[]) => void)` | No       | Called when the selected value changes.                               |
| `color`                  | `SelectColor`                                                      | No       | Trigger and option color palette.                                     |
| `variant`                | `SelectVariant`                                                    | No       | Trigger and option variant.                                           |
| `size`                   | `SelectSize`                                                       | No       | Select size.                                                          |
| `placeholder`            | `string`                                                           | No       | Text shown when no value is selected.                                 |
| `required`               | `boolean`                                                          | No       | Marks the field as required.                                          |
| `disabled`               | `boolean`                                                          | No       | Disables interaction.                                                 |
| `invalid`                | `boolean`                                                          | No       | Shows invalid styling without error text.                             |
| `open`                   | `boolean`                                                          | No       | Controlled open state.                                                |
| `defaultOpen`            | `boolean`                                                          | No       | Initial uncontrolled open state.                                      |
| `onOpenChange`           | `(open: boolean) => void`                                          | No       | Called when open state changes.                                       |
| `clearable`              | `boolean`                                                          | No       | Shows a clear action when the select has a value.                     |
| `searchable`             | `boolean`                                                          | No       | Renders a TextInput search field in content.                          |
| `searchPlaceholder`      | `string`                                                           | No       | Search input placeholder.                                             |
| `onSearch`               | `(value: string) => void`                                          | No       | Called when search text changes for async flows.                      |
| `filterOptions`          | `boolean`                                                          | No       | Controls built-in local filtering. Defaults to false with `onSearch`. |
| `empty`                  | `ReactNode`                                                        | No       | Empty state content.                                                  |
| `loading`                | `boolean`                                                          | No       | Shows trigger spinner and content loading state when empty.           |
| `loadingText`            | `string`                                                           | No       | Loading state text.                                                   |
| `multiple`               | `false \| true`                                                    | No       | Enables string array selection mode.                                  |
| `maxSelected`            | `number`                                                           | No       | Maximum selected values in multiple mode.                             |
| `closeOnSelect`          | `boolean`                                                          | No       | Controls whether content closes after item selection.                 |
| `presentation`           | `SelectPresentation`                                               | No       | Native content presentation.                                          |
| `placement`              | `FloatingPlacement`                                                | No       | Preferred popover placement relative to the trigger.                  |
| `matchTriggerWidth`      | `boolean`                                                          | No       | Matches popover width to trigger width.                               |
| `dismissOnBackdropPress` | `boolean`                                                          | No       | Enables backdrop dismissal.                                           |
| `virtual`                | `boolean \| SelectVirtualConfig`                                   | No       | FlatList virtualization settings.                                     |
| `renderValue`            | `SelectRenderValue`                                                | No       | Custom trigger value renderer.                                        |
| `renderOption`           | `SelectRenderOption`                                               | No       | Custom option renderer.                                               |
| `accessibilityLabel`     | `string`                                                           | No       | Accessible label for screen readers.                                  |
| `accessibilityHint`      | `string`                                                           | No       | Additional accessibility hint for screen readers.                     |
| `filter`                 | `(option: SelectOption, query: string) => boolean`                 | No       | —                                                                     |
| `startIcon`              | `SelectIconElement`                                                | No       | —                                                                     |
| `endIcon`                | `SelectIconElement`                                                | No       | —                                                                     |
| `prefix`                 | `ReactNode`                                                        | No       | —                                                                     |
| `suffix`                 | `ReactNode`                                                        | No       | —                                                                     |
| `style`                  | `StyleProp<ViewStyle>`                                             | No       | Extra root style.                                                     |
| `triggerStyle`           | `StyleProp<ViewStyle>`                                             | No       | Extra trigger style.                                                  |
| `textStyle`              | `StyleProp<TextStyle>`                                             | No       | Extra text style.                                                     |
| `contentStyle`           | `StyleProp<ViewStyle>`                                             | No       | Extra content style.                                                  |
| `optionStyle`            | `StyleProp<ViewStyle>`                                             | No       | Extra option style.                                                   |
| `searchStyle`            | `StyleProp<TextStyle>`                                             | No       | —                                                                     |
| `testID`                 | `string`                                                           | No       | —                                                                     |
| `offset`                 | `number`                                                           | No       | Distance between the trigger and popover content in pixels.           |

<!-- api-docgen:end native.SelectProps.SelectProps -->

### SelectOption

<!-- api-docgen:start native.SelectOption.SelectOption -->

| Prop                 | Type          | Required | Description                                  |
| -------------------- | ------------- | -------- | -------------------------------------------- |
| `label`              | `string`      | Yes      | Visible option label and accessibility text. |
| `value`              | `string`      | Yes      | Option value.                                |
| `disabled`           | `boolean`     | No       | Disables this option.                        |
| `description`        | `string`      | No       | Additional descriptive text.                 |
| `icon`               | `ReactNode`   | No       | Icon rendered before the label.              |
| `badge`              | `ReactNode`   | No       | Badge rendered after the label.              |
| `color`              | `SelectColor` | No       | Option-specific selected color.              |
| `accessibilityLabel` | `string`      | No       | Accessible option label override.            |
| `accessibilityHint`  | `string`      | No       | Accessible option hint override.             |

<!-- api-docgen:end native.SelectOption.SelectOption -->

## Dropdown

Native menu component with item, group, and separator entries.

```tsx
import { Button, Dropdown } from '@vellira-ui/react-native';

<Dropdown label='Actions'>
  <Dropdown.Trigger>
    <Button>Actions</Button>
  </Dropdown.Trigger>

  <Dropdown.Content presentation='auto'>
    <Dropdown.Label>File</Dropdown.Label>
    <Dropdown.Item value='edit' onSelect={handleEdit}>
      Edit
    </Dropdown.Item>
    <Dropdown.Separator />
    <Dropdown.Item value='delete' color='danger' onSelect={handleDelete}>
      Delete
    </Dropdown.Item>
  </Dropdown.Content>
</Dropdown>;
```

### Dropdown Usage Guidelines

Use `Dropdown` for contextual actions such as copy, rename, archive, delete or
account commands. Handle selection on each `Dropdown.Item`; it should not be
used as a form value control. Use `Select` when the user chooses one saved value
from a compact list. Use `RadioGroup` when there are only a few choices and
keeping them visible helps comparison.

The menu open state can be controlled with `open` and `onOpenChange`, or left
uncontrolled with `defaultOpen`. Prefer a visible text trigger; for icon-only or
custom non-text triggers, provide `accessibilityLabel` and add
`accessibilityHint` when the surrounding screen needs extra guidance.

### Dropdown Props

<!-- api-docgen:start native.DropdownProps.DropdownProps -->

| Prop                 | Type                      | Required | Description                                                            |
| -------------------- | ------------------------- | -------- | ---------------------------------------------------------------------- |
| `label`              | `ReactNode`               | No       | Default trigger label.                                                 |
| `trigger`            | `ReactNode`               | No       | Custom trigger content.                                                |
| `style`              | `StyleProp<ViewStyle>`    | No       | Extra root style.                                                      |
| `triggerStyle`       | `StyleProp<ViewStyle>`    | No       | Extra trigger style.                                                   |
| `itemStyle`          | `StyleProp<ViewStyle>`    | No       | Extra item style.                                                      |
| `textStyle`          | `StyleProp<TextStyle>`    | No       | Extra text style.                                                      |
| `disabled`           | `boolean`                 | No       | Disables the trigger.                                                  |
| `icon`               | `ReactNode`               | No       | Icon rendered inside the component.                                    |
| `arrowIcon`          | `ReactNode`               | No       | Custom arrow icon rendered in the trigger.                             |
| `showArrow`          | `boolean`                 | No       | Controls whether the trigger arrow is rendered.                        |
| `contentStyle`       | `StyleProp<ViewStyle>`    | No       | Extra content style.                                                   |
| `accessibilityLabel` | `string`                  | No       | Accessible label for screen readers.                                   |
| `accessibilityHint`  | `string`                  | No       | Additional accessibility hint for screen readers.                      |
| `size`               | `DropdownSize`            | No       | Dropdown size.                                                         |
| `open`               | `boolean`                 | No       | Controlled open state.                                                 |
| `defaultOpen`        | `boolean`                 | No       | Initial uncontrolled open state.                                       |
| `onOpenChange`       | `(open: boolean) => void` | No       | Called when the open state changes.                                    |
| `children`           | `ReactNode`               | No       | Content rendered inside the component.                                 |
| `presentation`       | `DropdownPresentation`    | No       | —                                                                      |
| `closeOnSelect`      | `boolean`                 | No       | —                                                                      |
| `loading`            | `boolean`                 | No       | —                                                                      |
| `loadingText`        | `ReactNode`               | No       | —                                                                      |
| `searchable`         | `boolean`                 | No       | —                                                                      |
| `command`            | `boolean`                 | No       | —                                                                      |
| `searchValue`        | `string`                  | No       | —                                                                      |
| `defaultSearchValue` | `string`                  | No       | —                                                                      |
| `searchPlaceholder`  | `string`                  | No       | —                                                                      |
| `onSearch`           | `(value: string) => void` | No       | —                                                                      |
| `empty`              | `ReactNode`               | No       | —                                                                      |
| `color`              | `DropdownColor`           | No       | Semantic palette for trigger, content, focus, and pressed item states. |
| `placement`          | `FloatingPlacement`       | No       | Preferred dropdown placement.                                          |
| `offset`             | `number`                  | No       | —                                                                      |

<!-- api-docgen:end native.DropdownProps.DropdownProps -->

## Tabs

Compound tab navigation for native screens.

```tsx
import { Tabs } from '@vellira-ui/react-native';

<Tabs defaultValue='overview' orientation='horizontal' variant='line'>
  <Tabs.List scrollable>
    <Tabs.Trigger value='overview'>Overview</Tabs.Trigger>
    <Tabs.Trigger value='settings'>Settings</Tabs.Trigger>
  </Tabs.List>

  <Tabs.Content value='overview'>Overview content</Tabs.Content>
  <Tabs.Content value='settings'>Settings content</Tabs.Content>
</Tabs>;
```

Tabs use stable string values. `Tabs.Trigger value` must match
`Tabs.Content value`; the selected panel does not depend on render order. Use
`Tabs.List scrollable` for horizontally scrollable native tab rows.

Mounting defaults to only the active panel. `keepMounted`, `lazyMount`, and
`Tabs.Content forceMount` control panel lifetime when local state or expensive
content needs to be preserved.

### Tabs Props

<!-- api-docgen:start native.TabsProps.TabsProps -->

| Prop            | Type                         | Required | Description                                                 |
| --------------- | ---------------------------- | -------- | ----------------------------------------------------------- |
| `children`      | `ReactNode`                  | Yes      | `Tabs.List`, `Tabs.Trigger`, and `Tabs.Content` content.    |
| `style`         | `StyleProp<ViewStyle>`       | No       | Extra root style.                                           |
| `orientation`   | `Orientation`                | No       | Layout orientation.                                         |
| `value`         | `string`                     | No       | Controlled selected value.                                  |
| `defaultValue`  | `string`                     | No       | Initial selected value for uncontrolled usage.              |
| `onValueChange` | `(value: TabsValue) => void` | No       | Called when the selected value changes.                     |
| `keepMounted`   | `boolean`                    | No       | Keeps all content mounted and hides inactive panels.        |
| `lazyMount`     | `boolean`                    | No       | Mounts content only after its value has been activated.     |
| `variant`       | `TabsVariant`                | No       | Visual style: line, pills, or segmented.                    |
| `color`         | `TabsColor`                  | No       | Visual tone: primary, neutral, success, warning, or danger. |
| `size`          | `TabsSize`                   | No       | Tabs size.                                                  |
| `disabled`      | `boolean`                    | No       | Disables interaction.                                       |
| `mode`          | `TabsMode`                   | No       | —                                                           |

<!-- api-docgen:end native.TabsProps.TabsProps -->

### Tabs.List Props

<!-- api-docgen:start native.TabsListProps.TabsListProps -->

| Prop         | Type                   | Required | Description                                 |
| ------------ | ---------------------- | -------- | ------------------------------------------- |
| `children`   | `ReactNode`            | Yes      | Tab triggers.                               |
| `style`      | `StyleProp<ViewStyle>` | No       | Extra list style.                           |
| `scrollable` | `boolean`              | No       | Makes the tab list horizontally scrollable. |

<!-- api-docgen:end native.TabsListProps.TabsListProps -->

### Tabs.Indicator Props

<!-- api-docgen:start native.TabsIndicatorProps.TabsIndicatorProps -->

| Prop       | Type                   | Required | Description            |
| ---------- | ---------------------- | -------- | ---------------------- |
| `children` | `ReactNode`            | No       | Visual indicator node. |
| `style`    | `StyleProp<ViewStyle>` | No       | Extra indicator style. |

<!-- api-docgen:end native.TabsIndicatorProps.TabsIndicatorProps -->

### Tabs.Trigger Props

<!-- api-docgen:start native.TabsTriggerProps.TabsTriggerProps -->

| Prop          | Type                   | Required | Description                                                                  |
| ------------- | ---------------------- | -------- | ---------------------------------------------------------------------------- |
| `children`    | `ReactNode`            | No       | Tab label.                                                                   |
| `icon`        | `ReactNode`            | No       | Icon rendered before the label. Explicit Tabs.Icon children take precedence. |
| `style`       | `StyleProp<ViewStyle>` | No       | Extra tab style.                                                             |
| `textStyle`   | `StyleProp<TextStyle>` | No       | Extra label text style.                                                      |
| `badge`       | `ReactNode`            | No       | Badge rendered after the label.                                              |
| `description` | `ReactNode`            | No       | Secondary text rendered below the trigger label.                             |
| `value`       | `string`               | Yes      | Stable trigger value matched with Tabs.Content.                              |
| `disabled`    | `boolean`              | No       | Disables interaction.                                                        |
| `asChild`     | `boolean`              | No       | —                                                                            |

<!-- api-docgen:end native.TabsTriggerProps.TabsTriggerProps -->

### Tabs.Icon and Tabs.Badge Props

`Tabs.Icon` and `Tabs.Badge` accept `children` and optional `style`. Use these
compound slots when trigger content needs custom ordering or richer markup. If
`Tabs.Trigger` receives both the `icon` prop and an explicit `Tabs.Icon` child,
the explicit compound slot takes precedence.

### Tabs.Content Props

<!-- api-docgen:start native.TabsContentProps.TabsContentProps -->

| Prop         | Type                   | Required | Description                                                        |
| ------------ | ---------------------- | -------- | ------------------------------------------------------------------ |
| `children`   | `ReactNode`            | No       | Tab content.                                                       |
| `style`      | `StyleProp<ViewStyle>` | No       | Extra panel style.                                                 |
| `value`      | `string`               | Yes      | Stable content value matched with Tabs.Trigger.                    |
| `forceMount` | `boolean`              | No       | Keeps this content mounted regardless of the root mounting policy. |

<!-- api-docgen:end native.TabsContentProps.TabsContentProps -->

## Tooltip

Floating helper text around a native target. Compose native Tooltip with
`Tooltip.Trigger`, `Tooltip.Content`, and optional `withArrow`; the root manages
placement, open state, delay, and dismissal.

```tsx
import { Tooltip, Button } from '@vellira-ui/react-native';

<Tooltip placement='top'>
  <Tooltip.Trigger>
    <Button>More</Button>
  </Tooltip.Trigger>

  <Tooltip.Content withArrow>More actions</Tooltip.Content>
</Tooltip>;
```

<!-- api-docgen:start native.TooltipProps.Tooltip -->

| Prop                  | Type                              | Required | Description                                                   |
| --------------------- | --------------------------------- | -------- | ------------------------------------------------------------- |
| `children`            | `ReactNode`                       | Yes      | Trigger element.                                              |
| `style`               | `StyleProp<ViewStyle>`            | No       | Extra root style.                                             |
| `placement`           | `FloatingPlacement`               | No       | Preferred tooltip placement.                                  |
| `disabled`            | `boolean`                         | No       | Prevents the tooltip from opening.                            |
| `delay`               | `number \| Partial<TooltipDelay>` | No       | Open delay in milliseconds, or explicit open/close delays.    |
| `onOpenChange`        | `(open: boolean) => void`         | No       | Called when the open state changes.                           |
| `open`                | `boolean`                         | No       | Controlled open state.                                        |
| `defaultOpen`         | `boolean`                         | No       | Initial uncontrolled open state.                              |
| `offset`              | `number`                          | No       | Distance between trigger and content in pixels.               |
| `closeOnOutsidePress` | `boolean`                         | No       | Closes the tooltip when the user presses outside the content. |

<!-- api-docgen:end native.TooltipProps.Tooltip -->

### Tooltip.Trigger Props

<!-- api-docgen:start native.TooltipTriggerProps.TooltipTriggerProps -->

| Prop       | Type                   | Required | Description                 |
| ---------- | ---------------------- | -------- | --------------------------- |
| `children` | `ReactNode`            | Yes      | Trigger element or content. |
| `disabled` | `boolean`              | No       | Disables this trigger.      |
| `style`    | `StyleProp<ViewStyle>` | No       | Extra root style.           |

<!-- api-docgen:end native.TooltipTriggerProps.TooltipTriggerProps -->

### Tooltip.Content Props

<!-- api-docgen:start native.TooltipContentProps.TooltipContentProps -->

| Prop         | Type                   | Required | Description                                                        |
| ------------ | ---------------------- | -------- | ------------------------------------------------------------------ |
| `children`   | `ReactNode`            | Yes      | Content rendered inside the component.                             |
| `forceMount` | `boolean`              | No       | Keeps the tooltip content mounted even when the tooltip is closed. |
| `style`      | `StyleProp<ViewStyle>` | No       | Extra root style.                                                  |
| `textStyle`  | `StyleProp<TextStyle>` | No       | Extra tooltip text style.                                          |
| `withArrow`  | `boolean`              | No       | —                                                                  |

<!-- api-docgen:end native.TooltipContentProps.TooltipContentProps -->

## Portal

Shared native primitive for explicit overlay composition. The current native
adapter renders children in place and keeps API parity with web overlays.

```tsx
import { Portal } from '@vellira-ui/react-native';

<Portal>
  <Modal.Content>Content</Modal.Content>
</Portal>;
```

| Prop        | Type        | Required | Description                              |
| ----------- | ----------- | -------- | ---------------------------------------- |
| `children`  | `ReactNode` | Yes      | Content rendered through the primitive.  |
| `container` | `unknown`   | No       | Reserved native portal host integration. |

### PortalProvider

Provides a default container/host value for nested native `Portal` instances.

## Modal

Native compound dialog with backdrop close behavior and content sections.

```tsx
import { Button, Modal, Portal } from '@vellira-ui/react-native';

<Modal open={open} onOpenChange={setOpen}>
  <Modal.Trigger asChild>
    <Button>Open modal</Button>
  </Modal.Trigger>
  <Portal>
    <Modal.Overlay>
      <Modal.Content>
        <Modal.Header>Delete file</Modal.Header>
        <Modal.Body>Are you sure you want to delete this file?</Modal.Body>
        <Modal.Footer>
          <Modal.Close>
            <Button color='neutral' appearance='solid'>
              Cancel
            </Button>
          </Modal.Close>
        </Modal.Footer>
      </Modal.Content>
    </Modal.Overlay>
  </Portal>
</Modal>;
```

### Modal Props

<!-- api-docgen:start native.ModalProps.ModalProps -->

| Prop                  | Type                      | Required | Description                          |
| --------------------- | ------------------------- | -------- | ------------------------------------ |
| `children`            | `ReactNode`               | Yes      | Modal content.                       |
| `open`                | `boolean`                 | No       | Controls dialog visibility.          |
| `defaultOpen`         | `boolean`                 | No       | Initial uncontrolled open state.     |
| `onOpenChange`        | `(open: boolean) => void` | No       | Called when the open state changes.  |
| `closeOnOutsidePress` | `boolean`                 | No       | Allows closing by pressing backdrop. |
| `closeOnEscape`       | `boolean`                 | No       | Reserved for API parity with web.    |
| `animation`           | `ModalAnimation`          | No       | —                                    |
| `duration`            | `ModalAnimationDuration`  | No       | —                                    |
| `easing`              | `ModalAnimationEasing`    | No       | —                                    |
| `restoreFocus`        | `boolean`                 | No       | —                                    |

<!-- api-docgen:end native.ModalProps.ModalProps -->

### Modal Compound Components

| Component       | Description            |
| --------------- | ---------------------- |
| `Modal.Trigger` | Opens the modal.       |
| `Modal.Overlay` | Native modal backdrop. |
| `Modal.Content` | Main dialog surface.   |
| `Modal.Header`  | Header/title section.  |
| `Modal.Body`    | Body section.          |
| `Modal.Footer`  | Action/footer section. |
| `Modal.Close`   | Closes the modal.      |

### Modal Accessibility

Provide a clear title and body copy for screen reader users. The native implementation exposes modal structure and close behavior, while the consuming app remains responsible for meaningful labels and actions.

## Toast

### Toast Props

<!-- api-docgen:start native.ToastProps.ToastProps -->

| Prop                 | Type                                                        | Required | Description                                                      |
| -------------------- | ----------------------------------------------------------- | -------- | ---------------------------------------------------------------- |
| `open`               | `boolean`                                                   | No       | Controlled open state.                                           |
| `defaultOpen`        | `boolean`                                                   | No       | Initial uncontrolled open state.                                 |
| `onOpenChange`       | `(open: boolean, details?: ToastOpenChangeDetails) => void` | No       | Called when the open state changes.                              |
| `children`           | `ReactNode`                                                 | No       | Content rendered inside the component.                           |
| `id`                 | `string`                                                    | No       | —                                                                |
| `title`              | `ReactNode`                                                 | No       | Short message heading.                                           |
| `description`        | `ReactNode`                                                 | No       | Optional supporting detail.                                      |
| `icon`               | `ReactNode`                                                 | No       | Optional custom icon; semantic tones provide canonical defaults. |
| `announcement`       | `string`                                                    | No       | Explicit text announced by native assistive technology.          |
| `tone`               | `ToastTone`                                                 | No       | Semantic visual tone and announcement priority.                  |
| `duration`           | `number`                                                    | No       | Auto-dismiss duration in milliseconds. Zero disables timeout.    |
| `dismissible`        | `boolean`                                                   | No       | Renders an explicit dismiss control.                             |
| `dismissLabel`       | `string`                                                    | No       | Accessible label for the dismiss control.                        |
| `action`             | `ToastAction`                                               | No       | Optional labelled action with deterministic close behavior.      |
| `accessibilityLabel` | `string`                                                    | No       | Accessible label for screen readers.                             |
| `style`              | `StyleProp<ViewStyle>`                                      | No       | Extra root style.                                                |
| `testID`             | `string`                                                    | No       | —                                                                |

<!-- api-docgen:end native.ToastProps.ToastProps -->

### Toast.Provider Props

<!-- api-docgen:start native.ToastProviderProps.ToastProviderProps -->

| Prop         | Type         | Required | Description                                                         |
| ------------ | ------------ | -------- | ------------------------------------------------------------------- |
| `children`   | `ReactNode`  | No       | Content rendered inside the component.                              |
| `store`      | `ToastStore` | No       | Externally owned store used for independent testing or integration. |
| `duration`   | `number`     | No       | Default auto-dismiss duration for messages in this provider.        |
| `maxVisible` | `number`     | No       | Maximum visible messages before oldest-first overflow.              |

<!-- api-docgen:end native.ToastProviderProps.ToastProviderProps -->

### Toast.Viewport Props

<!-- api-docgen:start native.ToastViewportProps.ToastViewportProps -->

| Prop                 | Type                                                                                            | Required | Description                            |
| -------------------- | ----------------------------------------------------------------------------------------------- | -------- | -------------------------------------- |
| `children`           | `ReactNode`                                                                                     | No       | Content rendered inside the component. |
| `portal`             | `boolean`                                                                                       | No       | —                                      |
| `position`           | `'top-start' \| 'top-end' \| 'bottom-start' \| 'bottom-end' \| 'top-center' \| 'bottom-center'` | No       | —                                      |
| `accessibilityLabel` | `string`                                                                                        | No       | Accessible label for screen readers.   |
| `style`              | `StyleProp<ViewStyle>`                                                                          | No       | Extra root style.                      |
| `testID`             | `string`                                                                                        | No       | —                                      |

<!-- api-docgen:end native.ToastViewportProps.ToastViewportProps -->

## ThemeProvider

Provides theme context for native components.

```tsx
import { ThemeProvider } from '@vellira-ui/react-native';

<ThemeProvider defaultTheme='dark'>
  <App />
</ThemeProvider>;
```

### ThemeProvider Props

<!-- api-docgen:start native.ThemeProviderProps.ThemeProvider -->

<!-- api-docgen:start native.ThemeProviderProps.ThemeProviderProps -->

| Prop            | Type                                  | Required | Description                               |
| --------------- | ------------------------------------- | -------- | ----------------------------------------- |
| `children`      | `ReactNode`                           | Yes      | Content wrapped by the provider.          |
| `theme`         | `'light' \| 'dark' \| 'highContrast'` | No       | Controlled theme value.                   |
| `defaultTheme`  | `'light' \| 'dark' \| 'highContrast'` | No       | Initial theme for uncontrolled usage.     |
| `onThemeChange` | `(theme: NativeThemeName) => void`    | No       | Called whenever the active theme changes. |

<!-- api-docgen:end native.ThemeProviderProps.ThemeProviderProps -->
<!-- api-docgen:end native.ThemeProviderProps.ThemeProvider -->

### Supported Themes

| Theme          | Description                 |
| -------------- | --------------------------- |
| `light`        | Default light theme.        |
| `dark`         | Dark theme.                 |
| `highContrast` | High contrast native theme. |

## useTheme

Returns the current native theme, current theme name, and a function to update it.

```tsx
import { useTheme } from '@vellira-ui/react-native';

function ThemeReader() {
  const { themeName, theme, setTheme } = useTheme();

  return null;
}
```

### Returns

| Property    | Type                               | Description                |
| ----------- | ---------------------------------- | -------------------------- |
| `themeName` | `NativeThemeName`                  | Current active theme name. |
| `theme`     | `NativeTheme`                      | Current token object.      |
| `setTheme`  | `(theme: NativeThemeName) => void` | Updates the active theme.  |

## Accordion

### Accordion Props

<!-- api-docgen:start native.AccordionProps.AccordionProps -->

| Prop            | Type                                                       | Required | Description                                                                 |
| --------------- | ---------------------------------------------------------- | -------- | --------------------------------------------------------------------------- |
| `children`      | `ReactNode`                                                | No       | Content rendered inside the component.                                      |
| `type`          | `'single' \| 'multiple'`                                   | No       | Selection mode: single allows one item, multiple allows several open items. |
| `value`         | `string \| string[]`                                       | No       | Controlled expanded value.                                                  |
| `defaultValue`  | `string \| string[]`                                       | No       | Initial expanded value for uncontrolled usage.                              |
| `onValueChange` | `((value: string) => void) \| ((value: string[]) => void)` | No       | Called when the expanded value changes.                                     |
| `collapsible`   | `boolean`                                                  | No       | Allows the open item to collapse in single mode.                            |
| `disabled`      | `boolean`                                                  | No       | Disables every accordion item.                                              |

<!-- api-docgen:end native.AccordionProps.AccordionProps -->

### Accordion.Item Props

<!-- api-docgen:start native.AccordionItemProps.AccordionItemProps -->

| Prop       | Type        | Required | Description                            |
| ---------- | ----------- | -------- | -------------------------------------- |
| `children` | `ReactNode` | No       | Content rendered inside the component. |
| `value`    | `string`    | Yes      | Stable item value used by root state.  |
| `disabled` | `boolean`   | No       | Disables this item.                    |

<!-- api-docgen:end native.AccordionItemProps.AccordionItemProps -->

### Accordion.Trigger Props

<!-- api-docgen:start native.AccordionTriggerProps.AccordionTriggerProps -->

| Prop       | Type        | Required | Description                            |
| ---------- | ----------- | -------- | -------------------------------------- |
| `children` | `ReactNode` | No       | Content rendered inside the component. |
| `disabled` | `boolean`   | No       | Disables this trigger.                 |

<!-- api-docgen:end native.AccordionTriggerProps.AccordionTriggerProps -->

### Accordion.Content Props

<!-- api-docgen:start native.AccordionContentProps.AccordionContentProps -->

| Prop         | Type        | Required | Description                                                 |
| ------------ | ----------- | -------- | ----------------------------------------------------------- |
| `children`   | `ReactNode` | No       | Content rendered inside the component.                      |
| `forceMount` | `boolean`   | No       | Keeps this content mounted even when its item is collapsed. |

<!-- api-docgen:end native.AccordionContentProps.AccordionContentProps -->

## Textarea

## Textarea

<!-- api-docgen:start native.TextareaProps.Textarea -->

| Prop             | Type                      | Required | Description                               |
| ---------------- | ------------------------- | -------- | ----------------------------------------- |
| `containerStyle` | `ViewStyle`               | No       | —                                         |
| `inputStyle`     | `TextStyle`               | No       | Extra style for the input element.        |
| `label`          | `string`                  | No       | Visible label.                            |
| `description`    | `string`                  | No       | Additional descriptive text.              |
| `error`          | `string`                  | No       | Error message rendered for invalid state. |
| `placeholder`    | `string`                  | No       | Placeholder text.                         |
| `size`           | `InputSize`               | No       | Input size.                               |
| `value`          | `string`                  | No       | Controlled value.                         |
| `defaultValue`   | `string`                  | No       | Initial uncontrolled value.               |
| `disabled`       | `boolean`                 | No       | Disables interaction.                     |
| `required`       | `boolean`                 | No       | Marks the field as required.              |
| `invalid`        | `boolean`                 | No       | —                                         |
| `onValueChange`  | `(value: string) => void` | No       | Called when the value changes.            |

<!-- api-docgen:end native.TextareaProps.Textarea -->
