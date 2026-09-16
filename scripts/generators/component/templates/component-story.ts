import type { ComponentCapability } from '@vellira-ui/metadata';

import {
  deriveComponentPresentationScenarios,
  getComponentPresentationScenarioTitle,
} from '../../component-presentation';
import {
  assertGeneratedNativeTextHostSafety,
  NATIVE_TEXT_IMPORT,
  renderGeneratedNativeText,
} from '../../native-text-host';
import type { ComponentProfileArg, FormControlKindArg } from '../cli';

export type StoryTemplateParams = {
  componentName: string;
  layer: string;
  isNative: boolean;
  profile?: ComponentProfileArg;
  control?: FormControlKindArg;
  capabilities?: readonly ComponentCapability[];
  parts?: readonly string[];
};

function renderCompoundChildren(params: {
  componentName: string;
  parts: readonly string[];
  isNative: boolean;
  count?: number;
  rich?: boolean;
}) {
  const { componentName, parts, isNative, count = 1, rich = false } = params;

  if (!parts.includes('Item') || !parts.includes('Trigger')) {
    return undefined;
  }

  const items = Array.from({ length: count }, (_, index) => {
    const itemNumber = index + 1;
    const triggerLabel =
      count > 1 ? `Example section ${itemNumber}` : 'Example section';
    const contentLabel = rich
      ? 'A longer production-style example with supporting details and useful content.'
      : count > 1
        ? `Example content ${itemNumber}`
        : 'Example content';
    const triggerText = isNative
      ? renderGeneratedNativeText(triggerLabel, 'view-like')
      : triggerLabel;
    const contentText = isNative
      ? renderGeneratedNativeText(contentLabel, 'view-like')
      : contentLabel;

    return `<${componentName}.Item value='item-${itemNumber}'>
  <${componentName}.Trigger>${triggerText}</${componentName}.Trigger>
  ${
    parts.includes('Content')
      ? `<${componentName}.Content>${contentText}</${componentName}.Content>`
      : contentText
  }
</${componentName}.Item>`;
  });

  const source = items.join('\n');

  if (isNative) {
    assertGeneratedNativeTextHostSafety({
      componentName,
      surface: 'Storybook generated native compound children',
      source,
    });
  }

  return source;
}

function renderCompoundStories(params: {
  componentName: string;
  capabilities: readonly ComponentCapability[];
  parts: readonly string[];
  isNative: boolean;
}) {
  const { componentName, capabilities, parts, isNative } = params;
  const scenarios = new Set(
    deriveComponentPresentationScenarios({
      profile: 'compound',
      capabilities,
    })
  );
  const children = renderCompoundChildren({
    componentName,
    parts,
    isNative,
  });

  if (!children) {
    return '';
  }

  const stories: string[] = [];
  const singleTypeArg = scenarios.has('multiple')
    ? "    type: 'single',\n"
    : '';

  if (scenarios.has('multiple')) {
    const multipleChildren = renderCompoundChildren({
      componentName,
      parts,
      isNative,
      count: 2,
    });

    stories.push(`export const Multiple: Story = {
  args: {
    type: 'multiple',
    defaultValue: ['item-1', 'item-2'],
    children: (
      ${multipleChildren}
    ),
  },
};`);
  }

  if (scenarios.has('controlled')) {
    stories.push(`export const Controlled: Story = {
  args: {
${singleTypeArg}    value: 'item-1',
    onValueChange: () => undefined,
    children: (
      ${children}
    ),
  },
};`);
  }

  if (scenarios.has('uncontrolled')) {
    stories.push(`export const Uncontrolled: Story = {
  args: {
${singleTypeArg}    defaultValue: 'item-1',
    children: (
      ${children}
    ),
  },
};`);
  }

  if (scenarios.has('collapsible')) {
    stories.push(`export const Collapsible: Story = {
  args: {
${singleTypeArg}    collapsible: true,
    defaultValue: 'item-1',
    children: (
      ${children}
    ),
  },
};`);
  }

  if (scenarios.has('disabled')) {
    stories.push(`export const Disabled: Story = {
  args: {
${singleTypeArg}    disabled: true,
    children: (
      ${children}
    ),
  },
};`);
  }

  if (scenarios.has('rich-content')) {
    const richChildren = renderCompoundChildren({
      componentName,
      parts,
      isNative,
      rich: true,
    });

    stories.push(`export const RichContent: Story = {
  args: {
${singleTypeArg}    children: (
      ${richChildren}
    ),
  },
};`);
  }

  return stories.length > 0 ? `\n${stories.join('\n\n')}\n` : '';
}

function renderFormControlStories(params: {
  control: FormControlKindArg;
  capabilities: readonly ComponentCapability[];
}) {
  const scenarios = new Set(
    deriveComponentPresentationScenarios({
      profile: 'form-control',
      capabilities: params.capabilities,
    })
  );
  const stories: string[] = [];
  const booleanControl = params.control === 'boolean';

  if (booleanControl) {
    stories.push(`export const Checked: Story = {
  args: {
    checked: true,
  },
};`);
  }

  if (scenarios.has('controlled')) {
    stories.push(
      booleanControl
        ? `export const Controlled: Story = {
  args: {
    checked: true,
    onCheckedChange: () => undefined,
  },
};`
        : `export const Controlled: Story = {
  args: {
    value: 'Controlled value',
    onValueChange: () => undefined,
  },
};`
    );
  }

  if (scenarios.has('uncontrolled')) {
    stories.push(
      booleanControl
        ? `export const Uncontrolled: Story = {
  args: {
    defaultChecked: true,
  },
};`
        : `export const Uncontrolled: Story = {
  args: {
    defaultValue: 'Default value',
  },
};`
    );
  }

  for (const [scenario, prop] of [
    ['disabled', 'disabled'],
    ['required', 'required'],
    ['invalid', 'invalid'],
    ['loading', 'loading'],
  ] as const) {
    if (!scenarios.has(scenario)) {
      continue;
    }

    stories.push(`export const ${getComponentPresentationScenarioTitle(
      scenario
    )}: Story = {
  args: {
    ${prop}: true,
  },
};`);
  }

  return stories.length > 0 ? `\n${stories.join('\n\n')}\n` : '';
}

function renderOverlayStories(capabilities: readonly ComponentCapability[]) {
  const scenarios = new Set(
    deriveComponentPresentationScenarios({
      profile: 'overlay',
      capabilities,
    })
  );
  const stories: string[] = [];

  if (scenarios.has('controlled')) {
    stories.push(`export const Controlled: Story = {
  args: {
    open: true,
    onOpenChange: () => undefined,
  },
};`);
  }

  if (scenarios.has('uncontrolled')) {
    stories.push(`export const Uncontrolled: Story = {
  args: {
    defaultOpen: true,
  },
};`);
  }

  return stories.length > 0 ? `\n${stories.join('\n\n')}\n` : '';
}

function renderBaseStories(capabilities: readonly ComponentCapability[]) {
  const scenarios = new Set(
    deriveComponentPresentationScenarios({
      profile: 'base',
      capabilities,
    })
  );
  const stories: string[] = [];

  for (const [scenario, prop] of [
    ['disabled', 'disabled'],
    ['required', 'required'],
    ['invalid', 'invalid'],
    ['loading', 'loading'],
  ] as const) {
    if (!scenarios.has(scenario)) {
      continue;
    }

    stories.push(`export const ${getComponentPresentationScenarioTitle(
      scenario
    )}: Story = {
  args: {
    ${prop}: true,
  },
};`);
  }

  return stories.length > 0 ? `\n${stories.join('\n\n')}\n` : '';
}

export function renderStoryTemplate({
  componentName,
  layer,
  isNative,
  profile = 'base',
  control = 'value',
  capabilities = [],
  parts = [],
}: StoryTemplateParams) {
  const storybookPackage = isNative
    ? '@storybook/react-native'
    : '@storybook/react-vite';
  const title = `${layer[0].toUpperCase() + layer.slice(1)}/${componentName}`;
  const scenarios = deriveComponentPresentationScenarios({
    profile,
    capabilities,
  });
  const scenarioLabels = scenarios
    .slice(1)
    .map((scenario) => `- ${getComponentPresentationScenarioTitle(scenario)}`);
  const description = [
    `### ${componentName} Component`,
    '',
    `Use ${componentName} as a Vellira ${profile.replaceAll('-', ' ')} component with the states declared by its canonical component capabilities.`,
    '',
    '**Generated coverage**',
    ...(scenarioLabels.length > 0 ? scenarioLabels : ['- Basic usage']),
    '',
    'The examples below are deterministic generator output and can be extended with component-specific stories when deeper behavior needs dedicated evidence.',
  ].join('\n');

  const compoundChildren =
    profile === 'compound'
      ? renderCompoundChildren({
          componentName,
          parts,
          isNative,
        })
      : undefined;
  const defaultTextChild = isNative
    ? `(\n      ${renderGeneratedNativeText(
        'Example content',
        'view-like'
      )}\n    )`
    : "'Example content'";
  const hasMultiple = scenarios.includes('multiple');

  const defaultArgs =
    profile === 'compound'
      ? compoundChildren
        ? `{
${hasMultiple ? "    type: 'single',\n" : ''}    children: (
      ${compoundChildren}
    ),
  }`
        : `{
    children: ${defaultTextChild},
  }`
      : profile === 'form-control'
        ? control === 'boolean'
          ? `{
    defaultChecked: false,
  }`
          : `{
    defaultValue: 'Example value',
  }`
        : `{
    children: ${defaultTextChild},
  }`;

  const additionalStories =
    profile === 'compound'
      ? renderCompoundStories({
          componentName,
          capabilities,
          parts,
          isNative,
        })
      : profile === 'form-control'
        ? renderFormControlStories({ control, capabilities })
        : profile === 'overlay'
          ? renderOverlayStories(capabilities)
          : renderBaseStories(capabilities);

  const nativeTextImport =
    isNative && profile !== 'form-control' ? `${NATIVE_TEXT_IMPORT}\n` : '';

  return `import type { Meta, StoryObj } from '${storybookPackage}';
${nativeTextImport}
import { ${componentName} } from './${componentName}';

const meta: Meta<typeof ${componentName}> = {
  title: '${title}',
  component: ${componentName},
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component: \`
${description}
\`,
      },
    },
  },
};

export default meta;

type Story = StoryObj<typeof ${componentName}>;

export const Default: Story = {
  args: ${defaultArgs},
};
${additionalStories}`;
}
