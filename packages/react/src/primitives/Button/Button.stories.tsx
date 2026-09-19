import { useState } from 'react';

import type { Meta, StoryObj } from '@storybook/react-vite';
import { Download, Filter, Save, Search } from '@vellira-ui/icons';
import { animatedIcons } from '@vellira-ui/icons/lottie';
import type { CSSProperties, ReactNode } from 'react';
const noop = () => undefined;

import { AnimatedIconPreview } from '../../../../icons/src/storybook/AnimatedIconPreview';
import { Button } from '../Button';

const meta = {
  title: 'Primitives/Button',
  component: Button,
  tags: ['autodocs'],
  parameters: {
    controls: {
      exclude: ['children'],
    },
    docs: {
      description: {
        // language=Markdown
        component: `
### Button Component

Clickable action primitive for web interfaces.

**Features**
- Colors: primary, neutral, success, warning, and danger
- Appearances: solid, outline, ghost, soft, link, and bare
- Shapes: square, rounded, and pill
- Sizes: sm, md, and lg
- Disabled, loading, icon-only, and full-width states
- Start and end icon support
- Badge, shortcut, tooltip, spinner, and anchor rendering support

### Accessibility

Use a clear text label whenever possible. For icon-only buttons, provide an accessible label so screen readers can announce the action.

Correct usage:

\`\`\`tsx
<Button color='primary' onClick={handleSave}>
  Save changes
</Button>

<Button aria-label='Search' iconStart={<Search />} />
\`\`\`
`,
      },
    },
  },
  args: {
    children: 'Button',
    color: 'primary',
    appearance: 'solid',
    size: 'md',
    disabled: false,
    loading: false,
    fullWidth: false,
    onClick: noop,
  },
  argTypes: {
    color: {
      description: 'Button color.',
      control: 'select',
      options: ['primary', 'neutral', 'success', 'warning', 'danger'],
      table: {
        type: {
          summary: `'primary' | 'neutral' | 'success' | 'warning' | 'danger'`,
        },
        defaultValue: { summary: 'primary' },
      },
    },
    appearance: {
      description: 'Button visual appearance.',
      control: 'select',
      options: ['solid', 'outline', 'ghost', 'soft', 'link', 'bare'],
      table: {
        type: {
          summary: `'solid' | 'outline' | 'ghost' | 'soft' | 'link' | 'bare'`,
        },
        defaultValue: { summary: 'solid' },
      },
    },
    shape: {
      description: 'Button corner shape.',
      control: 'radio',
      options: ['square', 'rounded', 'pill'],
      table: {
        type: { summary: `'square' | 'rounded' | 'pill'` },
        defaultValue: { summary: 'pill' },
      },
    },
    size: {
      description: 'Button size.',
      control: 'radio',
      options: ['sm', 'md', 'lg'],
      table: {
        type: { summary: `'sm' | 'md' | 'lg'` },
        defaultValue: { summary: 'md' },
      },
    },
    type: {
      description: 'Native button type.',
      control: 'select',
      options: ['button', 'submit', 'reset'],
      table: {
        type: { summary: `'button' | 'submit' | 'reset'` },
        defaultValue: { summary: 'button' },
      },
    },
    disabled: {
      description: 'Disables user interaction and applies disabled styling.',
      control: 'boolean',
      table: {
        type: { summary: 'boolean' },
        defaultValue: { summary: 'false' },
      },
    },
    loading: {
      description: 'Shows a loading spinner and disables interaction.',
      control: 'boolean',
      table: {
        type: { summary: 'boolean' },
        defaultValue: { summary: 'false' },
      },
    },
    loadingText: {
      description: 'Optional text shown while loading.',
      control: 'text',
      table: {
        type: { summary: 'string' },
      },
    },
    fullWidth: {
      description: 'Makes the button fill the width of its parent container.',
      control: 'boolean',
      table: {
        type: { summary: 'boolean' },
        defaultValue: { summary: 'false' },
      },
    },
    iconOnly: {
      description: 'Renders the button as an icon-only action.',
      control: 'boolean',
      table: {
        type: { summary: 'boolean' },
        defaultValue: { summary: 'false' },
      },
    },
    children: {
      description: 'Visible button content.',
      control: 'text',
      table: {
        disable: true,
      },
    },
    onClick: {
      description: 'Click event handler.',
      action: 'clicked',
      table: {
        type: { summary: 'MouseEventHandler<HTMLButtonElement>' },
      },
    },
    iconStart: {
      description: 'Icon rendered before the button content.',
      control: false,
      table: {
        type: { summary: 'ReactNode' },
      },
    },
    iconEnd: {
      description: 'Icon rendered after the button content.',
      control: false,
      table: {
        type: { summary: 'ReactNode' },
      },
    },
    className: {
      control: false,
      table: {
        disable: true,
      },
    },
    id: {
      control: false,
    },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

const stackStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
  alignItems: 'flex-start',
} as const;

const subtitleStyle = {
  margin: 0,
  color: 'var(--text-secondary)',
  fontSize: 13,
  fontWeight: 600,
} satisfies CSSProperties;

const rowStyle = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 12,
  alignItems: 'center',
} as const;

const animatedIconGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(96px, 1fr))',
  gap: 8,
  width: '100%',
  maxWidth: 520,
} satisfies CSSProperties;

const animatedIconTileStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  minHeight: 40,
  padding: '8px 10px',
  border: '1px solid var(--border-muted)',
  borderRadius: 'var(--radius-md)',
  color: 'var(--text-primary)',
  background: 'var(--surface-primary)',
  fontSize: 13,
} satisfies CSSProperties;

const sectionStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
  minWidth: 0,
  padding: 20,
  maxWidth: 760,
  border: '1px solid var(--border-muted)',
  borderRadius: 'var(--radius-xl)',
  background: 'var(--surface-subtle)',
} satisfies CSSProperties;

const panelStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  padding: 16,
  border: '1px solid var(--border-muted)',
  borderRadius: 'var(--radius-md)',
  background: 'var(--surface-default)',
} satisfies CSSProperties;

const panelTextStyle = {
  margin: 0,
  color: 'var(--text-secondary)',
  fontSize: 14,
  lineHeight: 1.5,
} satisfies CSSProperties;

const buttonGroupStyle = {
  display: 'inline-flex',
  flexWrap: 'wrap',
  gap: 8,
  alignItems: 'center',
} satisfies CSSProperties;

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
    <section
      style={{
        ...sectionStyle,
        ...style,
      }}
    >
      <h3 style={subtitleStyle}>{title}</h3>
      {children}
    </section>
  );
}

function DestructiveConfirmationDemo() {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = () => {
    setDeleting(true);
    window.setTimeout(() => {
      setDeleting(false);
      setConfirming(false);
    }, 900);
  };

  return (
    <div style={stackStyle}>
      <Button
        appearance='soft'
        color='danger'
        onClick={() => setConfirming(true)}
      >
        Delete workspace
      </Button>

      {confirming && (
        <div aria-live='polite' role='group' style={panelStyle}>
          <p style={panelTextStyle}>
            This action removes workspace settings and cannot be undone.
          </p>
          <div style={rowStyle}>
            <Button
              appearance='ghost'
              color='neutral'
              disabled={deleting}
              onClick={() => setConfirming(false)}
            >
              Cancel
            </Button>
            <Button
              color='danger'
              loading={deleting}
              loadingText='Deleting...'
              onClick={handleDelete}
            >
              Delete
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export const Basic: Story = {
  args: {
    children: 'Download',
    color: 'primary',
    appearance: 'solid',
    size: 'md',
    'aria-label': 'Download',
    iconStart: <Download />,
  },
  render: (args) => (
    <Section title='Basic'>
      <div style={rowStyle}>
        <Button {...args}>Primary</Button>
      </div>
    </Section>
  ),
};

export const Colors: Story = {
  args: {
    appearance: 'solid',
    size: 'md',
  },
  render: (args) => (
    <Section title='Colors'>
      <div style={rowStyle}>
        <Button {...args} color='primary'>
          Primary
        </Button>
        <Button {...args} color='neutral'>
          Neutral
        </Button>
        <Button {...args} color='success'>
          Success
        </Button>
        <Button {...args} color='warning'>
          Warning
        </Button>
        <Button {...args} color='danger'>
          Danger
        </Button>
      </div>
    </Section>
  ),
};

export const Appearances: Story = {
  args: {
    color: 'primary',
    size: 'md',
  },
  render: (args) => (
    <Section title='Appearances'>
      <div style={rowStyle}>
        <Button {...args} appearance='solid'>
          Solid
        </Button>
        <Button {...args} appearance='outline'>
          Outline
        </Button>
        <Button {...args} appearance='ghost'>
          Ghost
        </Button>
        <Button {...args} appearance='soft'>
          Soft
        </Button>
        <Button {...args} appearance='link'>
          Link
        </Button>
      </div>
    </Section>
  ),
};

export const BareComposition: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'The web-only `bare` appearance keeps Button behavior and accessibility while leaving chrome and geometry to the surrounding composition.',
      },
    },
  },
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

export const Matrix: Story = {
  args: {
    size: 'md',
  },
  render: (args) => {
    const colors = [
      'primary',
      'neutral',
      'success',
      'warning',
      'danger',
    ] as const;

    const appearances = ['solid', 'outline', 'ghost', 'soft', 'link'] as const;

    return (
      <Section
        title='Matrix'
        style={{
          maxWidth: 820,
        }}
      >
        <div style={{ overflowX: 'auto' }}>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
            }}
          >
            {colors.map((color) => (
              <div
                key={color}
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(136px, 1fr))',
                  gap: 12,
                  alignItems: 'center',
                  width: '100%',
                }}
              >
                {appearances.map((appearance) => (
                  <Button
                    key={`${color}-${appearance}`}
                    {...args}
                    color={color}
                    appearance={appearance}
                    fullWidth
                  >
                    {color} {appearance}
                  </Button>
                ))}
              </div>
            ))}
          </div>
        </div>
      </Section>
    );
  },
};

export const Sizes: Story = {
  args: {
    color: 'primary',
    appearance: 'solid',
  },
  render: (args) => (
    <Section title='Sizes'>
      <div style={rowStyle}>
        <Button {...args} size='sm'>
          Small
        </Button>
        <Button {...args} size='md'>
          Medium
        </Button>
        <Button {...args} size='lg'>
          Large
        </Button>
      </div>
    </Section>
  ),
};

export const Shapes: Story = {
  args: {
    appearance: 'solid',
    color: 'primary',
    size: 'md',
  },
  render: (args) => (
    <Section title='Shapes'>
      <div style={rowStyle}>
        <Button {...args} shape='square'>
          Square
        </Button>
        <Button {...args} shape='rounded'>
          Rounded
        </Button>
        <Button {...args} shape='pill'>
          Pill
        </Button>
      </div>
    </Section>
  ),
};

export const WithIcons: Story = {
  args: {
    color: 'primary',
    appearance: 'solid',
    size: 'md',
  },
  render: (args) => (
    <Section title='WithIcons'>
      <div style={stackStyle}>
        <div style={rowStyle}>
          <Button {...args} iconStart={<Download />}>
            Left icon
          </Button>
          <Button {...args} iconEnd={<Download />}>
            End icon
          </Button>
          <Button {...args} iconStart={<Save />} iconEnd={<Download />}>
            Both icons
          </Button>
          <Button
            {...args}
            iconStart={<AnimatedIconPreview data={animatedIcons.Download} />}
          >
            Animated
          </Button>
          <Button
            {...args}
            appearance='soft'
            iconStart={<AnimatedIconPreview data={animatedIcons.Search} />}
          >
            Search
          </Button>
        </div>
        <div style={animatedIconGridStyle}>
          {(
            [
              ['Search', animatedIcons.Search],
              ['Download', animatedIcons.Download],
              ['Bell', animatedIcons.Bell],
              ['Settings', animatedIcons.Settings],
            ] as const
          ).map(([label, icon]) => (
            <span
              key={label}
              data-animated-icon-trigger=''
              style={animatedIconTileStyle}
            >
              <AnimatedIconPreview data={icon} size={18} />
              {label}
            </span>
          ))}
        </div>
      </div>
    </Section>
  ),
};

export const Command: Story = {
  args: {
    appearance: 'soft',
    color: 'neutral',
    size: 'md',
  },
  render: (args) => (
    <Section title='Command'>
      <div style={rowStyle}>
        <Button
          {...args}
          badge='4'
          iconStart={<Search />}
          shortcut='⌘K'
          tooltip='Open command menu'
        >
          Command menu
        </Button>
        <Button {...args} color='danger' iconStart={<Filter />} shortcut='⌘⌫'>
          Clear filters
        </Button>
      </div>
    </Section>
  ),
};

export const DestructiveConfirmation: Story = {
  render: () => (
    <Section title='DestructiveConfirmation'>
      <DestructiveConfirmationDemo />
    </Section>
  ),
};

export const ToolbarButtonGroup: Story = {
  render: () => (
    <Section title='ToolbarButtonGroup'>
      <div style={stackStyle}>
        <div
          aria-label='Editor toolbar'
          role='toolbar'
          style={buttonGroupStyle}
        >
          <Button
            aria-label='Save'
            appearance='ghost'
            color='neutral'
            iconOnly
            iconStart={<Save />}
          />
          <Button
            appearance='ghost'
            color='neutral'
            iconStart={<Search />}
            shortcut='⌘K'
          >
            Search
          </Button>
          <Button appearance='ghost' color='neutral' iconStart={<Filter />}>
            Filter
          </Button>
          <Button appearance='soft' color='danger'>
            Delete
          </Button>
        </div>

        <div aria-label='View mode' role='group' style={buttonGroupStyle}>
          <Button appearance='solid' color='primary' shape='rounded'>
            Preview
          </Button>
          <Button appearance='outline' color='neutral' shape='rounded'>
            Code
          </Button>
          <Button appearance='outline' color='neutral' shape='rounded'>
            Diff
          </Button>
        </div>
      </div>
    </Section>
  ),
};

export const LinkButton: Story = {
  args: {
    appearance: 'link',
    color: 'primary',
    size: 'md',
  },
  render: (args) => (
    <Section title='LinkButton'>
      <div style={rowStyle}>
        <Button {...args} href='https://docs.vellira.dev' target='_blank'>
          Open docs
        </Button>
        <Button {...args} appearance='outline' href='/download' download>
          Download
        </Button>
      </div>
    </Section>
  ),
};

export const IconOnly: Story = {
  argTypes: {
    children: { table: { disable: true } },
  },
  args: {
    color: 'primary',
    appearance: 'solid',
    size: 'md',
    iconOnly: true,
    'aria-label': 'Filter',
  },
  render: (args) => (
    <Section title='IconOnly'>
      <div style={rowStyle}>
        <Button {...args} iconStart={<Filter />}>
          Filter
        </Button>
      </div>
    </Section>
  ),
};

export const Loading: Story = {
  args: {
    color: 'primary',
    appearance: 'solid',
    size: 'md',
  },
  render: (args) => (
    <Section title='Loading'>
      <div style={rowStyle}>
        <Button {...args} loading>
          Saving
        </Button>
        <Button {...args} loading loadingText='Saving...'>
          Save
        </Button>
        <Button {...args} loadingText='Publishing...'>
          Publish
        </Button>
        <Button {...args} loading loadingText='Publishing...'>
          Publish
        </Button>
        <Button {...args} loading iconStart={<Save />}>
          Uploading
        </Button>
      </div>
    </Section>
  ),
};

export const Disabled: Story = {
  args: {
    color: 'primary',
    appearance: 'solid',
    size: 'md',
    disabled: true,
    children: 'Disabled',
  },
  render: (args) => (
    <Section title='Disabled'>
      <div style={rowStyle}>
        <Button {...args}>Disabled</Button>
      </div>
    </Section>
  ),
};

export const FullWidth: Story = {
  args: {
    color: 'primary',
    appearance: 'solid',
    size: 'md',
  },
  render: (args) => (
    <Section title='FullWidth'>
      <div style={rowStyle}>
        <Button {...args} fullWidth>
          Full width
        </Button>
      </div>
    </Section>
  ),
};

export const ButtonTypes: Story = {
  args: {
    color: 'primary',
    appearance: 'solid',
    size: 'md',
  },
  render: (args) => (
    <Section title='ButtonTypes'>
      <div style={rowStyle}>
        <Button {...args} type='button'>
          Button
        </Button>
        <Button {...args} type='submit'>
          Submit
        </Button>
        <Button {...args} type='reset'>
          Reset
        </Button>
      </div>
    </Section>
  ),
};

export const AccessibleIconActions: Story = {
  render: () => (
    <Section title='AccessibleIconActions'>
      <div style={rowStyle}>
        <Button
          aria-label='Search'
          color='primary'
          iconOnly
          iconStart={<Search />}
          appearance='ghost'
        />
        <Button
          aria-label='Filter results'
          color='neutral'
          iconOnly
          iconStart={<Filter />}
          appearance='outline'
        />
        <Button
          aria-label='Save'
          color='primary'
          iconOnly
          iconStart={<Save />}
          appearance='solid'
        />
      </div>
    </Section>
  ),
};
