import { defineComponentPageMetadata } from '../../metadata';

const useStateImport = "import { useState } from 'react';" as const;

export default defineComponentPageMetadata({
  profile: 'selection-control',
  discovery: {
    status: 'complete',
    summary:
      'Use Checkbox as the canonical Vellira form component across React and React Native.',
    description:
      'Checkbox for React and React Native with controlled and uncontrolled state, indeterminate state, disabled state, required state, and validation state.',
    whenToUse: [
      'Use it when an interface needs explicit user input, selection, or form participation.',
      'Prefer the canonical state and validation API instead of rebuilding form-control behavior in application code.',
      'Use Checkbox for independent boolean choices; use RadioGroup when exactly one option must be selected.',
      'Use Checkbox for form-like independent selections; use Switch for persistent settings that apply immediately.',
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
        id: 'indeterminate',
        title: 'Indeterminate',
        description: 'Mixed selection state for partial group selection.',
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
      description: 'An independent boolean choice with a visible label.',
      props: [],
    },
    {
      title: 'Controlled Checkbox',
      description:
        'Keep checked state in application state when another part of the interface needs to read or change it.',
      props: ['checked={checked}', 'onCheckedChange={setChecked}'],
      setup: ['const [checked, setChecked] = useState(false);'],
      imports: [useStateImport],
    },
    {
      title: 'Uncontrolled Checkbox',
      description:
        'Set the initial checked state and let Checkbox manage later interaction.',
      props: ['defaultChecked'],
    },
    {
      title: 'Indeterminate / Select All',
      description:
        'Represent partial group selection while keeping the stored selection model boolean.',
      inheritDemoProps: false,
      props: [
        'checked={allSelected}',
        'indeterminate={someSelected && !allSelected}',
        'onCheckedChange={toggleAll}',
        "label='Select all projects'",
      ],
      setup: [
        'const [selectedCount, setSelectedCount] = useState(1);',
        'const totalCount = 3;',
        'const allSelected = selectedCount === totalCount;',
        'const someSelected = selectedCount > 0;',
        'const toggleAll = (checked: boolean) => setSelectedCount(checked ? totalCount : 0);',
      ],
      imports: [useStateImport],
    },
    {
      title: 'Validation / Required State',
      description:
        'Combine required state with visible validation feedback when acceptance is mandatory.',
      inheritDemoProps: false,
      props: [
        'required',
        'checked={accepted}',
        'onCheckedChange={setAccepted}',
        "label='Accept the terms'",
        "error={accepted ? undefined : 'Accept the terms to continue.'}",
      ],
      setup: ['const [accepted, setAccepted] = useState(false);'],
      imports: [useStateImport],
    },
    {
      title: 'Accessible Labels and Descriptions',
      description:
        'Pair a visible label with durable supporting context instead of relying on hover-only help.',
      inheritDemoProps: false,
      props: [
        "label='Email product updates'",
        "description='Receive important release and billing updates.'",
      ],
    },
    {
      title: 'Disabled',
      description: 'Keep unavailable choices visible while preventing interaction.',
      props: ['disabled'],
    },
  ],
  related: ['radio-group', 'switch', 'form-field'],
});
