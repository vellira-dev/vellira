import { defineComponentPageMetadata } from '../../metadata';

const reactTriggerImports = [
  `import { Button as ReactButton, Portal as ReactPortal } from '@vellira-ui/react';`,
] as const;

const nativeTriggerImports = [
  `import { Button as NativeButton } from '@vellira-ui/react-native';`,
] as const;

const reactModalChildren = `<Modal.Trigger asChild>
  <ReactButton>Open modal</ReactButton>
</Modal.Trigger>
<ReactPortal>
  <Modal.Overlay />
  <Modal.Content>
    <Modal.Header>
      <div>
        <Modal.Title>Delete file</Modal.Title>
        <Modal.Description>This action cannot be undone.</Modal.Description>
      </div>
      <Modal.Close />
    </Modal.Header>
    <Modal.Body>Are you sure you want to continue?</Modal.Body>
    <Modal.Footer>
      <Modal.Close asChild>
        <ReactButton color='neutral' appearance='ghost'>Cancel</ReactButton>
      </Modal.Close>
      <ReactButton color='danger'>Delete</ReactButton>
    </Modal.Footer>
  </Modal.Content>
</ReactPortal>`;

const nativeModalChildren = `<Modal.Trigger asChild>
  <NativeButton>Open modal</NativeButton>
</Modal.Trigger>
<Modal.Overlay>
  <Modal.Content>
    <Modal.Header>
      <Modal.Title>Delete file</Modal.Title>
      <Modal.Description>This action uses the native overlay stack and focus restore.</Modal.Description>
    </Modal.Header>
    <Modal.Body>Are you sure you want to continue?</Modal.Body>
    <Modal.Footer>
      <Modal.Close>
        <NativeButton color='neutral' appearance='solid'>Cancel</NativeButton>
      </Modal.Close>
      <Modal.Close>
        <NativeButton color='danger' appearance='solid'>Delete</NativeButton>
      </Modal.Close>
    </Modal.Footer>
  </Modal.Content>
</Modal.Overlay>`;

export default defineComponentPageMetadata({
  discovery: {
    status: 'complete',
    summary:
      'Use Modal for a focused confirmation, short form or decision that interrupts the current task.',
    description:
      'React and React Native Modal for focused dialogs, confirmations and forms with compound structure, controlled state, accessible dismissal and focus restoration.',
    whenToUse: [
      'Use Modal for a focused decision or short form that takes priority over the current page.',
      'Prefer Popover for contextual details that should not interrupt the surrounding task.',
      'Use a clear Title, Description, Body and action Footer; provide a safe close path for confirmation flows.',
      'Disable outside dismissal when a critical decision requires an explicit response.',
    ],
    patterns: [
      {
        id: 'compound-dialog',
        title: 'Compound dialog anatomy',
        description:
          'Compose Modal.Trigger, Overlay, Content, Header, Title, Description, Body, Footer and Close as appropriate.',
      },
      {
        id: 'controlled-dialog',
        title: 'Controlled or initial open state',
        description:
          'Use open and onOpenChange for application-owned visibility, or defaultOpen for initially open state.',
      },
      {
        id: 'dismissal',
        title: 'Safe dismissal',
        description:
          'Set closeOnOutsidePress to false when required, and keep an explicit cancel or close action available.',
      },
      {
        id: 'critical-confirmation',
        title: 'Critical confirmation',
        description:
          'Use explicit irreversible-action text and distinct safe and destructive actions; web alertdialog semantics require a description.',
      },
    ],
    platformNotes: {
      react: [
        'React Modal supports focus trapping, initial and final focus, focus restoration, scroll prevention and configurable Escape or outside-press dismissal.',
        'Web content supports dialog or alertdialog ARIA roles; supply Modal.Title or an accessible content label and add Modal.Description for alertdialog.',
        'React Modal supports a Portal, animation variants and long scrollable content without requiring a new route.',
      ],
      'react-native': [
        'React Native Modal uses an overlay stack with animation and focus-restoration support; provide a clear trigger, title, meaningful actions and close path.',
        'Native dismissal is configurable for outside presses; closeOnEscape exists for API parity but browser-only focus-trap and alertdialog props are not native API guarantees.',
        'Check reading order, overlay dismissal and VoiceOver or TalkBack announcements on real devices for consequential flows.',
      ],
    },
    missingEvidence: [],
  },
  react: {
    children: reactModalChildren,
    imports: reactTriggerImports,
  },
  native: {
    children: nativeModalChildren,
    imports: nativeTriggerImports,
  },
  defaults: {
    shared: {
      closeOnOutsidePress: true,
      closeOnEscape: true,
      animation: 'scale',
      restoreFocus: true,
    },
    react: {
      modal: true,
      preventScroll: true,
      trapFocus: true,
      role: 'dialog',
    },
  },
  examples: [
    {
      title: 'Basic',
      description: 'Dialog with trigger and content.',
      props: [],
      reactImports: reactTriggerImports,
      nativeImports: nativeTriggerImports,
      reactChildren: reactModalChildren,
      nativeChildren: nativeModalChildren,
    },
    {
      title: 'No outside dismissal',
      description: 'Requires an explicit close action.',
      props: ['closeOnOutsidePress={false}'],
      reactImports: reactTriggerImports,
      nativeImports: nativeTriggerImports,
      reactChildren: reactModalChildren,
      nativeChildren: nativeModalChildren,
    },
    {
      title: 'Fade animation',
      description: 'Uses an alternate transition for modal entry and exit.',
      props: [`animation='fade'`],
      reactImports: reactTriggerImports,
      nativeImports: nativeTriggerImports,
    },
    {
      title: 'Large scrollable content',
      description:
        'Uses a larger panel with inside scrolling for long content.',
      props: [],
      reactImports: reactTriggerImports,
      reactChildren: `<Modal.Trigger asChild>
  <ReactButton>Review details</ReactButton>
</Modal.Trigger>
<Modal.Overlay />
<Modal.Content size='lg' scrollBehavior='inside'>
  <Modal.Header>
    <Modal.Title>Release notes</Modal.Title>
    <Modal.Description>Review changes before publishing.</Modal.Description>
  </Modal.Header>
  <Modal.Body>Long-form modal content can scroll inside the panel.</Modal.Body>
  <Modal.Footer>
    <Modal.Close aria-label='Close' />
  </Modal.Footer>
</Modal.Content>`,
      platforms: ['react'],
    },
    {
      title: 'Alert dialog',
      description: 'Uses alert dialog semantics for destructive confirmation.',
      props: [`role='alertdialog'`],
      reactImports: reactTriggerImports,
      reactChildren: `<Modal.Trigger asChild>
  <ReactButton color='danger'>Delete project</ReactButton>
</Modal.Trigger>
<Modal.Overlay />
<Modal.Content>
  <Modal.Header>
    <Modal.Title>Delete project?</Modal.Title>
    <Modal.Description>This action cannot be undone.</Modal.Description>
  </Modal.Header>
  <Modal.Body>All project data will be permanently removed.</Modal.Body>
  <Modal.Footer>
    <Modal.Close aria-label='Cancel' />
  </Modal.Footer>
</Modal.Content>`,
      platforms: ['react'],
    },
  ],
  api: {
    sections: [
      { name: 'Modal.Trigger', exportName: 'ModalTriggerProps' },
      { name: 'Modal.Overlay', exportName: 'ModalOverlayProps' },
      { name: 'Modal.Content', exportName: 'ModalContentProps' },
      { name: 'Modal.Header', exportName: 'ModalHeaderProps' },
      { name: 'Modal.Body', exportName: 'ModalBodyProps' },
      { name: 'Modal.Footer', exportName: 'ModalFooterProps' },
      { name: 'Modal.Close', exportName: 'ModalCloseProps' },
    ],
  },
  accessibility: {
    react: [
      {
        title: 'Focus management',
        description:
          'Trap focus while open and restore focus to the trigger when the modal closes.',
        props: ['trapFocus', 'restoreFocus', 'initialFocus', 'finalFocus'],
      },
      {
        title: 'Dialog labelling',
        description:
          'Use title and description content so assistive technology can announce the dialog purpose.',
        props: ['role', 'children'],
      },
      {
        title: 'Dismissal',
        description:
          'Choose outside press and Escape dismissal behavior based on task criticality.',
        props: ['closeOnOutsidePress', 'closeOnEscape'],
      },
      {
        title: 'Destructive confirmations',
        description:
          'Use alert dialog semantics only for urgent decisions that require immediate attention.',
        props: ['role'],
      },
      {
        title: 'Scrollable content',
        description:
          'Keep title, description, and final actions reachable when modal content is long.',
        props: ['scrollBehavior', 'size'],
      },
    ],
    native: [
      {
        title: 'Modal announcement',
        description:
          'Use title and description content so the modal purpose is announced clearly.',
        props: ['children'],
      },
      {
        title: 'Dismissal',
        description:
          'Provide an explicit close action when outside dismissal is disabled.',
        props: ['closeOnOutsidePress'],
      },
    ],
  },
  related: ['button', 'popover', 'tooltip'],
});
