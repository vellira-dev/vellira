import { useState } from 'react';

import type { Meta, StoryObj } from '@storybook/react-vite';
import { Check, Search } from '@vellira-ui/icons';
import type { CSSProperties, ReactNode } from 'react';
const noop = () => undefined;

import { Input } from '../Input';

import type { InputProps } from './types';

import { FormField } from '#patterns/FormField';

const meta = {
  title: 'Primitives/Input',
  component: Input,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        // language=Markdown
        component: `
### Input Component

Labeled text input primitive for short form values.

**Features**
- Controlled and uncontrolled usage
- Label, description and placeholder support
- Colors: primary, neutral, success, warning and danger
- Variants: outline, filled, soft and bare
- Sizes: sm, md and lg
- Smart type handling for email, password, tel, url, number and search
- Icons, addons, prefix and suffix support
- Clearable, loading, password reveal, masks, formatting and counters
- Disabled, read-only, required, invalid and error states
`,
      },
    },
  },
  args: {
    label: 'Email',
    placeholder: 'name@company.com',
    type: 'email',
    size: 'md',
    disabled: false,
    required: false,
    readOnly: false,
    clearable: false,
    clearIconTone: 'default',
    onValueChange: noop,
  },
  argTypes: {
    id: { control: 'text' },
    name: { control: 'text' },
    label: { control: 'text' },
    description: { control: 'text' },
    value: { control: 'text' },
    defaultValue: { control: 'text' },
    placeholder: { control: 'text' },
    size: {
      control: 'radio',
      options: ['sm', 'md', 'lg'],
    },
    color: {
      control: 'select',
      options: ['primary', 'neutral', 'success', 'warning', 'danger'],
    },
    variant: {
      control: 'radio',
      options: ['outline', 'filled', 'soft', 'bare'],
      table: {
        type: { summary: `'outline' | 'filled' | 'soft' | 'bare'` },
      },
    },
    type: {
      control: 'select',
      options: ['text', 'email', 'password', 'number', 'tel', 'url', 'search'],
    },
    startIconTone: {
      control: 'select',
      options: [
        'default',
        'primary',
        'secondary',
        'success',
        'danger',
        'muted',
        'inverse',
      ],
    },
    endIconTone: {
      control: 'select',
      options: [
        'default',
        'primary',
        'secondary',
        'success',
        'danger',
        'muted',
        'inverse',
      ],
    },
    required: { control: 'boolean' },
    invalid: { control: 'boolean' },
    loading: { control: 'boolean' },
    disabled: { control: 'boolean' },
    readOnly: { control: 'boolean' },
    clearable: { control: 'boolean' },
    clearIconTone: {
      control: 'select',
      options: [
        'default',
        'primary',
        'secondary',
        'success',
        'danger',
        'muted',
        'inverse',
      ],
    },
    revealPassword: { control: 'boolean' },
    showCounter: { control: 'boolean' },
    error: { control: 'text' },
    mask: { control: 'text' },
    autoComplete: { control: 'text' },
    autoFocus: { control: 'boolean' },
    maxLength: { control: 'number' },
    onValueChange: { action: 'changed' },
    onClear: { action: 'cleared' },
    startIcon: { control: false },
    endIcon: { control: false },
    format: { control: false },
    parse: { control: false },
    className: { control: false },
    wrapperClassName: { control: false },
  },
} satisfies Meta<typeof Input>;

export default meta;

type Story = StoryObj<typeof meta>;

const fieldColumnStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  width: '100%',
} satisfies CSSProperties;

const matrixStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: 16,
  width: '100%',
} satisfies CSSProperties;

const sectionStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
  width: '100%',
  padding: 20,

  backgroundColor: 'var(--surface-subtle)',

  borderWidth: 1,
  borderStyle: 'solid',
  borderColor: 'var(--border-muted)',

  borderRadius: 'var(--radius-xl)',
} satisfies CSSProperties;

const subtitleStyle = {
  margin: 0,
  color: 'var(--text-secondary)',
  fontSize: 13,
  fontWeight: 600,
} satisfies CSSProperties;

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section style={sectionStyle}>
      <h3 style={subtitleStyle}>{title}</h3>
      {children}
    </section>
  );
}

const ControlledInputDemo = (args: InputProps) => {
  const [value, setValue] = useState(args.value ?? '');

  const handleValueChange = (nextValue: string) => {
    setValue(nextValue);
    args.onValueChange?.(nextValue);
  };

  return <Input {...args} value={value} onValueChange={handleValueChange} />;
};

const ClearableInputDemo = () => {
  const [value, setValue] = useState('Clear me');

  return (
    <Input
      label='Clearable input'
      value={value}
      onValueChange={setValue}
      clearable
      clearIconTone='default'
      onClear={() => setValue('')}
      placeholder='Type something'
    />
  );
};

const CounterInputDemo = () => {
  const [value, setValue] = useState(
    'Product designer focused on accessible systems, form UX, clear validation, and calm interfaces for fast-moving teams....'
  );

  return (
    <Input
      label='Bio'
      description='Short profile summary.'
      value={value}
      onValueChange={setValue}
      maxLength={200}
      showCounter
      placeholder='Write a short bio'
    />
  );
};

export const Basic: Story = {
  args: {
    label: 'Email',
    description: 'Smart autocomplete is derived from type="email".',
    placeholder: 'name@company.com',
    value: '',
    type: 'email',
  },
  render: (args) => (
    <Section title='Basic'>
      <ControlledInputDemo {...args} />
    </Section>
  ),
};

export const ShorthandAndComposed: Story = {
  render: () => (
    <Section title='Shorthand and composed'>
      <div style={fieldColumnStyle}>
        <Input
          label='Shorthand'
          description='Input renders FormField internally.'
          placeholder='name@company.com'
          type='email'
        />

        <FormField
          label='Composed'
          description='Input inherits id, aria, state, and size from FormField.'
          required
          size='sm'
        >
          <Input
            placeholder='name@company.com'
            type='email'
            clearable
            clearIconTone='default'
          />
        </FormField>
      </div>
    </Section>
  ),
};

export const BareComposition: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'The web-only `bare` variant keeps Input behavior, search affordance, clear action, and accessibility while removing field chrome for composed surfaces.',
      },
    },
  },
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

export const Uncontrolled: Story = {
  args: {
    label: 'Workspace',
    description: 'Uses defaultValue without controlled state.',
    defaultValue: 'vellira-design',
    placeholder: 'workspace-name',
    type: 'text',
  },
  render: (args) => (
    <Section title='Uncontrolled'>
      <Input {...args} />
    </Section>
  ),
};

export const Sizes: Story = {
  render: () => (
    <Section title='Sizes'>
      <div style={fieldColumnStyle}>
        <Input label='Small' size='sm' placeholder='Small input' />
        <Input label='Medium' size='md' placeholder='Medium input' />
        <Input label='Large' size='lg' placeholder='Large input' />
      </div>
    </Section>
  ),
};

export const FieldSizeInheritance: Story = {
  render: () => (
    <Section title='Field size inheritance'>
      <div style={fieldColumnStyle}>
        <FormField label='Inherited small' size='sm'>
          <Input placeholder='Input inherits sm' />
        </FormField>

        <FormField label='Inherited large' size='lg'>
          <Input placeholder='Input inherits lg' />
        </FormField>

        <FormField
          label='Explicit input size'
          description='Input size wins over FormField size.'
          size='sm'
        >
          <Input size='lg' placeholder='Explicit lg input' />
        </FormField>
      </div>
    </Section>
  ),
};

export const Variants: Story = {
  render: () => (
    <Section title='Variants'>
      <div style={fieldColumnStyle}>
        <Input label='Outline' variant='outline' placeholder='Outline input' />
        <Input label='Filled' variant='filled' placeholder='Filled input' />
        <Input label='Soft' variant='soft' placeholder='Soft input' />
      </div>
    </Section>
  ),
};

export const Colors: Story = {
  render: () => (
    <Section title='Colors'>
      <div style={fieldColumnStyle}>
        <Input label='Primary' color='primary' placeholder='Primary input' />
        <Input label='Neutral' color='neutral' placeholder='Neutral input' />
        <Input label='Success' color='success' placeholder='Success input' />
        <Input label='Warning' color='warning' placeholder='Warning input' />
        <Input label='Danger' color='danger' placeholder='Danger input' />
      </div>
    </Section>
  ),
};

export const ColorVariantMatrix: Story = {
  render: () => (
    <Section title='Color and variant matrix'>
      <div style={matrixStyle}>
        {(['primary', 'neutral', 'success', 'warning', 'danger'] as const).map(
          (color) =>
            (['outline', 'filled', 'soft'] as const).map((variant) => (
              <Input
                key={`${color}-${variant}`}
                label={`${color} ${variant}`}
                color={color}
                variant={variant}
                placeholder='Field value'
              />
            ))
        )}
      </div>
    </Section>
  ),
};

export const FocusStates: Story = {
  render: () => (
    <Section title='Focus states'>
      <div style={matrixStyle}>
        <Input
          label='Primary focus'
          color='primary'
          variant='outline'
          defaultValue='Focused'
          autoFocus
        />
        <Input
          label='Neutral filled'
          color='neutral'
          variant='filled'
          defaultValue='Tab here'
        />
        <Input
          label='Success soft'
          color='success'
          variant='soft'
          defaultValue='Tab here'
        />
        <Input
          label='Warning outline'
          color='warning'
          variant='outline'
          defaultValue='Tab here'
        />
        <Input
          label='Danger filled'
          color='danger'
          variant='filled'
          defaultValue='Tab here'
        />
      </div>
    </Section>
  ),
};

export const Types: Story = {
  render: () => (
    <Section title='Types'>
      <div style={fieldColumnStyle}>
        <Input label='Text' type='text' placeholder='Ada Lovelace' />
        <Input label='Email' type='email' placeholder='name@company.com' />
        <Input label='Password' type='password' placeholder='Password' />
        <Input label='Number' type='number' placeholder='42' />
        <Input label='Phone' type='tel' placeholder='+33 6 00 00 00 00' />
        <Input label='URL' type='url' placeholder='https://vellira.dev' />
        <Input
          label='Search'
          type='search'
          defaultValue='Components'
          clearable
          clearIconTone='default'
          placeholder='Search components'
        />
      </div>
    </Section>
  ),
};

export const Adornments: Story = {
  render: () => (
    <Section title='Adornments'>
      <div style={fieldColumnStyle}>
        <Input
          label='Search'
          defaultValue='Theme'
          startIcon={<Search />}
          startIconTone='primary'
          clearable
          clearIconTone='default'
          placeholder='Search components'
          type='search'
        />

        <Input
          label='Verified email'
          defaultValue='hello@vellira.dev'
          endIcon={<Check size={14} />}
          endIconTone='success'
          placeholder='name@company.com'
          type='email'
        />

        <Input
          label='Search settings'
          startIcon={<Search />}
          endIcon={<Check size={14} />}
          endIconTone='success'
          startIconTone='primary'
          defaultValue='Theme'
        />

        <ClearableInputDemo />
      </div>
    </Section>
  ),
};

export const RightSlotPriority: Story = {
  render: () => (
    <Section title='Right slot priority'>
      <div style={fieldColumnStyle}>
        <Input
          label='Loading wins'
          value='Searching'
          loading
          clearable
          clearIconTone='default'
          endIcon={<Search />}
          placeholder='Loading'
        />

        <Input
          label='Clear wins over reveal and icon'
          value='secret'
          type='password'
          clearable
          clearIconTone='default'
          revealPassword
          endIcon={<Check size={14} />}
        />

        <Input
          label='Reveal wins over icon'
          value=''
          type='password'
          revealPassword
          endIcon={<Check size={14} />}
          placeholder='Password'
        />

        <Input
          label='Icon renders when no action is active'
          value=''
          endIcon={<Check size={14} />}
          endIconTone='success'
          placeholder='Verified value'
        />
      </div>
    </Section>
  ),
};

export const AddonsAndAffixes: Story = {
  render: () => (
    <Section title='Addons and affixes'>
      <div style={fieldColumnStyle}>
        <Input
          label='Domain'
          startAddon='https://'
          endAddon='.com'
          placeholder='vellira'
        />
        <Input label='Handle' prefix='@' placeholder='roman' />
        <Input label='Weight' suffix='kg' type='number' placeholder='72' />
      </div>
    </Section>
  ),
};

export const MasksAndFormatting: Story = {
  render: () => (
    <Section title='Masks and formatting'>
      <div style={fieldColumnStyle}>
        <Input
          label='Phone'
          mask='+33 # ## ## ## ##'
          placeholder='+33 6 00 00 00 00'
          type='tel'
        />
        <Input
          label='Card'
          mask='#### #### #### ####'
          placeholder='4242 4242 4242 4242'
        />
        <Input
          label='Amount'
          value='12000'
          format={(nextValue) =>
            nextValue ? Number(nextValue).toLocaleString('en-US') : ''
          }
          parse={(displayValue) => displayValue.replace(/,/g, '')}
          prefix='$'
        />
      </div>
    </Section>
  ),
};

export const Counter: Story = {
  render: () => (
    <Section title='Counter'>
      <CounterInputDemo />
    </Section>
  ),
};

export const States: Story = {
  render: () => (
    <Section title='States'>
      <div style={fieldColumnStyle}>
        <Input label='Required' required placeholder='Required input' />
        <Input label='Disabled' disabled value='Disabled value' />
        <Input label='Read only' readOnly value='Read only value' />
        <Input
          label='Error'
          value=''
          required
          error='This field is required'
          placeholder='Invalid value'
        />
        <Input label='Invalid' invalid placeholder='Invalid without message' />
        <Input label='Loading' loading value='Syncing value' />

        <FormField
          label='Inherited disabled and invalid'
          description='Input cannot unset field-level state.'
          disabled
          invalid
        >
          <Input
            disabled={false}
            invalid={false}
            placeholder='Inherited state'
          />
        </FormField>
      </div>
    </Section>
  ),
};

export const Validation: Story = {
  render: () => (
    <Section title='Validation'>
      <div style={fieldColumnStyle}>
        <Input
          label='Email'
          type='email'
          required
          error='Enter a valid email address'
          value='wrong-email'
        />

        <Input
          label='Password'
          type='password'
          revealPassword
          required
          error='Password must contain at least 8 characters'
          value=''
        />
      </div>
    </Section>
  ),
};

export const Playground: Story = {
  render: (args) => (
    <Section title='Playground'>
      <ControlledInputDemo {...args} />
    </Section>
  ),
};
