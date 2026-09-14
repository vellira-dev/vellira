import { useEffect, useState } from 'react';

import type { Meta, StoryObj } from '@storybook/react-vite';
import { Search } from '@vellira-ui/icons';
import type { ComponentProps, CSSProperties, ReactNode } from 'react';

import { Tooltip } from './Tooltip';

import { Button } from '#primitives/Button';
import { Portal } from '#primitives/Portal';

const noop = () => undefined;

const placements = [
  'top',
  'top-start',
  'top-end',
  'right',
  'right-start',
  'right-end',
  'bottom',
  'bottom-start',
  'bottom-end',
  'left',
  'left-start',
  'left-end',
] as const;

const subtitleStyle = {
  margin: 0,
  color: 'var(--text-secondary)',
  fontSize: 13,
  fontWeight: 600,
} satisfies CSSProperties;

const sectionStyle = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  gap: 16,
  minWidth: 0,
  maxWidth: 760,
  padding: 20,
  border: '1px solid var(--border-muted)',
  borderRadius: 'var(--radius-xl)',
  background: 'var(--surface-subtle)',
} satisfies CSSProperties;

const matrixStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, max-content))',
  gap: 12,
  alignItems: 'start',
} satisfies CSSProperties;

const fieldGridStyle = {
  display: 'grid',
  gap: 12,
  justifyItems: 'start',
} satisfies CSSProperties;

const placementSectionStyle = {
  ...sectionStyle,
  width: '100%',
  maxWidth: 960,
} satisfies CSSProperties;

const meta = {
  title: 'Components/Tooltip',
  component: Tooltip,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        // language=Markdown
        component: `
### Tooltip Component

Short helper overlay attached to a trigger element.

**Features**
- Compound-first API with Trigger, Content, Arrow, and Provider parts
- Trigger composition through asChild
- Controlled and uncontrolled open state
- Placement: top, bottom, left, and right
- Hover, focus, pointer, and keyboard interactions
- Configurable delay and provider-level default delay
- Optional arrow, collision avoidance, trigger-width matching, and interactive
  content
- Disabled state and custom content styles

### Usage

Use Tooltip for short contextual help attached to a specific control. Keep the
content concise and do not place required workflow information only in a
tooltip.

\`\`\`tsx
<Tooltip delay={500} placement='top'>
  <Tooltip.Trigger asChild>
    <Button aria-label='Search' iconStart={<Search />} />
  </Tooltip.Trigger>

  <Portal>
    <Tooltip.Content withArrow>Search all projects</Tooltip.Content>
  </Portal>
</Tooltip>
\`\`\`

### Accessibility

- Opens on focus for keyboard users
- Trigger keeps its accessible name
- Content is connected to the trigger while open
- Disabled tooltips do not create inactive interactive surfaces
`,
      },
    },
  },
  args: {
    children: null,
    placement: 'top',
    delay: 300,
    disabled: false,
    interactive: false,
    avoidCollisions: true,
    matchTriggerWidth: false,
    defaultOpen: false,
    onOpenChange: noop,
  },
  argTypes: {
    children: {
      control: false,
      description: 'Compound tooltip children.',
      table: { type: { summary: 'ReactNode' } },
    },
    placement: {
      description: 'Tooltip position relative to the trigger.',
      control: 'select',
      options: placements,
      table: {
        type: {
          summary:
            "'top' | 'top-start' | 'top-end' | 'right' | 'right-start' | 'right-end' | 'bottom' | 'bottom-start' | 'bottom-end' | 'left' | 'left-start' | 'left-end'",
        },
        defaultValue: { summary: 'top' },
      },
    },
    delay: {
      description: 'Open delay in milliseconds, or open/close delay object.',
      control: 'number',
      table: {
        type: { summary: 'number | { open?: number; close?: number }' },
      },
    },
    defaultOpen: {
      description: 'Initial uncontrolled open state.',
      control: 'boolean',
      table: {
        type: { summary: 'boolean' },
        defaultValue: { summary: 'false' },
      },
    },
    open: {
      description: 'Controlled open state.',
      control: false,
      table: {
        type: { summary: 'boolean' },
      },
    },
    disabled: {
      description: 'Disables tooltip behavior.',
      control: 'boolean',
      table: {
        type: { summary: 'boolean' },
        defaultValue: { summary: 'false' },
      },
    },
    interactive: {
      description: 'Keeps pointer events available for interactive content.',
      control: 'boolean',
      table: {
        type: { summary: 'boolean' },
        defaultValue: { summary: 'false' },
      },
    },
    avoidCollisions: {
      description: 'Allows the tooltip to flip or shift to stay in viewport.',
      control: 'boolean',
      table: {
        type: { summary: 'boolean' },
        defaultValue: { summary: 'true' },
      },
    },
    matchTriggerWidth: {
      description: 'Matches tooltip content width to the trigger width.',
      control: 'boolean',
      table: {
        type: { summary: 'boolean' },
        defaultValue: { summary: 'false' },
      },
    },
    onOpenChange: {
      description: 'Called when tooltip open state changes.',
      action: 'open changed',
      table: {
        type: { summary: '(open: boolean) => void' },
      },
    },
  },
} satisfies Meta<typeof Tooltip>;

export default meta;
type Story = StoryObj<typeof meta>;

function Section({
  title,
  children,
  style,
}: {
  title: string;
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <section style={{ ...sectionStyle, ...style }}>
      <h3 style={subtitleStyle}>{title}</h3>
      {children}
    </section>
  );
}

function TooltipDemo({
  children,
  tooltipContent,
  withArrow = true,
  ...args
}: ComponentProps<typeof Tooltip> & {
  tooltipContent: ReactNode;
  withArrow?: boolean;
}) {
  return (
    <Tooltip {...args}>
      <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
      <Portal>
        <Tooltip.Content withArrow={withArrow}>
          {tooltipContent}
        </Tooltip.Content>
      </Portal>
    </Tooltip>
  );
}

function ControlledTooltip({
  defaultOpen,
  open,
  ...args
}: ComponentProps<typeof Tooltip>) {
  const [isOpen, setIsOpen] = useState(open ?? defaultOpen ?? false);

  useEffect(() => {
    setIsOpen(open ?? defaultOpen ?? false);
  }, [open, defaultOpen]);

  return (
    <Tooltip
      {...args}
      open={isOpen}
      onOpenChange={(nextOpen) => {
        setIsOpen(nextOpen);
        args.onOpenChange?.(nextOpen);
      }}
    >
      <Tooltip.Trigger asChild>
        <Button>{isOpen ? 'Tooltip open' : 'Tooltip closed'}</Button>
      </Tooltip.Trigger>
      <Portal>
        <Tooltip.Content withArrow>Controlled tooltip</Tooltip.Content>
      </Portal>
    </Tooltip>
  );
}

export const Default: Story = {
  render: (args) => (
    <Section title='Default'>
      <TooltipDemo {...args} tooltipContent='This is a tooltip'>
        <Button>Hover me</Button>
      </TooltipDemo>
    </Section>
  ),
};

export const Controlled: Story = {
  args: {
    defaultOpen: true,
  },
  render: (args) => (
    <Section title='Controlled'>
      <ControlledTooltip {...args} />
    </Section>
  ),
};

export const TriggerAsChild: Story = {
  render: (args) => (
    <Section title='asChild trigger'>
      <TooltipDemo {...args} tooltipContent='Composed with Button via asChild'>
        <Button color='neutral' appearance='outline'>
          asChild trigger
        </Button>
      </TooltipDemo>
    </Section>
  ),
};

export const Placement: Story = {
  render: () => (
    <Section title='Placement' style={placementSectionStyle}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(120px, 1fr))',
          gap: '48px',
          padding: '80px',
          placeItems: 'center',
          width: '100%',
        }}
      >
        {placements.map((placement) => (
          <TooltipDemo
            key={placement}
            tooltipContent={`${placement} tooltip`}
            placement={placement}
            delay={0}
          >
            <Button>{placement}</Button>
          </TooltipDemo>
        ))}
      </div>
    </Section>
  ),
};

export const LongContent: Story = {
  render: (args) => (
    <Section title='Long content'>
      <div style={fieldGridStyle}>
        <TooltipDemo
          {...args}
          tooltipContent='This is a very very very long tooltip content that will wrap to multiple lines automatically'
        >
          <Button>Hover for long text</Button>
        </TooltipDemo>
      </div>
    </Section>
  ),
};

export const Disabled: Story = {
  args: {
    disabled: true,
  },
  render: (args) => (
    <Section title='Disabled'>
      <TooltipDemo {...args} tooltipContent='This tooltip is disabled'>
        <Button disabled>Disabled Button</Button>
      </TooltipDemo>
    </Section>
  ),
};

export const CustomDelay: Story = {
  args: {
    delay: 500,
  },
  render: (args) => (
    <Section title='Custom delay'>
      <TooltipDemo {...args} tooltipContent='Appears after 500ms'>
        <Button>Slow Tooltip</Button>
      </TooltipDemo>
    </Section>
  ),
};

export const NoDelay: Story = {
  args: {
    delay: 0,
  },
  render: (args) => (
    <Section title='No delay'>
      <TooltipDemo {...args} tooltipContent='Appears instantly'>
        <Button>Instant Tooltip</Button>
      </TooltipDemo>
      <Button appearance='outline' color='neutral'>
        Next focus target
      </Button>
    </Section>
  ),
};

export const WithoutArrow: Story = {
  render: (args) => (
    <Section title='Without arrow'>
      <TooltipDemo
        {...args}
        tooltipContent='Tooltip without arrow'
        withArrow={false}
      >
        <Button>No arrow</Button>
      </TooltipDemo>
    </Section>
  ),
};

export const MatchTriggerWidth: Story = {
  args: {
    matchTriggerWidth: true,
    placement: 'bottom',
  },
  render: (args) => (
    <Section title='Match trigger width'>
      <Tooltip {...args}>
        <Tooltip.Trigger asChild>
          <Button style={{ width: 240 }}>Matched width trigger</Button>
        </Tooltip.Trigger>
        <Portal>
          <Tooltip.Content withArrow>Matches trigger width</Tooltip.Content>
        </Portal>
      </Tooltip>
    </Section>
  ),
};

export const RichContent: Story = {
  render: (args) => (
    <Section title='Rich content'>
      <div style={fieldGridStyle}>
        <TooltipDemo
          {...args}
          tooltipContent={
            <div>
              <strong>Rich content</strong>
              <p style={{ margin: 0 }}>Can contain any React node</p>
              <code>Even code blocks</code>
            </div>
          }
        >
          <Button>Rich Tooltip</Button>
        </TooltipDemo>
      </div>
    </Section>
  ),
};

export const Triggers: Story = {
  render: () => (
    <Section title='Triggers'>
      <div style={matrixStyle}>
        <TooltipDemo tooltipContent='Small button'>
          <Button size='sm'>Small</Button>
        </TooltipDemo>

        <TooltipDemo tooltipContent='Medium button'>
          <Button size='md'>Medium</Button>
        </TooltipDemo>

        <TooltipDemo tooltipContent='Large button'>
          <Button size='lg'>Large</Button>
        </TooltipDemo>

        <TooltipDemo tooltipContent='Icon only'>
          <Button aria-label='Search' iconStart={<Search />} />
        </TooltipDemo>
      </div>
    </Section>
  ),
};

export const ProviderDelay: Story = {
  render: () => (
    <Section title='Provider delay'>
      <Tooltip.Provider delay={700} skipDelay={300}>
        <TooltipDemo tooltipContent='Uses provider delay'>
          <Button>Provider delay</Button>
        </TooltipDemo>
      </Tooltip.Provider>
    </Section>
  ),
};

export const ForceMount: Story = {
  args: {
    open: false,
  },
  render: (args) => (
    <Section title='Force mount'>
      <Tooltip {...args}>
        <Tooltip.Trigger asChild>
          <Button>Force mounted</Button>
        </Tooltip.Trigger>
        <Portal>
          <Tooltip.Content forceMount withArrow>
            Mounted with closed state
          </Tooltip.Content>
        </Portal>
      </Tooltip>
    </Section>
  ),
};
