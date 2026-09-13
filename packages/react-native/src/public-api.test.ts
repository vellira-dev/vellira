import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { componentTokenPaths } from '@vellira-ui/tokens';
import { describe, expect, it } from 'vitest';

import * as api from './index';
import { nativeThemes } from './theme';

const dirname = path.dirname(fileURLToPath(import.meta.url));

const webOnlyRuntimeExports = new Set(['Popover']);

const getRuntimeExports = (source: string) => {
  const exports = new Set<string>();
  const exportPattern = /^export\s+\{\s*([^}]+)\s*\}/gm;
  let match: RegExpExecArray | null;

  while ((match = exportPattern.exec(source))) {
    match[1]
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean)
      .forEach((entry) => {
        const [, alias = entry] = entry.split(/\s+as\s+/);

        exports.add(alias.trim());
      });
  }

  return [...exports].sort();
};

const getValueByPath = (source: unknown, tokenPath: string) =>
  tokenPath
    .split('.')
    .reduce<unknown>(
      (value, segment) =>
        value && typeof value === 'object'
          ? (value as Record<string, unknown>)[segment]
          : undefined,
      source
    );

export const publicApiSymbols = [
  'Accordion',
  'AccordionContentProps',
  'AccordionItemProps',
  'AccordionProps',
  'AccordionTriggerProps',
  'Button',
  'ButtonProps',
  'Checkbox',
  'CheckboxProps',
  'Dropdown',
  'DropdownContentProps',
  'DropdownEmptyProps',
  'DropdownGroupProps',
  'DropdownItemProps',
  'DropdownLabelProps',
  'DropdownPresentation',
  'DropdownProps',
  'DropdownSelectEvent',
  'DropdownSeparatorProps',
  'DropdownTriggerProps',
  'FormField',
  'FormFieldControlProps',
  'FormFieldDescriptionProps',
  'FormFieldLabelProps',
  'FormFieldMessageProps',
  'FormFieldProps',
  'Input',
  'InputProps',
  'Modal',
  'ModalBodyProps',
  'ModalCloseProps',
  'ModalContentProps',
  'ModalDescriptionProps',
  'ModalFooterProps',
  'ModalHeaderProps',
  'ModalOverlayProps',
  'ModalProps',
  'ModalTitleProps',
  'ModalTriggerProps',
  'NativeThemeName',
  'Popover',
  'PopoverAnchorProps',
  'PopoverArrowProps',
  'PopoverCloseProps',
  'PopoverContentProps',
  'PopoverDescriptionProps',
  'PopoverProps',
  'PopoverTitleProps',
  'PopoverTriggerProps',
  'Portal',
  'PortalProps',
  'PortalProvider',
  'PortalProviderProps',
  'Radio',
  'RadioGroup',
  'RadioGroupItemProps',
  'RadioGroupProps',
  'RadioProps',
  'Select',
  'SelectContentProps',
  'SelectEmptyProps',
  'SelectGroupProps',
  'SelectIconSlotProps',
  'SelectItemBadgeProps',
  'SelectItemDescriptionProps',
  'SelectItemIconProps',
  'SelectItemProps',
  'SelectLabelProps',
  'SelectLoadingProps',
  'SelectOption',
  'SelectPresentation',
  'SelectProps',
  'SelectRenderOption',
  'SelectRenderOptionContext',
  'SelectRenderValue',
  'SelectRenderValueContext',
  'SelectSearchProps',
  'SelectSeparatorProps',
  'SelectTriggerSlotProps',
  'SelectValueSlotProps',
  'SelectVirtualConfig',
  'Switch',
  'SwitchProps',
  'Tabs',
  'TabsContentProps',
  'TabsListProps',
  'TabsProps',
  'TabsTriggerProps',
  'ThemeProvider',
  'ThemeProviderProps',
  'Tooltip',
  'TooltipContentProps',
  'TooltipProps',
  'TooltipRootProps',
  'TooltipTriggerProps',
  'nativeThemes',
  'useTheme',
] as const;

describe('public API', () => {
  it('exports only documented runtime entries', () => {
    expect(Object.keys(api).sort()).toEqual([
      'Accordion',
      'Button',
      'Checkbox',
      'Dropdown',
      'FormField',
      'Input',
      'Modal',
      'Popover',
      'Portal',
      'PortalProvider',
      'Radio',
      'RadioGroup',
      'Select',
      'Switch',
      'Tabs',
      'ThemeProvider',
      'Tooltip',
      'nativeThemes',
      'useTheme',
    ]);
  });

  it('contains every shared web runtime export', () => {
    const webIndex = readFileSync(
      path.resolve(dirname, '../../react/src/index.ts'),
      'utf8'
    );

    const sharedWebRuntimeExports = getRuntimeExports(webIndex).filter(
      (runtimeExport) => !webOnlyRuntimeExports.has(runtimeExport)
    );

    expect(Object.keys(api)).toEqual(
      expect.arrayContaining(sharedWebRuntimeExports)
    );
  });

  it('keeps every component token path available to native themes', () => {
    for (const [themeName, theme] of Object.entries(nativeThemes)) {
      const missingTokens = componentTokenPaths.filter(
        (tokenPath) => getValueByPath(theme, tokenPath) === undefined
      );

      expect(missingTokens, `${themeName} missing component tokens`).toEqual(
        []
      );
    }
  });
});
