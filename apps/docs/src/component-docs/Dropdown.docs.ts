import { defineComponentDocs } from './defineComponentDocs';

/**
 * Platform-specific Dropdown documentation intent.
 * Legacy examples stay untouched until the verified adoption step.
 */
export const dropdownDocs = defineComponentDocs({
  component: 'Dropdown',
  platforms: {
    react: {
      title: 'Dropdown – React Menu Component',
      description:
        'Create accessible React dropdown menus with keyboard navigation, submenus, checkboxes, radio items, and TypeScript support.',
      summary:
        'Dropdown exposes contextual commands through a compound menu API rather than selecting a saved form value.',
      whenToUse: [
        'Use Dropdown for contextual actions and commands; use Select for saved form values.',
        'Use Dropdown.Trigger with a labeled Button or accessible icon-only trigger.',
        'Use Item onSelect for pointer and keyboard action selection.',
        'Use checkbox or radio menu items for menu-scoped settings, and nested submenus for related commands.',
      ],
      accessibility: [
        'The trigger exposes aria-haspopup, aria-expanded, and aria-controls.',
        'Menu content and items use menu, menuitem, menuitemcheckbox, and menuitemradio roles.',
        'Keep keyboard navigation, Escape dismissal, focus return, and disabled link semantics intact.',
        'Do not substitute listbox semantics for action menus.',
      ],
      seeAlso: [
        {
          component: 'Select',
          label: 'Select for persistent value selection.',
        },
        {
          component: 'Popover',
          label: 'Popover for richer contextual content.',
        },
      ],
    },
    'react-native': {
      title: 'React Native Dropdown',
      description:
        'Build contextual native action menus with Vellira Dropdown using compound items, controlled open state, search, command mode, loading, and semantic colors.',
      summary:
        'Native Dropdown exposes contextual commands in sheet, modal, or popover presentations with optional search.',
      whenToUse: [
        'Use Dropdown for actions such as rename, archive, copy, and delete, not saved form values.',
        'Use controlled open and onOpenChange or initial defaultOpen for menu visibility.',
        'Use searchable and command for longer action sets.',
        'Choose auto, sheet, modal, or popover presentation to match native context.',
      ],
      accessibility: [
        'Provide visible trigger text or accessibilityLabel for icon-only triggers.',
        'Use accessibilityHint where opening a command menu needs clarification.',
        'Make destructive commands explicit and test touch interactions and announcements.',
        'Verify outside dismissal and focus restoration with VoiceOver and TalkBack.',
      ],
      seeAlso: [
        {
          component: 'Select',
          label: 'Select for native saved values.',
        },
        {
          component: 'Modal',
          label: 'Modal for confirmation flows.',
        },
      ],
    },
  },
});
