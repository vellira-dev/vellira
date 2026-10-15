import { defineComponentDocs } from './defineComponentDocs';

/**
 * Platform-scoped Tabs documentation intent. Existing guides are retained
 * until the reviewed two-platform legacy adoption completes.
 */
export const tabsDocs = defineComponentDocs({
  component: 'Tabs',
  platforms: {
    react: {
      title: 'Tabs – React Tabs Component',
      description:
        'Accessible React tabs and navigation with keyboard support, controlled state, and flexible layouts.',
      summary:
        'Tabs organize peer content sections or composed navigation destinations with stable values and flexible mounting.',
      whenToUse: [
        'Use tabs mode for related panels in the same context, not step-by-step workflows.',
        'Use navigation mode when triggers represent destinations rather than tab panels.',
        'Use stable values and controlled state when selection follows the URL or application state.',
        'Choose keepMounted, lazyMount, or forceMount deliberately for stateful panels.',
      ],
      accessibility: [
        'In tabs mode, Tabs.List, Tabs.Trigger, and Tabs.Content follow the WAI-ARIA tablist, tab, and tabpanel pattern.',
        'Keyboard interaction supports directional arrows, Home, End, and manual Enter or Space activation.',
        'In navigation mode, composed links retain their native semantics and expose aria-current for the active destination.',
        'Keep panel and trigger values paired, and preserve unsaved form state intentionally.',
      ],
      seeAlso: [
        { component: 'Select', label: 'Select for compact choices.' },
        { component: 'Button', label: 'Button for actions inside panels.' },
      ],
    },
    'react-native': {
      title: 'React Native Tabs',
      description:
        'Organize native screens with Vellira Tabs using compound triggers, stable values, variants, scrollable lists, controlled state, and panel mounting policies.',
      summary:
        'Native Tabs switch related screen content through accessible compound triggers and configurable panel mounting.',
      whenToUse: [
        'Use Tabs for related sections within a native screen and stable value-based selection.',
        'Use scrollable Tabs.List for rows that cannot fit on a narrow display.',
        'Choose keepMounted and lazyMount according to native panel state needs.',
        'Use navigation mode for destinations instead of in-place panels.',
      ],
      accessibility: [
        'In tabs mode, native triggers expose selected and disabled states with tab semantics where supported.',
        'In navigation mode, composed children retain destination-specific accessibility responsibility.',
        'Keep trigger labels short, distinct, and understandable without color alone.',
        'Verify navigation, scrollable triggers, and mounting with VoiceOver and TalkBack.',
      ],
      seeAlso: [
        { component: 'Select', label: 'Select for compact native choices.' },
        { component: 'Button', label: 'Button for panel actions.' },
      ],
    },
  },
});
