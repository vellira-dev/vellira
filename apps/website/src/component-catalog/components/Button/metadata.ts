import { defineComponentPageMetadata } from '../../metadata';

export default defineComponentPageMetadata({
  discovery: {
    status: 'complete',
    summary:
      'Use Button for explicit actions such as saving, submitting a form, or opening a menu.',
    description:
      'Accessible React and React Native actions with Vellira Button: appearances, semantic colors, sizes, loading states, icons, links, and composition.',
    whenToUse: [
      'Choose Button for an action; use a semantic link for navigation.',
      'Use appearance and color to communicate action hierarchy and intent.',
      'For asynchronous actions, use loading and loadingText to signal progress.',
      'Give icon-only controls accessible names; the icon itself is not a label.',
    ],
    patterns: [
      {
        id: 'async-action',
        title: 'Save or submit',
        description: 'Use loading and loadingText while an action is pending.',
      },
      {
        id: 'action-hierarchy',
        title: 'Primary and secondary actions',
        description:
          'Pair solid primary actions with quieter outline or ghost actions.',
      },
      {
        id: 'icon-only',
        title: 'Accessible icon-only buttons',
        description:
          'Keep a concise accessible label when visible text is absent.',
      },
      {
        id: 'navigation',
        title: 'Link-like buttons',
        description:
          'On React, use href or asChild to preserve link semantics.',
      },
    ],
    platformNotes: {
      react: [
        'React Button supports onClick for actions and href or asChild for link semantics.',
        'For an icon-only web action, use aria-label or aria-labelledby.',
      ],
      'react-native': [
        'React Native Button handles native actions through onPress, not DOM onClick.',
        'Use accessibilityLabel for icon-only native actions; web ARIA rules do not transfer.',
      ],
    },
    missingEvidence: [],
  },

  react: {
    children: 'Add item',
    demoProps: `iconStart={<Plus />}
aria-label='Add item'`,
    imports: [`import { Plus } from '@vellira-ui/icons';`],
  },
  native: {
    children: 'Add item',
    demoProps: `iconStart={<Plus />}
accessibilityLabel='Add item'`,
    imports: [`import { Plus } from '@vellira-ui/icons';`],
  },
  demo: {
    initialValues: {
      color: 'primary',
      appearance: 'solid',
      size: 'md',
      shape: 'pill',
      fullWidth: false,
      loading: false,
      disabled: false,
      iconOnly: false,
    },
  },

  defaults: {
    shared: {
      color: 'primary',
      appearance: 'solid',
      size: 'md',
      shape: 'pill',
      fullWidth: false,
      loading: false,
      disabled: false,
      iconOnly: false,
    },

    react: {
      asChild: false,
    },
  },

  examples: [
    {
      title: 'Basic',
      description: 'Primary action button.',
      props: [],
    },
    {
      title: 'Appearance and color',
      description: 'Alternative surface and semantic action tone.',
      props: [`appearance='outline'`, `color='danger'`],
    },
    {
      title: 'Icons',
      description: 'Icons clarify the action without replacing the label.',
      imports: [`import { ArrowRight } from '@vellira-ui/icons';`],
      props: ['iconEnd={<ArrowRight />}'],
    },
    {
      title: 'Icon-only',
      description: 'Compact action with an accessible name.',
      props: ['iconOnly'],
      reactChildren: '',
      nativeChildren: '',
    },
    {
      title: 'Loading',
      description: 'Shows progress and prevents interaction.',
      props: ['loading', `loadingText='Saving...'`],
    },
    {
      title: 'Disabled',
      description: 'Disabled action state.',
      props: ['disabled'],
    },
    {
      title: 'Full width',
      description: 'Button expands to fill its container.',
      props: ['fullWidth'],
    },
    {
      title: 'Size and shape',
      description: 'Large rounded button treatment.',
      props: [`size='lg'`, `shape='rounded'`],
    },
    {
      title: 'Composed link',
      description: 'Composes button styling onto a custom React link.',
      props: ['asChild'],
      reactImports: [`import Link from 'next/link';`],
      reactChildren: `<Link href='/components/button'>Button</Link>`,
      platforms: ['react'],
    },
    {
      title: 'Press handler',
      description: 'Handles native press interaction.',
      props: [],
      nativeProps: ['onPress={() => {}}'],
      platforms: ['react-native'],
    },
  ],

  accessibility: {
    react: [
      {
        title: 'Accessible names',
        description:
          'Use visible text for normal buttons and aria-label or aria-labelledby for icon-only actions.',
        props: ['children', 'iconOnly', 'aria-label', 'aria-labelledby'],
      },
      {
        title: 'Loading and disabled state',
        description:
          'Loading buttons expose busy state and prevent interaction while preserving the button label.',
        props: ['loading', 'loadingText', 'disabled'],
      },
      {
        title: 'Composed semantics',
        description:
          'When using asChild, pass semantic attributes and href to the child element.',
        props: ['asChild', 'href', 'type'],
      },
    ],
    native: [
      {
        title: 'Accessible names',
        description:
          'Use visible text for normal buttons and accessibilityLabel for icon-only actions.',
        props: ['children', 'iconOnly', 'accessibilityLabel'],
      },
      {
        title: 'Loading and disabled state',
        description:
          'Loading buttons announce disabled interaction through React Native accessibility state.',
        props: ['loading', 'loadingText', 'disabled'],
      },
      {
        title: 'Press handling',
        description:
          'Keep onPress actions predictable and provide an accessibilityHint when the result is not obvious.',
        props: ['onPress', 'accessibilityHint'],
      },
    ],
  },

  related: ['input', 'checkbox', 'modal'],
});
