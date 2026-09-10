import type { Meta, StoryObj } from '@storybook/react-vite';

import { Input } from './Input';

const meta = {
  title: 'Primitives/Input/Bare composition',
  component: Input,
  parameters: {
    docs: {
      description: {
        component:
          'The web-only `bare` variant keeps Input behavior, search affordance, clear action, and accessibility while removing field chrome for composed surfaces.',
      },
    },
  },
} satisfies Meta<typeof Input>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SearchToolbar: Story = {
  args: {
    type: 'search',
    variant: 'bare',
    value: 'design systems',
    clearable: true,
    'aria-label': 'Search articles',
  },
  render: (args) => (
    <div style={{ width: 520, maxWidth: '100%' }}>
      <Input {...args} />
    </div>
  ),
};
