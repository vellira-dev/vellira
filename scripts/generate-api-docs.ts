import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import prettier from 'prettier';
import ts from 'typescript';

export type ApiSection = {
  docPath: string;
  heading: string;
  id: string;
  sourceFile: string;
  interfaceName: string;
};

type PropRow = {
  name: string;
  type: string;
  required: boolean;
  description: string;
};

const fallbackDescriptions: Record<string, string> = {
  accessibilityLabel: 'Accessible label for screen readers.',
  accessibilityHint: 'Additional accessibility hint for screen readers.',
  'aria-label': 'Accessible trigger label.',
  activeIndex: 'Currently active tab index.',
  ariaLabel: 'Accessible trigger label for icon-only or custom triggers.',
  arrowIcon: 'Custom arrow icon rendered in the trigger.',
  contentClassName: 'Extra CSS class for the menu content element.',
  contentStyle: 'Extra content style.',
  error: 'Error message rendered for invalid state.',
  fullWidth: 'Makes the component fill its container width.',
  icon: 'Icon rendered inside the component.',
  iconSize: 'Icon size in pixels.',
  inputStyle: 'Extra style for the input element.',
  itemClassName: 'Extra CSS class applied to every menu item.',
  itemStyle: 'Extra item style.',
  label: 'Visible label.',
  labelStyle: 'Extra label text style.',
  leftIcon: 'Icon rendered before content.',
  startIconTone: 'Color tone for the start icon.',
  onChange: 'Called when the value changes.',
  onBlur: 'Called when the trigger loses focus.',
  onClick: 'Click handler.',
  onFocus: 'Called when the trigger receives focus.',
  onClear: 'Called when the clear action is pressed.',
  onKeyDown: 'Keyboard handler.',
  optionStyle: 'Extra option style.',
  overlayStyle: 'Extra overlay style.',
  readOnly: 'Marks the input as read-only.',
  rightIcon: 'Icon rendered after content.',
  endIconTone: 'Color tone for the end icon.',
  clearIconTone: 'Color tone for the clear icon.',
  showArrow: 'Controls whether the trigger arrow is rendered.',
  showOverflowTooltip: 'Shows a tooltip when the input value overflows.',
  size: 'Input size.',
  style: 'Extra root style.',
  textStyle: 'Extra text style.',
  triggerStyle: 'Extra trigger style.',
  children: 'Content rendered inside the component.',
  type: 'HTML input type.',
  value: 'Controlled value.',
  defaultValue: 'Initial uncontrolled value.',
  theme: 'Controlled theme value.',
  defaultTheme: 'Initial theme for uncontrolled usage.',
  onThemeChange: 'Called whenever the active theme changes.',
  className: 'Extra CSS class for the root element.',
  defaultOpen: 'Initial uncontrolled open state.',
  description: 'Additional descriptive text.',
  disabled: 'Disables interaction.',
  dropdownClassName: 'Extra CSS class for the dropdown element.',
  matchTriggerWidth: 'Matches the dropdown width to the trigger width.',
  onOpenChange: 'Called when the open state changes.',
  noOptionsText: 'Content shown when no options are available.',
  open: 'Controlled open state.',
  placement: 'Preferred dropdown placement.',
  required: 'Marks the field as required.',
  placeholder: 'Placeholder text.',
  pickerStyle: 'Extra picker style.',
  clearable: 'Shows a clear action when the input has a value.',
  forceMount:
    'Keeps this content mounted regardless of the root mounting policy.',
  keepMounted: 'Keeps all content mounted and hides inactive panels.',
  lazyMount: 'Mounts content only after its value has been activated.',
  loop: 'Loops keyboard navigation from last to first and first to last.',
  onValueChange: 'Called when the value changes.',
  scrollable: 'Makes the tab list horizontally scrollable.',
  triggerClassName: 'Extra CSS class for the trigger element.',
};

const descriptionOverrides: Record<string, Record<string, string>> = {
  'web.InputProps.Input': {
    className: 'Extra CSS class for the input element.',
    variant:
      'Visual style: outline, filled, soft, or the web-only bare composition mode.',
  },
  'web.ButtonProps.Button': {
    appearance:
      'Visual style: solid, outline, ghost, soft, link, or the web-only bare composition mode.',
    asChild:
      'Composes Button behavior and styling onto a single child element.',
    badge: 'Compact badge rendered after the label when not icon-only.',
    color: 'Visual tone: primary, neutral, success, warning, or danger.',
    shape: 'Corner shape: square, rounded, or pill.',
    shortcut:
      'Keyboard shortcut hint rendered after the label when not icon-only.',
    spinner: 'Custom loading indicator.',
    tooltip: 'HTML title tooltip text for the button or composed child.',
  },
  'native.ButtonProps.Button': {
    appearance: 'Visual style: solid, outline, ghost, soft, or link.',
    badge: 'Compact badge rendered after the label when not icon-only.',
    color: 'Visual tone: primary, neutral, success, warning, or danger.',
    iconSize: 'Overrides the size-derived icon size in pixels.',
    shape: 'Corner shape: square, rounded, or pill.',
    shortcut:
      'Keyboard shortcut hint rendered after the label when not icon-only.',
  },
  'web.SelectProps.SelectProps': {
    size: 'Select size.',
  },
  'native.SelectProps.SelectProps': {
    offset: 'Distance between the trigger and popover content in pixels.',
    placement: 'Preferred popover placement relative to the trigger.',
    size: 'Select size.',
  },
  'web.DropdownProps.DropdownProps': {
    color:
      'Semantic palette for trigger, content, focus, and item interaction states.',
    size: 'Dropdown size.',
  },
  'native.DropdownProps.DropdownProps': {
    color:
      'Semantic palette for trigger, content, focus, and pressed item states.',
    size: 'Dropdown size.',
  },
  'web.TabsProps.TabsProps': {
    activationMode:
      'Keyboard activation mode: automatic selects on focus, manual selects with Enter or Space.',
    color: 'Visual tone: primary, neutral, success, warning, or danger.',
    defaultValue: 'Initial selected value for uncontrolled usage.',
    dir: 'Text direction used for horizontal keyboard navigation and indicator positioning.',
    orientation: 'Keyboard and layout orientation.',
    onValueChange: 'Called when the selected value changes.',
    size: 'Tabs size.',
    value: 'Controlled selected value.',
    variant: 'Visual style: line, pills, or segmented.',
  },
  'web.TabsTriggerProps.TabsTriggerProps': {
    badge: 'Badge rendered after the label.',
    description: 'Secondary text rendered below the trigger label.',
    icon: 'Icon rendered before the label. Explicit Tabs.Icon children take precedence.',
    value: 'Stable trigger value matched with Tabs.Content.',
  },
  'web.TabsContentProps.TabsContentProps': {
    value: 'Stable content value matched with Tabs.Trigger.',
  },
  'web.TooltipProps.Tooltip': {
    avoidCollisions: 'Allows the tooltip to flip or shift to stay in viewport.',
    delay: 'Open delay in milliseconds, or explicit open/close delays.',
    interactive: 'Allows pointer interaction inside tooltip content.',
    matchTriggerWidth: 'Matches tooltip content width to the trigger width.',
    modal:
      'Reserved for modal overlay semantics. Tooltip defaults to non-modal.',
    offset: 'Distance between trigger and content in pixels.',
    placement: 'Preferred tooltip placement.',
    portal: 'Reserved for automatic portal rendering in higher-level helpers.',
    skipDelay: 'Delay window for future sibling tooltip delay skipping.',
  },
  'web.TooltipTriggerProps.TooltipTriggerProps': {
    asChild: 'Composes trigger behavior onto a single child element.',
    children: 'Trigger element or content.',
    disabled: 'Disables this trigger.',
  },
  'web.TooltipContentProps.TooltipContentProps': {
    forceMount:
      'Keeps the tooltip content mounted even when the tooltip is closed.',
  },
  'native.TooltipProps.Tooltip': {
    closeOnOutsidePress:
      'Closes the tooltip when the user presses outside the content.',
    delay: 'Open delay in milliseconds, or explicit open/close delays.',
    offset: 'Distance between trigger and content in pixels.',
    placement: 'Preferred tooltip placement.',
  },
  'native.TooltipTriggerProps.TooltipTriggerProps': {
    children: 'Trigger element or content.',
    disabled: 'Disables this trigger.',
  },
  'native.TooltipContentProps.TooltipContentProps': {
    forceMount:
      'Keeps the tooltip content mounted even when the tooltip is closed.',
    textStyle: 'Extra tooltip text style.',
  },
  'native.TabsProps.TabsProps': {
    activationMode:
      'Keyboard activation mode: automatic selects on focus, manual selects with Enter or Space.',
    color: 'Visual tone: primary, neutral, success, warning, or danger.',
    defaultValue: 'Initial selected value for uncontrolled usage.',
    dir: 'Text direction reserved for API parity.',
    orientation: 'Layout orientation.',
    onValueChange: 'Called when the selected value changes.',
    size: 'Tabs size.',
    value: 'Controlled selected value.',
    variant: 'Visual style: line, pills, or segmented.',
  },
  'native.TabsTriggerProps.TabsTriggerProps': {
    badge: 'Badge rendered after the label.',
    description: 'Secondary text rendered below the trigger label.',
    icon: 'Icon rendered before the label. Explicit Tabs.Icon children take precedence.',
    value: 'Stable trigger value matched with Tabs.Content.',
  },
  'native.TabsContentProps.TabsContentProps': {
    value: 'Stable content value matched with Tabs.Trigger.',
  },
  'web.AccordionProps.AccordionProps': {
    type: 'Selection mode: single allows one item, multiple allows several open items.',
    value: 'Controlled expanded value.',
    defaultValue: 'Initial expanded value for uncontrolled usage.',
    onValueChange: 'Called when the expanded value changes.',
    collapsible: 'Allows the open item to collapse in single mode.',
    disabled: 'Disables every accordion item.',
  },
  'web.AccordionItemProps.AccordionItemProps': {
    value: 'Stable item value used by root state.',
    disabled: 'Disables this item.',
  },
  'web.AccordionTriggerProps.AccordionTriggerProps': {
    disabled: 'Disables this trigger.',
  },
  'web.AccordionContentProps.AccordionContentProps': {
    forceMount: 'Keeps this content mounted even when its item is collapsed.',
  },
  'native.AccordionProps.AccordionProps': {
    type: 'Selection mode: single allows one item, multiple allows several open items.',
    value: 'Controlled expanded value.',
    defaultValue: 'Initial expanded value for uncontrolled usage.',
    onValueChange: 'Called when the expanded value changes.',
    collapsible: 'Allows the open item to collapse in single mode.',
    disabled: 'Disables every accordion item.',
  },
  'native.AccordionItemProps.AccordionItemProps': {
    value: 'Stable item value used by root state.',
    disabled: 'Disables this item.',
  },
  'native.AccordionTriggerProps.AccordionTriggerProps': {
    disabled: 'Disables this trigger.',
  },
  'native.AccordionContentProps.AccordionContentProps': {
    forceMount: 'Keeps this content mounted even when its item is collapsed.',
  },
};

const defaultSections: ApiSection[] = [
  section('web', '## Button', 'ButtonProps', 'src/primitives/Button/types.ts'),
  section(
    'web',
    '## Checkbox',
    'CheckboxProps',
    'src/primitives/Checkbox/types.ts'
  ),
  section('web', '## Switch', 'SwitchProps', 'src/primitives/Switch/types.ts'),
  section('web', '## Input', 'InputProps', 'src/primitives/Input/types.ts'),
  section(
    'web',
    '## FormField',
    'FormFieldProps',
    'src/patterns/FormField/types.ts'
  ),
  section(
    'web',
    '### RadioGroup Props',
    'RadioGroupProps',
    'src/components/RadioGroup/types.ts'
  ),
  section(
    'web',
    '### Radio Props',
    'RadioProps',
    'src/primitives/Radio/types.ts'
  ),
  section(
    'web',
    '### Select Props',
    'SelectProps',
    'src/components/Select/types.ts'
  ),
  section(
    'web',
    '### SelectOption',
    'SelectOption',
    'src/components/Select/types.ts'
  ),
  section(
    'web',
    '### Dropdown Props',
    'DropdownProps',
    'src/components/Dropdown/types.ts'
  ),
  section(
    'web',
    '### Tabs Props',
    'TabsProps',
    'src/components/Tabs/Root/types.ts'
  ),
  section(
    'web',
    '### Tabs.List Props',
    'TabsListProps',
    'src/components/Tabs/List/types.ts'
  ),
  section(
    'web',
    '### Tabs.Indicator Props',
    'TabsIndicatorProps',
    'src/components/Tabs/List/types.ts'
  ),
  section(
    'web',
    '### Tabs.Trigger Props',
    'TabsTriggerProps',
    'src/components/Tabs/Trigger/types.ts'
  ),
  section(
    'web',
    '### Tabs.Content Props',
    'TabsContentProps',
    'src/components/Tabs/Content/types.ts'
  ),
  section(
    'web',
    '### Accordion Props',
    'AccordionProps',
    'src/components/Accordion/types.ts'
  ),
  section(
    'web',
    '### Accordion.Item Props',
    'AccordionItemProps',
    'src/components/Accordion/Item/types.ts'
  ),
  section(
    'web',
    '### Accordion.Trigger Props',
    'AccordionTriggerProps',
    'src/components/Accordion/Trigger/types.ts'
  ),
  section(
    'web',
    '### Accordion.Content Props',
    'AccordionContentProps',
    'src/components/Accordion/Content/types.ts'
  ),
  section(
    'web',
    '## Tooltip',
    'TooltipProps',
    'src/components/Tooltip/types.ts'
  ),
  section(
    'web',
    '### Tooltip.Trigger Props',
    'TooltipTriggerProps',
    'src/components/Tooltip/Trigger/types.ts'
  ),
  section(
    'web',
    '### Tooltip.Content Props',
    'TooltipContentProps',
    'src/components/Tooltip/Content/types.ts'
  ),
  section(
    'web',
    '### Modal Props',
    'ModalProps',
    'src/components/Modal/types.ts'
  ),
  section(
    'web',
    '### ThemeProvider Props',
    'ThemeProviderProps',
    'src/theme/types.ts'
  ),
  section(
    'native',
    '## Button',
    'ButtonProps',
    'src/primitives/Button/types.ts'
  ),
  section(
    'native',
    '## Checkbox',
    'CheckboxProps',
    'src/primitives/Checkbox/types.ts'
  ),
  section(
    'native',
    '## Switch',
    'SwitchProps',
    'src/primitives/Switch/types.ts'
  ),
  section('native', '## Input', 'InputProps', 'src/primitives/Input/types.ts'),
  section(
    'native',
    '## FormField',
    'FormFieldProps',
    'src/patterns/FormField/types.ts'
  ),
  section(
    'native',
    '### RadioGroup Props',
    'RadioGroupProps',
    'src/components/RadioGroup/types.ts'
  ),
  section(
    'native',
    '### Radio Props',
    'RadioProps',
    'src/primitives/Radio/types.ts'
  ),
  section(
    'native',
    '### Select Props',
    'SelectProps',
    'src/components/Select/types.ts'
  ),
  section(
    'native',
    '### SelectOption',
    'SelectOption',
    'src/components/Select/types.ts'
  ),
  section(
    'native',
    '### Dropdown Props',
    'DropdownProps',
    'src/components/Dropdown/types.ts'
  ),
  section(
    'native',
    '### Tabs Props',
    'TabsProps',
    'src/components/Tabs/types.ts'
  ),
  section(
    'native',
    '### Tabs.List Props',
    'TabsListProps',
    'src/components/Tabs/List/types.ts'
  ),
  section(
    'native',
    '### Tabs.Indicator Props',
    'TabsIndicatorProps',
    'src/components/Tabs/List/types.ts'
  ),
  section(
    'native',
    '### Tabs.Trigger Props',
    'TabsTriggerProps',
    'src/components/Tabs/Trigger/types.ts'
  ),
  section(
    'native',
    '### Tabs.Content Props',
    'TabsContentProps',
    'src/components/Tabs/Content/types.ts'
  ),
  section(
    'native',
    '### Accordion Props',
    'AccordionProps',
    'src/components/Accordion/types.ts'
  ),
  section(
    'native',
    '### Accordion.Item Props',
    'AccordionItemProps',
    'src/components/Accordion/Item/types.ts'
  ),
  section(
    'native',
    '### Accordion.Trigger Props',
    'AccordionTriggerProps',
    'src/components/Accordion/Trigger/types.ts'
  ),
  section(
    'native',
    '### Accordion.Content Props',
    'AccordionContentProps',
    'src/components/Accordion/Content/types.ts'
  ),
  section(
    'native',
    '## Tooltip',
    'TooltipProps',
    'src/components/Tooltip/types.ts'
  ),
  section(
    'native',
    '### Tooltip.Trigger Props',
    'TooltipTriggerProps',
    'src/components/Tooltip/Trigger/types.ts'
  ),
  section(
    'native',
    '### Tooltip.Content Props',
    'TooltipContentProps',
    'src/components/Tooltip/Content/types.ts'
  ),
  section(
    'native',
    '### Modal Props',
    'ModalProps',
    'src/components/Modal/types.ts'
  ),
  section(
    'native',
    '### ThemeProvider Props',
    'ThemeProviderProps',
    'src/theme/types.ts'
  ),
];

export type GenerateApiDocsResult = {
  status: 'updated' | 'up-to-date' | 'stale';
  changedFiles: string[];
};

type ApiDocsContext = {
  rootDir: string;
  checker: ts.TypeChecker;
  sourceFileByName: Map<string, ts.SourceFile>;
};

export async function generateApiDocs(
  params: {
    rootDir?: string;
    check?: boolean;
    silent?: boolean;
    sections?: readonly ApiSection[];
  } = {}
): Promise<GenerateApiDocsResult> {
  const {
    rootDir = process.cwd(),
    check = false,
    silent = false,
    sections = defaultSections,
  } = params;
  const sourceFiles = Array.from(
    new Set(sections.map((item) => item.sourceFile))
  ).map((sourceFile) => path.join(rootDir, sourceFile));

  const program = ts.createProgram(sourceFiles, {
    baseUrl: rootDir,
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    jsx: ts.JsxEmit.ReactJSX,
    skipLibCheck: true,
    strict: true,
    esModuleInterop: true,
    allowSyntheticDefaultImports: true,
    paths: {
      '@vellira-ui/core': ['packages/core/src/index.ts'],
      '@vellira-ui/icons': ['packages/icons/src/web.ts'],
      '@vellira-ui/icons/native': ['packages/icons/src/native.ts'],
      '@vellira-ui/icons/web': ['packages/icons/src/web.ts'],
      '@vellira-ui/react': ['packages/react/src/index.ts'],
      '@vellira-ui/react-native': ['packages/react-native/src/index.ts'],
      '@vellira-ui/tokens': ['packages/tokens/src/index.ts'],
      '@vellira-ui/types': ['packages/types/src/index.ts'],
    },
  });
  const context: ApiDocsContext = {
    rootDir,
    checker: program.getTypeChecker(),
    sourceFileByName: new Map(
      program
        .getSourceFiles()
        .map((sourceFile) => [normalizePath(sourceFile.fileName), sourceFile])
    ),
  };
  const docs = new Map<string, string>();

  for (const item of sections) {
    const docPath = path.join(rootDir, item.docPath);
    const currentDoc =
      docs.get(item.docPath) ?? fs.readFileSync(docPath, 'utf8');
    const descriptions = readExistingDescriptions(currentDoc, item);
    const rows = sortRows(
      readInterfaceRows(item, context).map((row) => ({
        ...row,
        description: getDescription(row.name, descriptions, item),
      })),
      descriptions
    );

    docs.set(
      item.docPath,
      replaceGeneratedTable(currentDoc, item, renderPropsTable(rows))
    );
  }

  const changedFiles: string[] = [];

  for (const [relativePath, generatedContent] of docs) {
    const docPath = path.join(rootDir, relativePath);
    const currentContent = fs.readFileSync(docPath, 'utf8');
    const prettierConfig = await prettier.resolveConfig(docPath);
    const nextContent = await prettier.format(generatedContent, {
      ...prettierConfig,
      filepath: docPath,
      parser: 'markdown',
    });

    if (currentContent !== nextContent) {
      changedFiles.push(relativePath);

      if (!check) {
        fs.writeFileSync(docPath, nextContent);

        if (!silent) {
          console.log(`Updated ${relativePath}`);
        }
      }
    }
  }

  if (!silent && check && changedFiles.length > 0) {
    console.error('API docs are out of date. Run `pnpm docs:api`.');
  }

  if (!silent && changedFiles.length === 0) {
    console.log('API docs are up to date.');
  }

  return {
    status:
      changedFiles.length === 0 ? 'up-to-date' : check ? 'stale' : 'updated',
    changedFiles: changedFiles.sort(),
  };
}

export function section(
  packageName: 'web' | 'native',
  heading: string,
  interfaceName: string,
  sourceFile: string
): ApiSection {
  const packageDirByName = {
    web: 'packages/react',
    native: 'packages/react-native',
  } satisfies Record<typeof packageName, string>;
  const packageDir = packageDirByName[packageName];

  return {
    docPath: `${packageDir}/API.md`,
    heading,
    id: `${packageName}.${interfaceName}.${heading.replace(/[#.\s]/g, '')}`,
    sourceFile: `${packageDir}/${sourceFile}`,
    interfaceName,
  };
}

function getDescription(
  propName: string,
  descriptions: Map<string, string>,
  item: ApiSection
) {
  const override = descriptionOverrides[item.id]?.[propName];

  if (override) {
    return override;
  }

  const existing = descriptions.get(propName);

  if (existing && existing !== '—') {
    return existing;
  }

  return fallbackDescriptions[propName] ?? '—';
}

function readInterfaceRows(
  item: ApiSection,
  context: ApiDocsContext
): PropRow[] {
  const sourceFile = context.sourceFileByName.get(
    normalizePath(path.join(context.rootDir, item.sourceFile))
  );

  if (!sourceFile) {
    throw new Error(`Cannot find source file for ${item.sourceFile}`);
  }

  const declaration = findTypeDeclaration(sourceFile, item.interfaceName);

  if (!declaration) {
    throw new Error(
      `Cannot find interface or type alias ${item.interfaceName} in ${item.sourceFile}`
    );
  }

  const type = context.checker.getTypeAtLocation(declaration.name);

  return readPropRows(type, context.checker);
}

function readPropRows(type: ts.Type, checker: ts.TypeChecker): PropRow[] {
  if (type.isUnion()) {
    return readUnionPropRows(type, checker);
  }

  return checker
    .getPropertiesOfType(type)
    .flatMap((property) => readSymbolPropRow(property, checker) ?? []);
}

function readUnionPropRows(type: ts.UnionType, checker: ts.TypeChecker) {
  const propertiesByName = new Map<
    string,
    {
      declarations: ts.Declaration[];
      optionalBranches: number;
      presentBranches: number;
      typeStrings: string[];
    }
  >();

  for (const branch of type.types) {
    const branchProperties = checker.getPropertiesOfType(branch);

    for (const property of branchProperties) {
      const declaration =
        property.valueDeclaration ?? property.declarations?.[0];

      if (!declaration || !isDocumentedPropDeclaration(declaration)) {
        continue;
      }

      const propertyType = checker.getTypeOfSymbolAtLocation(
        property,
        declaration
      );

      if (propertyType.flags & ts.TypeFlags.Never) {
        continue;
      }

      const entry = propertiesByName.get(property.name) ?? {
        declarations: [],
        optionalBranches: 0,
        presentBranches: 0,
        typeStrings: [],
      };
      const optional = (property.flags & ts.SymbolFlags.Optional) !== 0;
      const formattedType = formatType(
        propertyType,
        declaration,
        optional,
        checker
      );

      entry.declarations.push(declaration);
      entry.presentBranches += 1;

      if (optional) {
        entry.optionalBranches += 1;
      }

      if (!entry.typeStrings.includes(formattedType)) {
        entry.typeStrings.push(formattedType);
      }

      propertiesByName.set(property.name, entry);
    }
  }

  return Array.from(propertiesByName, ([name, entry]) => ({
    name,
    type: normalizeUnionTypeStrings(entry.typeStrings),
    required:
      entry.presentBranches === type.types.length &&
      entry.optionalBranches === 0,
    description: '',
  }));
}

function readSymbolPropRow(
  property: ts.Symbol,
  checker: ts.TypeChecker
): PropRow | null {
  const declaration = property.valueDeclaration ?? property.declarations?.[0];

  if (!declaration || !isDocumentedPropDeclaration(declaration)) {
    return null;
  }

  const propertyType = checker.getTypeOfSymbolAtLocation(property, declaration);
  const optional = (property.flags & ts.SymbolFlags.Optional) !== 0;

  return {
    name: property.name,
    type: formatType(propertyType, declaration, optional, checker),
    required: !optional,
    description: '',
  };
}

function normalizeUnionTypeStrings(types: string[]) {
  if (types.length === 1) {
    return types[0];
  }

  return types
    .flatMap((type) => type.split(' | '))
    .filter((type) => type !== 'undefined')
    .filter((type, index, allTypes) => allTypes.indexOf(type) === index)
    .join(' | ');
}

function findTypeDeclaration(sourceFile: ts.SourceFile, interfaceName: string) {
  let result: ts.InterfaceDeclaration | ts.TypeAliasDeclaration | undefined;

  const visit = (node: ts.Node) => {
    if (
      (ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)) &&
      node.name.text === interfaceName
    ) {
      result = node;
      return;
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);

  return result;
}

function formatType(
  type: ts.Type,
  declaration: ts.Declaration,
  optional: boolean,
  checker: ts.TypeChecker
) {
  const formatted = checker.typeToString(
    type,
    declaration,
    ts.TypeFormatFlags.NoTruncation |
      ts.TypeFormatFlags.UseSingleQuotesForStringLiteralType
  );

  return normalizeType(optional ? removeUndefined(formatted) : formatted);
}

function removeUndefined(type: string) {
  return type.replace(/ \| undefined/g, '').replace(/undefined \| /g, '');
}

function isDocumentedPropDeclaration(declaration: ts.Declaration) {
  const fileName = normalizePath(declaration.getSourceFile().fileName);

  return (
    fileName.includes('/packages/react/') ||
    fileName.includes('/packages/react-native/') ||
    fileName.includes('/packages/types/') ||
    fileName.includes('/node_modules/@vellira-ui/types/')
  );
}

function sortRows(rows: PropRow[], descriptions: Map<string, string>) {
  const existingOrder = new Map(
    Array.from(descriptions.keys()).map((name, index) => [name, index])
  );

  return rows.toSorted((a, b) => {
    const aIndex = existingOrder.get(a.name) ?? Number.MAX_SAFE_INTEGER;
    const bIndex = existingOrder.get(b.name) ?? Number.MAX_SAFE_INTEGER;

    if (aIndex !== bIndex) {
      return aIndex - bIndex;
    }

    return rows.indexOf(a) - rows.indexOf(b);
  });
}

function normalizeType(type: string) {
  const normalized = type
    .replace(/import\(["'][^"']*\/@types\/react\/index["']\)\./g, '')
    .replace(/import\(["'][^"']*\/@types\+react@[^"']*\/index["']\)\./g, '')
    .replace(/import\("react"\)\./g, '')
    .replace(/import\("react-native"\)\./g, '')
    .replace(/\bBaseSelectOption\[\]/g, 'SelectOption[]')
    .replace(/Readonly<(.+)>/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();

  if (
    (normalized.startsWith('((') || normalized.startsWith('(()')) &&
    normalized.endsWith(')')
  ) {
    return normalized.slice(1, -1);
  }

  return normalized;
}

function readExistingDescriptions(doc: string, item: ApiSection) {
  const descriptions = new Map<string, string>();
  const block = findTableBlock(doc, item);

  if (!block) {
    return descriptions;
  }

  const rows = block.table
    .split('\n')
    .filter((line) => line.trim().startsWith('|'))
    .slice(2);

  for (const row of rows) {
    const cells = splitMarkdownRow(row);
    const prop = cells[0]?.replace(/`/g, '').trim();
    const description = cells[3]?.trim();

    if (prop && description) {
      descriptions.set(prop, description);
    }
  }

  return descriptions;
}

function replaceGeneratedTable(doc: string, item: ApiSection, table: string) {
  const startMarker = `<!-- api-docgen:start ${item.id} -->`;
  const endMarker = `<!-- api-docgen:end ${item.id} -->`;
  const generatedBlock = `${startMarker}\n${table}\n${endMarker}`;
  const markedBlock = new RegExp(
    `${escapeRegExp(startMarker)}[\\s\\S]*?${escapeRegExp(endMarker)}`
  );

  if (markedBlock.test(doc)) {
    return doc.replace(markedBlock, generatedBlock);
  }

  const block = findTableBlock(doc, item);

  if (!block) {
    throw new Error(
      `Cannot find props table after ${item.heading} in ${item.docPath}`
    );
  }

  return `${doc.slice(0, block.start)}${generatedBlock}${doc.slice(block.end)}`;
}

function findTableBlock(doc: string, item: ApiSection) {
  const headingIndex = doc.indexOf(item.heading);

  if (headingIndex === -1) {
    throw new Error(`Cannot find heading ${item.heading} in ${item.docPath}`);
  }

  const nextHeadingIndex = findNextHeadingIndex(
    doc,
    headingIndex + item.heading.length
  );
  const searchEnd = nextHeadingIndex === -1 ? doc.length : nextHeadingIndex;
  const sectionBody = doc.slice(headingIndex, searchEnd);
  const tableMatch =
    /\n\|\s*Prop\s*\|\s*Type\s*\|\s*Required\s*\|\s*Description\s*\|\n\|[-\s|:]+\|\n(?:\|.*\|\n?)+/.exec(
      sectionBody
    );

  if (!tableMatch || tableMatch.index === undefined) {
    return undefined;
  }

  const start = headingIndex + tableMatch.index + 1;
  const table = tableMatch[0].trimEnd();

  return {
    start,
    end: start + table.length,
    table,
  };
}

function findNextHeadingIndex(doc: string, fromIndex: number) {
  const match = /\n#{1,3}\s/.exec(doc.slice(fromIndex));
  return match?.index === undefined ? -1 : fromIndex + match.index;
}

function renderPropsTable(rows: PropRow[]) {
  const header = ['Prop', 'Type', 'Required', 'Description'];
  const body = rows.map((row) => [
    `\`${row.name}\``,
    `\`${escapeTableCell(row.type)}\``,
    row.required ? 'Yes' : 'No',
    escapeTableCell(row.description),
  ]);
  const tableRows = [header, ...body];
  const widths = header.map((_, index) =>
    Math.max(...tableRows.map((row) => (row[index] ?? '').length))
  );

  const renderRow = (row: string[]) =>
    `| ${row.map((cell, index) => cell.padEnd(widths[index])).join(' | ')} |`;
  const separator = `| ${widths.map((width) => '-'.repeat(width)).join(' | ')} |`;

  return [renderRow(header), separator, ...body.map(renderRow)].join('\n');
}

function splitMarkdownRow(row: string) {
  const cells: string[] = [];
  let current = '';
  let escaped = false;

  for (const char of row.trim().slice(1, -1)) {
    if (char === '|' && !escaped) {
      cells.push(current.trim());
      current = '';
      continue;
    }

    current += char;
    escaped = char === '\\' && !escaped;
  }

  cells.push(current.trim());

  return cells;
}

function escapeTableCell(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/\|/g, '\\|');
}

function normalizePath(filePath: string) {
  return path.resolve(filePath).split(path.sep).join('/');
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const isCli =
  process.argv[1] &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isCli) {
  const result = await generateApiDocs({
    rootDir: process.cwd(),
    check: process.argv.includes('--check'),
  });

  if (result.status === 'stale') {
    process.exit(1);
  }
}
