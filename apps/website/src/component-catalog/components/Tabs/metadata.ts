import { defineComponentPageMetadata } from '../../metadata';

const nativeTextImport =
  `import { Text as NativeText } from 'react-native';` as const;
const nativeThemeImport =
  `import { useTheme } from '@vellira-ui/react-native';` as const;

export default defineComponentPageMetadata({
  discovery: {
    status: 'complete',
    summary:
      'Use Tabs to switch between related content panels without navigating away.',
    description:
      'React and React Native Tabs with compound triggers and panels, controlled or default selection, layout variants, disabled state, and platform-specific accessibility.',
    whenToUse: [
      'Use tabs to organize related panels within the same context.',
      'Give every Tabs.Trigger a matching Tabs.Content value.',
      'Use value and onValueChange when selection is application-controlled; use defaultValue for initial selection.',
      'Prefer navigation links when each destination is a separate page.',
    ],
    patterns: [
      {
        id: 'compound-panels',
        title: 'Triggers and panels',
        description:
          'Compose Tabs.List, Tabs.Trigger, Tabs.Indicator and matching Tabs.Content elements.',
      },
      {
        id: 'controlled-selection',
        title: 'Controlled selection',
        description:
          'Manage the selected value with value and onValueChange.',
      },
      {
        id: 'panel-mounting',
        title: 'Panel mounting',
        description:
          'Use keepMounted and lazyMount to manage inactive panel rendering when appropriate.',
      },
    ],
    platformNotes: {
      react: [
        'React tabs implement keyboard navigation with orientation, automatic or manual activation, direction and optional looping.',
        'React uses stable relationships between tab triggers and panels; disabled tabs are excluded from selection navigation.',
      ],
      'react-native': [
        'React Native tabs use Pressable-based trigger interaction and accessibility selection state; do not assume web-specific keyboard activationMode.',
        'React Native supports orientation and measures trigger layout for the indicator, while matching trigger and panel values remains required.',
      ],
    },
    missingEvidence: [],
  },
  react: {
    children: `<Tabs.List>
  <Tabs.Trigger value='account'>Account</Tabs.Trigger>
  <Tabs.Trigger value='billing'>Billing</Tabs.Trigger>
  <Tabs.Indicator />
</Tabs.List>
<Tabs.Content value='account'>Account settings</Tabs.Content>
<Tabs.Content value='billing'>Billing details</Tabs.Content>`,
  },
  native: {
    children: `<Tabs.List>
  <Tabs.Trigger value='account'>Account</Tabs.Trigger>
  <Tabs.Trigger value='billing'>Billing</Tabs.Trigger>
  <Tabs.Indicator />
</Tabs.List>
<Tabs.Content value='account'>
  <NativeText
    style={{
      color: nativeTheme.components.tabs.panel.fg,
      fontFamily: 'VelliraSans-Regular',
      fontSize: 16,
      lineHeight: 20,
    }}
  >
    Account settings
  </NativeText>
</Tabs.Content>
<Tabs.Content value='billing'>
  <NativeText
    style={{
      color: nativeTheme.components.tabs.panel.fg,
      fontFamily: 'VelliraSans-Regular',
      fontSize: 16,
      lineHeight: 20,
    }}
  >
    Billing details
  </NativeText>
</Tabs.Content>`,
    imports: [nativeTextImport, nativeThemeImport],
    setup: ['const { theme: nativeTheme } = useTheme();'],
  },
  demo: {
    initialValues: {
      orientation: 'horizontal',
      activationMode: 'automatic',
      variant: 'line',
      color: 'primary',
      size: 'md',
      disabled: false,
    },
  },
  defaults: {
    shared: {
      orientation: 'horizontal',
      keepMounted: false,
      lazyMount: false,
      variant: 'line',
      color: 'primary',
      size: 'md',
      disabled: false,
    },
    react: {
      activationMode: 'automatic',
      loop: true,
    },
  },
  examples: [
    { title: 'Basic', description: 'Two-panel tab navigation.', props: [] },
    {
      title: 'Pills',
      description: 'Alternative visual treatment.',
      props: [`variant='pills'`],
    },
    {
      title: 'Manual activation',
      description: 'Focus tabs without selecting until activation.',
      props: [`activationMode='manual'`],
      platforms: ['react'],
    },
    {
      title: 'Disabled',
      description: 'Disabled tab set.',
      props: ['disabled'],
    },
  ],
  api: {
    sections: [
      { name: 'Tabs.List', exportName: 'TabsListProps' },
      { name: 'Tabs.Trigger', exportName: 'TabsTriggerProps' },
      { name: 'Tabs.Indicator', exportName: 'TabsIndicatorProps' },
      { name: 'Tabs.Content', exportName: 'TabsContentProps' },
    ],
  },
  accessibility: {
    react: [
      {
        title: 'Keyboard navigation',
        description:
          'Support arrow-key movement between triggers and preserve focus order.',
        props: ['orientation', 'activationMode', 'loop'],
      },
      {
        title: 'Panel relationships',
        description:
          'Each trigger value should match exactly one content panel value.',
        props: ['value', 'defaultValue'],
      },
    ],
    native: [
      {
        title: 'Screen reader state',
        description:
          'Expose the selected tab and associated panel content through React Native accessibility state.',
        props: ['value', 'defaultValue'],
      },
      {
        title: 'Orientation',
        description:
          'Use an orientation that keeps tab navigation clear and predictable for the available space.',
        props: ['orientation'],
      },
    ],
  },
  related: ['radio-group', 'button'],
});
