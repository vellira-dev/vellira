import { defineComponentMetadata } from '../defineComponentMetadata';

export const accordionMetadata = defineComponentMetadata({
  name: 'Accordion',
  layer: 'components',
  category: 'navigation',
  platforms: ['react', 'react-native'],
  profile: 'compound',
  status: 'experimental',
  capabilities: [
    'compound-api',
    'controlled',
    'uncontrolled',
    'disabled',
    'keyboard',
  ],
  dependencies: {
    packages: ['@vellira-ui/types'],
  },
  requirements: {
    tests: true,
    storybook: true,
    docs: true,
    accessibility: true,
    componentTokens: 'disclosure',
    icons: [
      {
        name: 'ChevronDown',
        purpose: 'disclosure indicator',
      },
    ],
  },
});
