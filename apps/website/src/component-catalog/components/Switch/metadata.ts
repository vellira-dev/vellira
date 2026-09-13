import { defineComponentPageMetadata } from '../../metadata';

export default defineComponentPageMetadata({
  profile: 'form-control',
  demo: {
    staticProps: {
      accessibilityLabel: "'Switch'",
    },
  },
  examples: [
    {
      title: 'Basic',
      description: 'Basic component usage.',
      props: [],
    },
    {
      title: 'Controlled',
      description: 'State controlled by the parent application.',
      props: ['checked'],
    },
    {
      title: 'Uncontrolled',
      description: 'State initialized and then managed by the component.',
      props: ['defaultChecked'],
    },
    {
      title: 'Disabled',
      description: 'Disabled state with interaction unavailable.',
      props: ['disabled'],
    },
    {
      title: 'Required',
      description: 'Required state for form participation.',
      props: ['required'],
    },
    {
      title: 'Invalid',
      description: 'Invalid state with validation semantics.',
      props: ['invalid'],
    },
  ],
  related: ['checkbox', 'radio', 'form-field'],
});
