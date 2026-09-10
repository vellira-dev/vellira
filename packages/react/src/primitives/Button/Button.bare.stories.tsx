import type { Meta, StoryObj } from '@storybook/react-vite';

import { Button } from './Button';

const meta = {
  title: 'Primitives/Button/Bare composition',
  component: Button,
  parameters: {
    docs: {
      description: {
        component:
          'The web-only `bare` appearance keeps Button behavior and accessibility while leaving chrome and geometry to the surrounding composition.',
      },
    },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ToolbarAction: Story = {
  args: {
    appearance: 'bare',
    children: 'Filter articles',
    'aria-pressed': false,
  },
  render: (args) => (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        minHeight: 40,
        paddingInline: 12,
        borderBottom: '2px solid currentColor',
      }}
    >
      <Button {...args} />
    </div>
  ),
};
