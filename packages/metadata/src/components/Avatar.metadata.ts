import { defineComponentMetadata } from '../defineComponentMetadata';

export const avatarMetadata = defineComponentMetadata({
  name: 'Avatar',
  layer: 'primitives',
  category: 'data-display',
  platforms: ['react', 'react-native'],
  profile: 'base',
  status: 'experimental',
  capabilities: [],
  semanticCapabilities: [
    'accessible-name',
    'fallback',
    'image-source',
    'size-variants',
  ],
  requirements: {
    tests: true,
    storybook: true,
    docs: true,
    accessibility: true,
    componentTokens: 'standard',
  },
});
