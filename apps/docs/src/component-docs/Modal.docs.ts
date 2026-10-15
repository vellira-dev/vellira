import { defineComponentDocs } from './defineComponentDocs';

/**
 * Platform-scoped Modal documentation contract. Preserve the original
 * published examples inside the authored region during legacy adoption.
 */
export const modalDocs = defineComponentDocs({
  component: 'Modal',
  platforms: {
    react: {
      title: 'Modal – React Modal Component',
      description:
        'Accessible React modal dialog with focus trapping, portal rendering, keyboard navigation, and customizable layouts.',
      summary:
        'Modal focuses attention on blocking decisions and short tasks, then returns focus to the preceding workflow.',
      whenToUse: [
        'Use Modal for focused confirmations, short forms, and decisions that interrupt the current workflow.',
        'Prefer a regular page for long multi-step flows or content that must be compared with the background.',
        'Compose Modal.Trigger, Modal.Overlay, and Modal.Content through the public compound API and Portal.',
        'Use alertdialog semantics and explicit consequences for destructive confirmations.',
      ],
      accessibility: [
        'Provide a visible Modal.Title or an accessible label for Modal.Content.',
        'Use Modal.Description when an action or decision needs context, especially alertdialog.',
        'Preserve keyboard focus containment, Escape handling, and focus return when the dialog closes.',
        'Keep a clearly labeled close or cancel action, and do not communicate destructive consequences through color alone.',
      ],
      seeAlso: [
        {
          component: 'Button',
          label: 'Button for safe and destructive dialog actions.',
        },
        {
          component: 'FormField',
          label: 'FormField for compact forms inside dialogs.',
        },
      ],
    },
    'react-native': {
      title: 'React Native Modal',
      description:
        'Build native dialogs with Vellira Modal using compound triggers, overlays, controlled state, animations, outside dismissal, Portal composition, and accessible actions.',
      summary:
        'Native Modal presents blocking confirmations and focused tasks with compound overlays, content, and actions.',
      whenToUse: [
        'Use Modal for concise native confirmations or focused tasks that block the underlying screen.',
        'Use controlled open state when the application owns visibility, or defaultOpen for initial uncontrolled state.',
        'Compose Modal.Trigger, Modal.Overlay, Modal.Content, and action slots through Portal when needed.',
        'Disable outside dismissal for required decisions and use explicit wording for destructive actions.',
      ],
      accessibility: [
        'Give dialogs a clear heading and action labels that describe the actual consequences.',
        'Provide a safe close path for non-required dialogs and do not rely only on semantic color.',
        'Respect reduced-motion preferences and ensure dialog content is understandable without animation.',
        'Verify screen-reader announcements, focus and reading order, and outside dismissal on iOS and Android.',
      ],
      seeAlso: [
        { component: 'Button', label: 'Button for native dialog actions.' },
        {
          component: 'FormField',
          label: 'FormField for structured native inputs.',
        },
      ],
    },
  },
});
