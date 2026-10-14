import { defineComponentPageMetadata } from '../../metadata';

const nativeImports = [
  `import { Text as NativeText } from 'react-native';`,
  `import { useTheme } from '@vellira-ui/react-native';`,
  `import { controlSizes } from '@vellira-ui/tokens';`,
] as const;

const nativeTriggerChildren = `<Tooltip.Trigger
  style={{
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: controlSizes.md.height,
    paddingLeft: nativeTheme.tokens.spacing[6],
    paddingRight: nativeTheme.tokens.spacing[6],
    borderRadius: nativeTheme.tokens.radius.full,
    backgroundColor:
      nativeTheme.components.button.primary.solid.default.bg,
  }}
>
  <NativeText
    style={{
      color: nativeTheme.components.button.primary.solid.default.fg,
      fontFamily: nativeTheme.tokens.typography.family.regular,
      fontSize: nativeTheme.tokens.typography.size.md,
      lineHeight: nativeTheme.tokens.typography.lineHeight.md,
    }}
  >
    Press and hold
  </NativeText>
</Tooltip.Trigger>
<Tooltip.Content withArrow>Helpful contextual label.</Tooltip.Content>`;

export default defineComponentPageMetadata({
  discovery: {
    status: 'complete',
    summary:
      'Use Tooltip for brief, supplemental context associated with an interactive trigger.',
    description:
      'React and React Native Tooltip with compound Trigger and Content, positioning, optional arrow, disabled state, and platform-specific interaction.',
    whenToUse: [
      'Use Tooltip for short, nonessential explanations of a control.',
      'Never rely on tooltip content as the sole source of instructions or critical feedback.',
      'Use Tooltip.Trigger and Tooltip.Content together, keeping content concise.',
      'Choose Popover for interactive or longer content instead of a tooltip.',
    ],
    patterns: [
      {
        id: 'compound-tooltip',
        title: 'Trigger and content',
        description:
          'Compose a Tooltip.Trigger with associated Tooltip.Content for a small contextual message.',
      },
      {
        id: 'placement',
        title: 'Placement and arrow',
        description:
          'Select a placement and optional withArrow presentation that does not obscure the triggering control.',
      },
      {
        id: 'disabled',
        title: 'Conditional help',
        description:
          'Use disabled to suppress a tooltip when contextual help is not appropriate.',
      },
    ],
    platformNotes: {
      react: [
        'Web Tooltip can use a composed asChild trigger and hover/focus interactions; controlled open state and delay behavior depend on the React API.',
        'Provide supplementary information accessible without requiring pointer-only interaction.',
      ],
      'react-native': [
        'React Native Tooltip supports touch-oriented trigger interaction and does not require web hover semantics.',
        'Keep essential text outside Tooltip, with placement and dismissal appropriate to native accessibility and input.',
      ],
    },
    missingEvidence: [],
  },
  react: {
    children: `<Tooltip.Trigger asChild>
  <ReactButton>Hover for details</ReactButton>
</Tooltip.Trigger>
<Tooltip.Content withArrow>Helpful contextual label.</Tooltip.Content>`,
    imports: [`import { Button as ReactButton } from '@vellira-ui/react';`],
  },
  native: {
    children: nativeTriggerChildren,
    imports: nativeImports,
    setup: ['const { theme: nativeTheme } = useTheme();'],
  },
  defaults: {
    shared: {
      placement: 'top',
      disabled: false,
    },
  },
  examples: [
    {
      title: 'Basic',
      description: 'Contextual label for a trigger.',
      props: [],
      reactImports: [
        `import { Button as ReactButton } from '@vellira-ui/react';`,
      ],
      nativeImports,
    },
    {
      title: 'Placement',
      description: 'Alternative tooltip placement.',
      props: [`placement='bottom'`],
      reactImports: [
        `import { Button as ReactButton } from '@vellira-ui/react';`,
      ],
      nativeImports,
    },
    {
      title: 'Disabled',
      description: 'Disabled tooltip behavior.',
      props: ['disabled'],
      reactImports: [
        `import { Button as ReactButton } from '@vellira-ui/react';`,
      ],
      nativeImports,
    },
    {
      title: 'Without arrow',
      description: 'Omits the arrow when a simpler bubble is preferred.',
      props: [],
      reactImports: [
        `import { Button as ReactButton } from '@vellira-ui/react';`,
      ],
      nativeImports,
      reactChildren: `<Tooltip.Trigger asChild>
  <ReactButton>No arrow</ReactButton>
</Tooltip.Trigger>
<Tooltip.Content>Tooltip without arrow</Tooltip.Content>`,
      nativeChildren: `<Tooltip.Trigger
  style={{
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: controlSizes.md.height,
    paddingLeft: nativeTheme.tokens.spacing[6],
    paddingRight: nativeTheme.tokens.spacing[6],
    borderRadius: nativeTheme.tokens.radius.full,
    backgroundColor:
      nativeTheme.components.button.primary.solid.default.bg,
  }}
>
  <NativeText
    style={{
      color: nativeTheme.components.button.primary.solid.default.fg,
      fontFamily: nativeTheme.tokens.typography.family.regular,
      fontSize: nativeTheme.tokens.typography.size.md,
      lineHeight: nativeTheme.tokens.typography.lineHeight.md,
    }}
  >
    No arrow
  </NativeText>
</Tooltip.Trigger>
<Tooltip.Content>Tooltip without arrow</Tooltip.Content>`,
    },
  ],
  api: {
    sections: [
      { name: 'Tooltip.Trigger', exportName: 'TooltipTriggerProps' },
      { name: 'Tooltip.Content', exportName: 'TooltipContentProps' },
    ],
  },
  accessibility: {
    react: [
      {
        title: 'Supplemental text',
        description:
          'Use tooltips for supplemental labels, not as the only way to complete a task.',
        props: ['children', 'disabled'],
      },
      {
        title: 'Delay behavior',
        description:
          'Choose open and close delays that keep hover and focus behavior predictable.',
        props: ['delay', 'onOpenChange'],
      },
    ],
    native: [
      {
        title: 'Supplemental text',
        description:
          'Keep tooltip content concise and make critical information available outside the tooltip.',
        props: ['children', 'disabled'],
      },
      {
        title: 'Placement',
        description:
          'Use placement that keeps the tooltip near its trigger without covering the control.',
        props: ['placement'],
      },
    ],
  },
  related: ['button', 'popover'],
});
