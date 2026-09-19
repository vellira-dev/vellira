import { defineComponentPageMetadata } from '../../metadata';

export default defineComponentPageMetadata({
  profile: 'form-control',
  related: ['input', 'form-field', 'select'],
  catalogPreview: {
    layout: 'field',
    props: [
      "label='Message'",
      "placeholder='Write a message...'",
      "size='sm'",
      'rows={3}',
    ],
  },
  discovery: {
    status: 'complete',
    summary:
      'Use Textarea as the canonical Vellira form component across React and React Native.',
    description:
      'Textarea for React and React Native with controlled and uncontrolled state, disabled state, required state, and validation state.',
    whenToUse: [
      'Use it when an interface needs explicit user input, selection, or form participation.',
      'Prefer the canonical state and validation API instead of rebuilding form-control behavior in application code.',
    ],
    patterns: [
      {
        id: 'basic',
        title: 'Basic',
        description: 'Basic component usage.',
      },
      {
        id: 'controlled',
        title: 'Controlled',
        description: 'State controlled by the parent application.',
      },
      {
        id: 'uncontrolled',
        title: 'Uncontrolled',
        description: 'State initialized and then managed by the component.',
      },
      {
        id: 'disabled',
        title: 'Disabled',
        description: 'Disabled state with interaction unavailable.',
      },
      {
        id: 'required',
        title: 'Required',
        description: 'Required state for form participation.',
      },
      {
        id: 'invalid',
        title: 'Invalid',
        description: 'Invalid state with validation semantics.',
      },
    ],
    platformNotes: {
      react: [
        'The React package uses web platform semantics; keep DOM, keyboard, and ARIA guidance scoped to behavior verified by the web implementation.',
      ],
      'react-native': [
        'The React Native package uses native rendering and accessibility props; browser-only DOM and keyboard behavior does not automatically apply.',
      ],
    },
    missingEvidence: [],
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
      props: ["value='Example value'"],
    },
    {
      title: 'Uncontrolled',
      description: 'State initialized and then managed by the component.',
      props: ["defaultValue='Example value'"],
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
});
