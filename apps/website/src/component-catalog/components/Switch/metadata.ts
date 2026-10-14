import { defineComponentPageMetadata } from '../../metadata';

export default defineComponentPageMetadata({
  profile: 'form-control',
  discovery: {
    status: 'complete',
    summary:
      'Use Switch for immediate on/off settings such as notifications, synchronization, and saved preferences.',
    description:
      'Accessible React and React Native Switch for immediate boolean settings with controlled or default checked state, disabled, required, and invalid semantics.',
    whenToUse: [
      'Choose Switch for an on/off setting that takes effect immediately.',
      'Choose Checkbox instead for independent selections or acceptance fields in a form.',
      'Use checked with onCheckedChange when application state owns the preference; use defaultChecked for its initial local state.',
      'Provide a meaningful accessible name describing the setting being changed.',
    ],
    patterns: [
      {
        id: 'controlled-setting',
        title: 'Controlled preference',
        description:
          'Use checked and onCheckedChange when application state drives the on/off preference.',
      },
      {
        id: 'uncontrolled-setting',
        title: 'Initially enabled',
        description:
          'Use defaultChecked to initialize an on/off setting that Switch manages after mounting.',
      },
      {
        id: 'disabled-setting',
        title: 'Unavailable setting',
        description:
          'Use disabled when a setting cannot currently be changed, while keeping its label visible.',
      },
      {
        id: 'required-and-invalid',
        title: 'State and validation cues',
        description:
          'Use required and invalid to communicate state; implement any form submission or recovery separately.',
      },
    ],
    platformNotes: {
      react: [
        'React renders a button with role=switch and aria-checked; required and invalid map to aria-required and aria-invalid.',
        'Disabled is the native button disabled attribute. Switch does not submit a native form value by itself.',
      ],
      'react-native': [
        'React Native uses Pressable with accessibilityRole=switch and checked/disabled in accessibilityState.',
        'Required and invalid are conveyed through accessibilityHint rather than browser ARIA attributes; verify announcements on real devices.',
      ],
    },
    missingEvidence: [],
  },
  demo: {
    staticProps: {
      accessibilityLabel: "'Switch'",
    },
  },
  examples: [
    {
      title: 'Basic',
      description: 'Basic component usage.',
      props: [],
    },
    {
      title: 'Controlled',
      description: 'State controlled by the parent application.',
      props: ['checked'],
    },
    {
      title: 'Uncontrolled',
      description: 'State initialized and then managed by the component.',
      props: ['defaultChecked'],
    },
    {
      title: 'Disabled',
      description: 'Disabled state with interaction unavailable.',
      props: ['disabled'],
    },
    {
      title: 'Required',
      description: 'Required state for form participation.',
      props: ['required'],
    },
    {
      title: 'Invalid',
      description: 'Invalid state with validation semantics.',
      props: ['invalid'],
    },
  ],
  related: ['checkbox', 'radio', 'form-field'],
});
