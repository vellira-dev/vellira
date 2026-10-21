import type { Meta, StoryObj } from '@storybook/react-vite';

import { Avatar } from './Avatar';

const meta: Meta<typeof Avatar> = {
  title: 'Primitives/Avatar',
  component: Avatar,
  tags: ['autodocs'],
};

export default meta;

type Story = StoryObj<typeof Avatar>;

export const Default: Story = {
  args: {
    fallback: 'JD',
    name: 'Jordan Diaz',
    size: 'md',
  },
};

export const Large: Story = {
  args: {
    fallback: 'JD',
    name: 'Jordan Diaz',
    size: 'lg',
  },
};
