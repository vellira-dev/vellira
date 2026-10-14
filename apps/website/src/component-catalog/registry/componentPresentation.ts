import type { ComponentCatalogPresentationEntry } from '../types';

export const componentCatalogPresentation = [
  {
    component: 'Button',
    slug: 'button',
    name: 'Button',
    description:
      'Accessible React and React Native actions with Vellira Button: appearances, semantic colors, sizes, loading states, icons, links, and composition.',
    category: 'general',
    order: 10,
    docs: {
      react: 'https://docs.vellira.dev/react/button',
      'react-native': 'https://docs.vellira.dev/react-native/button',
    },
  },

  {
    component: 'Input',
    slug: 'input',
    name: 'Input',
    description:
      'Accessible React and React Native text inputs with labels, controlled values, validation feedback, clearable search, and password reveal.',
    category: 'forms',
    order: 10,
    docs: {
      react: 'https://docs.vellira.dev/react/input',
      'react-native': 'https://docs.vellira.dev/react-native/input',
    },
  },
  {
    component: 'Checkbox',
    slug: 'checkbox',
    name: 'Checkbox',
    description:
      'Checkbox for React and React Native with controlled and uncontrolled state, indeterminate state, disabled state, required state, and validation state.',
    category: 'forms',
    order: 20,
    docs: {
      react: 'https://docs.vellira.dev/react/checkbox',
      'react-native': 'https://docs.vellira.dev/react-native/checkbox',
    },
  },
  {
    component: 'Radio',
    slug: 'radio',
    name: 'Radio',
    description:
      'React and React Native Radio for a labelled single choice, with controlled or default selection, disabled and required states, sizes, colors, and validation feedback.',
    category: 'forms',
    order: 30,
    docs: {
      react: 'https://docs.vellira.dev/react/radio-group',
      'react-native': 'https://docs.vellira.dev/react-native/radio-group',
    },
  },
  {
    component: 'RadioGroup',
    slug: 'radio-group',
    name: 'Radio Group',
    description:
      'React and React Native RadioGroup for controlled or default single selection, labelled items, horizontal or vertical layout, and group validation feedback.',
    category: 'forms',
    order: 40,
    docs: {
      react: 'https://docs.vellira.dev/react/radio-group',
      'react-native': 'https://docs.vellira.dev/react-native/radio-group',
    },
  },
  {
    component: 'Select',
    slug: 'select',
    name: 'Select',
    description:
      'Accessible React and React Native selection with Vellira Select: single and multiple values, search, groups, rich items, and virtualization.',
    category: 'forms',
    order: 50,
    docs: {
      react: 'https://docs.vellira.dev/react/select',
      'react-native': 'https://docs.vellira.dev/react-native/select',
    },
  },
  {
    component: 'FormField',
    slug: 'form-field',
    name: 'Form Field',
    description:
      'Composable React and React Native FormField with Label, Description, Control and Message slots, field state, accessible feedback, and layout options.',
    category: 'forms',
    order: 60,
    docs: {
      react: 'https://docs.vellira.dev/react/form-field',
      'react-native': 'https://docs.vellira.dev/react-native/form-field',
    },
  },

  {
    component: 'Tabs',
    slug: 'tabs',
    name: 'Tabs',
    description:
      'React and React Native Tabs with compound triggers and panels, controlled or default selection, layout variants, disabled state, and platform-specific accessibility.',
    category: 'navigation',
    order: 10,
    docs: {
      react: 'https://docs.vellira.dev/react/tabs',
      'react-native': 'https://docs.vellira.dev/react-native/tabs',
    },
  },

  {
    component: 'Dropdown',
    slug: 'dropdown',
    name: 'Dropdown',
    description:
      'Composable action menus with nested content, selection states, and rich items.',
    category: 'overlays',
    order: 10,
    docs: {
      react: 'https://docs.vellira.dev/react/dropdown',
      'react-native': 'https://docs.vellira.dev/react-native/dropdown',
    },
  },
  {
    component: 'Modal',
    slug: 'modal',
    name: 'Modal',
    description:
      'Accessible modal dialogs with focus management, dismissal, and compound structure.',
    category: 'overlays',
    order: 20,
    docs: {
      react: 'https://docs.vellira.dev/react/modal',
      'react-native': 'https://docs.vellira.dev/react-native/modal',
    },
  },
  {
    component: 'Popover',
    slug: 'popover',
    name: 'Popover',
    description:
      'Floating contextual content with collision handling and flexible positioning.',
    category: 'overlays',
    order: 30,
    docs: {
      react: 'https://docs.vellira.dev/react/popover',
      'react-native': 'https://docs.vellira.dev/react-native/popover',
    },
  },
  {
    component: 'Tooltip',
    slug: 'tooltip',
    name: 'Tooltip',
    description:
      'React and React Native Tooltip with compound Trigger and Content, positioning, optional arrow, disabled state, and platform-specific interaction.',
    category: 'overlays',
    order: 40,
    docs: {
      react: 'https://docs.vellira.dev/react/tooltip',
      'react-native': 'https://docs.vellira.dev/react-native/tooltip',
    },
  },
  {
    component: 'Switch',
    slug: 'switch',
    name: 'Switch',
    description:
      'Accessible React and React Native Switch for immediate boolean settings with controlled or default checked state, disabled, required, and invalid semantics.',
    category: 'forms',
    order: 999,
    docs: {
      react: 'https://docs.vellira.dev/react/switch',
      'react-native': 'https://docs.vellira.dev/react-native/switch',
    },
  },
  {
    component: 'Accordion',
    slug: 'accordion',
    name: 'Accordion',
    description:
      'Accessible compound Accordion for React and React Native with single or multiple expansion, controlled and default values, collapsible behavior, disabled items, and platform-specific trigger semantics.',
    category: 'navigation',
    order: 999,
    docs: {
      react: 'https://docs.vellira.dev/react/accordion',
      'react-native': 'https://docs.vellira.dev/react-native/accordion',
    },
  },
  {
    component: 'Textarea',
    slug: 'textarea',
    name: 'Textarea',
    description:
      'Textarea for React and React Native with controlled and uncontrolled state, disabled state, required state, and validation state.',
    category: 'forms',
    order: 999,
    docs: {
      react: 'https://docs.vellira.dev/react/textarea',
      'react-native': 'https://docs.vellira.dev/react-native/textarea',
    },
  },
] as const satisfies readonly ComponentCatalogPresentationEntry[];
