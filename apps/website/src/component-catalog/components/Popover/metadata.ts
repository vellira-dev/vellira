import { defineComponentPageMetadata } from '../../metadata';

export default defineComponentPageMetadata({
  discovery: {
    status: 'complete',
    summary:
      'Use Popover for contextual content anchored near a control, including interactive details.',
    description:
      'React and React Native Popover with compound trigger, positioned content, optional title, description, arrow, anchor and explicit close action.',
    whenToUse: [
      'Use Popover for contextual details or small interactions that need more than a Tooltip.',
      'Compose Trigger and Content, adding Title, Description, Arrow or Close where useful.',
      'Provide an explicit close control when interactive content requires it.',
      'Use Modal for a focused task that should take precedence over the surrounding page.',
    ],
    patterns: [
      {
        id: 'compound',
        title: 'Contextual panel',
        description:
          'Compose Popover.Trigger with Popover.Content and descriptive text.',
      },
      {
        id: 'placement',
        title: 'Anchor and placement',
        description:
          'Use side, align and sideOffset to position content; Anchor can provide a separate reference element.',
      },
      {
        id: 'dismissal',
        title: 'Explicit dismissal',
        description:
          'Add Popover.Close for interactive or multistep content and handle open state if needed.',
      },
    ],
    platformNotes: {
      react: [
        'React Popover supports nonmodal or modal behavior, portal positioning and collision avoidance, with focus and dismissal behavior tied to its trigger.',
        'Use the title and description for understandable content; ensure keyboard users can dismiss or leave the popover.',
      ],
      'react-native': [
        'React Native Popover exposes trigger, content, arrow, title, description, anchor and close slots with placement guidance.',
        'Native focus and dismissal differ from web behavior; preserve accessible naming and a clear close action for task content.',
      ],
    },
    missingEvidence: [],
  },
  react: {
    children: `<Popover.Trigger asChild>
  <ReactButton>Open popover</ReactButton>
</Popover.Trigger>
<Popover.Content>
  <Popover.Arrow />
  <Popover.Title>Details</Popover.Title>
  <Popover.Description>Contextual information for this control.</Popover.Description>
</Popover.Content>`,
    imports: [`import { Button as ReactButton } from '@vellira-ui/react';`],
  },
  native: {
    children: `<Popover.Trigger asChild>
  <NativeButton>Open popover</NativeButton>
</Popover.Trigger>
<Popover.Content>
  <Popover.Arrow />
  <Popover.Title>Details</Popover.Title>
  <Popover.Description>Contextual information for this control.</Popover.Description>
</Popover.Content>`,
    imports: [
      `import { Button as NativeButton } from '@vellira-ui/react-native';`,
    ],
  },
  defaults: {
    shared: {
      side: 'bottom',
      align: 'center',
      sideOffset: 8,
    },
    react: {
      avoidCollisions: true,
      modal: false,
      portal: true,
      strategy: 'absolute',
    },
  },
  demo: {
    initialValues: {
      open: false,
      modal: false,
    },
    previewWidth: 'field',
  },
  examples: [
    {
      title: 'Basic',
      description: 'Floating contextual content.',
      props: [],
      reactImports: [
        `import { Button as ReactButton } from '@vellira-ui/react';`,
      ],
      nativeImports: [
        `import { Button as NativeButton } from '@vellira-ui/react-native';`,
      ],
    },
    {
      title: 'Placement',
      description: 'Positions content relative to the trigger.',
      props: [`side='top'`, `align='start'`, 'sideOffset={12}'],
      reactImports: [
        `import { Button as ReactButton } from '@vellira-ui/react';`,
      ],
      nativeImports: [
        `import { Button as NativeButton } from '@vellira-ui/react-native';`,
      ],
    },
    {
      title: 'Open change handler',
      description: 'Observes popover visibility from application state.',
      props: ['onOpenChange={() => {}}'],
      reactImports: [
        `import { Button as ReactButton } from '@vellira-ui/react';`,
      ],
      nativeImports: [
        `import { Button as NativeButton } from '@vellira-ui/react-native';`,
      ],
    },
    {
      title: 'Modal',
      description: 'Modal interaction semantics.',
      props: ['modal'],
      platforms: ['react'],
      reactImports: [
        `import { Button as ReactButton } from '@vellira-ui/react';`,
      ],
    },
    {
      title: 'Arrow and close action',
      description:
        'Adds an arrow and an explicit close control inside the popover.',
      props: [],
      reactImports: [
        `import { Button as ReactButton } from '@vellira-ui/react';`,
      ],
      reactChildren: `<Popover.Trigger asChild>
  <ReactButton>Open popover</ReactButton>
</Popover.Trigger>
<Popover.Content>
  <Popover.Arrow />
  <Popover.Title>Details</Popover.Title>
  <Popover.Description>Contextual information for this control.</Popover.Description>
  <Popover.Close asChild>
    <ReactButton appearance='outline'>Close</ReactButton>
  </Popover.Close>
</Popover.Content>`,
      nativeChildren: `<Popover.Trigger asChild>
  <NativeButton>Open popover</NativeButton>
</Popover.Trigger>
<Popover.Content>
  <Popover.Arrow />
  <Popover.Title>Details</Popover.Title>
  <Popover.Description>Contextual information for this control.</Popover.Description>
  <Popover.Close asChild>
    <NativeButton>Close</NativeButton>
  </Popover.Close>
</Popover.Content>`,
      nativeImports: [
        `import { Button as NativeButton } from '@vellira-ui/react-native';`,
      ],
    },
    {
      title: 'Separate anchor',
      description:
        'Positions content from an anchor while using a separate trigger.',
      props: [],
      reactImports: [
        `import { Button as ReactButton } from '@vellira-ui/react';`,
      ],
      reactChildren: `<div
  style={{
    display: 'flex',
    alignItems: 'center',
    gap: 16,
  }}
>
  <Popover.Anchor asChild>
    <div
      style={{
        padding: 16,
        border: '1px dashed var(--border-muted)',
        borderRadius: 'var(--radius-lg)',
      }}
    >
      Position relative to me
    </div>
  </Popover.Anchor>

  <Popover.Trigger asChild>
    <ReactButton>Toggle popover</ReactButton>
  </Popover.Trigger>
</div>

<Popover.Content>
  <Popover.Arrow />
  <Popover.Title>Separate anchor</Popover.Title>
  <Popover.Description>
    The trigger controls the state, but the content is positioned relative to the anchor.
  </Popover.Description>

  <Popover.Close asChild>
    <ReactButton size='sm' appearance='ghost'>
      Close
    </ReactButton>
  </Popover.Close>
</Popover.Content>`,
      nativeChildren: `<NativeView
  style={{
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  }}
>
  <Popover.Anchor asChild>
    <NativeView
      style={{
        padding: 16,
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: '#d8d2f0',
        borderRadius: 16,
      }}
    >
      <NativeText>Position relative to me</NativeText>
    </NativeView>
  </Popover.Anchor>

  <Popover.Trigger asChild>
    <NativeButton>Toggle popover</NativeButton>
  </Popover.Trigger>
</NativeView>

<Popover.Content>
  <Popover.Arrow />
  <Popover.Title>Separate anchor</Popover.Title>
  <Popover.Description>
    The trigger controls the state, but the content is positioned relative to the anchor.
  </Popover.Description>

  <Popover.Close asChild>
    <NativeButton size='sm' appearance='ghost'>
      Close
    </NativeButton>
  </Popover.Close>
</Popover.Content>`,
      nativeImports: [
        `import { Button as NativeButton } from '@vellira-ui/react-native';`,
        `import { Text as NativeText, View as NativeView } from 'react-native';`,
      ],
    },
  ],
  api: {
    sections: [
      { name: 'Popover.Trigger', exportName: 'PopoverTriggerProps' },
      { name: 'Popover.Content', exportName: 'PopoverContentProps' },
      { name: 'Popover.Title', exportName: 'PopoverTitleProps' },
      { name: 'Popover.Description', exportName: 'PopoverDescriptionProps' },
      { name: 'Popover.Close', exportName: 'PopoverCloseProps' },
      { name: 'Popover.Arrow', exportName: 'PopoverArrowProps' },
      { name: 'Popover.Anchor', exportName: 'PopoverAnchorProps' },
    ],
  },
  accessibility: {
    react: [
      {
        title: 'Trigger relationship',
        description:
          'Use trigger content and popover title or description to clarify the relationship.',
        props: ['children', 'open', 'onOpenChange'],
      },
      {
        title: 'Dismissal and focus',
        description:
          'Keep focus and dismissal predictable when content contains interactive controls.',
        props: ['modal', 'side', 'align', 'onOpenChange'],
      },
      {
        title: 'Explicit close controls',
        description:
          'Provide a close action when popover content contains interactive or multi-step content.',
        props: ['children'],
      },
    ],
    native: [
      {
        title: 'Context announcement',
        description:
          'Use title and description content so screen readers can identify popover purpose.',
        props: ['children'],
      },
      {
        title: 'Placement',
        description:
          'Choose placement that keeps content near its trigger without obscuring controls.',
        props: ['side', 'align'],
      },
      {
        title: 'Explicit close controls',
        description:
          'Use a clearly labelled close action when the popover stays open for task content.',
        props: ['children'],
      },
    ],
  },
  related: ['button', 'tooltip', 'modal'],
});
