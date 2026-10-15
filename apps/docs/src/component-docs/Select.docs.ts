import { defineComponentDocs } from './defineComponentDocs';

/**
 * Platform-specific Select documentation intent.
 * Legacy examples remain authoritative until independently verified adoption.
 */
export const selectDocs = defineComponentDocs({
  component: 'Select',
  platforms: {
    react: {
      title: 'Select – React Select Component',
      description:
        'Accessible React select component with keyboard navigation, search, validation, and customizable dropdown menus.',
      summary:
        'Select provides controlled and uncontrolled single or multiple choice fields with a compound option API.',
      whenToUse: [
        'Use Select for saved form values chosen from a compact known set.',
        'Use RadioGroup when a small list should remain visible; use Dropdown for commands.',
        'Use multiple and maxSelected when users may choose several options.',
        'Use searchable and Select.Search for large sets of options.',
      ],
      accessibility: [
        'Use a visible label where possible or aria-label when a visible label is unavailable.',
        'Web Select supports keyboard navigation with arrows, Home, End, Enter, Space, and Escape.',
        'The trigger associates errors via aria-describedby and exposes invalid state.',
        'Verify selected option focus and scrolling when reopening long lists.',
      ],
      seeAlso: [
        { component: 'Dropdown', label: 'Dropdown for contextual commands.' },
        { component: 'RadioGroup', label: 'RadioGroup for visible exclusive choices.' },
      ],
    },
    'react-native': {
      title: 'React Native Select',
      description:
        'Build native single and multiple selection fields with sheets, modals, popovers, search, groups, virtualization, validation, and accessible triggers.',
      summary:
        'Native Select presents known choices in a sheet, modal, or popover, with optional search and multiple selection.',
      whenToUse: [
        'Use Select for choosing one or more stored values from known options.',
        'Use presentation to select automatic, sheet, modal, or popover content.',
        'Use options or Select.Item children to define values and labels.',
        'Use virtual for large FlatList-backed option sets.',
      ],
      accessibility: [
        'Provide a visible label or accessibilityLabel for the native trigger.',
        'Native trigger exposes required and invalid state, with an error announcement region.',
        'Use accessibilityHint only where the default list behavior needs additional context.',
        'Test sheet, modal, and popover focus with VoiceOver and TalkBack.',
      ],
      seeAlso: [
        { component: 'RadioGroup', label: 'RadioGroup for short visible native choices.' },
        { component: 'Dropdown', label: 'Dropdown for native contextual actions.' },
      ],
    },
  },
});
