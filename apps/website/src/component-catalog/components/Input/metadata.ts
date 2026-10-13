import { defineComponentPageMetadata } from '../../metadata';

export default defineComponentPageMetadata({
  discovery: {
    status: 'complete',
    summary:
      'Use Input for short free-form text in forms and search, with explicit labels and validation feedback.',
    description:
      'Accessible React and React Native text inputs with labels, controlled values, validation feedback, clearable search, and password reveal.',
    whenToUse: [
      'Use Input for short text such as email, search terms, and account names.',
      'Use Select or RadioGroup for fixed choices; use Textarea for longer messages.',
      'Choose value with onValueChange for controlled fields or defaultValue for initial state.',
      'Provide visible labels and actionable error text instead of placeholder-only instructions.',
    ],
    patterns: [
      {
        id: 'controlled',
        title: 'Controlled values',
        description:
          'Use value and onValueChange when application state owns the text.',
      },
      {
        id: 'uncontrolled',
        title: 'Default values',
        description:
          'Use defaultValue when the component can manage its initial text.',
      },
      {
        id: 'validation',
        title: 'Field validation',
        description:
          'Use error, invalid, and FormField for accessible field feedback.',
      },
      {
        id: 'clear-search',
        title: 'Clearable search',
        description:
          'Use clearable and onClear to reset a controlled search field.',
      },
      {
        id: 'password',
        title: 'Password reveal',
        description:
          'Enable revealPassword only on password-type inputs.',
      },
    ],
    platformNotes: {
      react: [
        'React Input supports browser input types, onValueChange, and form label associations.',
        'When the app owns a clearable value, reset its state in onClear.',
      ],
      'react-native': [
        'React Native Input uses native text controls and keyboard behavior.',
        'Choose keyboardType and returnKeyType for the expected native text input.',
      ],
    },
    missingEvidence: [],
  },

  demo: {
    label: 'Email',
    description: 'Used for account notifications.',
    initialValues: {
      placeholder: 'name@example.com',
      size: 'md',
      color: 'primary',
      variant: 'outline',
      disabled: false,
      readOnly: false,
      required: false,
      invalid: false,
      loading: false,
      clearable: false,
      revealPassword: false,
      showCounter: false,
      error: '',
    },
    previewWidth: 'field',
  },

  defaults: {
    shared: {
      size: 'md',
      color: 'primary',
      variant: 'outline',
      disabled: false,
      readOnly: false,
      required: false,
      invalid: false,
      loading: false,
      clearable: false,
      revealPassword: false,
      showCounter: false,
    },

    react: {
      type: 'text',
      startIconTone: 'default',
      endIconTone: 'default',
      clearIconTone: 'danger',
    },

    native: {
      type: 'text',
      startIconTone: 'default',
      endIconTone: 'default',
      clearIconTone: 'danger',
    },
  },

  examples: [
    {
      title: 'Basic',
      description: 'Labeled text input.',
      props: [],
    },
    {
      title: 'Clearable',
      description: 'Shows a clear action when a value is present.',
      props: ['clearable', `defaultValue='Acme Inc.'`],
    },
    {
      title: 'Loading',
      description: 'Shows progress while the field is waiting on work.',
      props: ['loading', `defaultValue='Checking...'`],
    },
    {
      title: 'Error',
      description: 'Validation feedback state.',
      props: [`error='Enter a valid email.'`],
    },
    {
      title: 'Read only',
      description: 'Preserves value display without allowing edits.',
      props: ['readOnly', `defaultValue='readonly@example.com'`],
    },
    {
      title: 'Password',
      description: 'Password input with reveal control.',
      props: [`type='password'`, 'revealPassword'],
    },
    {
      title: 'Counter',
      description: 'Character count when maxLength is set.',
      props: ['showCounter', 'maxLength={80}'],
    },
  ],

  accessibility: {
    react: [
      {
        title: 'Labels and descriptions',
        description:
          'Use label and description text so the input purpose and expected value are clear.',
        props: ['label', 'description', 'placeholder'],
      },
      {
        title: 'Validation feedback',
        description:
          'Expose error and invalid state with text that explains how to resolve the issue.',
        props: ['error', 'invalid', 'required'],
      },
      {
        title: 'Read-only and disabled fields',
        description:
          'Use readOnly when values should remain focusable and disabled only when interaction is unavailable.',
        props: ['readOnly', 'disabled'],
      },
    ],
    native: [
      {
        title: 'Labels and hints',
        description:
          'Use visible label text and accessibility hints when the expected input is not obvious.',
        props: ['label', 'description', 'accessibilityHint'],
      },
      {
        title: 'Validation feedback',
        description:
          'Expose error text and invalid state so screen reader users receive the same feedback.',
        props: ['error', 'invalid', 'required'],
      },
      {
        title: 'Keyboard input',
        description:
          'Choose the appropriate input type and keyboard behavior for the value being entered.',
        props: ['type', 'keyboardType', 'returnKeyType'],
      },
    ],
  },

  related: ['form-field', 'select', 'checkbox'],
});
