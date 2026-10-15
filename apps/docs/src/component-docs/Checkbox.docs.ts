import { defineComponentDocs } from './defineComponentDocs';

/**
 * Authored Checkbox intent for the two platform docs surfaces.
 * Historical editorial examples remain in their protected authored region.
 * This contract only owns generated structure and verified API guidance.
 */
export const checkboxDocs = defineComponentDocs({
  component: 'Checkbox',
  platforms: {
    react: {
      title: 'Checkbox – React Checkbox Component',
      description:
        'Accessible React checkbox component with indeterminate state, validation, descriptions, keyboard support, and TypeScript integration.',
      summary:
        'Checkbox represents an independently selected form value, including partial group-selection summaries.',
      whenToUse: [
        'Use Checkbox for independent selections, agreements, and form settings.',
        'Use RadioGroup when exactly one mutually exclusive value may be chosen.',
        'Use controlled checked and onCheckedChange when application state owns the choice, or defaultChecked for local initial state.',
        'Use indeterminate only for partial group selection; it is not a third submitted boolean value.',
      ],
      accessibility: [
        'React Checkbox uses a native input type=checkbox, including disabled and required browser semantics.',
        'Provide label, aria-label, or aria-labelledby so the control has an accessible name.',
        'Description and error text are connected through aria-describedby, and error exposes invalid state.',
        'Indeterminate uses the DOM indeterminate state and announces mixed through aria-checked.',
      ],
      seeAlso: [
        {
          component: 'RadioGroup',
          label: 'RadioGroup for choosing exactly one option.',
        },
        {
          component: 'FormField',
          label: 'FormField for composable form labels and feedback.',
        },
      ],
    },
    'react-native': {
      title: 'React Native Checkbox',
      description:
        'Use Vellira Checkbox for controlled, uncontrolled, required, disabled, error, and indeterminate boolean selection in React Native.',
      summary:
        'React Native Checkbox supports independent selection and mixed-state summaries through an accessible Pressable control.',
      whenToUse: [
        'Use Checkbox for independent agreements, preferences, or selection rows.',
        'Use checked and onCheckedChange for controlled state, or defaultChecked for initial local state.',
        'Use indeterminate for partial group selection, not a third stored boolean value.',
        'Use RadioGroup for one-of-many choices rather than independent selections.',
      ],
      accessibility: [
        'React Native Checkbox uses accessibilityRole=checkbox with checked or mixed and disabled values in accessibilityState.',
        'Provide a visible label or explicit accessibilityLabel.',
        'Descriptions, required state, errors, and accessibilityHint contribute to the control hint.',
        'Check mixed-state announcements and touch targets with VoiceOver and TalkBack.',
      ],
      seeAlso: [
        {
          component: 'RadioGroup',
          label: 'RadioGroup for mutually exclusive native choices.',
        },
        {
          component: 'FormField',
          label: 'FormField for field context, labels, and validation.',
        },
      ],
    },
  },
});
