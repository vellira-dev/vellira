import { defineComponentPageMetadata } from '../../metadata';

const nativeTextImport =
  `import { Text as NativeText } from 'react-native';` as const;
const nativeThemeImport =
  `import { useTheme } from '@vellira-ui/react-native';` as const;

const nativeTextStyle = `style={{
      color: nativeTheme.components.accordion.content.fg,
      fontFamily: 'VelliraSans-Regular',
      fontSize: 16,
      lineHeight: 22,
    }}`;

export default defineComponentPageMetadata({
  profile: 'compound',
  discovery: {
    status: 'complete',
    summary:
      'Use Accordion for in-place progressive disclosure in settings, FAQs, and detail screens.',
    description:
      'Accessible compound Accordion for React and React Native with single or multiple expansion, controlled and default values, collapsible behavior, disabled items, and platform-specific trigger semantics.',
    whenToUse: [
      'Reveal secondary details without leaving the current page or screen.',
      'Use single mode for one open item or multiple mode to compare sections.',
      'Use collapsible when the currently open single item may close.',
      'Choose Tabs instead for peer views that replace content rather than reveal it.',
    ],
    patterns: [
      {
        id: 'single-expansion',
        title: 'One section at a time',
        description:
          'Use single mode and defaultValue for a focused disclosure with a default open item.',
      },
      {
        id: 'multiple-expansion',
        title: 'Compare open sections',
        description:
          'Use multiple mode for settings or details that users need visible together.',
      },
      {
        id: 'controlled-state',
        title: 'Controlled expansion',
        description:
          'Use value with onValueChange when application state owns which items are expanded.',
      },
      {
        id: 'collapsible-single',
        title: 'Dismiss the open section',
        description:
          'Enable collapsible on a single accordion when every section may be closed.',
      },
    ],
    platformNotes: {
      react: [
        'Accordion.Trigger uses a native button with aria-expanded and aria-controls; Tab, Enter, and Space follow browser button semantics.',
        'Force-mount Accordion.Content only when persistent web panel state is required.',
      ],
      'react-native': [
        'Accordion.Trigger exposes native button semantics and expanded state through accessibility props, not DOM aria-controls.',
        'Wrap textual Accordion.Content children in React Native Text and verify assistive announcements on target devices.',
      ],
    },
    missingEvidence: [],
  },
  demo: {
    label: 'Account settings',
    description: 'Expand a section to reveal its settings.',
    initialValues: { defaultValue: 'profile' },
    satisfiedRequiredProps: ['children'],
    previewWidth: 'field',
  },
  defaults: {
    shared: { type: 'single', collapsible: false, disabled: false },
  },
  react: {
    children: `<Accordion.Item value='profile'>
  <Accordion.Trigger>Profile settings</Accordion.Trigger>
  <Accordion.Content>Update your public profile and account details.</Accordion.Content>
</Accordion.Item>
<Accordion.Item value='notifications'>
  <Accordion.Trigger>Notifications</Accordion.Trigger>
  <Accordion.Content>Choose when you want to receive updates.</Accordion.Content>
</Accordion.Item>`,
  },
  native: {
    children: `<Accordion.Item value='profile'>
  <Accordion.Trigger>Profile settings</Accordion.Trigger>
  <Accordion.Content>
    <NativeText
      ${nativeTextStyle}
    >
      Update your public profile and account details.
    </NativeText>
  </Accordion.Content>
</Accordion.Item>
<Accordion.Item value='notifications'>
  <Accordion.Trigger>Notifications</Accordion.Trigger>
  <Accordion.Content>
    <NativeText
      ${nativeTextStyle}
    >
      Choose when you want to receive updates.
    </NativeText>
  </Accordion.Content>
</Accordion.Item>`,
    imports: [nativeTextImport, nativeThemeImport],
    setup: ['const { theme: nativeTheme } = useTheme();'],
  },
  examples: [
    {
      title: 'Basic',
      description:
        'A single accordion keeps one settings section visible at a time.',
      props: [],
    },
    {
      title: 'Multiple open items',
      description:
        'Use multiple mode when people need to compare information across sections.',
      props: ["type='multiple'", "defaultValue={['billing', 'limits']}"],
      reactChildren: `<Accordion.Item value='billing'>
  <Accordion.Trigger>Billing cadence</Accordion.Trigger>
  <Accordion.Content>Invoices are issued monthly with a separate annual tax summary.</Accordion.Content>
</Accordion.Item>
<Accordion.Item value='limits'>
  <Accordion.Trigger>Usage limits</Accordion.Trigger>
  <Accordion.Content>Workspace exports include the last 90 days by default.</Accordion.Content>
</Accordion.Item>
<Accordion.Item value='retention'>
  <Accordion.Trigger>Data retention</Accordion.Trigger>
  <Accordion.Content>Audit logs remain searchable for one year on business plans.</Accordion.Content>
</Accordion.Item>`,
      nativeChildren: `<Accordion.Item value='billing'>
  <Accordion.Trigger>Billing cadence</Accordion.Trigger>
  <Accordion.Content>
    <NativeText
      ${nativeTextStyle}
    >
      Invoices are issued monthly with a separate annual tax summary.
    </NativeText>
  </Accordion.Content>
</Accordion.Item>
<Accordion.Item value='limits'>
  <Accordion.Trigger>Usage limits</Accordion.Trigger>
  <Accordion.Content>
    <NativeText
      ${nativeTextStyle}
    >
      Workspace exports include the last 90 days by default.
    </NativeText>
  </Accordion.Content>
</Accordion.Item>
<Accordion.Item value='retention'>
  <Accordion.Trigger>Data retention</Accordion.Trigger>
  <Accordion.Content>
    <NativeText
      ${nativeTextStyle}
    >
      Audit logs remain searchable for one year on business plans.
    </NativeText>
  </Accordion.Content>
</Accordion.Item>`,
    },
    {
      title: 'Collapsible single item',
      description:
        'Allow the current section to close when the interface can return to an empty state.',
      props: ['collapsible', "defaultValue='profile'"],
    },
    {
      title: 'Controlled state',
      description:
        'Store the open section in application state when another part of the interface needs to control it.',
      props: ['value={value}', 'onValueChange={setValue}'],
      setup: ["const [value, setValue] = useState('security');"],
      imports: ["import { useState } from 'react';"],
      reactChildren: `<Accordion.Item value='profile'>
  <Accordion.Trigger>Profile</Accordion.Trigger>
  <Accordion.Content>Profile visibility and contact details can be updated here.</Accordion.Content>
</Accordion.Item>
<Accordion.Item value='security'>
  <Accordion.Trigger>Security</Accordion.Trigger>
  <Accordion.Content>Password, passkey, and recovery settings are managed in this section.</Accordion.Content>
</Accordion.Item>`,
      nativeChildren: `<Accordion.Item value='profile'>
  <Accordion.Trigger>Profile</Accordion.Trigger>
  <Accordion.Content>
    <NativeText
      ${nativeTextStyle}
    >
      Profile visibility and contact details can be updated here.
    </NativeText>
  </Accordion.Content>
</Accordion.Item>
<Accordion.Item value='security'>
  <Accordion.Trigger>Security</Accordion.Trigger>
  <Accordion.Content>
    <NativeText
      ${nativeTextStyle}
    >
      Password, passkey, and recovery settings are managed in this section.
    </NativeText>
  </Accordion.Content>
</Accordion.Item>`,
    },
    {
      title: 'Default expanded state',
      description:
        'Set an initial expanded item while keeping later changes uncontrolled.',
      props: ["defaultValue='notifications'"],
    },
    {
      title: 'Disabled state',
      description:
        'Disable the whole accordion or a single item while preserving visible context.',
      props: [],
      reactChildren: `<Accordion.Item value='billing'>
  <Accordion.Trigger>Billing</Accordion.Trigger>
  <Accordion.Content>View invoices and payment methods.</Accordion.Content>
</Accordion.Item>
<Accordion.Item value='audit' disabled>
  <Accordion.Trigger>Audit exports</Accordion.Trigger>
  <Accordion.Content>Audit exports are available after the first report is generated.</Accordion.Content>
</Accordion.Item>`,
      nativeChildren: `<Accordion.Item value='billing'>
  <Accordion.Trigger>Billing</Accordion.Trigger>
  <Accordion.Content>
    <NativeText
      ${nativeTextStyle}
    >
      View invoices and payment methods.
    </NativeText>
  </Accordion.Content>
</Accordion.Item>
<Accordion.Item value='audit' disabled>
  <Accordion.Trigger>Audit exports</Accordion.Trigger>
  <Accordion.Content>
    <NativeText
      ${nativeTextStyle}
    >
      Audit exports are available after the first report is generated.
    </NativeText>
  </Accordion.Content>
</Accordion.Item>`,
    },
    {
      title: 'Rich content',
      description:
        'Panels can contain structured content for support notes or account summaries.',
      props: ["defaultValue='handoff'"],
      reactChildren: `<Accordion.Item value='handoff'>
  <Accordion.Trigger>Support handoff</Accordion.Trigger>
  <Accordion.Content>
    <p>Include ownership, status, and next action so the next teammate can continue without opening another view.</p>
    <ul>
      <li>Owner: Customer operations</li>
      <li>Status: Waiting for workspace admin</li>
      <li>Next action: Confirm billing contact</li>
    </ul>
  </Accordion.Content>
</Accordion.Item>
<Accordion.Item value='history'>
  <Accordion.Trigger>Recent history</Accordion.Trigger>
  <Accordion.Content>Four workspace settings changed in the last seven days.</Accordion.Content>
</Accordion.Item>`,
      nativeChildren: `<Accordion.Item value='handoff'>
  <Accordion.Trigger>Support handoff</Accordion.Trigger>
  <Accordion.Content>
    <NativeText
      ${nativeTextStyle}
    >
      Include ownership, status, and next action so the next teammate can continue without opening another view.
    </NativeText>
    <NativeText
      ${nativeTextStyle}
    >
      Owner: Customer operations
    </NativeText>
    <NativeText
      ${nativeTextStyle}
    >
      Status: Waiting for workspace admin
    </NativeText>
    <NativeText
      ${nativeTextStyle}
    >
      Next action: Confirm billing contact
    </NativeText>
  </Accordion.Content>
</Accordion.Item>
<Accordion.Item value='history'>
  <Accordion.Trigger>Recent history</Accordion.Trigger>
  <Accordion.Content>
    <NativeText
      ${nativeTextStyle}
    >
      Four workspace settings changed in the last seven days.
    </NativeText>
  </Accordion.Content>
</Accordion.Item>`,
    },
  ],
  api: {
    sections: [
      { name: 'Accordion.Item', exportName: 'AccordionItemProps' },
      { name: 'Accordion.Trigger', exportName: 'AccordionTriggerProps' },
      { name: 'Accordion.Content', exportName: 'AccordionContentProps' },
    ],
    descriptions: {
      children:
        'Compound Accordion.Item, Accordion.Trigger, and Accordion.Content nodes.',
      type: 'Determines whether one item or multiple items can be expanded.',
      value: 'Controlled expanded value or values.',
      defaultValue: 'Initial expanded value or values for uncontrolled usage.',
      onValueChange:
        'Called with the next expanded value or values after interaction.',
      collapsible:
        'Allows an expanded single item to collapse back to no selection.',
      disabled: 'Disables interaction for the root, item, or trigger.',
      forceMount: 'Keeps content mounted even when the item is collapsed.',
    },
  },
  accessibility: {
    react: [
      {
        title: 'Keyboard operation',
        description:
          'Triggers are native buttons. Tab to a trigger and use Enter or Space to expand or collapse its section.',
        props: ['disabled'],
      },
      {
        title: 'Expanded state',
        description:
          'Each trigger exposes its expanded state and references the content panel it controls.',
      },
    ],
    native: [
      {
        title: 'Screen reader support',
        description:
          'Triggers expose button semantics, disabled and expanded state, plus a hint describing the resulting action.',
        props: ['disabled'],
      },
    ],
  },
  related: ['tabs', 'dropdown', 'popover'],
});
