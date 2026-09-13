import type { Meta, StoryObj } from '@storybook/react-vite';

import { Switch } from './Switch';

const meta: Meta<typeof Switch> = {
  title: 'Primitives/Switch',
  component: Switch,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component: `
### Switch Component

Use Switch as a Vellira form control component with the states declared by its canonical component capabilities.

**Generated coverage**
- Controlled
- Uncontrolled
- Disabled
- Required
- Invalid

The examples below are deterministic generator output and can be extended with component-specific stories when deeper behavior needs dedicated evidence.
`,
      },
    },
  },
};

export default meta;

type Story = StoryObj<typeof Switch>;

export const Default: Story = {
  args: {
    defaultChecked: false,
  },
};

export const Checked: Story = {
  args: {
    checked: true,
  },
};

export const Controlled: Story = {
  args: {
    checked: true,
    onCheckedChange: () => undefined,
  },
};

export const Uncontrolled: Story = {
  args: {
    defaultChecked: true,
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
  },
};

export const Required: Story = {
  args: {
    required: true,
  },
};

export const Invalid: Story = {
  args: {
    invalid: true,
  },
};
