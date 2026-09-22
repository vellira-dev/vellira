import { defineComponentPageMetadata } from '../../metadata';

export default defineComponentPageMetadata({
  profile: 'overlay',
  react: {
    demoProps:
      "title='Changes saved' description='Your preferences are up to date.' duration={0}",
  },
  native: {
    demoProps:
      "title='Changes saved' description='Your preferences are up to date.' duration={0}",
  },
  demo: {
    previewWidth: 'full',
    excludeControls: ['children', 'style', 'className', 'id', 'testID'],
  },
  catalogPreview: {
    layout: 'stack',
    props: [
      "title='Changes saved'",
      "tone='success'",
      'duration={0}',
      'dismissible={false}',
    ],
  },
  discovery: {
    status: 'complete',
    summary:
      'Use Toast for transient, non-blocking application feedback on React and React Native.',
    description:
      'Toast provides deterministic timing, manual dismissal, bounded stacking, semantic tones, optional actions, announcements, and reduced-motion behavior.',
    whenToUse: [
      'Confirm a completed background action without interrupting the current task.',
      'Report a brief application-level warning or error that is not tied to one field.',
      'Use FormField or inline feedback when the message must remain beside a control.',
      'Use persistent application content for history, unread state, or notification-center behavior.',
    ],
    patterns: [
      {
        id: 'semantic-tones',
        title: 'Semantic tones',
        description:
          'Choose neutral, info, success, warning, error, or danger based on message meaning.',
      },
      {
        id: 'application-host',
        title: 'Application host',
        description:
          'Compose one provider and viewport near the app root, then publish through useToast.',
      },
      {
        id: 'action',
        title: 'Optional action',
        description:
          'Offer one concise action when the result can be immediately reversed or inspected.',
      },
    ],
    platformNotes: {
      react: [
        'The viewport portals into the canonical overlay layer and pauses timing while pointer or focus interaction is active.',
      ],
      'react-native': [
        'The viewport stays native-oriented, uses the native overlay manager, and announces messages with AccessibilityInfo.',
      ],
    },
    missingEvidence: [],
  },
  examples: [
    {
      title: 'Success',
      description: 'A polite confirmation that dismisses automatically.',
      inheritDemoProps: false,
      props: [
        "title='Changes saved'",
        "description='Your preferences are up to date.'",
        "tone='success'",
      ],
    },
    {
      title: 'Error',
      description:
        'An assertive application-level error with manual dismissal.',
      inheritDemoProps: false,
      props: [
        "title='Upload failed'",
        "description='Check your connection and try again.'",
        "tone='error'",
        'duration={0}',
      ],
    },
    {
      title: 'Action',
      description: 'A concise reversible action.',
      inheritDemoProps: false,
      props: [
        "title='Message archived'",
        "action={{ label: 'Undo', onAction: () => undefined }}",
        'duration={0}',
      ],
    },
  ],
  api: {
    sections: [
      { name: 'Toast.Provider', exportName: 'ToastProviderProps' },
      { name: 'Toast.Viewport', exportName: 'ToastViewportProps' },
    ],
    descriptions: {
      open: 'Controlled visibility state.',
      defaultOpen: 'Initial visibility for uncontrolled usage.',
      onOpenChange:
        'Called with the next visibility and the deterministic close reason.',
      id: 'Stable identifier for the rendered toast.',
      title: 'Short message heading.',
      description: 'Optional supporting detail.',
      icon: 'Optional custom icon; semantic tones provide canonical defaults.',
      children: 'Optional custom message content.',
      announcement: 'Explicit text announced by native assistive technology.',
      tone: 'Semantic tone used for color and announcement priority.',
      duration: 'Auto-dismiss duration in milliseconds. Set to 0 to persist.',
      dismissible: 'Whether to render an explicit dismiss control.',
      dismissLabel: 'Accessible name for the dismiss control.',
      action: 'Optional labelled action with deterministic close behavior.',
      pauseOnHover:
        'Whether pointer hover pauses the remaining web auto-dismiss timeout.',
      pauseOnFocus:
        'Whether focus within the toast pauses the remaining web timeout.',
      closeOnEscape:
        'Whether Escape dismisses a web toast while one of its controls has focus.',
      ariaLive: 'Overrides the tone-derived web live-region priority.',
      className: 'Additional class name for the web toast or viewport.',
      style: 'Platform style override for the toast or viewport.',
      accessibilityLabel: 'Native accessible label.',
      testID: 'Stable native test identifier.',
      store: 'Externally owned store for integration or independent testing.',
      maxVisible:
        'Maximum number of visible messages before oldest-first overflow.',
      portal: 'Whether the web viewport renders through the canonical Portal.',
      container: 'Optional web portal destination.',
      position: 'Viewport edge and alignment.',
      label: 'Accessible name for the web notification region.',
    },
  },
  accessibility: {
    react: [
      {
        title: 'Announcements',
        description:
          'Ordinary tones use a polite status region; error and danger use an assertive alert.',
        props: ['tone', 'ariaLive'],
      },
      {
        title: 'Focus and controls',
        description:
          'Toasts do not steal focus; action and dismiss controls remain keyboard accessible.',
        props: ['action', 'dismissible', 'dismissLabel'],
      },
      {
        title: 'Reduced motion',
        description:
          'Entrance animation is removed under prefers-reduced-motion.',
      },
    ],
    native: [
      {
        title: 'Native announcement',
        description:
          'Messages use AccessibilityInfo announcements and native live-region semantics.',
        props: ['announcement', 'tone', 'accessibilityLabel'],
      },
      {
        title: 'Touch and dismissal',
        description:
          'Action and dismiss controls provide labelled 44-point touch targets and accessibility escape dismissal.',
        props: ['action', 'dismissible', 'dismissLabel'],
      },
      {
        title: 'Reduced motion',
        description:
          'Native entrance transitions become immediate when reduced motion is enabled.',
      },
    ],
  },
  related: ['form-field', 'modal', 'popover'],
});
