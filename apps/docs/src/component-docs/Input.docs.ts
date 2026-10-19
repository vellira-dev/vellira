import { defineComponentDocs } from './defineComponentDocs';

/**
 * Verified Input documentation intent for React and React Native.
 * Historical form examples and editorial guidance stay in authored regions.
 */
export const inputDocs = defineComponentDocs({
  component: 'Input',
  platforms: {
    react: {
      title: 'Input – React Input Component',
      description:
        'Create accessible React input fields with labels, validation, helper text, icons, and customizable styling.',
      summary:
        'Input captures short free-form values with controlled or default state, labels, validation feedback, clear actions, icons, and optional formatting.',
      whenToUse: [
        'Use Input for names, emails, search queries, passwords, and other short text values rather than fixed choices.',
        'Use value with onValueChange for application-owned state, or defaultValue for an initial uncontrolled value.',
        'Use visible labels and description or error text to communicate field meaning and validation.',
        'Use FormField composition for complex layouts that need shared label, error, description, and required state.',
        'For clearable controlled inputs, make sure the application updates its value when the clear action runs.',
      ],
      accessibility: [
        'Web Input uses a native input and can inherit labels, description, errors, and required state from FormField context.',
        'Provide a visible label or correctly associated accessible name rather than relying on placeholder alone.',
        'Invalid fields expose aria-invalid and connect relevant description and error text through aria-describedby.',
        'Keep clear and password-reveal actions understandable with their own accessible labels.',
      ],
      seeAlso: [
        {
          component: 'FormField',
          label:
            'FormField for composed labels, descriptions, validation, and feedback.',
        },
        {
          component: 'Select',
          label: 'Select when the set of valid values is known in advance.',
        },
      ],
    },
    'react-native': {
      title: 'React Native Input',
      description:
        'Capture native text with Vellira Input using validation, clear actions, password reveal, icons, masks, formatting, counters, and TextInput props.',
      summary:
        'React Native Input collects short text using a native TextInput with controlled or initial values, error hints, clearable search, and password reveal.',
      whenToUse: [
        'Use Input for editable short text such as search queries, names, email addresses, and passwords.',
        'Use value and onValueChange for controlled text, or defaultValue for an initial local value.',
        'Choose keyboardType, returnKeyType, and secure-text behavior to match the native input task.',
        'Use clearable and onClear for reset actions; when controlled, clear the application-owned value.',
        'Provide meaningful label, description, and error content, and avoid presenting placeholder as the only field label.',
      ],
      accessibility: [
        'React Native Input uses TextInput and supports accessibilityLabel and accessibilityHint for accessible context.',
        'A visible label and field description should communicate the input purpose and validation message.',
        'Disabled and busy state are exposed through native accessibilityState, while editing is disabled during loading or read-only state.',
        'Verify focus, validation hints, password reveal, and clear controls on actual VoiceOver and TalkBack devices.',
      ],
      seeAlso: [
        {
          component: 'FormField',
          label: 'FormField for labels and additional field context.',
        },
        {
          component: 'Select',
          label: 'Select for choosing from a fixed set of native options.',
        },
      ],
    },
  },
});
