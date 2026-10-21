import { defineComponentPageMetadata } from '../../metadata';

export default defineComponentPageMetadata({
  profile: 'primitive',
  defaults: {
    shared: {
      fallback: 'JD',
      name: 'Jordan Diaz',
      size: 'md',
    },
  },
  catalogPreview: {},
  discovery: {
    status: 'complete',
    summary:
      'Display a person, account, or entity using an image with a named text fallback.',
    description:
      'Avatar presents a compact, accessible identity marker. It shows a deterministic fallback while an image is unavailable or loading.',
    whenToUse: [
      'Use it to identify people, accounts, teams, or other entities in compact interface areas.',
      'Provide a short fallback and a human-readable name for every avatar.',
    ],
    patterns: [
      {
        id: 'identity-image',
        title: 'Identity image',
        description:
          'Use a source when an image is available while retaining initials or a short label as the fallback.',
      },
      {
        id: 'fallback-only',
        title: 'Fallback only',
        description:
          'Use the fallback directly when no image source is available.',
      },
    ],
    platformNotes: {
      react: [
        'The web implementation exposes the avatar as an image role named by the name prop.',
      ],
      'react-native': [
        'The native implementation uses image accessibility semantics and keeps its nested image decorative.',
      ],
    },
  },
  examples: [
    {
      title: 'Fallback avatar',
      description:
        'A named fallback remains visible when an image source is not supplied.',
      props: [],
    },
    {
      title: 'Large avatar',
      description:
        'Use the large size where the identity marker needs more emphasis.',
      props: ["size='lg'"],
    },
  ],
  api: {
    descriptions: {
      fallback:
        'Text shown when no image is available and while the supplied image is loading or has failed.',
      name: 'Human-readable name announced to assistive technologies for the avatar.',
      size: 'Controls the avatar geometry using the small, medium, or large size variant.',
      source:
        'Optional image source. Changing it starts a new image lifecycle and restores the fallback until the new image loads.',
    },
  },
  accessibility: {
    react: [
      {
        title: 'Accessible name',
        description:
          'The avatar exposes an image role with the name prop as its accessible name. Its visual fallback and nested image are not announced separately.',
        props: ['name'],
      },
    ],
    native: [
      {
        title: 'Accessible name',
        description:
          'The native avatar is announced as one image using the name prop. Nested fallback content and the loaded image remain decorative.',
        props: ['name'],
      },
    ],
  },
  related: [],
});
