import { defineComponentMetadata } from '../defineComponentMetadata';

export const checkboxMetadata = defineComponentMetadata({
  name: 'Checkbox',
  layer: 'primitives',
  category: 'form',
  platforms: ['react', 'react-native'],
  profile: 'form-control',
  status: 'stable',
  capabilities: [
    'controlled',
    'uncontrolled',
    'indeterminate',
    'disabled',
    'required',
    'invalid',
  ],
  dependencies: {
    packages: ['@vellira-ui/types', '@vellira-ui/tokens'],
  },
  requirements: {
    tests: true,
    storybook: true,
    docs: true,
    accessibility: true,
  },
});
