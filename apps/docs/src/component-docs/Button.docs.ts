import { defineComponentDocs } from './defineComponentDocs';

/**
 * Canonical two-platform Button documentation intent.
 * The detailed legacy recipes and examples remain in authored regions.
 */
export const buttonDocs = defineComponentDocs({
  component: 'Button',
  platforms: {
    react: {
      title: 'Button – React Button Component',
      description:
        'Build accessible React buttons with multiple appearances, colors, loading states, icons, keyboard shortcuts, and full TypeScript support.',
      summary:
        'Button triggers explicit actions such as saving, submitting, opening a menu, or confirming a change, with separate web link composition when navigation is intended.',
      whenToUse: [
        'Use Button for actions, not as a substitute for an inline text link.',
        'Choose appearance for visual hierarchy and color for semantic action intent.',
        'Use loading and loadingText for pending operations; a loading button prevents repeat interaction.',
        'Use iconStart, iconEnd, badge, and shortcut to clarify dense action surfaces; shortcut is a visual hint, not automatic keyboard handling.',
        'Use href, download, or asChild only when the web action needs real link or router semantics.',
      ],
      accessibility: [
        'Web Button uses button semantics by default; icon-only actions require an accessible name using aria-label or aria-labelledby.',
        'Loading and disabled states prevent interaction; use understandable progress labels for asynchronous actions.',
        'When Button renders a link via href, disabled or loading links use aria-disabled rather than a native button disabled attribute.',
        'Do not rely on danger color alone to communicate irreversible actions.',
      ],
      seeAlso: [
        {
          component: 'Dropdown',
          label: 'Dropdown for grouped actions and contextual commands.',
        },
        {
          component: 'Modal',
          label: 'Modal for confirmation before irreversible operations.',
        },
      ],
    },
    'react-native': {
      title: 'React Native Button',
      description:
        'Build native actions with Vellira Button using appearances, semantic colors, loading states, icons, badges, shortcuts, and accessible labels.',
      summary:
        'React Native Button handles press actions with native onPress, semantic appearances and colors, icon-only labels, loading state, and optional compact badges.',
      whenToUse: [
        'Use onPress for native actions such as saving, submitting, and confirming; DOM onClick is a web-only API.',
        'Use appearance and color to express native action priority and intent.',
        'Use loading and loadingText for pending native actions, and disabled to prevent activation.',
        'Use iconOnly with accessibilityLabel when no visible action label is rendered.',
        'Badge and shortcut are display hints and do not implement keyboard shortcuts by themselves.',
      ],
      accessibility: [
        'For icon-only actions supply accessibilityLabel; an icon alone is not an accessible action name.',
        'Use visible action text whenever practical, and loadingText to communicate an asynchronous action.',
        'Disabled or loading Button blocks native press interaction.',
        'Keep touch targets usable and check important flows with VoiceOver and TalkBack on actual devices.',
      ],
      seeAlso: [
        {
          component: 'Dropdown',
          label: 'Dropdown for native action lists.',
        },
        {
          component: 'Modal',
          label: 'Modal for confirming destructive native operations.',
        },
      ],
    },
  },
});
