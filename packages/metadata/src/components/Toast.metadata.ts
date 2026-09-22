import { defineComponentMetadata } from '../defineComponentMetadata';

export const toastMetadata = defineComponentMetadata({
  name: 'Toast',
  layer: 'components',
  category: 'feedback',
  platforms: ['react', 'react-native'],
  profile: 'overlay',
  status: 'experimental',
  capabilities: [
    'controlled',
    'uncontrolled',
    'keyboard',
    'focus-management',
    'compound-api',
    'portal',
  ],
  dependencies: {
    packages: ['@vellira-ui/types'],
  },
  requirements: {
    tests: true,
    storybook: true,
    docs: true,
    accessibility: true,
    componentTokens: 'standard',
  },
});
