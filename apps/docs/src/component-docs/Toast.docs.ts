import { defineComponentDocs } from './defineComponentDocs';

export const toastDocs = defineComponentDocs({
  component: 'Toast',
  platforms: {
    react: {
      title: 'Toast - React feedback',
      description:
        'Show transient, non-blocking feedback in React with deterministic timing, bounded stacking, semantic tones, actions, and accessible announcements.',
      summary:
        'Toast reports the outcome of an event without interrupting the current task or moving focus.',
      whenToUse: [
        'Confirm a completed background action such as saving or copying.',
        'Report a short-lived warning or error that is not tied to one form field.',
        'Use FormField or inline content when feedback must remain beside the affected control.',
        'Use persistent application content instead of Toast for history, unread state, or notification-center behavior.',
      ],
      accessibility: [
        'Neutral, info, success, and warning messages use a polite live region; error and danger messages are assertive.',
        'Ordinary toasts do not move focus. Action and dismiss controls remain keyboard accessible.',
        'Keep messages concise and do not rely on color alone to communicate tone.',
        'Motion is removed when the user requests reduced motion.',
      ],
      notes: [
        'Mount one Toast.Provider and Toast.Viewport near the application root. The viewport portals to the canonical overlay layer by default.',
        'The default store keeps at most three visible messages, removes the oldest on overflow, and replaces matching dedupeKey entries in place.',
        'Pointer hover and focused controls pause the remaining timeout. A toast action closes by default unless closeOnAction is false.',
      ],
      storybook: {
        story: 'Default',
        title: 'Components/Toast',
      },
    },
    'react-native': {
      title: 'Toast - React Native feedback',
      description:
        'Show transient, non-blocking feedback in React Native with deterministic timing, bounded stacking, semantic tones, actions, and native announcements.',
      summary:
        'Toast reports an event outcome without replacing the current screen or becoming a notification inbox.',
      whenToUse: [
        'Confirm a completed background action such as saving or copying.',
        'Report brief application-level warnings or errors.',
        'Use inline feedback when the message belongs to a specific field or must remain visible.',
        'Use persistent screen content for history, unread state, or notification-center behavior.',
      ],
      accessibility: [
        'Messages are announced with AccessibilityInfo and expose a native live-region equivalent.',
        'Action and dismiss controls provide accessibility labels and at least 44-point touch targets.',
        'The accessibility escape action dismisses the current toast.',
        'Entrance motion becomes immediate when reduced motion is enabled.',
      ],
      notes: [
        'Mount Toast.Provider and Toast.Viewport near the application root. The native viewport participates in the native overlay manager without DOM portal semantics.',
        'The default store keeps at most three visible messages, removes the oldest on overflow, and replaces matching dedupeKey entries in place.',
        'Gesture dismissal is not required; explicit touch and screen-reader dismissal remain available.',
      ],
      storybook: {
        story: 'Default',
        title: 'Components/Toast',
      },
    },
  },
});
