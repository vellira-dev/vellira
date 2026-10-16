import { defineComponentDocs } from './defineComponentDocs';

/**
 * Published FormField documentation authority, scoped separately to Web and
 * React Native. Legacy author bodies must be protected during adoption.
 */
export const formFieldDocs = defineComponentDocs({
  component: 'FormField',
  platforms: {
    react: {
      title: 'FormField – React Form Component',
      description:
        'Compose accessible React form fields with labels, helper text, validation messages, and consistent layouts.',
      summary:
        'Web FormField connects labels, descriptions, errors, status messages, state, and ids for composed field controls.',
      whenToUse: [
        'Use FormField for custom field layouts requiring shared label, description, error, message, and control semantics.',
        'Prefer the Input shorthand for an ordinary text field that does not need custom field composition.',
        'Use the compound Label, Description, Control, and Message slots for explicitly ordered field markup.',
        'Let compatible controls consume FormField context; use bindControl={false} only when the custom control owns binding.',
      ],
      accessibility: [
        'Preserve generated control and label ids, aria-labelledby, aria-describedby, and aria-invalid relationships.',
        'Present required, disabled, and invalid states clearly, without relying on color alone.',
        'Connect explicit descriptions and error messages to the control without overriding user-supplied attributes.',
        'Use a meaningful error announcement and keep field messages associated with their actual control.',
      ],
      seeAlso: [
        {
          component: 'Input',
          label: 'Input for built-in text-field composition.',
        },
        { component: 'Select', label: 'Select for field choices.' },
        {
          component: 'RadioGroup',
          label: 'RadioGroup for visible exclusive choices.',
        },
      ],
    },
    'react-native': {
      title: 'React Native FormField',
      description:
        'Compose custom native controls with Vellira FormField labels, descriptions, validation messages, required state, layout, and styles.',
      summary:
        'Native FormField composes labels, descriptions, messages, and errors around custom native controls without replacing their semantics.',
      whenToUse: [
        'Use FormField for custom native controls that need presentational field chrome and supporting text.',
        'Do not double-wrap Input, Select, or RadioGroup controls that already render their own field chrome.',
        'Use the labelPosition, orientation, and size contract to arrange custom form-field content.',
        'Let the native child control own its label, role, editable or disabled behavior, and interactions.',
      ],
      accessibility: [
        'The child must expose its own accessible label and interaction semantics; FormField provides supporting layout only.',
        'Give errors a polite live region without using it as a substitute for the child control’s state.',
        'Ensure disabled is applied to the child control’s interaction as well as the field container.',
        'Check custom field interactions and screen-reader announcements on iOS and Android.',
      ],
      seeAlso: [
        { component: 'Input', label: 'Input for native built-in text fields.' },
        { component: 'Select', label: 'Select for compact choice fields.' },
        {
          component: 'RadioGroup',
          label: 'RadioGroup for native exclusive choices.',
        },
      ],
    },
  },
});
