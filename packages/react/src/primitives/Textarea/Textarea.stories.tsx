import type { Meta, StoryObj } from '@storybook/react-vite';

import { Textarea } from './Textarea';

const meta: Meta<typeof Textarea> = {
  title: 'Primitives/Textarea',
  component: Textarea,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component: `
### Textarea Component

Use Textarea as a Vellira form control component with the states declared by its canonical component capabilities.

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

type Story = StoryObj<typeof Textarea>;

export const Default: Story = {
  args: {
    defaultValue: 'Example value',
  },
};

export const Controlled: Story = {
  args: {
    value: 'Controlled value',
    onValueChange: () => undefined,
  },
};

export const Uncontrolled: Story = {
  args: {
    defaultValue: 'Default value',
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
