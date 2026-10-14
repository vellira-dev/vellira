import { defineComponentPageMetadata } from '../../metadata';

export default defineComponentPageMetadata({
  discovery: {
    status: 'complete',
    summary:
      'Use RadioGroup for a labelled, mutually exclusive set of options.',
    description:
      'React and React Native RadioGroup for controlled or default single selection, labelled items, horizontal or vertical layout, and group validation feedback.',
    whenToUse: [
      'Use RadioGroup when a person chooses exactly one item from a related set.',
      'Give each RadioGroup.Item a unique value and label the group.',
      'Use value and onValueChange for controlled selection or defaultValue for initial selection.',
      'Use required and error for group validation; use Checkbox for independent choices.',
    ],
    patterns: [
      {
        id: 'controlled',
        title: 'Controlled choice',
        description:
          'Use value and onValueChange to manage the selected option externally.',
      },
      {
        id: 'default',
        title: 'Default selection',
        description:
          'Use defaultValue to initialize selection while the group manages later updates.',
      },
      {
        id: 'layout',
        title: 'Orientation',
        description:
          'Prefer vertical options; use horizontal layout when space and labels permit.',
      },
      {
        id: 'validation',
        title: 'Required group',
        description:
          'Display a meaningful error and propagate disabled and invalid state to child radios.',
      },
    ],
    platformNotes: {
      react: [
        'React renders role=radiogroup with ARIA label, description, required and invalid semantics, and named native radio inputs.',
        'React group navigation handles keyboard behavior and orientation controls layout.',
      ],
      'react-native': [
        'React Native composes FormField with accessibilityRole=radiogroup and hints for required or invalid state.',
        'Child Pressable radios expose checked/disabled accessibilityState; orientation changes their layout.',
      ],
    },
    missingEvidence: [],
  },
  react: {
    children: `<RadioGroup.Item value='fr' label='France' />
<RadioGroup.Item value='es' label='Spain' />
<RadioGroup.Item value='de' label='Germany' />`,
  },
  native: {
    children: `<RadioGroup.Item value='starter' label='Starter' />
<RadioGroup.Item value='pro' label='Pro' />
<RadioGroup.Item value='enterprise' label='Enterprise' />`,
  },
  demo: {
    label: 'Country',
    description: 'Choose your country of residence.',
    initialValues: {
      defaultValue: 'fr',
      orientation: 'vertical',
      size: 'md',
      color: 'primary',
      disabled: false,
      required: false,
      error: '',
    },
    previewWidth: 'full',
  },
  defaults: {
    shared: {
      orientation: 'vertical',
      size: 'md',
      color: 'primary',
      disabled: false,
      required: false,
    },
  },
  examples: [
    {
      title: 'Basic',
      description: 'Select one option from a labelled group.',
      props: [],
      reactProps: [`defaultValue='fr'`],
      nativeProps: [`defaultValue='pro'`],
    },
    {
      title: 'Horizontal',
      description: 'Places options in a row when space allows.',
      props: [`orientation='horizontal'`],
      reactProps: [`defaultValue='fr'`],
      nativeProps: [`defaultValue='pro'`],
    },
    {
      title: 'Required',
      description: 'Marks the group as required.',
      props: ['required'],
    },
    {
      title: 'Error',
      description: 'Shows validation feedback for the group.',
      props: [`error='Choose one notification method.'`],
    },
    {
      title: 'Disabled',
      description: 'Disables every option in the group.',
      props: ['disabled'],
    },
    {
      title: 'Color',
      description: 'Applies the selected color to child radio controls.',
      props: [`color='success'`],
      reactProps: [`defaultValue='fr'`],
      nativeProps: [`defaultValue='pro'`],
    },
  ],
  api: {
    sections: [{ name: 'RadioGroup.Item', exportName: 'RadioGroupItemProps' }],
  },
  accessibility: {
    react: [
      {
        title: 'Group labelling',
        description:
          'Use a visible label and optional description so the radiogroup purpose is announced clearly.',
        props: ['label', 'description'],
      },
      {
        title: 'Single selection',
        description:
          'Each item value should be unique so keyboard and form selection remain predictable.',
        props: ['value', 'defaultValue', 'onValueChange'],
      },
      {
        title: 'Validation state',
        description:
          'Use required and error together when a selection must be made before submission.',
        props: ['required', 'error'],
      },
    ],
    native: [
      {
        title: 'Group announcement',
        description:
          'Provide a visible label and description so assistive technology can identify the choice set.',
        props: ['label', 'description'],
      },
      {
        title: 'Selection state',
        description:
          'Keep value, defaultValue, and onValueChange tied to exactly one selected item.',
        props: ['value', 'defaultValue', 'onValueChange'],
      },
      {
        title: 'Required and error text',
        description:
          'Pair required state with clear error content when validation fails.',
        props: ['required', 'error'],
      },
      {
        title: 'Accessibility state',
        description:
          'Disabled, required, and invalid state are exposed through React Native accessibility semantics.',
        props: ['disabled', 'required', 'invalid'],
      },
    ],
  },
  related: ['radio', 'checkbox', 'select'],
});
