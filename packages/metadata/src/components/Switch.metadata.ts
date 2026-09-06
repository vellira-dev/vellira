import { defineComponentMetadata } from '../defineComponentMetadata';

export const switchMetadata = defineComponentMetadata({
  name: 'Switch',
  layer: 'primitives',
  category: 'form',
  platforms: ['react', 'react-native'],
  profile: 'form-control',
  status: 'experimental',
  capabilities: [
    'controlled',
    'uncontrolled',
    'disabled',
    'required',
    'invalid',
  ],
  dependencies: {
    packages: ['@vellira-ui/types'],
  },
  requirements: {
    tests: true,
    storybook: true,
    docs: true,
    accessibility: true,
    componentTokens: 'boolean-control',
  },
});
