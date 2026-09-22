import { useMemo } from 'react';

import type { Meta, StoryObj } from '@storybook/react-native';
import { Pressable, Text as NativeText, View } from 'react-native';

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

Use Toast for transient, non-blocking feedback. Mount one provider and viewport near the application root; the viewport participates in Vellira's native overlay manager without reproducing DOM portal behavior.

Messages use native accessibility announcements, labelled 44-point controls, deterministic timeout and stacking behavior, and reduced-motion-safe transitions. Use inline feedback when the message must remain visible and persistent screen content for notification history.
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
    <View style={{ gap: 12 }}>
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
    </View>
  ),
};

function ApplicationHostExample() {
  const store = useMemo(() => createToastStore({ maxVisible: 3 }), []);

  return (
    <Toast.Provider store={store}>
      <Pressable
        accessibilityRole='button'
        onPress={() =>
          store.show({
            title: 'Message archived',
            tone: 'info',
            dedupeKey: 'archive',
            action: { label: 'Undo' },
          })
        }
        style={{ minHeight: 44, padding: 12 }}
      >
        <NativeText>Show toast</NativeText>
      </Pressable>
      <Toast.Viewport />
    </Toast.Provider>
  );
}

export const ApplicationHost: Story = {
  render: () => <ApplicationHostExample />,
};
