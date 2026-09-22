import { defineComponentMetadata } from '../defineComponentMetadata';

export const toastMetadata = defineComponentMetadata({
  name: 'Toast',
  layer: 'components',
  category: 'feedback',
  platforms: ['react', 'react-native'],
  profile: 'overlay',
  status: 'beta',
  capabilities: [
    'controlled',
    'uncontrolled',
    'keyboard',
    'focus-management',
    'compound-api',
    'portal',
  ],
  semanticCapabilities: [
    'announcement',
    'auto-dismiss',
    'dismissible',
    'reduced-motion',
    'stacking',
  ],
  dependencies: {
    packages: ['@vellira-ui/icons', '@vellira-ui/types'],
  },
  requirements: {
    tests: true,
    storybook: true,
    docs: true,
    accessibility: true,
    componentTokens: 'standard',
    icons: [
      { name: 'Info', purpose: 'Neutral and informational feedback.' },
      { name: 'Success', purpose: 'Successful action feedback.' },
      { name: 'Warning', purpose: 'Attention-required feedback.' },
      { name: 'Error', purpose: 'Recoverable error feedback.' },
    ],
  },
});
