import { useMemo } from 'react';

import type { Meta, StoryObj } from '@storybook/react-vite';

import { createToastStore } from './internal/store';
import { Toast } from './Toast';

const meta: Meta<typeof Toast> = {
  title: 'Components/Toast',
  component: Toast,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component: `
### Toast

Use Toast for transient, non-blocking application feedback. Mount one provider and viewport near the application root; the viewport uses Vellira's canonical toast overlay level and does not move focus.

Messages auto-dismiss after a deterministic duration, can be dismissed manually, and are bounded to three visible entries by default. Matching \`dedupeKey\` values replace in place. Prefer inline or FormField feedback when a message must remain beside a control, and persistent application content for notification history.
`,
      },
    },
  },
};

export default meta;

type Story = StoryObj<typeof Toast>;

export const Default: Story = {
  args: {
    title: 'Changes saved',
    description: 'Your preferences are up to date.',
    tone: 'success',
    duration: 0,
  },
};

export const Controlled: Story = {
  args: {
    open: true,
    onOpenChange: () => undefined,
    title: 'Controlled toast',
    duration: 0,
  },
};

export const Uncontrolled: Story = {
  args: {
    defaultOpen: true,
    title: 'Uncontrolled toast',
    duration: 0,
  },
};

export const SemanticTones: Story = {
  render: () => (
    <div style={{ display: 'grid', gap: 12 }}>
      <Toast duration={0} dismissible={false} title='Neutral update' />
      <Toast
        duration={0}
        dismissible={false}
        tone='info'
        title='Sync started'
      />
      <Toast duration={0} dismissible={false} tone='success' title='Saved' />
      <Toast
        duration={0}
        dismissible={false}
        tone='warning'
        title='Storage almost full'
      />
      <Toast
        duration={0}
        dismissible={false}
        tone='error'
        title='Upload failed'
      />
    </div>
  ),
};

function ApplicationHostExample() {
  const store = useMemo(() => createToastStore({ maxVisible: 3 }), []);

  return (
    <Toast.Provider store={store}>
      <button
        type='button'
        onClick={() =>
          store.show({
            title: 'Message archived',
            tone: 'info',
            dedupeKey: 'archive',
            action: { label: 'Undo' },
          })
        }
      >
        Show toast
      </button>
      <Toast.Viewport />
    </Toast.Provider>
  );
}

export const ApplicationHost: Story = {
  render: () => <ApplicationHostExample />,
};
