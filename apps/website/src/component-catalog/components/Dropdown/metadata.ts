import { defineComponentPageMetadata } from '../../metadata';

const reactTriggerImports = [
  `import { ChevronDown } from '@vellira-ui/icons';`,
  `import { Button as ReactButton } from '@vellira-ui/react';`,
] as const;

const nativeTriggerImports = [
  `import { ChevronDown } from '@vellira-ui/icons';`,
  `import { Button as NativeButton } from '@vellira-ui/react-native';`,
] as const;

export default defineComponentPageMetadata({
  discovery: {
    status: 'complete',
    summary:
      'Use Dropdown for a compact menu of related actions or optional selections.',
    description:
      'React and React Native Dropdown menus with compound triggers and content, grouped actions, optional search, loading and disabled states, and platform-specific selection patterns.',
    whenToUse: [
      'Use Dropdown to reveal a compact set of actions from a clearly named trigger.',
      'Use Dropdown.Item for actions; organize longer menus with Group, Label, and Separator.',
      'Use searchable menus only when filtering improves finding items.',
      'Prefer Select for a primary form value and Popover for richer interactive content.',
    ],
    patterns: [
      {
        id: 'actions',
        title: 'Action menu',
        description:
          'Compose Dropdown.Trigger, Content and Item; provide clear action labels.',
      },
      {
        id: 'grouping',
        title: 'Grouped actions',
        description:
          'Use Group, Label and Separator to distinguish related actions.',
      },
      {
        id: 'search',
        title: 'Search and loading',
        description:
          'Use searchable or loading states when filtering or asynchronous data needs them.',
      },
      {
        id: 'selection',
        title: 'Selection semantics',
        description:
          'Use web CheckboxItem, RadioGroup and RadioItem for selection; these are not advertised as React Native equivalents.',
      },
    ],
    platformNotes: {
      react: [
        'Web Dropdown supports arrow-key navigation, Escape dismissal and focus return; optional nested submenus and checkbox/radio items are web-only patterns.',
        'Web positioning can use a portal and collision avoidance; modal and loop settings affect menu interaction.',
      ],
      'react-native': [
        'React Native Dropdown supports responsive popover, modal or sheet presentation and uses Pressable-based item interaction with accessible labels.',
        'Native examples use distinct item values; do not assume web-only nested submenu or checkbox/radio item slots are available.',
      ],
    },
    missingEvidence: [],
  },
  react: {
    children: `<Dropdown.Trigger asChild>
  <ReactButton appearance='outline' color='neutral' iconEnd={<ChevronDown />}>Actions</ReactButton>
</Dropdown.Trigger>
<Dropdown.Content>
  <Dropdown.Item>Profile</Dropdown.Item>
  <Dropdown.Item>Settings</Dropdown.Item>
  <Dropdown.Separator />
  <Dropdown.Item color='danger'>Sign out</Dropdown.Item>
</Dropdown.Content>`,
    childPropBindings: [
      {
        target: 'ReactButton',
        props: ['size={value.size}'],
      },
    ],
    imports: reactTriggerImports,
  },
  native: {
    responsivePresentation: true,
    children: `<Dropdown.Trigger asChild>
  <NativeButton appearance='outline' color='neutral' iconEnd={<ChevronDown />}>Actions</NativeButton>
</Dropdown.Trigger>
<Dropdown.Content>
  <Dropdown.Item value='profile'>Profile</Dropdown.Item>
  <Dropdown.Item value='settings'>Settings</Dropdown.Item>
  <Dropdown.Separator />
  <Dropdown.Item value='sign-out' color='danger'>Sign out</Dropdown.Item>
</Dropdown.Content>`,
    childPropBindings: [
      {
        target: 'NativeButton',
        props: ['size={value.size}'],
      },
    ],
    imports: nativeTriggerImports,
  },
  demo: {
    initialValues: {
      size: 'md',
      color: 'primary',
      disabled: false,
      loading: false,
      searchable: false,
      command: false,
    },
  },
  defaults: {
    shared: {
      size: 'md',
      color: 'primary',
      disabled: false,
      loading: false,
      closeOnSelect: true,
      searchable: false,
      command: false,
    },
    react: {
      portal: true,
      avoidCollisions: true,
      modal: false,
      loop: true,
      offset: 8,
    },
    native: {
      presentation: 'auto',
      placement: 'bottom-start',
      offset: 8,
      showArrow: true,
    },
  },
  examples: [
    {
      title: 'Basic',
      description: 'Action menu with common items.',
      props: [],
      reactImports: reactTriggerImports,
      nativeImports: nativeTriggerImports,
    },
    {
      title: 'Groups and separators',
      description: 'Organizes related actions with labels and dividers.',
      props: [],
      reactImports: reactTriggerImports,
      nativeImports: nativeTriggerImports,
      reactChildren: `<Dropdown.Trigger asChild>
  <ReactButton appearance='outline' color='neutral' iconEnd={<ChevronDown />}>Actions</ReactButton>
</Dropdown.Trigger>
<Dropdown.Content>
  <Dropdown.Group>
    <Dropdown.Label>Account</Dropdown.Label>
    <Dropdown.Item>Profile</Dropdown.Item>
    <Dropdown.Item>Settings</Dropdown.Item>
  </Dropdown.Group>
  <Dropdown.Separator />
  <Dropdown.Item color='danger'>Sign out</Dropdown.Item>
</Dropdown.Content>`,
      nativeChildren: `<Dropdown.Trigger asChild>
  <NativeButton appearance='outline' color='neutral' iconEnd={<ChevronDown />}>Actions</NativeButton>
</Dropdown.Trigger>
<Dropdown.Content>
  <Dropdown.Group>Account</Dropdown.Group>
  <Dropdown.Item value='profile'>Profile</Dropdown.Item>
  <Dropdown.Item value='settings'>Settings</Dropdown.Item>
  <Dropdown.Separator />
  <Dropdown.Item value='sign-out' color='danger'>Sign out</Dropdown.Item>
</Dropdown.Content>`,
    },
    {
      title: 'Item adornments',
      description: 'Adds icons, badges, and shortcuts to clarify actions.',
      props: [],
      imports: [`import { Download, Settings } from '@vellira-ui/icons';`],
      reactImports: reactTriggerImports,
      nativeImports: nativeTriggerImports,
      reactChildren: `<Dropdown.Trigger asChild>
  <ReactButton appearance='outline' color='neutral' iconEnd={<ChevronDown />}>Actions</ReactButton>
</Dropdown.Trigger>
<Dropdown.Content>
  <Dropdown.Item icon={<Settings />} shortcut='Cmd+,'>Settings</Dropdown.Item>
  <Dropdown.Item icon={<Download />} badge='New' shortcut='Cmd+D'>Download</Dropdown.Item>
  <Dropdown.Item disabled>Unavailable</Dropdown.Item>
</Dropdown.Content>`,
      nativeChildren: `<Dropdown.Trigger asChild>
  <NativeButton appearance='outline' color='neutral' iconEnd={<ChevronDown />}>Actions</NativeButton>
</Dropdown.Trigger>
<Dropdown.Content>
  <Dropdown.Item value='settings' icon={<Settings />}>Settings</Dropdown.Item>
  <Dropdown.Item value='download' icon={<Download />}>Download</Dropdown.Item>
  <Dropdown.Item value='unavailable' disabled>Unavailable</Dropdown.Item>
</Dropdown.Content>`,
    },
    {
      title: 'Searchable',
      description: 'Filter menu items.',
      props: ['searchable'],
      reactImports: reactTriggerImports,
      nativeImports: nativeTriggerImports,
    },
    {
      title: 'Selectable items',
      description:
        'Uses checkbox and radio menu items for temporary preferences.',
      props: [],
      reactImports: reactTriggerImports,
      reactChildren: `<Dropdown.Trigger asChild>
  <ReactButton appearance='outline' color='neutral' iconEnd={<ChevronDown />}>View options</ReactButton>
</Dropdown.Trigger>
<Dropdown.Content>
  <Dropdown.CheckboxItem checked>Show archived</Dropdown.CheckboxItem>
  <Dropdown.Separator />
  <Dropdown.RadioGroup defaultValue='comfortable'>
    <Dropdown.RadioItem value='comfortable'>Comfortable</Dropdown.RadioItem>
    <Dropdown.RadioItem value='compact'>Compact</Dropdown.RadioItem>
  </Dropdown.RadioGroup>
</Dropdown.Content>`,
      platforms: ['react'],
    },
    {
      title: 'Nested React dropdown submenu',
      description:
        'Groups secondary actions under a nested React dropdown submenu.',
      props: [],
      reactImports: reactTriggerImports,
      reactChildren: `<Dropdown.Trigger asChild>
  <ReactButton appearance='outline' color='neutral' iconEnd={<ChevronDown />}>Export</ReactButton>
</Dropdown.Trigger>
<Dropdown.Content>
  <Dropdown.Item>Copy link</Dropdown.Item>
  <Dropdown.Sub>
    <Dropdown.SubTrigger>Download</Dropdown.SubTrigger>
    <Dropdown.SubContent>
      <Dropdown.Item>PDF</Dropdown.Item>
      <Dropdown.Item>CSV</Dropdown.Item>
    </Dropdown.SubContent>
  </Dropdown.Sub>
</Dropdown.Content>`,
      platforms: ['react'],
    },
    {
      title: 'Loading',
      description: 'Loading menu state.',
      props: ['loading'],
      reactImports: reactTriggerImports,
      nativeImports: nativeTriggerImports,
    },
    {
      title: 'Disabled',
      description: 'Disabled trigger state.',
      props: ['disabled'],
      reactImports: reactTriggerImports,
      nativeImports: nativeTriggerImports,
    },
  ],
  api: {
    sections: [
      { name: 'Dropdown.Trigger', exportName: 'DropdownTriggerProps' },
      { name: 'Dropdown.Content', exportName: 'DropdownContentProps' },
      { name: 'Dropdown.Search', exportName: 'DropdownSearchProps' },
      { name: 'Dropdown.Item', exportName: 'DropdownItemProps' },
      {
        name: 'Dropdown.CheckboxItem',
        exportName: { react: 'DropdownCheckboxItemProps' },
      },
      {
        name: 'Dropdown.RadioGroup',
        exportName: { react: 'DropdownRadioGroupProps' },
      },
      {
        name: 'Dropdown.RadioItem',
        exportName: { react: 'DropdownRadioItemProps' },
      },
      { name: 'Dropdown.Group', exportName: 'DropdownGroupProps' },
      { name: 'Dropdown.Label', exportName: 'DropdownLabelProps' },
      { name: 'Dropdown.Separator', exportName: 'DropdownSeparatorProps' },
      {
        name: 'Dropdown.Sub',
        exportName: { react: 'DropdownSubProps' },
      },
      {
        name: 'Dropdown.SubTrigger',
        exportName: { react: 'DropdownSubTriggerProps' },
      },
      {
        name: 'Dropdown.SubContent',
        exportName: { react: 'DropdownSubContentProps' },
      },
      {
        name: 'Dropdown.ItemIcon',
        exportName: { react: 'DropdownItemIconProps' },
      },
      {
        name: 'Dropdown.ItemDescription',
        exportName: { react: 'DropdownItemDescriptionProps' },
      },
      {
        name: 'Dropdown.ItemBadge',
        exportName: { react: 'DropdownItemBadgeProps' },
      },
      {
        name: 'Dropdown.ItemShortcut',
        exportName: { react: 'DropdownItemShortcutProps' },
      },
      { name: 'Dropdown.Empty', exportName: 'DropdownEmptyProps' },
      { name: 'Dropdown.Loading', exportName: 'DropdownLoadingProps' },
    ],
  },
  accessibility: {
    react: [
      {
        title: 'Trigger naming',
        description:
          'Use trigger content that clearly communicates the menu purpose.',
        props: ['children', 'aria-label'],
      },
      {
        title: 'Keyboard menu behavior',
        description:
          'Preserve arrow-key navigation, Escape dismissal, and focus return to the trigger.',
        props: ['loop', 'modal', 'open'],
      },
      {
        title: 'Nested menu navigation',
        description:
          'Use the web submenu slots for related secondary actions. ArrowRight opens the active submenu, ArrowLeft closes it, and the submenu trigger exposes menu and expanded state semantics.',
        props: ['Dropdown.Sub', 'Dropdown.SubTrigger', 'Dropdown.SubContent'],
      },
      {
        title: 'Item states',
        description:
          'Use disabled and color state to communicate unavailable or destructive actions.',
        props: ['disabled', 'color'],
      },
      {
        title: 'Selection patterns',
        description:
          'Use checkbox and radio items only when menu selections remain understandable from their labels.',
        props: ['checked', 'value', 'onValueChange'],
      },
    ],
    native: [
      {
        title: 'Trigger naming',
        description:
          'Provide visible trigger text or accessibilityLabel for the menu trigger.',
        props: ['label', 'accessibilityLabel'],
      },
      {
        title: 'Presentation semantics',
        description:
          'Choose sheet, modal, or popover presentation based on screen size and interaction context.',
        props: ['presentation', 'placement'],
      },
      {
        title: 'Selection state',
        description:
          'Keep selected, disabled, and loading state reflected in item labels and accessibility state.',
        props: ['disabled', 'loading', 'onSelect'],
      },
    ],
  },
  related: ['button', 'select', 'popover'],
});
