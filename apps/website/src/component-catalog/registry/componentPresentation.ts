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
      'Flexible text input with adornments, validation states, and form integration.',
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
      'Accessible single-choice selection control with labels, descriptions, and validation states.',
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
      'Single-choice selection with keyboard navigation and shared group state.',
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
      'Composable labels, descriptions, controls, and validation messages for forms.',
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
      'Keyboard-accessible tab navigation with controlled activation and indicators.',
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
      'Accessible Tooltip for React and React Native with managed delay, positioning, controlled state, compound triggers, and platform-appropriate dismissal behavior.',
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
      'Vellira Switch for React and React Native with usage examples, accessibility guidance, and API details.',
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
      'Vellira Accordion for React and React Native with usage examples, accessibility guidance, and API details.',
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
