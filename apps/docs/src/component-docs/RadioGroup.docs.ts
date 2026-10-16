import { defineComponentDocs } from './defineComponentDocs';

/**
 * Canonical RadioGroup docs for Web and React Native. Preserve original
 * editorial examples in protected authored regions during safe adoption.
 */
export const radioGroupDocs = defineComponentDocs({
  component: 'RadioGroup',
  platforms: {
    react: {
      title: 'RadioGroup – React Radio Component',
      description:
        'Build accessible React radio groups with keyboard navigation, validation, descriptions, and TypeScript support.',
      summary:
        'RadioGroup displays mutually exclusive choices together, enabling comparison and keyboard selection with coherent shared state.',
      whenToUse: [
        'Use RadioGroup when a small set of exclusive options should remain visible for easy comparison.',
        'Prefer Select when there are many options or the selected value is secondary to the task.',
        'Choose controlled value and onValueChange for application-owned state or defaultValue for initial uncontrolled state.',
        'Compose Radio children or RadioGroup.Item while using group size, color, and orientation tokens.',
      ],
      accessibility: [
        'Provide a visible and accessible group label, especially when choices need context.',
        'Preserve radio group and radio semantics, keyboard navigation, and a focus indicator for keyboard users.',
        'Keep labels and meaningful option descriptions visible and maintain visual and keyboard ordering.',
        'Associate group validation errors, required/disabled state, and selected state with their controls.',
      ],
      seeAlso: [
        { component: 'Select', label: 'Select for compact or longer choice lists.' },
        { component: 'Checkbox', label: 'Checkbox for independent boolean choices.' },
        { component: 'FormField', label: 'FormField for custom field composition.' },
      ],
    },
    'react-native': {
      title: 'React Native RadioGroup',
      description:
        'Build visible single-selection groups with Vellira RadioGroup and Radio using controlled state, orientation, validation, colors, and native accessibility.',
      summary:
        'Native RadioGroup keeps exclusive choices visible with consistent controlled state, group styling, and selected-state announcements.',
      whenToUse: [
        'Use RadioGroup for a short exclusive set of choices when comparing visible options helps the user.',
        'Use value and onValueChange for controlled selection, or defaultValue for initial uncontrolled selection.',
        'Choose horizontal orientation only when option labels remain readable on phone screens.',
        'Use Radio children or RadioGroup.Item; prefer Select when space or the number of options makes persistent display awkward.',
      ],
      accessibility: [
        'Provide a meaningful group label and keep descriptions visible for context and tradeoffs.',
        'Ensure error messages explain how to correct selection and communicate selected state accessibly.',
        'Propagate disabled and required state consistently to child Radio controls and their interaction.',
        'Verify selected-state announcements and navigation using VoiceOver and TalkBack on iOS and Android.',
      ],
      seeAlso: [
        { component: 'Select', label: 'Select for compact or long lists.' },
        { component: 'Checkbox', label: 'Checkbox for independent native choices.' },
        { component: 'FormField', label: 'FormField for custom field layouts.' },
      ],
    },
  },
});
