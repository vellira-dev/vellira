import { defineComponentPageMetadata } from '../../metadata';

export default defineComponentPageMetadata({
  discovery: {
    status: 'complete',
    summary:
      'Use Radio for one choice; use RadioGroup for mutually exclusive choices.',
    description:
      'React and React Native Radio for a labelled single choice, with controlled or default selection, disabled and required states, sizes, colors, and validation feedback.',
    whenToUse: [
      'Use RadioGroup for a related set of mutually exclusive options.',
      'Use standalone Radio only when an application owns its selection behavior.',
      'Choose Checkbox for independent selections.',
      'Provide a visible label or an accessible name and explain errors.',
    ],
    patterns: [
      {
        id: 'group-item',
        title: 'Group selection',
        description:
          'A Radio inside RadioGroup receives selected value and shared properties from group context.',
      },
      {
        id: 'standalone',
        title: 'Standalone state',
        description:
          'Outside a group, checked and onCheckedChange control state; defaultChecked initializes local selection.',
      },
      {
        id: 'feedback',
        title: 'Validation feedback',
        description:
          'Use error for option-specific validation and RadioGroup error for group-wide failures.',
      },
    ],
    platformNotes: {
      react: [
        'React renders a native input type=radio with label, description, aria-invalid and native required/disabled states.',
        'Inside RadioGroup, checked derives from group value; standalone checked and defaultChecked do not own group selection.',
      ],
      'react-native': [
        'React Native uses Pressable with accessibilityRole=radio and checked/disabled accessibilityState; string labels provide default accessibility names.',
        'Description, required state, and error can contribute to the accessibility hint; the group owns selected value when present.',
      ],
    },
    missingEvidence: [],
  },
  react: {
    demoProps: `value='option'`,
  },
  native: {
    demoProps: `value='option'`,
  },
  demo: {
    label: 'Email notifications',
    description: 'Receive updates by email.',
    excludeControls: ['value', 'required'],
    initialValues: {
      size: 'md',
      color: 'primary',
      checked: false,
      disabled: false,
      error: '',
    },
    previewWidth: 'field',
  },

  defaults: {
    shared: {
      defaultChecked: false,
      disabled: false,
      required: false,
      size: 'md',
      color: 'primary',
    },
  },

  examples: [
    {
      title: 'Basic',
      description: 'Standalone radio option.',
      props: [],
    },
    {
      title: 'Selected',
      description: 'Selected state.',
      props: ['checked'],
    },
    {
      title: 'Disabled',
      description: 'Disabled state.',
      props: ['disabled'],
    },
    {
      title: 'Required',
      description: 'Required form control.',
      props: ['required'],
    },
    {
      title: 'Error',
      description: 'Validation error state.',
      props: [`error='Please choose an option.'`],
    },
    {
      title: 'Size and color',
      description: 'Large semantic radio treatment.',
      props: [`size='lg'`, `color='success'`],
    },
  ],

  related: ['radio-group', 'checkbox', 'select'],
});
