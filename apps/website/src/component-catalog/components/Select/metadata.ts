import { defineComponentPageMetadata } from '../../metadata';

export default defineComponentPageMetadata({
  discovery: {
    status: 'complete',
    summary:
      'Use Select when a form or setting needs one or several saved values from a compact option list.',
    description:
      'React and React Native Select for single or multiple form values, searchable grouped options, validation, clearable state and platform-specific presentation.',
    whenToUse: [
      'Use Select for persisted form or preference values rather than commands; use Dropdown for contextual actions.',
      'Prefer RadioGroup for short sets of visible alternatives that benefit from side-by-side comparison.',
      'Choose single or multiple selection, stable item values, and an accessible label.',
      'Use search for long option sets and pair invalid state with actionable error feedback.',
    ],
    patterns: [
      {
        id: 'controlled-selection',
        title: 'Controlled and initial values',
        description:
          'Use value and onValueChange for external state, or defaultValue to initialize single or multiple selection.',
      },
      {
        id: 'multi-select',
        title: 'Multiple choices and limits',
        description:
          'Use multiple, maxSelected and closeOnSelect to govern multiple selection and option limits.',
      },
      {
        id: 'search-and-groups',
        title: 'Searchable grouped options',
        description:
          'Compose Select.Item, Group, Label, Search, Separator, Empty and Loading for structured option lists.',
      },
      {
        id: 'validation',
        title: 'Validated form field',
        description:
          'Use label, description, required, disabled, invalid and error to describe and validate the selected value.',
      },
    ],
    platformNotes: {
      react: [
        'React Select composes with FormField and supports named form values, keyboard navigation, typeahead, searchable options and accessible trigger relationships.',
        'Web Select supports compound Trigger/Content composition, controlled open state, portal placement and rich option content.',
      ],
      'react-native': [
        'React Native Select uses FormField context and supports auto, sheet, modal or popover option presentation; it does not rely on web keyboard interaction.',
        'Native Select supports accessible trigger labels, search, single or multiple values, option grouping and FlatList-based virtualized lists for large collections.',
        'Verify announcement of expanded or selected state, validation errors and overlay dismissal with VoiceOver and TalkBack.',
      ],
    },
    missingEvidence: [],
  },
  react: {
    children: `<Select.Item value='react'>React</Select.Item>
<Select.Item value='vue'>Vue</Select.Item>
<Select.Item value='svelte'>Svelte</Select.Item>`,
  },

  native: {
    demoProps: `presentation='popover'
matchTriggerWidth`,
    children: `<Select.Item value='react' label='React' />
<Select.Item value='vue' label='Vue' />
<Select.Item value='svelte' label='Svelte' />`,
  },

  demo: {
    label: 'Favorite framework',
    description: 'Choose one option.',
    satisfiedRequiredProps: ['options'],
    excludeControls: [
      'multiple',
      'label',
      'description',
      'required',
      'maxSelected',
      'closeOnSelect',
      'avoidCollisions',
      'modal',
      'command',
    ],
    initialValues: {
      multiple: false,
      placeholder: 'Select an option',
      size: 'md',
      color: 'primary',
      variant: 'outline',
      invalid: false,
      loading: false,
      clearable: false,
      searchable: false,
      disabled: false,
      error: '',
    },
  },

  defaults: {
    shared: {
      multiple: false,
      placeholder: 'Select...',
      size: 'md',
      color: 'primary',
      variant: 'outline',
      invalid: false,
      loading: false,
      clearable: false,
      searchable: false,
      closeOnSelect: false,
      required: false,
      disabled: false,
    },

    react: {
      modal: false,
      command: false,
      matchTriggerWidth: true,
      avoidCollisions: true,
      portal: true,
      defaultOpen: false,
      placement: 'bottom',
    },

    native: {
      presentation: 'auto',
      placement: 'bottom-start',
      offset: 8,
      matchTriggerWidth: false,
      dismissOnBackdropPress: true,
      defaultOpen: false,
    },
  },

  examples: [
    {
      title: 'Basic',
      description: 'Basic component usage.',
      props: [],
    },
    {
      title: 'Searchable',
      description: 'Filter options by typing a search query.',
      props: ['searchable'],
    },
    {
      title: 'Multiple',
      description: 'Select more than one option.',
      props: ['multiple'],
    },
    {
      title: 'Error',
      description: 'Validation error state.',
      props: [`error='Please review this option.'`],
    },
    {
      title: 'Disabled',
      description: 'Disabled select state.',
      props: ['disabled'],
    },
    {
      title: 'Loading',
      description: 'Loading state while options are being resolved.',
      props: ['loading'],
    },
  ],

  api: {
    descriptions: {
      multiple: 'Enables multiple selection when true.',
      value: 'Controlled selected value or values.',
      defaultValue: 'Initial selected value or values for uncontrolled usage.',
      onValueChange: 'Called when the selected value or values change.',
    },

    sections: [
      { name: 'Select.Item', exportName: 'SelectItemProps' },
      { name: 'Select.Trigger', exportName: 'SelectTriggerSlotProps' },
      {
        name: 'Select.Value',
        exportName: {
          react: 'SelectValueProps',
          'react-native': 'SelectValueSlotProps',
        },
      },
      {
        name: 'Select.Content',
        exportName: {
          react: 'SelectContentSlotProps',
          'react-native': 'SelectContentProps',
        },
      },
      { name: 'Select.Search', exportName: 'SelectSearchProps' },
      { name: 'Select.Group', exportName: 'SelectGroupProps' },
      { name: 'Select.Label', exportName: 'SelectLabelProps' },
      { name: 'Select.Separator', exportName: 'SelectSeparatorProps' },
      { name: 'Select.Empty', exportName: 'SelectEmptyProps' },
      { name: 'Select.Loading', exportName: 'SelectLoadingProps' },
    ],
  },

  accessibility: {
    react: [
      {
        title: 'Accessible naming',
        description:
          'Provide a visible label or another accessible name for the select trigger.',
        props: ['label', 'description'],
      },
      {
        title: 'Keyboard interaction',
        description:
          'Preserve expected keyboard navigation, focus management, and option selection behavior.',
        props: ['open', 'defaultOpen', 'searchable'],
      },
      {
        title: 'Selection state',
        description:
          'Keep selected values and expanded state synchronized with the visual interface.',
        props: ['value', 'defaultValue', 'multiple'],
      },
      {
        title: 'Validation feedback',
        description:
          'Associate validation feedback with the control and expose invalid and required state.',
        props: ['error', 'invalid', 'required', 'disabled'],
      },
    ],

    native: [
      {
        title: 'Accessible naming',
        description:
          'Provide a visible label or accessibilityLabel so screen readers can identify the control.',
        props: ['label', 'accessibilityLabel', 'accessibilityHint'],
      },
      {
        title: 'Screen reader interaction',
        description:
          'Expose expanded, selected, disabled, and busy state through React Native accessibility semantics.',
        props: ['value', 'multiple', 'disabled', 'loading'],
      },
      {
        title: 'Search and selection',
        description:
          'Keep search, active option, and selected values understandable when using assistive technologies.',
        props: ['searchable', 'searchPlaceholder', 'multiple'],
      },
      {
        title: 'Validation feedback',
        description:
          'Expose validation errors and required state without relying only on visual styling.',
        props: ['error', 'invalid', 'required'],
      },
    ],
  },

  related: ['input', 'dropdown', 'radio-group'],
});
