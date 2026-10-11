import type { Meta, StoryObj } from '@storybook/react-vite';
import { DocsVellira } from '@vellira-ui/icons';

const meta = {
  title: 'Product assets/Vellira',
  component: DocsVellira,
  parameters: {
    docs: {
      description: {
        component:
          'Vellira-owned documentation mark. Product artwork is separate from the ordinary UI icon vocabulary and third-party branding.',
      },
    },
  },
} satisfies Meta<typeof DocsVellira>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Documentation: Story = {
  args: { size: 48, 'aria-label': 'Vellira documentation' },
};
