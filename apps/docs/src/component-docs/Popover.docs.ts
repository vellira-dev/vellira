import { defineComponentDocs } from './defineComponentDocs';

/**
 * Platform-scoped Popover documentation authority. Original published examples
 * and detailed guidance are preserved in protected authored regions.
 */
export const popoverDocs = defineComponentDocs({
  component: 'Popover',
  platforms: {
    react: {
      title: 'Popover – Accessible React Popover Component',
      description:
        'Build accessible React popovers with controlled state, modal behavior, flexible positioning, anchors, arrows, and keyboard interactions.',
      summary:
        'Popover presents rich interactive contextual content anchored to a trigger or another element without requiring a blocking dialog.',
      whenToUse: [
        'Use Popover for compact forms, contextual settings, filters, and other interactive floating content.',
        'Use Tooltip for short non-interactive helper text and Modal for blocking decisions.',
        'Compose trigger, content, title, description, arrow, and close parts through the public compound API.',
        'Use Popover.Anchor for positioning independent of the trigger and control dismissal for the interaction.',
      ],
      accessibility: [
        'Give interactive content a clear accessible name with Popover.Title or an explicit labeling strategy.',
        'Use Popover.Description for supporting context and keep trigger expanded and control semantics intact.',
        'Preserve Escape dismissal, keyboard reachability, and focus return to the trigger after closing.',
        'Modal popovers should manage focus and isolate surrounding content; do not hide essential instructions in a popover.',
      ],
      seeAlso: [
        {
          component: 'Tooltip',
          label: 'Tooltip for short non-interactive hints.',
        },
        {
          component: 'Dropdown',
          label: 'Dropdown for command menus with menu semantics.',
        },
        {
          component: 'Modal',
          label: 'Modal for blocking workflows.',
        },
      ],
    },
    'react-native': {
      title: 'React Native Popover',
      description:
        'Build anchored floating surfaces with Vellira Popover using compound components, positioning, alignment, arrows, custom anchors, controlled state, and native accessibility.',
      summary:
        'Native Popover displays interactive anchored floating surfaces for contextual actions, settings, and compact forms.',
      whenToUse: [
        'Use Popover for contextual settings, inspector panels, inline forms, filters, or formatting toolbars.',
        'Use Tooltip for concise helper text and Modal for blocking native tasks.',
        'Use controlled open state for application-owned visibility or defaultOpen for an initially open surface.',
        'Use compound anchors, triggers, content, and close controls, and disable outside dismissal only when an explicit action is needed.',
      ],
      accessibility: [
        'Give the trigger an understandable label and provide Popover.Title for the surface heading.',
        'Provide Popover.Description for relevant supporting context.',
        'Ensure interactive controls remain reachable and are announced clearly with VoiceOver and TalkBack.',
        'Prefer Modal when the native workflow should be blocking.',
      ],
      seeAlso: [
        {
          component: 'Tooltip',
          label: 'Tooltip for concise native helper text.',
        },
        {
          component: 'Dropdown',
          label: 'Dropdown for contextual native command menus.',
        },
        {
          component: 'Modal',
          label: 'Modal for required decisions.',
        },
      ],
    },
  },
});
