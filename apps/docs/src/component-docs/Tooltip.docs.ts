import { defineComponentDocs } from './defineComponentDocs';

/**
 * Platform-specific Tooltip intent. The full published React and Native
 * guides remain intact in protected authored regions after safe adoption.
 */
export const tooltipDocs = defineComponentDocs({
  component: 'Tooltip',
  platforms: {
    react: {
      title: 'Tooltip – React Tooltip Component',
      description:
        'Build accessible React tooltips with keyboard and pointer interactions, positioning, and customizable content.',
      summary:
        'Tooltip provides brief, non-critical helper text for pointer and keyboard users without replacing visible instructions.',
      whenToUse: [
        'Use Tooltip to clarify short icon labels, shortcuts, and terse controls without creating a blocking interaction.',
        'Keep required instructions and validation messages visible outside the tooltip.',
        'Compose Tooltip.Trigger and Tooltip.Content, using Portal where floating content may otherwise be clipped.',
        'Use deliberate open and close delays, placement, and forceMount only when the interaction calls for them.',
      ],
      accessibility: [
        'Give the trigger its own accessible name; tooltip content does not replace a trigger label.',
        'Ensure keyboard focus can reveal tooltip information, not just pointer hover.',
        'Keep the content concise, non-interactive, and non-essential to task completion.',
        'Preserve dismissal and screen-reader behavior, and use persistent helper text for required content.',
      ],
      seeAlso: [
        { component: 'Button', label: 'Button for accessible icon-only triggers.' },
        { component: 'FormField', label: 'FormField for persistent form guidance.' },
        { component: 'Popover', label: 'Popover for interactive contextual content.' },
      ],
    },
    'react-native': {
      title: 'React Native Tooltip',
      description:
        'Add native contextual helper text with Vellira Tooltip using compound triggers, placement, delay, controlled state, outside dismissal, and optional arrows.',
      summary:
        'Native Tooltip shows short contextual helper text near a target while leaving required instructions visible in the screen.',
      whenToUse: [
        'Use Tooltip for short, non-interactive explanations near a native control.',
        'Use controlled open state when the application owns visibility, otherwise use defaultOpen if an initially open tooltip is needed.',
        'Compose Tooltip.Trigger and Tooltip.Content with placement, delay, and arrow options as needed.',
        'Keep required instructional content visible and use Popover for interactive contextual surfaces.',
      ],
      accessibility: [
        'Give icon-only or otherwise ambiguous triggers a meaningful accessibilityLabel.',
        'Make required help available without depending solely on hover or tooltip visibility.',
        'Keep tooltip content short and non-interactive and provide an accessible dismissal route.',
        'Verify opening, reading, and dismissal with VoiceOver and TalkBack on physical devices.',
      ],
      seeAlso: [
        { component: 'Button', label: 'Button for native trigger controls.' },
        { component: 'FormField', label: 'FormField for required helper messages.' },
        { component: 'Popover', label: 'Popover for interactive native contextual content.' },
      ],
    },
  },
});
