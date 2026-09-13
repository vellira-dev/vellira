export const componentTokenFactoryConventionV1 = {
  rootEntries: [
    { name: 'components', kind: 'directory' },
    { name: 'index.ts', kind: 'file' },
    { name: 'palettes', kind: 'directory' },
    { name: 'shared', kind: 'directory' },
  ],
  paletteFamilies: [
    {
      component: 'button',
      componentName: 'Button',
      factory: 'createButtonTokens',
      helper: 'createButtonIntentPalette.ts',
      themeFile: 'button.ts',
    },
    {
      component: 'checkbox',
      componentName: 'Checkbox',
      factory: 'createCheckboxTokens',
      helper: 'createCheckboxIntentPalette.ts',
      themeFile: 'checkbox.ts',
    },
    {
      component: 'dropdown',
      componentName: 'Dropdown',
      factory: 'createDropdownTokens',
      helper: 'createDropdownIntentPalette.ts',
      themeFile: 'dropdown.ts',
    },
    {
      component: 'input',
      componentName: 'Input',
      factory: 'createInputTokens',
      helper: 'createInputIntentPalette.ts',
      themeFile: 'input.ts',
    },
    {
      component: 'radio',
      componentName: 'Radio',
      factory: 'createRadioTokens',
      helper: 'createRadioIntentPalette.ts',
      themeFile: 'radio.ts',
    },
    {
      component: 'select',
      componentName: 'Select',
      factory: 'createSelectTokens',
      helper: 'createSelectIntentPalette.ts',
      themeFile: 'select.ts',
    },
  ],
  sharedHelpers: ['componentFocusRing.ts'],
} as const;

export type ComponentTokenFactoryConvention =
  typeof componentTokenFactoryConventionV1;
